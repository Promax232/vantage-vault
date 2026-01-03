 const express = require('express');
const axios = require('axios');
require('dotenv').config();
const mongoose = require('mongoose');
const Groq = require("groq-sdk");
const NodeCache = require('node-cache');
const morgan = require('morgan');
const path = require('path');
const { HUD_STYLE, NAV_COMPONENT, VOICE_SCRIPT } = require('./ui/layout');
const { Show, getWatchlist, saveWatchlist } = require('./db/index');
const { getSeasonProgress } = require('./utils/seasonUtils');
const app = express();
// --- ENV CHECK ---
['MONGO_URI', 'TMDB_KEY', 'GROQ_API_KEY'].forEach(key => {
if (!process.env[key]) console.warn(`⚠️ Warning: ${key} is not set!`);
});
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // dev logging
app.use('/public', express.static(path.join(__dirname, 'public'))); // static assets



// Cache & API keys
const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TMDB_KEY;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
// --- PAGE ROUTES ---
app.use('/', require('./routes/pages/watchlistPage'));
app.use('/', require('./routes/pages/planToWatchPage'));
app.use('/', require('./routes/pages/hallOfFamePage'));
app.use('/', require('./routes/pages/showPage'));
app.use('/', require('./routes/pages/intelligenceCorePage'));
app.use('/', require('./routes/pages/vantagePage'));


// --- API ROUTES (Pointing to the new subfolder) ---
app.use('/api/search', require('./routes/api/search'));
app.use('/api', require('./routes/api/vantage'));
app.use('/api/watchlist', require('./routes/api/watchlist'));
app.use('/api', require('./routes/api/vantageAI'));
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
// --- MongoDB ---
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("Vault Uplink Established (MongoDB)"))
.catch(err => console.error("Vault Connection Error:", err));
// --- Default redirect ---
app.get('/', (req, res) => res.redirect('/watchlist'));
// --- 404 handler ---
app.use((req, res, next) => {
res.status(404).send("<h2>404: Page Not Found</h2>");
});
// --- Error handler ---
app.use((err, req, res, next) => {
console.error("❌ Server Error:", err);
res.status(500).send("<h2>500: Internal Server Error</h2>");
});
// --- Server ---
app.listen(PORT, () => console.log(`VANTAGE OS ONLINE ON PORT ${PORT}`)); 