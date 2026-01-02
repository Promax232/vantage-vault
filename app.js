const express = require('express');
const axios = require('axios');
require('dotenv').config();
const mongoose = require('mongoose');
// app.js
const { Show, getWatchlist, saveWatchlist } = require('./db/index');
const { getSeasonProgress } = require('./utils/seasonUtils');
const Groq = require("groq-sdk");
const NodeCache = require('node-cache');
const jikanjs = require('@mateoaranda/jikanjs');
const { HUD_STYLE, NAV_COMPONENT, VOICE_SCRIPT } = require('./ui/layout');


// Routes
const searchRoutes = require('./routes/search');
const vantageRoutes = require('./routes/vantage');
const watchlistRoutes = require('./routes/watchlist');

const app = express(); // <- only once

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // for form / URL-encoded bodies

// Routes
app.use('/api/search', searchRoutes);
app.use('/api', vantageRoutes);
app.use('/', watchlistRoutes);

// Android Manifest (dynamic)
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

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Vault Uplink Established (MongoDB)"))
    .catch(err => console.error("Vault Connection Error:", err));

const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TMDB_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const BRAVE_KEY = process.env.BRAVE_API_KEY;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SIMKL_CLIENT_ID = process.env.SIMKL_CLIENT_ID;



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



app.get('/', (req, res) => res.redirect('/watchlist'));

app.listen(PORT, () => console.log(`VANTAGE OS ONLINE ON PORT ${PORT}`));