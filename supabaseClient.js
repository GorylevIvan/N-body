import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const SUPABASE_URL = "https://gxfttbffheesltpkzdzy.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4ZnR0YmZmaGVlc2x0cGt6ZHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDQwODcsImV4cCI6MjA5MzgyMDA4N30.RWxAtlJqJIAi_TADw4YFwLb9T4q_GvDLP5iJ-PNDXjY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
