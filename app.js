const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const morgan = require('morgan');
const path = require('path');

const app = express();

// --- 1. SYSTEM INTEGRITY CHECK (Updated for Mark II Memory) ---
// Sir, we now verify Upstash credentials on startup to prevent memory failures.
const REQUIRED_KEYS = [
    'MONGO_URI', 
    'GROQ_API_KEY', 
    'TAVILY_API_KEY',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN'
];

REQUIRED_KEYS.forEach(key => {
    if (!process.env[key]) {
        console.error(`❌ CRITICAL FAILURE: ${key} missing. JARVIS cannot initialize.`);
        process.exit(1);
    }
});

// --- 2. MIDDLEWARE STACK ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static sector: Serve everything in public
app.use(express.static(path.join(__dirname, 'public')));

// --- 3. PWA & CORE ASSETS ---
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'public', 'manifest.json')));
app.get('/service-worker.js', (req, res) => res.sendFile(path.join(__dirname, 'public', 'service-worker.js')));

// --- 4. API GATEWAY ---
const jarvisRoutes = require('./routes/api/jarvis');
app.use('/api/jarvis', jarvisRoutes);

// --- 5. VAULT UPLINK (MongoDB - Long Term Storage) ---
const connectVault = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Vault Uplink Established (MongoDB)");
    } catch (err) {
        console.error("❌ Vault Connection Error. Retrying in 5s...", err.message);
        setTimeout(connectVault, 5000);
    }
};
connectVault();

// Note: Upstash (Short Term Memory) is Serverless. 
// It does not require a 'connect' function here. 
// It is initialized on-demand in 'utils/memoryBank.js'.

// --- 6. UNIFIED HUD REDIRECT ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/intelligence-core', (req, res) => {
    res.redirect('/');
});

// --- 7. FAILSAFE HANDLERS ---
app.use((req, res) => {
    res.redirect('/');
});

app.use((err, req, res, next) => {
    console.error("⚠️ SYSTEM EXCEPTION:", err.stack);
    res.status(500).json({ status: "Core Error", message: "Internal Neural Failure." });
});

// --- 8. POWER ON ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 JARVIS OS ONLINE`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`🧠 ARCHITECT MODE: High-Agency Engineer Activated\n`);
});