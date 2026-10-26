// Supabase settings for the online scoreboard and certificate check.
// Project "LureLens" in the Supabase organization "Th3 SpaceIO".
// Both values are public by design: every visitor's browser uses them, and the
// database only lets them call the functions in supabase/schema.sql.
// Never put the secret or service_role key here.
// VITE_SUPABASE_URL / VITE_SUPABASE_KEY at build time override these
// (set both to empty strings to build without online features).
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://rxyhvpdbfuboukqgbych.supabase.co';
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_v58sr6nGSPrgvUHMP8HVyw_SADkXbTk';
