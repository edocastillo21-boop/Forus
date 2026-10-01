// Consultas reactivas a la base local: la interfaz se actualiza sola cuando cambian los datos.
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb, getUid } from './store';
import type { BodyMeasurement, BodyWeight, CustomFood, DayLog, FoodLog, Mesocycle, Phase, Profile, ProgressPhoto, Routine, SavedMeal, WeeklyCheckin, WorkoutSession } from './types';

const live = <T>(r: T[]) => r.filter((x) => !(x as { deleted_at?: string | null }).deleted_at);

export function useProfile(): Profile | null | undefined {
  // undefined = cargando, null = sin perfil
  return useLiveQuery(async () => (await getDb().profiles.get(getUid())) ?? null, [], undefined);
}
export const usePhases = () => useLiveQuery(async () => live(await getDb().phases.toArray()), [], [] as Phase[]);
export const useMesocycles = () => useLiveQuery(async () => live(await getDb().mesocycles.toArray()), [], [] as Mesocycle[]);
export const useRoutines = () => useLiveQuery(async () => live(await getDb().routines.toArray()).sort((a, b) => a.name.localeCompare(b.name)), [], [] as Routine[]);
export const useRoutine = (id: string | null | undefined) => useLiveQuery(async () => (id ? (await getDb().routines.get(id)) ?? null : null), [id], undefined as Routine | null | undefined);
export const useSessions = () => useLiveQuery(async () => live(await getDb().workout_sessions.toArray()), [], [] as WorkoutSession[]);
export const useSession = (id: string | undefined) => useLiveQuery(async () => (id ? (await getDb().workout_sessions.get(id)) ?? null : null), [id], undefined as WorkoutSession | null | undefined);
export const useFoodLogs = (date: string) => useLiveQuery(async () => live(await getDb().food_log_entries.where('date').equals(date).toArray()).sort((a, b) => a.created_at.localeCompare(b.created_at)), [date], [] as FoodLog[]);
export const useFoodLogsRange = (from: string, to: string) => useLiveQuery(async () => live(await getDb().food_log_entries.where('date').between(from, to, true, true).toArray()), [from, to], [] as FoodLog[]);
export const useRecentFoodLogs = (limit = 400) => useLiveQuery(async () => live(await getDb().food_log_entries.orderBy('date').reverse().limit(limit).toArray()), [limit], [] as FoodLog[]);
export const useCustomFoods = () => useLiveQuery(async () => live(await getDb().foods.toArray()), [], [] as CustomFood[]);
export const useSavedMeals = () => useLiveQuery(async () => live(await getDb().saved_meals.toArray()), [], [] as SavedMeal[]);
export const useDayLog = (date: string) => useLiveQuery(async () => (await getDb().day_logs.get(`${getUid()}:${date}`)) ?? null, [date], null as DayLog | null);
export const useWeights = () => useLiveQuery(async () => live(await getDb().body_weights.toArray()).sort((a, b) => a.date.localeCompare(b.date)), [], [] as BodyWeight[]);
export const useMeasurements = () => useLiveQuery(async () => live(await getDb().body_measurements.toArray()).sort((a, b) => a.date.localeCompare(b.date)), [], [] as BodyMeasurement[]);
export const usePhotos = () => useLiveQuery(async () => live(await getDb().progress_photos.toArray()).sort((a, b) => b.date.localeCompare(a.date) || a.pose.localeCompare(b.pose)), [], [] as ProgressPhoto[]);
export const useCheckin = (anchor: string) => useLiveQuery(async () => (await getDb().weekly_checkins.get(`${getUid()}:${anchor}`)) ?? null, [anchor], undefined as WeeklyCheckin | null | undefined);
