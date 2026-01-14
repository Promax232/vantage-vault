const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const morgan = require('morgan');
const path = require('path');

const app = express();

// --- 1. SYSTEM INTEGRITY CHECK (Critical Orphans) ---
const REQUIRED_ORPHANS = ['MONGO_URI', 'GROQ_API_KEY'];
REQUIRED_ORPHANS.forEach(key => {
    if (!process.env[key]) {
        console.error(`❌ CRITICAL FAILURE: ${key} missing. Shutting down.`);
        process.exit(1);
    }
});

// --- 2. MIDDLEWARE STACK ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- 3. PWA SERVICE WORKER & MANIFEST ---
// Serve manifest and service worker for PWA support
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'public', 'manifest.json')));
app.get('/service-worker.js', (req, res) => res.sendFile(path.join(__dirname, 'public', 'service-worker.js')));

// --- 4. MISSION-CRITICAL ROUTES ---
app.use('/', require('./routes/pages/intelligenceCorePage'));
app.use('/', require('./routes/pages/vantagePage'));
app.use('/api', require('./routes/api/vantageAI'));

// --- 5. VAULT UPLINK (MongoDB with Auto-Reconnection) ---
const connectVault = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000
        });
        console.log("✅ Vault Uplink Established (MongoDB)");
    } catch (err) {
        console.error("❌ Vault Connection Error. Retrying in 5s...", err.message);
        setTimeout(connectVault, 5000);
    }
};
connectVault();

// --- 6. ARCHITECT'S DEFAULT REDIRECT ---
app.get('/', (req, res) => res.redirect('/intelligence-core'));

// --- 7. GLOBAL ERROR HANDLING (Failsafe) ---
// 404 Handler
app.use((req, res) => {
    res.status(404).send("<h2>404: Node Unreachable in this Sector</h2>");
});

// 500 Centralized Error Handler
app.use((err, req, res, next) => {
    console.error("⚠️ SYSTEM EXCEPTION:", err.stack);
    res.status(500).json({
        status: "Core Error",
        message: process.env.NODE_ENV === 'production' ? "Internal Core Error" : err.message
    });
});

// --- 8. POWER ON ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 JARVIS OS ONLINE`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`🧠 ARCHITECT MODE: Tony Stark Activated\n`);
});
