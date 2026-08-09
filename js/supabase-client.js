// supabase-client.js
// Fill these in from your Supabase project (Settings -> API). Safe to keep
// public — the anon key only works within the RLS policies from schema.sql.
const SUPABASE_URL = 'https://wvkplejlzqmyjhxksksz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2a3BsZWpsenFteWpoeGtza3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMDY3NTMsImV4cCI6MjEwMTg4Mjc1M30.oOSHVE9KI6_J0ha50tZ447-5mmtRrCInVbLRZfsSClo';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sb = sb;
