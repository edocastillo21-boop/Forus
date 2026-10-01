// Qué toca hoy: fase, mesociclo, día de rutina y sesiones del día.
import { useMemo } from 'react';
import { useMesocycles, usePhases, useRoutine, useSessions, useWeights } from './hooks';
import { activeMeso, currentPhase } from './logic';
import { plannedFor } from '../core/schedule';
import { latestWeight } from './actions';

export function useTodayPlan(today: string) {
  const phases = usePhases();
  const mesos = useMesocycles();
  const sessions = useSessions();
  const weights = useWeights();
  const meso = activeMeso(mesos);
  const routine = useRoutine(meso?.routine_id);
  return useMemo(() => {
    const planned = plannedFor(meso, today);
    const day = routine && planned ? routine.days[planned.dayIndex] ?? null : null;
    const active = sessions.filter((s) => s.status === 'en_curso').sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
    const doneToday = sessions.filter((s) => s.status === 'terminada' && s.date === today).sort((a, b) => b.started_at.localeCompare(a.started_at));
    return {
      phase: currentPhase(phases, today), phases, mesos, meso, routine: routine ?? null, planned, day, sessions, active, doneToday,
      weights, weight: latestWeight(weights),
    };
  }, [phases, mesos, meso, routine, sessions, weights, today]);
}

export type TodayPlan = ReturnType<typeof useTodayPlan>;
