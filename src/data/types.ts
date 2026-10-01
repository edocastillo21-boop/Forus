// Tipos de datos de Forus. Los nombres de campos coinciden 1:1 con las columnas en Supabase.

export type Sex = 'm' | 'f';
export type Goal = 'volumen' | 'definicion' | 'recomposicion' | 'mantencion';
export type Activity = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy_activo';
export type Level = 'principiante' | 'intermedio' | 'avanzado';
export type Diet = 'omnivora' | 'vegetariana' | 'vegana';
export type Budget = 'bajo' | 'medio' | 'alto';

export interface Base {
  id: string;
  user_id: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MealSlot { id: string; name: string; time: string }

export interface Prefs {
  theme?: 'dark' | 'light';
  bar?: number;
  plates?: number[];
  meals?: MealSlot[];
  favorites?: string[];
  waterGoal?: number;
}

export interface Profile extends Base {
  name: string;
  sex: Sex;
  birth_date: string;
  height_cm: number;
  activity: Activity;
  experience: Level;
  goal: Goal;
  diet: Diet;
  meals_per_day: number;
  budget: Budget;
  training_days: number[];
  session_min: number;
  training_time: string;
  equipment: string[];
  dislikes: string[];
  allergies: string;
  timezone: string;
  prefs: Prefs;
  consent_at: string | null;
  onboarded_at: string | null;
}

export interface Phase extends Base {
  type: Goal;
  start_date: string;
  end_date: string | null;
  rate_kg_week: number;
  start_weight: number;
  goal_weight: number | null;
  bmr: number;
  tdee: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  protein_per_kg: number;
  fat_pct: number;
  activity_factor: number;
  training_kcal: number;
  cycling: boolean;
  status: 'activa' | 'terminada';
  notes: string | null;
}

/** C = calentamiento, E = efectiva, D = drop set, RP = rest-pause */
export type SetType = 'C' | 'E' | 'D' | 'RP';

export interface SetPlan {
  type: SetType;
  repsMin: number;
  repsMax: number;
  rir: number | null;
  kg?: number | null;
}

export interface RoutineExercise {
  uid: string;
  exId: string;
  /** Ejercicios consecutivos con la misma letra forman una superserie (A1, A2…) */
  group?: string | null;
  rest: number;
  note?: string;
  sets: SetPlan[];
}

export interface RoutineDay { id: string; name: string; exercises: RoutineExercise[] }

export interface Routine extends Base {
  name: string;
  split: string;
  level: string | null;
  days: RoutineDay[];
  notes: string | null;
}

export interface Mesocycle extends Base {
  routine_id: string;
  name: string;
  start_date: string;
  weeks: number;
  deload_week: number | null;
  /** RIR objetivo por semana (índice 0 = semana 1) */
  rir_plan: number[];
  /** día de la semana (0 = lunes … 6 = domingo) → índice del día de la rutina */
  schedule: Record<string, number>;
  status: 'activo' | 'terminado';
}

export interface SetLog {
  type: SetType;
  kg: number | null;
  reps: number | null;
  rir: number | null;
  done: boolean;
  failed?: boolean;
  target?: { kg: number | null; repsMin: number; repsMax: number; rir: number | null };
}

export interface SessionExercise {
  uid: string;
  exId: string;
  group?: string | null;
  rest: number;
  /** Sugerencia de progresión calculada al crear la sesión */
  note?: string;
  /** Nota propia (la de la rutina o la que se escribe en la sesión) */
  memo?: string;
  replacedFrom?: string;
  sets: SetLog[];
}

export interface PR { exId: string; e1rm: number; prev: number | null; kg: number; reps: number }

export interface WorkoutSession extends Base {
  date: string;
  routine_id: string | null;
  mesocycle_id: string | null;
  day_index: number | null;
  day_name: string;
  week: number | null;
  started_at: string;
  ended_at: string | null;
  status: 'en_curso' | 'terminada' | 'descartada';
  bodyweight: number | null;
  notes: string | null;
  exercises: SessionExercise[];
  volume_kg: number;
  sets_done: number;
  prs: PR[];
}

export interface CustomFood extends Base {
  name: string;
  brand: string | null;
  barcode: string | null;
  group_code: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  portions: [string, number][];
}

export interface FoodLog extends Base {
  date: string;
  meal: string;
  food_ref: string;
  name: string;
  grams: number;
  portion: string | null;
  qty: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  source: string;
  created_at: string;
}

export interface SavedMealItem { food_ref: string; name: string; grams: number; portion: string | null; qty: number | null }
export interface SavedMeal extends Base { name: string; items: SavedMealItem[] }

export interface DayLog extends Base { date: string; water_ml: number; note: string | null }

export interface BodyWeight extends Base { date: string; weight_kg: number; body_fat: number | null }

export interface TableMap {
  profiles: Profile;
  phases: Phase;
  routines: Routine;
  mesocycles: Mesocycle;
  workout_sessions: WorkoutSession;
  foods: CustomFood;
  food_log_entries: FoodLog;
  saved_meals: SavedMeal;
  day_logs: DayLog;
  body_weights: BodyWeight;
}
export type TableName = keyof TableMap;
export const TABLES: TableName[] = ['profiles', 'phases', 'routines', 'mesocycles', 'workout_sessions', 'foods', 'food_log_entries', 'saved_meals', 'day_logs', 'body_weights'];
