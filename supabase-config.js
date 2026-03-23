// ============================================================
// supabase-config.js — Supabase client initialization
// ============================================================

const SUPABASE_URL = 'https://xblsoprouwrdjfdjixia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhibHNvcHJvdXdyZGpmZGppeGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTA0MTcsImV4cCI6MjA4ODc2NjQxN30.4ZHfVUe8a-HcLB8JS1ZNB1ys-DeasMB34wT8WiDHTtg';

// (Las contraseñas ya no se guardan en el código por seguridad)

// Initialize Supabase client with error protection
let supabaseClient = null;
window.supabaseApp = null; // We'll export it so other scripts can use it
try {
    if (window.supabase && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabaseApp = supabaseClient;
        console.log('Supabase client initialized successfully:', !!supabaseClient);
    } else {
        console.error('Supabase JS library not loaded. Check your internet connection.');
    }
} catch (err) {
    console.error('Error initializing Supabase client:', err.message);
}
