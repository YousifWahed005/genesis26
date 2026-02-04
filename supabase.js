import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.6/+esm";

// TODO: replace with your Supabase project URL + anon key
const supabaseUrl = "https://yvjrivunwdgkrmugmbpp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2anJpdnVud2Rna3JtdWdtYnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzA5MzEsImV4cCI6MjA4NTY0NjkzMX0.XEu9pACV5TNt5HaBpaHIGRMcp4SbM9Xdno-_I_G8UvI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
