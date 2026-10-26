// Public connection details for the farm's Supabase project.
// These are NOT secrets: every visitor's browser receives them, and the database's
// Row Level Security decides what each user may see. Environment variables
// (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY) override them, e.g. for a test project.
// Never put the secret / service_role key here.
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL || 'https://eozzivvksyhuhwidoobj.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_G0a-paziIqBHtpm8jY2URQ_RmS8m7XQ'
