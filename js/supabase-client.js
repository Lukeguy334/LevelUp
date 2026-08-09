// supabase-client.js
// Fill these in from your Supabase project (Settings -> API). Safe to keep
// public — the anon key only works within the RLS policies from schema.sql.
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sb = sb;
