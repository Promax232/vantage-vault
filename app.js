const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const morgan = require('morgan');
const path = require('path');

const app = express();

// --- 1. SYSTEM INTEGRITY CHECK ---
const REQUIRED_KEYS = ['MONGO_URI', 'GROQ_API_KEY', 'TAVILY_API_KEY'];
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

// --- 5. VAULT UPLINK (MongoDB) ---
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

// --- 6. UNIFIED HUD REDIRECT ---
// This ensures that even if you visit /intelligence-core, it sends you to the HUD
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/intelligence-core', (req, res) => {
    res.redirect('/');
});

// --- 7. FAILSAFE HANDLERS ---
app.use((req, res) => {
    // Sir, if a route is missing, we bring them back to the HUD instead of showing a 404
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