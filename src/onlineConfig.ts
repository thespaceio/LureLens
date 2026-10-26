// Supabase settings for the online scoreboard and certificate check.
// Both values are public by design: every visitor's browser uses them, and the
// database only lets them call the functions in supabase/schema.sql.
// Leave them empty to run LureLens without any online features.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? '';
