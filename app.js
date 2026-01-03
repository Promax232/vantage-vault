const express = require('express');
const axios = require('axios');
require('dotenv').config();
const mongoose = require('mongoose');
const Groq = require("groq-sdk");
const NodeCache = require('node-cache');
const morgan = require('morgan');
const path = require('path');
const cors = require('cors'); // Add CORS support

// Route imports
const vantageAIRouter = require('./routes/vantage-ai'); // Make sure this path is correct

const { HUD_STYLE, NAV_COMPONENT, VOICE_SCRIPT } = require('./ui/layout');
const { Show, getWatchlist, saveWatchlist } = require('./db/index');
const { getSeasonProgress } = require('./utils/seasonUtils');

const app = express();

// --- ENV CHECK ---
const requiredEnvVars = ['MONGO_URI', 'GROQ_API_KEY'];
requiredEnvVars.forEach(key => {
    if (!process.env[key]) {
        console.warn(`⚠️ Warning: ${key} is not set! Some features may not work.`);
    }
});

// Enhanced middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev')); // dev logging
app.use('/public', express.static(path.join(__dirname, 'public'))); // static assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // if you have uploads

// Cache & API keys
const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const PORT = process.env.PORT || 3000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- ROUTE MOUNTING ---
// IMPORTANT: Mount vantageAI routes BEFORE page routes to avoid conflicts
app.use('/api', vantageAIRouter); // This should handle /api/vantage-chat/:id

// Page routes
app.use('/', require('./routes/pages/watchlistPage'));
app.use('/', require('./routes/pages/planToWatchPage'));
app.use('/', require('./routes/pages/hallOfFamePage'));
app.use('/', require('./routes/pages/showPage'));
app.use('/', require('./routes/pages/intelligenceCorePage'));
app.use('/', require('./routes/pages/vantagePage'));
app.use('/', require('./routes/vantage')); // This contains /vantage-data and /anime-detail/:id

// API routes
app.use('/api/search', require('./routes/search'));
app.use('/api', require('./routes/vantage')); // Make sure this doesn't conflict
app.use('/api/watchlist', require('./routes/watchlist'));

// --- Health Check ---
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'Vantage OS',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        routes: {
            vantage: '/vantage',
            vantage_ai: '/api/vantage-chat/:id',
            watchlist: '/watchlist',
            search: '/api/search'
        }
    });
});

// --- Manifest ---
app.get('/manifest.json', (req, res) => {
    res.json({
        name: "Vantage Vault",
        short_name: "Vantage",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#05070a",
        theme_color: "#00d4ff",
        icons: [{
            src: "https://cdn-icons-png.flaticon.com/512/8669/8669741.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
        }]
    });
});

// Service Worker (if you want PWA)
app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/sw.js'));
});

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vantage')
    .then(() => console.log("✅ Vault Uplink Established (MongoDB)"))
    .catch(err => {
        console.error("❌ Vault Connection Error:", err.message);
        console.log("⚠️ Continuing without database...");
    });

// --- Default redirect ---
app.get('/', (req, res) => res.redirect('/watchlist'));

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error("❌ Unhandled Error:", err.stack);
    
    const statusCode = err.statusCode || 500;
    const errorMessage = process.env.NODE_ENV === 'development' 
        ? err.message 
        : 'Internal Server Error';
    
    res.status(statusCode).json({
        error: true,
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// --- 404 handler (must be last) ---
app.use('*', (req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Vantage OS</title>
            <style>
                body {
                    background: #0b0c10;
                    color: white;
                    font-family: monospace;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .container {
                    text-align: center;
                    border: 1px solid #00d4ff;
                    padding: 40px;
                    border-radius: 10px;
                    background: rgba(0,0,0,0.5);
                }
                h1 { color: #ff4757; }
                a { color: #00d4ff; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>404: INTELLIGENCE NOT FOUND</h1>
                <p>The requested resource could not be located.</p>
                <p><a href="/">Return to Vantage OS</a></p>
            </div>
        </body>
        </html>
    `);
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`
    ┌──────────────────────────────────────────┐
    │                                          │
    │   🚀 VANTAGE OS v1.0.0 ONLINE           │
    │                                          │
    │   ➤ Port: ${PORT}                        │
    │   ➤ URL: http://localhost:${PORT}        │
    │   ➤ Vantage: http://localhost:${PORT}/vantage │
    │   ➤ Health: http://localhost:${PORT}/health │
    │                                          │
    └──────────────────────────────────────────┘
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down...');
    mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed.');
        process.exit(0);
    });
});
