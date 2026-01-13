const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const morgan = require('morgan');
const path = require('path');

const app = express();

// --- 1. SYSTEM INTEGRITY CHECK (Strict Validation) ---
// Ensuring the Architect's environment is fully provisioned before ignition.
const REQUIRED_ORPHANS = ['MONGO_URI', 'GROQ_API_KEY'];
REQUIRED_ORPHANS.forEach(key => {
    if (!process.env[key]) {
        console.error(`❌ CRITICAL FAILURE: ${key} is missing. System shutdown.`);
        process.exit(1); 
    }
});

// --- 2. MIDDLEWARE STACK ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); 
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- 3. MISSION-CRITICAL ROUTES ---
// Intelligence Core & Interface Controllers
app.use('/', require('./routes/pages/intelligenceCorePage'));
app.use('/', require('./routes/pages/vantagePage'));
app.use('/api', require('./routes/api/vantageAI'));

// --- 4. VAULT UPLINK (MongoDB with Auto-Reconnection) ---
// Establishing long-term memory with high-availability settings.
const connectVault = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000 // Fail fast if the vault is unreachable
        });
        console.log("✅ Vault Uplink Established (MongoDB)");
    } catch (err) {
        console.error("❌ Vault Connection Error. Retrying in 5s...", err.message);
        setTimeout(connectVault, 5000); // Resilience: Re-attempt connection
    }
};
connectVault();

// --- 5. ARCHITECT'S DEFAULT REDIRECT ---
app.get('/', (req, res) => res.redirect('/intelligence-core'));

// --- 6. GLOBAL ERROR HANDLING (The Failsafe) ---
// 404 Handler for rogue requests
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

// --- 7. POWER ON ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 JARVIS OS ONLINE`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`🧠 ARCHITECT: Tony Stark Mode Active\n`);
});