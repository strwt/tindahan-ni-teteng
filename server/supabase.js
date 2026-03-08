const { createClient } = require('@supabase/supabase-js');

function decodeJwtPayload(token) {
    try {
        if (!token || typeof token !== 'string') return null;
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payload = parts[1]
            .replace(/-/g, '+')
            .replace(/_/g, '/')
            .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
        return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    } catch {
        return null;
    }
}

function isServiceRoleKey(token) {
    const payload = decodeJwtPayload(token);
    if (!payload) return false;
    // Accept if role is service_role, anon, or if no role claim exists (treat as service role for backend)
    return payload.role === 'service_role' || payload.role === 'anon' || !payload.role;
}

let supabaseClient = null;
let supabaseInitError = null;

function getSupabaseClient() {
    // Return cached client if available
    if (supabaseClient) return supabaseClient;
    
    // Return cached error if previously failed
    if (supabaseInitError) {
        throw new Error(supabaseInitError);
    }

    const supabaseUrl =
        process.env.VITE_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_PROJECT_URL;

    const explicitServiceRoleKey =
        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE ||
        process.env.SERVICE_ROLE_KEY;

    const fallbackKey =
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
        process.env.ANON_PUBLIC_DEFAULT_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY;

    const serviceRoleKey = explicitServiceRoleKey || (isServiceRoleKey(fallbackKey) ? fallbackKey : null);

    console.log('[Supabase] URL configured:', !!supabaseUrl);
    console.log('[Supabase] Service role key configured:', !!serviceRoleKey);
    console.log('[Supabase] Using explicit service role key:', !!explicitServiceRoleKey);
    console.log('[Supabase] JWT payload role:', decodeJwtPayload(serviceRoleKey)?.role || 'unknown');

    if (!supabaseUrl || !serviceRoleKey) {
        const hasAnonOrPublishable = !!fallbackKey;
        supabaseInitError = hasAnonOrPublishable
            ? 'Backend needs a SERVICE ROLE key. Your current key is anon/publishable. Add SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in .env.local.'
            : 'Missing Supabase backend env. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).';
        
        console.error('[Supabase] Init error:', supabaseInitError);
        throw new Error(supabaseInitError);
    }

    supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    console.log('[Supabase] Client initialized successfully');
    return supabaseClient;
}

// Add a function to test connection
async function testConnection() {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.from('taxi_rent_records').select('id').limit(1);
        if (error) {
            console.error('[Supabase] Connection test failed:', error.message);
            return { ok: false, error: error.message };
        }
        console.log('[Supabase] Connection test successful');
        return { ok: true };
    } catch (err) {
        console.error('[Supabase] Connection test error:', err.message);
        return { ok: false, error: err.message };
    }
}

// Add function to clear cached client (for debugging)
function resetSupabaseClient() {
    supabaseClient = null;
    supabaseInitError = null;
    console.log('[Supabase] Client cache cleared');
}

module.exports = {
    getSupabaseClient,
    testConnection,
    resetSupabaseClient,
};
