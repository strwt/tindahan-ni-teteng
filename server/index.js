const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();
const express = require('express');
const cors = require('cors');
const { getSupabaseClient, testConnection } = require('./supabase');
const { COLLECTION_KEYS, getCollection, setCollection } = require('./entityStore');

const app = express();
const PORT = Number(process.env.PORT || 4000);
const ALLOWED_COLLECTIONS = new Set(COLLECTION_KEYS);

app.use(cors({
    origin: (origin, callback) => {
        const configured = (process.env.ALLOWED_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);

        // Allow null origin (file:// protocol, Postman, etc.)
        if (!origin) {
            console.log('[CORS] Allowing null origin (local file or tool)');
            return callback(null, true);
        }
        
        console.log('[CORS] Request from origin:', origin);
        console.log('[CORS] Configured origins:', configured);
        
        if (configured.includes(origin)) {
            console.log('[CORS] Allowing request');
            return callback(null, true);
        }
        
        // Allow all origins for development
        console.log('[CORS] Allowing all origins (development mode)');
        return callback(null, true);
    },
}));
app.use(express.json({ limit: '2mb' }));

app.get('/health', async (_req, res) => {
    let supabaseConfigured = true;
    let supabaseMessage = 'ok';
    let connectionTest = null;
    
    try {
        getSupabaseClient();
    } catch (error) {
        supabaseConfigured = false;
        supabaseMessage = error.message;
    }

    // Test actual connection if configured
    if (supabaseConfigured) {
        connectionTest = await testConnection();
    }

    res.json({
        ok: true,
        service: 'project-backend',
        supabaseConfigured,
        supabaseMessage,
        connectionTest,
    });
});

app.get('/api/collections', async (_req, res) => {
    try {
        const supabase = getSupabaseClient();
        const items = [];
        for (const name of COLLECTION_KEYS) {
            const result = await getCollection(supabase, name);
            items.push({
                name,
                data: result.data || [],
                updatedAt: result.updatedAt || null,
            });
        }

        return res.json({
            items,
        });
    } catch (error) {
        console.error('[GET /api/collections]', error);
        return res.status(500).json({ error: error.message });
    }
});

app.get('/api/collections/:name', async (req, res) => {
    const { name } = req.params;
    if (!ALLOWED_COLLECTIONS.has(name)) {
        return res.status(400).json({ error: `Unsupported collection: ${name}` });
    }

    try {
        const supabase = getSupabaseClient();
        const result = await getCollection(supabase, name);

        return res.json({
            name,
            data: result.data || [],
            updatedAt: result.updatedAt || null,
        });
    } catch (error) {
        console.error(`[GET /api/collections/${name}]`, error);
        return res.status(500).json({ error: error.message });
    }
});

app.put('/api/collections/:name', async (req, res) => {
    const { name } = req.params;
    if (!ALLOWED_COLLECTIONS.has(name)) {
        return res.status(400).json({ error: `Unsupported collection: ${name}` });
    }

    const payload = req.body?.data;
    if (!Array.isArray(payload)) {
        return res.status(400).json({ error: 'Request body must be { data: [] }' });
    }

    try {
        const supabase = getSupabaseClient();
        const result = await setCollection(supabase, name, payload);

        return res.json({
            name,
            data: result.data || [],
            updatedAt: result.updatedAt || null,
        });
    } catch (error) {
        console.error(`[PUT /api/collections/${name}]`, error);
        return res.status(500).json({ error: error.message });
    }
});

app.post('/api/sync', async (req, res) => {
    const entries = Object.entries(req.body || {}).filter(([name, data]) => ALLOWED_COLLECTIONS.has(name) && Array.isArray(data));
    if (entries.length === 0) {
        return res.status(400).json({ error: 'No valid collections to sync.' });
    }

    try {
        const supabase = getSupabaseClient();
        const synced = [];
        for (const [name, data] of entries) {
            const result = await setCollection(supabase, name, data);
            synced.push({ name, updatedAt: result.updatedAt || null });
        }
        return res.json({ synced });
    } catch (error) {
        console.error('[POST /api/sync]', error);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
