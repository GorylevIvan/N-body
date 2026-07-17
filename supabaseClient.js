import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const SUPABASE_URL = "https://ffdklgcdpwdxbqyvcppc.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZGtsZ2NkcHdkeGJxeXZjcHBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyOTIxNjYsImV4cCI6MjA5OTg2ODE2Nn0.F5UII7Z7p8H_Yy9fBwLGf3DmhCqkPD9NDv7hZpJ302A";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
