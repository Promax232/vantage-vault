const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose'); 
const Groq = require("groq-sdk");
const path = require('path'); 
const NodeCache = require('node-cache');
require('dotenv').config();
const app = express();
const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TMDB_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const BRAVE_KEY = process.env.BRAVE_API_KEY; 
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SIMKL_CLIENT_ID = process.env.SIMKL_CLIENT_ID;

function getSeasonProgress() {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const day = now.getDate();
    const year = now.getFullYear();

    // Define Season Windows
    // Winter: Jan-Mar | Spring: Apr-Jun | Summer: Jul-Sep | Fall: Oct-Dec
    const seasons = [
        { name: "WINTER", start: 0 }, { name: "SPRING", start: 3 },
        { name: "SUMMER", start: 6 }, { name: "FALL", start: 9 }
    ];

    const currentSeason = seasons.reverse().find(s => month >= s.start) || seasons[0];
    const nextSeasonName = currentSeason.name === "FALL" ? "WINTER" : seasons[seasons.findIndex(s => s.name === currentSeason.name) + 1].name;

    // Calculate progress within the 3-month window
    const seasonStartMonth = currentSeason.start;
    const totalDaysInSeason = 91; // Rough average
    const daysPassed = ((month - seasonStartMonth) * 30) + day;
    const percent = Math.min(99, Math.round((daysPassed / totalDaysInSeason) * 100));

    return { name: currentSeason.name, percent, next: nextSeasonName, year };
}


