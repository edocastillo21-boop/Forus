// Base de datos local (IndexedDB vía Dexie). Una base por usuario, así dos personas
// en el mismo teléfono nunca mezclan sus datos.
import Dexie, { type Table } from 'dexie';
import type { BodyWeight, CustomFood, DayLog, FoodLog, Mesocycle, Phase, Profile, Routine, SavedMeal, WorkoutSession } from './types';

export interface OutboxEntry { seq?: number; table: string; id: string }
export interface Meta { key: string; value: unknown }

export class ForusDB extends Dexie {
  profiles!: Table<Profile, string>;
  phases!: Table<Phase, string>;
  routines!: Table<Routine, string>;
  mesocycles!: Table<Mesocycle, string>;
  workout_sessions!: Table<WorkoutSession, string>;
  foods!: Table<CustomFood, string>;
  food_log_entries!: Table<FoodLog, string>;
  saved_meals!: Table<SavedMeal, string>;
  day_logs!: Table<DayLog, string>;
  body_weights!: Table<BodyWeight, string>;
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<Meta, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      profiles: 'id',
      phases: 'id, start_date',
      routines: 'id',
      mesocycles: 'id, start_date',
      workout_sessions: 'id, date, status',
      foods: 'id',
      food_log_entries: 'id, date',
      saved_meals: 'id',
      day_logs: 'id, date',
      body_weights: 'id, date',
      outbox: '++seq, table',
      meta: 'key',
    });
  }
}