app.use(express.json());
app.get('/vantage', async (req, res) => {
    const sp = getSeasonProgress();
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vantage Anime OS</title>
        <style>
            :root { --accent: #00d4ff; --glass: rgba(255, 255, 255, 0.05); }
            body { background: #020202; color: white; font-family: 'Inter', sans-serif; margin: 0; padding: 20px; }
            
            .dashboard { max-width: 1000px; margin: 0 auto; }
            .glass-card { 
                background: var(--glass); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 25px; margin-bottom: 25px;
            }

            .search-container { position: relative; width: 100%; }
            .search-bar { 
                width: 100%; background: rgba(0,0,0,0.5); border: 1px solid #333; 
                padding: 15px 20px; border-radius: 15px; color: white; font-size: 16px; outline: none; transition: 0.3s;
            }
            .search-bar:focus { border-color: var(--accent); box-shadow: 0 0 15px rgba(0,212,255,0.3); }

            .progress-label { display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; margin-bottom: 8px; opacity: 0.8; }
            .bar-bg { width: 100%; height: 6px; background: #1a1a1a; border-radius: 10px; overflow: hidden; }
            .bar-fill { width: ${sp.percent}%; height: 100%; background: var(--accent); box-shadow: 0 0 10px var(--accent); }

            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 20px; margin-top: 30px; }
            .anime-item { cursor: pointer; border-radius: 15px; overflow: hidden; transition: 0.3s; position: relative; border: 1px solid transparent; }
            .anime-item:hover { transform: translateY(-5px); border-color: var(--accent); }
            .anime-item img { width: 100%; aspect-ratio: 2/3; object-fit: cover; }
            .anime-item-info { padding: 10px; font-size: 13px; font-weight: 600; text-align: center; }

            @media (max-width: 600px) { .grid { grid-template-columns: repeat(2, 1fr); } }
        </style>
    </head>
    <body>
        <div class="dashboard">
            <div class="glass-card">
                <h1 style="margin:0; font-size: 28px; letter-spacing: -1px;">VANTAGE <span style="color:var(--accent)">ANIME OS</span></h1>
                <p style="opacity:0.4; font-size:10px; margin-bottom:20px;">SYSTEM STATUS: ONLINE // DATA_SOURCE: JIKAN_V4</p>
                
                <div class="progress-label">
                    <span>${sp.name} ${sp.year}</span>
                    <span>${sp.percent}% TO ${sp.next}</span>
                </div>
                <div class="bar-bg"><div class="bar-fill"></div></div>
            </div>

            <div class="search-container">
                <input type="text" id="searchInput" class="search-bar" placeholder="Search any anime globally..." onkeyup="if(event.key==='Enter') searchAnime()">
            </div>

            <div id="results" class="grid">
                </div>
        </div>

        <script>
            async function searchAnime() {
                const query = document.getElementById('searchInput').value;
                const res = await fetch('https://api.jikan.moe/v4/anime?q=' + query);
                const json = await res.json();
                const container = document.getElementById('results');
                container.innerHTML = json.data.map(a => \`
                    <div class="anime-item" onclick="window.location='/anime-detail/\${a.mal_id}'">
                        <img src="\${a.images.jpg.large_image_url}">
                        <div class="anime-item-info">\${a.title}</div>
                    </div>
                \`).join('');
            }
        </script>
    </body>
    </html>
    `);
});


app.get('/anime-detail/:id', async (req, res) => {
    const malId = req.params.id;
    const cacheKey = `vantage_detail_${malId}`;
    let data = myCache.get(cacheKey);

    if (!data) {
        // Fetch full data including characters
        const [mainRes, charRes] = await Promise.all([
            axios.get(`https://api.jikan.moe/v4/anime/${malId}/full`),
            axios.get(`https://api.jikan.moe/v4/anime/${malId}/characters`)
        ]);
        data = { ...mainRes.data.data, characters: charRes.data.data.slice(0, 6) };
        myCache.set(cacheKey, data);
    }

    res.send(`
    <style>
        body { background: #000; color: white; font-family: 'Inter', sans-serif; margin:0; }
        .hero { 
            height: 50vh; width:100%; position:relative; 
            display:flex; align-items:flex-end; padding: 40px; box-sizing:border-box;
        }
        .hero-bg { position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; filter:blur(30px) brightness(0.3); z-index:-1; }
        .detail-container { max-width: 1000px; margin: -100px auto 50px; padding: 0 20px; display: flex; gap: 40px; }
        .poster { width: 280px; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,1); }
        .info-panel { flex: 1; margin-top: 120px; }
        .trailer-btn { 
            background: #ff0000; color: white; padding: 12px 25px; border-radius: 50px; 
            text-decoration: none; font-weight: 800; display: inline-flex; align-items: center; gap: 10px;
        }
        .char-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px; }
        .char-card { text-align: center; font-size: 11px; opacity: 0.8; }
        .char-card img { width: 100%; border-radius: 10px; }
        
        @media (max-width: 800px) {
            .detail-container { flex-direction: column; align-items: center; text-align: center; }
            .info-panel { margin-top: 20px; }
        }
    </style>

    <div class="hero">
        <img src="${data.images.jpg.large_image_url}" class="hero-bg">
        <h1 style="font-size: 42px; text-shadow: 0 5px 15px rgba(0,0,0,0.5);">${data.title}</h1>
    </div>

    <div class="detail-container">
        <img src="${data.images.jpg.large_image_url}" class="poster">
        
        <div class="info-panel">
            <p style="opacity:0.7; line-height:1.6;">${data.synopsis}</p>
            
            ${data.trailer.url ? `<a href="${data.trailer.url}" target="_blank" class="trailer-btn">▶ WATCH TRAILER</a>` : ''}
            
            <h3 style="margin-top:40px; border-bottom: 1px solid #333; padding-bottom: 10px;">CORE CHARACTERS</h3>
            <div class="char-grid">
                ${data.characters.map(c => `
                    <div class="char-card">
                        <img src="${c.character.images.jpg.image_url}">
                        <p>${c.character.name}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
    `);
});

// --- MONGODB CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Vault Uplink Established (MongoDB)"))
    .catch(err => console.error("Vault Connection Error:", err));
const showSchema = new mongoose.Schema({
    id: String,
    title: String,
    poster: String,
    type: String,
    source: String,
    currentEpisode: Number,
    totalEpisodes: Number,
    personalRating: Number,
    status: { type: String, default: 'watching' }, // 'watching', 'planned', 'completed'
    logs: { type: Map, of: Object, default: {} },
    startDate: String
});
const Show = mongoose.model('Show', showSchema);
const getWatchlist = async () => {
    return await Show.find({});
};
const saveWatchlist = async (showData) => {
    await Show.findOneAndUpdate({ id: showData.id }, showData, { upsert: true });
};
// --- ANDROID MANIFEST (DYNAMIC) ---
app.get('/manifest.json', (req, res) => {
    res.json({
        "name": "Vantage Vault",
        "short_name": "Vantage",
        "start_url": "/",
        "display": "standalone",
        "orientation": "portrait",
        "background_color": "#05070a",
        "theme_color": "#00d4ff",
        "icons": [{
            "src": "https://cdn-icons-png.flaticon.com/512/8669/8669741.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any maskable"
        }]
    });
});
// --- AI CORE (VANTAGE INTELLIGENCE) ---
app.post('/api/vantage-chat/:id', async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    const watchlist = await getWatchlist();
    const show = watchlist.find(s => s.id == id);
    const TRIGGER_WORD = "UPLINK";
    const isExplicitTrigger = message.toUpperCase().startsWith(TRIGGER_WORD);
    const cleanMessage = isExplicitTrigger ? message.slice(TRIGGER_WORD.length).trim() : message;
    const needsLiveIntel = isExplicitTrigger || /season|release|date|news|future|update|coming|when|latest|new|renewal|production|streaming|where/i.test(cleanMessage);
    let externalIntel = "";
    let tierUsed = "Internal Archive";
    if (show && needsLiveIntel) {
        if (process.env.TAVILY_API_KEY) {
            try {
                const tavilyRes = await axios.post('https://api.tavily.com/search', {
                    api_key: process.env.TAVILY_API_KEY,
                    query: `${show.title} show current status release date news 2025`,
                    search_depth: "advanced",
                    include_answer: true
                });
                if (tavilyRes.data.answer || tavilyRes.data.results.length > 0) {
                    externalIntel = tavilyRes.data.answer || tavilyRes.data.results.map(r => r.content).join(" ");
                    tierUsed = "Tavily (AI Tier)";
                }
            } catch (e) { console.log("Tavily failed"); }
        }
    }
    try {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: `You are VANTAGE. TODAY: ${today}. SOURCE: ${tierUsed}. ${externalIntel ? `INTEL: ${externalIntel}` : "Internal Archive Only."}` },
                { role: "user", content: `Context: ${show?.title}. Message: ${cleanMessage}` }
            ],
            model: "llama-3.3-70b-versatile",
        });
        res.json({ response: chatCompletion.choices[0].message.content });
    } catch (e) { res.status(500).json({ response: "Uplink unstable." }); }
});
// --- UI SYSTEMS (APPLE-POLISHED REFINE) ---
const HUD_STYLE = `
<style>
:root { --accent: #00d4ff; --gold: #ffcc00; --red: #ff4c4c; --bg: #05070a; --card: rgba(22, 27, 34, 0.6); --border: rgba(48, 54, 61, 0.5); }
body { background: var(--bg); color: #f0f6fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
/* LAYOUT ENGINE */
.split-view { display: flex; flex-direction: column; min-height: 100vh; }
.side-panel { width: 100%; padding: 25px; box-sizing: border-box; }
.main-panel { width: 100%; padding: 20px; box-sizing: border-box; }
@media (min-width: 1025px) {
    .split-view { flex-direction: row; height: 100vh; overflow: hidden; }
    .side-panel { width: 420px; border-right: 1px solid var(--border); overflow-y: auto; background: rgba(255,255,255,0.02); }
    .main-panel { flex: 1; overflow-y: auto; padding: 60px; }
}
/* UI ELEMENTS */
.glass { background: var(--card); backdrop-filter: blur(25px); border: 0.5px solid var(--border); border-radius: 18px; transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); }
.glass:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
.accent-text { color: var(--accent); font-weight: 800; letter-spacing: -0.5px; }
.input-field { background: rgba(1, 4, 9, 0.8); border: 1px solid var(--border); color: white; padding: 14px; border-radius: 12px; outline: none; width: 100%; box-sizing: border-box; font-size: 15px; transition: 0.3s; }
.input-field:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(0,212,255,0.1); }
.btn { background: transparent; border: 1px solid var(--accent); color: var(--accent); padding: 12px 24px; cursor: pointer; border-radius: 10px; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 1.5px; transition: 0.3s; }
.btn:hover { background: var(--accent); color: black; }
/* SIDEBAR REFINEMENT */
#nav-trigger { position: fixed; top: 0; left: 0; width: 15px; height: 100vh; z-index: 999; cursor: pointer; }
.sidebar { position: fixed; top: 0; left: -320px; width: 300px; height: 100vh; background: rgba(5, 7, 10, 0.98); backdrop-filter: blur(30px); border-right: 1px solid var(--border); z-index: 1001; transition: 0.5s cubic-bezier(0.19, 1, 0.22, 1); padding: 50px 30px; display: flex; flex-direction: column; visibility: hidden; }
.sidebar.active { left: 0; visibility: visible; box-shadow: 20px 0 80px rgba(0,0,0,0.9); }
.nav-link { color: #8b949e; text-decoration: none; padding: 18px; margin: 8px 0; border-radius: 12px; font-size: 12px; letter-spacing: 1.2px; display: flex; align-items: center; gap: 15px; transition: 0.3s; font-weight: 600; }
.nav-link:hover, .nav-link.active { color: var(--accent); background: rgba(0, 212, 255, 0.08); border-left: 4px solid var(--accent); }
.nav-burger { position: fixed; left: 25px; top: 25px; z-index: 1000; background: rgba(22, 27, 34, 0.5); backdrop-filter: blur(10px); border: 1px solid var(--border); color: var(--accent); width: 45px; height: 45px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.overlay { position: fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); z-index:1000; opacity:0; pointer-events:none; transition:0.4s; visibility: hidden; }
.overlay.active { opacity:1; pointer-events:all; visibility: visible; }
/* POSTER GRID */
.poster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 20px; padding: 10px; }
@media (max-width: 600px) { .poster-grid { grid-template-columns: 1fr 1fr; gap: 12px; } }
.rating-orb { width: 34px; height: 34px; margin: 5px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: #8b949e; border-radius: 50%; cursor: pointer; font-size: 12px; transition: 0.3s; }
.rating-orb.active { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 15px rgba(0,212,255,0.3); background: rgba(0,212,255,0.1); }
/* CHRONO STYLE */
.chrono-row { display: flex; align-items: center; gap: 20px; padding: 20px; margin-bottom: 15px; }
.chrono-timeline { flex: 1; height: 8px; background: rgba(255,255,255,0.05); border-radius: 10px; position: relative; overflow: hidden; }
.chrono-progress { height: 100%; background: linear-gradient(90deg, var(--accent), #00ffaa); box-shadow: 0 0 15px var(--accent); transition: 1s ease-out; }
</style>
`;
const NAV_COMPONENT = `
<button class="nav-burger" onclick="toggleNav()">☰</button>
<div id="nav-trigger" onmouseover="toggleNav()"></div>
<div id="overlay" class="overlay" onclick="toggleNav()"></div>
<div id="sidebar" class="sidebar">
    <h2 style="color:var(--accent); font-size:12px; margin-bottom:50px; letter-spacing:4px; font-weight:900;">VANTAGE <span style="color:white; opacity:0.5;">HUD</span></h2>
    
    <a href="/watchlist" class="nav-link"><span class="nav-icon">⦿</span> ACTIVE SYNC</a>
    <a href="/plan-to-watch" class="nav-link"><span class="nav-icon">🔖</span> PLAN TO WATCH</a>
    <a href="/hall-of-fame" class="nav-link"><span class="nav-icon">🏆</span> HALL OF FAME</a>
    <a href="/chrono-sync" class="nav-link"><span class="nav-icon">⏳</span> CHRONO-SYNC</a>
    <a href="/intelligence-core" class="nav-link"><span class="nav-icon">🧠</span> INTELLIGENCE CORE</a>

    <div style="margin-top:auto; padding:20px; background:rgba(255,255,255,0.03); border-radius:15px; border:1px solid var(--border);">
        <div style="font-size:10px; color:var(--accent); letter-spacing:1px; margin-bottom:5px;">● SYSTEM ONLINE</div>
        <div style="font-size:9px; color:#8b949e; opacity:0.6;">PHASE 5: INTELLIGENCE CORE ACTIVE</div>
    </div>
</div>
<script>
    function toggleNav() {
        document.getElementById('sidebar').classList.toggle('active');
        document.getElementById('overlay').classList.toggle('active');
    }
</script>
`;
const VOICE_SCRIPT = `
<script>
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            const activeInput = document.querySelector('.input-field:focus') || document.getElementById('chat-in') || document.getElementById('q');
            if(activeInput) {
                activeInput.value = text;
                if(activeInput.id === 'q') search();
            }
        };
        function startVoiceInput(e) {
            e.target.classList.add('mic-active');
            recognition.start();
            recognition.onend = () => e.target.classList.remove('mic-active');
        }
    }
</script>
`;
app.get('/watchlist', async (req, res) => {
    const list = await getWatchlist();
    const activeSyncs = list.filter(s => s.status === 'watching');
    const renderCard = (s) => {
        const total = s.totalEpisodes || 1;
        const progress = Math.min(100, Math.floor((s.currentEpisode / total) * 100));
        let posterUrl = s.poster;
        if (posterUrl && !posterUrl.startsWith('http')) posterUrl = `https://image.tmdb.org/t/p/w500${posterUrl}`;
        return `
        <div class="glass" style="padding:10px; position:relative; overflow:hidden;">
            <a href="/show/${s.type}/${s.id}"><img src="${posterUrl}" style="width:100%; height:240px; object-fit:cover; border-radius:12px;"></a>
            <div style="padding:10px;">
                <h4 style="font-size:13px; margin:5px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600;">${s.title}</h4>
                <div style="height:4px; background:rgba(255,255,255,0.05); border-radius:10px; margin:10px 0;">
                    <div style="width:${progress}%; height:100%; background:var(--accent); box-shadow: 0 0 10px var(--accent);"></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:11px; color:var(--accent); font-family:monospace; font-weight:bold;">${s.currentEpisode}/${total}</span>
                    <button onclick="updateEp('${s.id}', 'plus')" style="background:rgba(0,212,255,0.1); border:none; color:var(--accent); width:28px; height:28px; border-radius:8px; cursor:pointer; font-weight:bold;">+</button>
                </div>
            </div>
        </div>`;
    };
    res.send(`<html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <link rel="manifest" href="/manifest.json">
            ${HUD_STYLE}
        </head>
        <body>
        ${NAV_COMPONENT}
        <div style="padding:20px; max-width:1400px; margin:auto; padding-top:80px;">
            <header style="margin-bottom:40px;">
                <h1 style="font-size:28px; margin:0 0 20px 0; font-weight:900;">VANTAGE <span class="accent-text">VAULT</span></h1>
                <div style="display:flex; gap:12px; align-items:center; position:relative;">
                    <input id="q" class="input-field" style="padding-left:45px;" placeholder="Search archives..." onkeyup="if(event.key==='Enter') search()">
                    <span style="position:absolute; left:18px; opacity:0.4;">🔍</span>
                    <button onclick="startVoiceInput(event)" class="mic-btn" style="position:absolute; right:15px; border:none; background:none; cursor:pointer; font-size:18px;">🎤</button>
                </div>
                <div id="results" class="glass" style="display:none; position:absolute; left:20px; right:20px; z-index:1001; max-height:400px; overflow-y:auto; margin-top:10px; padding:10px;"></div>
            </header>
            <h2 style="font-size:11px; letter-spacing:3px; opacity:0.4; margin:0 0 20px 10px; font-weight:800;">● ACTIVE_SYNC</h2>
            <div class="poster-grid">
                ${activeSyncs.map(s => renderCard(s)).join('')}
                ${activeSyncs.length === 0 ? '<div style="grid-column: 1/-1; text-align:center; padding:100px; opacity:0.3;">No Active Syncs.</div>' : ''}
            </div>
        </div>
        ${VOICE_SCRIPT}
        <script>
            async function search(){
                const q = document.getElementById('q').value;
                const resDiv = document.getElementById('results');
                if(!q) { resDiv.style.display='none'; return; }
                resDiv.style.display = 'block'; resDiv.innerHTML = '<p style="padding:20px; opacity:0.5;">Scanning Multiverse...</p>';
                const r = await fetch('/api/search?q='+q);
                const d = await r.json();
                let html = d.mal.concat(d.tmdb).map(i => \`
                    <div style="padding:15px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-size:14px; font-weight:600;">\${i.title}</div>
                            <div style="font-size:10px; opacity:0.5; margin-top:4px;">\${i.source.toUpperCase()} • \${i.media_type}</div>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button class="btn" style="padding:8px 12px; font-size:9px;" onclick="location.href='/save?title=\${encodeURIComponent(i.title)}&id=\${i.id}&poster=\${encodeURIComponent(i.poster_path)}&type=\${i.media_type}&source=\${i.source}&total=\${i.total}&status=watching'">SYNC</button>
                            <button class="btn" style="padding:8px 12px; font-size:9px; border-color:#8b949e; color:#8b949e;" onclick="location.href='/save?title=\${encodeURIComponent(i.title)}&id=\${i.id}&poster=\${encodeURIComponent(i.poster_path)}&type=\${i.media_type}&source=\${i.source}&total=\${i.total}&status=planned'">PLAN</button>
                        </div>
                    </div>
                \`).join('');
                resDiv.innerHTML = html || '<p style="padding:20px;">No signal detected.</p>';
            }
            async function updateEp(id, action){
                await fetch('/api/update/'+id+'?action='+action);
                location.reload();
            }
        </script>
    </body></html>`);
});




// --- NEW PAGE: PLAN TO WATCH ---
app.get('/plan-to-watch', async (req, res) => {
    const list = await getWatchlist();
    const planned = list.filter(s => s.status === 'planned');
    const renderPlannedCard = (s) => {
        let posterUrl = s.poster;
        if (posterUrl && !posterUrl.startsWith('http')) posterUrl = `https://image.tmdb.org/t/p/w500${posterUrl}`;
        return `
        <div class="glass" style="padding:10px; position:relative;">
            <img src="${posterUrl}" style="width:100%; height:240px; object-fit:cover; border-radius:12px; filter: grayscale(0.4);">
            <div style="padding:10px;">
                <h4 style="font-size:13px; margin:5px 0; font-weight:600;">${s.title}</h4>
                <button class="btn" style="width:100%; margin-top:10px;" onclick="startSync('${s.id}')">START SYNC</button>
            </div>
        </div>`;
    };
    res.send(`<html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${HUD_STYLE}
        </head>
        <body>
        ${NAV_COMPONENT}
        <div style="padding:20px; max-width:1400px; margin:auto; padding-top:80px;">
            <h1 style="font-size:24px; margin:0 0 10px 0; font-weight:900;">PLAN TO <span class="accent-text">WATCH</span></h1>
            <p style="opacity:0.5; font-size:12px; margin-bottom:40px;">FUTURE LOGS & UPCOMING INTEL</p>
            <div class="poster-grid">
                ${planned.map(s => renderPlannedCard(s)).join('')}
                ${planned.length === 0 ? '<div style="grid-column: 1/-1; text-align:center; padding:100px; opacity:0.3;">Archive Empty. Add from Search.</div>' : ''}
            </div>
        </div>
        <script>
            async function startSync(id) {
                await fetch('/api/update-status/'+id+'?status=watching');
                location.href = '/watchlist';
            }
        </script>
    </body></html>`);
});
// --- NEW PAGE: HALL OF FAME ---
app.get('/hall-of-fame', async (req, res) => {
    const list = await getWatchlist();
    const completed = list.filter(s => s.status === 'completed');
    const renderHallCard = (s) => {
        let posterUrl = s.poster;
        if (posterUrl && !posterUrl.startsWith('http')) posterUrl = `https://image.tmdb.org/t/p/w500${posterUrl}`;
        return `
        <div class="glass" style="padding:10px; position:relative; border-color:var(--gold); background:rgba(255, 204, 0, 0.03);">
            <div style="position:absolute; top:15px; right:15px; background:var(--gold); color:black; font-weight:900; padding:5px 10px; border-radius:8px; font-size:12px; z-index:10; box-shadow:0 0 15px rgba(255,204,0,0.5);">${s.personalRating || 'NR'}</div>
            <a href="/show/${s.type}/${s.id}"><img src="${posterUrl}" style="width:100%; height:240px; object-fit:cover; border-radius:12px;"></a>
            <div style="padding:10px; text-align:center;">
                <h4 style="font-size:13px; margin:5px 0; font-weight:800; color:var(--gold);">${s.title.toUpperCase()}</h4>
                <div style="font-size:9px; opacity:0.5; letter-spacing:1px;">MISSION ACCOMPLISHED</div>
            </div>
        </div>`;
    };
    res.send(`<html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${HUD_STYLE}
        </head>
        <body>
        ${NAV_COMPONENT}
        <div style="padding:20px; max-width:1400px; margin:auto; padding-top:80px;">
            <h1 style="font-size:24px; margin:0 0 10px 0; font-weight:900;">HALL OF <span style="color:var(--gold);">FAME</span></h1>
            <p style="opacity:0.5; font-size:12px; margin-bottom:40px;">ELITE ARCHIVES & HIGHEST RATINGS</p>
            <div class="poster-grid">
                ${completed.map(s => renderHallCard(s)).join('')}
                ${completed.length === 0 ? '<div style="grid-column: 1/-1; text-align:center; padding:100px; opacity:0.3;">Hall is empty. Complete a show to induct it.</div>' : ''}
            </div>
        </div>
    </body></html>`);
});
app.get('/show/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const watchlist = await getWatchlist();
    const local = watchlist.find(s => s.id == id);
    let data = {};
    try {
        if (local && local.source === 'mal') {
            const jikan = await axios.get(`https://api.jikan.moe/v4/anime/${id.split('_')[0]}`);
            data = { title: jikan.data.data.title, overview: jikan.data.data.synopsis, poster_path: jikan.data.data.images.jpg.large_image_url };
        } else {
            const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${id.split('_')[0]}?api_key=${API_KEY}`);
            data = tmdbRes.data;
        }
    } catch(e) { return res.send("Uplink Error"); }
    const logs = local?.logs ? Object.fromEntries(local.logs) : {};
    let displayPoster = local?.poster || data.poster_path;
    if (displayPoster && !displayPoster.startsWith('http')) displayPoster = `https://image.tmdb.org/t/p/w500${displayPoster}`;
    res.send(`<html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${HUD_STYLE}
        </head>
        <body>
        ${NAV_COMPONENT}
        <div class="split-view" style="padding-top:40px;">
            <div class="side-panel">
                <img src="${displayPoster}" style="width:100%; border-radius:18px; margin-bottom:25px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
                <h1 style="font-size:22px; margin:0 0 12px 0; font-weight:800;">${local?.title || data.title}</h1>
                <p style="font-size:14px; opacity:0.5; line-height:1.6; margin-bottom:30px;">${data.overview?.substring(0, 300)}...</p>
                <div style="display:flex; flex-wrap:wrap; justify-content:center; margin-bottom:30px; background:rgba(0,0,0,0.2); padding:15px; border-radius:15px;">
                    ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button class="rating-orb ${local?.personalRating==n?'active':''}" onclick="setRating(${n})">${n}</button>`).join('')}
                </div>
                <div style="display:flex; gap:12px;">
                    <button onclick="location.href='/watchlist'" class="btn" style="flex:1;">Vault</button>
                    <button onclick="purgeShow()" class="btn" style="border-color:var(--red); color:var(--red);">Purge</button>
                </div>
            </div>
            <div class="main-panel">
                <div class="glass" style="padding:25px; margin-bottom:25px;">
                    <div id="chat-win" style="height:180px; overflow-y:auto; font-size:14px; margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:15px;">
                        <div style="color:var(--accent); font-weight:bold;">VANTAGE: Systems Active. Standing by for Intel request.</div>
                    </div>
                    <div style="display:flex; gap:12px; position:relative;">
                        <input id="chat-in" class="input-field" placeholder="Ask Vantage..." onkeyup="if(event.key==='Enter') chat()">
                        <button onclick="startVoiceInput(event)" class="mic-btn" style="position:absolute; right:100px; top:12px;">🎤</button>
                        <button class="btn" onclick="chat()">Send</button>
                    </div>
                </div>
                <div class="glass" style="padding:25px;">
                    <textarea id="logText" class="input-field" style="height:120px; margin-bottom:20px; resize:none;" placeholder="Log your observations..."></textarea>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span style="font-size:11px; font-weight:bold; letter-spacing:1px; opacity:0.6;">EPISODE</span>
                            <input id="ep" type="number" value="${local?.currentEpisode || 0}" class="input-field" style="width:70px; text-align:center;">
                        </div>
                        <button class="btn" onclick="saveLog()">Record Entry</button>
                    </div>
                </div>
                <div id="log-list" style="margin-top:30px;">
                    ${Object.keys(logs).sort((a,b)=>b-a).map(ep => `
                        <div class="glass" style="padding:20px; margin-bottom:15px; border-left:4px solid var(--accent);">
                            <div style="font-size:10px; color:var(--accent); font-weight:900; margin-bottom:8px; letter-spacing:1px;">ENTRY EP\${ep} // \${logs[ep].date}</div>
                            <div style="font-size:14px; line-height:1.6; opacity:0.9;">\${logs[ep].text}</div>
                        </div>`).join('')}
                </div>
            </div>
        </div>
        ${VOICE_SCRIPT}
        <script>
            async function setRating(n){ await fetch('/api/update/${id}?rating='+n); location.reload(); }
            async function saveLog(){
                const text = document.getElementById('logText').value;
                const ep = document.getElementById('ep').value;
                await fetch('/api/journal/${id}', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ep, text})});
                location.reload();
            }
            async function chat(){
                const inp = document.getElementById('chat-in');
                const win = document.getElementById('chat-win');
                if(!inp.value) return;
                win.innerHTML += '<div style="margin-bottom:10px;"><b>USER:</b> '+inp.value+'</div>';
                const r = await fetch('/api/vantage-chat/${id}', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:inp.value})});
                const d = await r.json();
                win.innerHTML += '<div style="color:var(--accent); margin-bottom:15px;"><b>VANTAGE:</b> '+d.response+'</div>';
                inp.value = ''; win.scrollTop = win.scrollHeight;
            }
            function purgeShow(){ if(confirm('Erase from archive?')) location.href='/api/delete-show/${id}'; }
        </script>
    </body></html>`);
});

// --- NEW PAGE: INTELLIGENCE CORE (STATS & AI) ---
app.get('/intelligence-core', async (req, res) => {
    const list = await getWatchlist();
    const completed = list.filter(s => s.status === 'completed');
    const watching = list.filter(s => s.status === 'watching');

    // Stats Logic
    const avgRating = completed.length > 0 
        ? (completed.reduce((acc, s) => acc + (s.personalRating || 0), 0) / completed.length).toFixed(1) 
        : "N/A";
    
    const totalEps = list.reduce((acc, s) => acc + (s.currentEpisode || 0), 0);

    // AI Recommendation Engine
    let aiRecs = "Initiating Analysis...";
    try {
        const tasteProfile = completed.map(s => `${s.title} (${s.personalRating}/10)`).join(", ");
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are the VANTAGE Intelligence Core. User is a 'savorer' (no binging). Analyze their Hall of Fame and suggest 3 masterpieces (Anime or HBO style) that reward slow watching. Return brief, tactical descriptions." },
                { role: "user", content: `My Hall of Fame: ${tasteProfile || "Empty. I like high-quality storytelling."}` }
            ],
            model: "llama-3.3-70b-versatile",
        });
        aiRecs = completion.choices[0].message.content.replace(/\n/g, '<br>');
    } catch (e) { aiRecs = "AI Uplink Interrupted."; }

    res.send(`<html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${HUD_STYLE}
        </head>
        <body>
        ${NAV_COMPONENT}
        <div style="padding:20px; max-width:1000px; margin:auto; padding-top:80px;">
            <h1 style="font-size:24px; margin:0 0 10px 0; font-weight:900;">INTELLIGENCE <span class="accent-text">CORE</span></h1>
            
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:40px;">
                <div class="glass" style="padding:20px; text-align:center;">
                    <div style="font-size:10px; opacity:0.5; letter-spacing:2px;">AVG_RATING</div>
                    <div style="font-size:32px; font-weight:900; color:var(--gold);">${avgRating}</div>
                </div>
                <div class="glass" style="padding:20px; text-align:center;">
                    <div style="font-size:10px; opacity:0.5; letter-spacing:2px;">EPS_CONSUMED</div>
                    <div style="font-size:32px; font-weight:900; color:var(--accent);">${totalEps}</div>
                </div>
                <div class="glass" style="padding:20px; text-align:center;">
                    <div style="font-size:10px; opacity:0.5; letter-spacing:2px;">ACTIVE_SYNC</div>
                    <div style="font-size:32px; font-weight:900;">${watching.length}</div>
                </div>
            </div>

            <div class="glass" style="padding:30px; border-left:4px solid var(--accent); position:relative; overflow:hidden;">
                <div style="position:absolute; top:-10px; right:-10px; font-size:100px; opacity:0.03; font-weight:900;">AI</div>
                <h2 style="font-size:14px; letter-spacing:3px; margin-bottom:20px; color:var(--accent);">● TACTICAL_RECOMMENDATIONS</h2>
                <div style="font-size:15px; line-height:1.8; opacity:0.9;">
                    ${aiRecs}
                </div>
            </div>
        </div>
    </body></html>`);
});


// --- API ROUTES (STABILIZED) ---
app.get('/api/search', async (req, res) => {
    try {
        const malRes = await axios.get(`https://api.jikan.moe/v4/anime?q=${req.query.q}&limit=5`).catch(()=>({data:{data:[]}}));
        const malResults = malRes.data.data.map(a => ({ 
            id: a.mal_id, title: a.title, poster_path: a.images.jpg.image_url, 
            media_type: 'anime', source: 'mal', total: a.episodes || 12
        }));
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${req.query.q}`).catch(()=>({data:{results:[]}}));
        const tmdbResults = tmdbRes.data.results.filter(i => i.poster_path).slice(0, 5).map(i => ({
            id: i.id, title: i.name || i.title, poster_path: i.poster_path, 
            media_type: i.media_type, source: 'tmdb', total: 1
        }));
        res.json({ mal: malResults, tmdb: tmdbResults });
    } catch (e) { res.json({ mal: [], tmdb: [] }); }
});
app.get('/save', async (req, res) => {
    const { id, title, poster, type, source, total, status } = req.query;
    await saveWatchlist({ 
        id, title: decodeURIComponent(title), poster: decodeURIComponent(poster), 
        type, source, currentEpisode: 0, totalEpisodes: parseInt(total) || 12, 
        status: status || 'watching',
        logs: {}, personalRating: 0, startDate: new Date().toISOString() 
    });
    res.redirect(status === 'planned' ? '/plan-to-watch' : '/watchlist');
});
app.get('/api/update/:id', async (req, res) => {
    const show = await Show.findOne({ id: req.params.id });
    if (show) {
        if (req.query.action === 'plus') {
            show.currentEpisode++;
            // AUTO-ARCHIVE LOGIC: Move to Hall of Fame if finished
            if (show.currentEpisode >= show.totalEpisodes) {
                show.status = 'completed';
            }
        }
        if (req.query.rating) show.personalRating = parseInt(req.query.rating);
        await show.save();
        res.json({ success: true });
    } else { res.json({ success: false }); }
});
app.get('/api/update-status/:id', async (req, res) => {
    await Show.findOneAndUpdate({ id: req.params.id }, { status: req.query.status });
    res.json({ success: true });
});
app.post('/api/journal/:id', async (req, res) => {
    const show = await Show.findOne({ id: req.params.id });
    if (show) {
        if (!show.logs) show.logs = new Map();
        show.logs.set(req.body.ep.toString(), { text: req.body.text, date: new Date().toLocaleDateString() });
        // Handle episode jumps from journal
        if (parseInt(req.body.ep) >= show.totalEpisodes) show.status = 'completed';
        await show.save();
    }
    res.json({ success: true });
});
app.get('/api/delete-show/:id', async (req, res) => {
    await Show.deleteOne({ id: req.params.id });
    res.redirect('/watchlist');
});
app.get('/', (req, res) => res.redirect('/watchlist'));
app.listen(PORT, () => console.log(`🚀 VANTAGE ONLINE | PORT ${PORT}`));