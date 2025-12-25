const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose'); 
const Groq = require("groq-sdk");
const path = require('path'); 
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TMDB_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const BRAVE_KEY = process.env.BRAVE_API_KEY; 
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
app.use(express.json());

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

// --- UI SYSTEMS (UPDATED WITH SIDEBAR CSS) ---
const HUD_STYLE = `
<style>
:root { --accent: #00d4ff; --gold: #ffcc00; --red: #ff4c4c; --bg: #05070a; --card: rgba(22, 27, 34, 0.7); --border: #30363d; }
body { background: var(--bg); color: #f0f6fc; font-family: 'Segoe UI', system-ui; margin: 0; padding: 0; overflow-x: hidden; -webkit-tap-highlight-color: transparent; }

/* LAYOUT ENGINE */
.split-view { display: flex; flex-direction: column; min-height: 100vh; }
.side-panel { width: 100%; padding: 20px; box-sizing: border-box; border-bottom: 1px solid var(--border); }
.main-panel { width: 100%; padding: 20px; box-sizing: border-box; }

@media (min-width: 1025px) {
    .split-view { flex-direction: row; height: 100vh; overflow: hidden; }
    .side-panel { width: 400px; border-right: 1px solid var(--border); border-bottom: none; overflow-y: auto; }
    .main-panel { flex: 1; overflow-y: auto; padding: 40px; }
}

/* UI ELEMENTS */
.glass { background: var(--card); backdrop-filter: blur(15px); border: 1px solid var(--border); border-radius: 16px; transition: 0.3s; }
.glass:hover { border-color: var(--accent); }
.accent-text { color: var(--accent); text-shadow: 0 0 10px rgba(0,212,255,0.3); }
.input-field { background: #010409; border: 1px solid var(--border); color: white; padding: 12px; border-radius: 8px; outline: none; width: 100%; box-sizing: border-box; font-size: 16px; }
.btn { background: transparent; border: 1px solid var(--accent); color: var(--accent); padding: 10px 20px; cursor: pointer; border-radius: 6px; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
.btn:active { transform: scale(0.95); }

/* RATING ORBS */
.rating-orb { width: 32px; height: 32px; margin: 4px; border: 1px solid var(--accent); background: none; color: var(--accent); border-radius: 50%; cursor: pointer; font-size: 11px; transition: 0.3s; }
.rating-orb.active { background: var(--accent); color: black; box-shadow: 0 0 15px var(--accent); }

/* CHRONO LINK */
.chrono-link { display: flex; gap: 10px; overflow-x: auto; padding: 15px 0; scrollbar-width: none; }
.chrono-item { font-size: 10px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 4px; white-space: nowrap; color: #8b949e; background: rgba(255,255,255,0.02); }
.chrono-today { border-color: var(--accent); color: var(--accent); }

.mic-btn { background: none; border: none; color: var(--accent); cursor: pointer; font-size: 20px; transition: 0.3s; padding: 5px; }
.mic-active { color: var(--red) !important; filter: drop-shadow(0 0 8px var(--red)); animation: pulse 1.5s infinite; }
@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

/* SIDEBAR COMMAND CENTER */
#nav-trigger { position: fixed; top: 0; left: 0; width: 25px; height: 100vh; z-index: 999; cursor: pointer; }
#nav-trigger:hover { background: linear-gradient(90deg, rgba(0,212,255,0.2) 0%, transparent 100%); }
.sidebar { position: fixed; top: 0; left: -300px; width: 280px; height: 100vh; background: rgba(5, 7, 10, 0.95); backdrop-filter: blur(20px); border-right: 1px solid var(--border); z-index: 1000; transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); padding: 40px 25px; display: flex; flex-direction: column; box-shadow: 10px 0 50px rgba(0,0,0,0.8); }
.sidebar.active { left: 0; }
.nav-link { color: #8b949e; text-decoration: none; padding: 15px; margin: 5px 0; border-radius: 8px; font-size: 13px; letter-spacing: 1px; display: flex; align-items: center; gap: 15px; transition: 0.2s; border: 1px solid transparent; text-transform: uppercase; font-weight: 600; }
.nav-link:hover, .nav-link.active { color: var(--accent); background: rgba(0, 212, 255, 0.05); border-color: rgba(0, 212, 255, 0.2); text-shadow: 0 0 10px rgba(0,212,255,0.4); }
.nav-icon { font-size: 16px; width: 20px; text-align: center; }
.close-btn { position: absolute; top: 20px; right: 20px; background: none; border: none; color: var(--red); font-size: 24px; cursor: pointer; opacity: 0.7; }
.overlay { position: fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:998; opacity:0; pointer-events:none; transition:0.3s; }
.overlay.active { opacity:1; pointer-events:all; }
.nav-burger { position: absolute; left: 20px; top: 25px; z-index: 900; background: none; border: none; color: var(--accent); font-size: 20px; cursor: pointer; opacity: 0.7; }
</style>
`;

// --- NEW COMPONENT: SIDEBAR NAVIGATION ---
const NAV_COMPONENT = `
<button class="nav-burger" onclick="toggleNav()">☰</button>
<div id="nav-trigger" onclick="toggleNav()"></div>
<div id="overlay" class="overlay" onclick="toggleNav()"></div>
<div id="sidebar" class="sidebar">
    <button class="close-btn" onclick="toggleNav()">×</button>
    <h2 style="color:var(--accent); font-size:14px; margin-bottom:40px; letter-spacing:3px; border-bottom:1px solid var(--border); padding-bottom:15px;">VANTAGE <span style="color:white;">HUD 2.0</span></h2>
    
    <a href="/watchlist" class="nav-link active"><span class="nav-icon">⦿</span> ACTIVE SYNC</a>
    <a href="#" class="nav-link" style="opacity:0.4; cursor:not-allowed;"><span class="nav-icon">🏆</span> HALL OF FAME <small style="font-size:8px; margin-left:auto;">[LOCKED]</small></a>
    <a href="#" class="nav-link" style="opacity:0.4; cursor:not-allowed;"><span class="nav-icon">⏳</span> CHRONO-SYNC <small style="font-size:8px; margin-left:auto;">[LOCKED]</small></a>
    <a href="#" class="nav-link" style="opacity:0.4; cursor:not-allowed;"><span class="nav-icon">🔖</span> PLAN TO WATCH <small style="font-size:8px; margin-left:auto;">[LOCKED]</small></a>
    <a href="#" class="nav-link" style="opacity:0.4; cursor:not-allowed;"><span class="nav-icon">🧠</span> INTELLIGENCE <small style="font-size:8px; margin-left:auto;">[LOCKED]</small></a>

    <div style="margin-top:auto; padding-top:20px; border-top:1px solid var(--border);">
        <div style="font-size:9px; color:#8b949e; letter-spacing:1px;">SYSTEM: ONLINE</div>
        <div style="font-size:9px; color:#8b949e; letter-spacing:1px;">EXPANSION: PHASE 1</div>
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
    const activeSyncs = list.filter(s => s.currentEpisode < (s.totalEpisodes || 1));
    const hallOfFame = list.filter(s => s.currentEpisode >= (s.totalEpisodes || 1));
    
    const renderCard = (s, isGold = false) => {
        const total = s.totalEpisodes || 1;
        const progress = Math.min(100, Math.floor((s.currentEpisode / total) * 100));
        let posterUrl = s.poster;
        if (posterUrl && !posterUrl.startsWith('http')) posterUrl = `https://image.tmdb.org/t/p/w500${posterUrl}`;
        
        return `
        <div class="glass" style="width:160px; padding:12px; display:inline-block; margin:8px; vertical-align:top; position:relative;">
            <a href="/show/${s.type}/${s.id}"><img src="${posterUrl}" style="width:100%; height:230px; object-fit:cover; border-radius:8px;"></a>
            <div style="height:3px; background:rgba(255,255,255,0.1); margin-top:8px; border-radius:2px; overflow:hidden;">
                <div style="width:${progress}%; height:100%; background:var(--accent);"></div>
            </div>
            <h4 style="font-size:12px; margin:8px 0 4px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.title}</h4>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:10px; color:var(--accent); font-family:monospace;">${s.currentEpisode}/${total}</span>
                <button onclick="updateEp('${s.id}', 'plus')" style="background:none; border:none; color:var(--accent); cursor:pointer; font-size:16px;">+</button>
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
        <div style="padding:15px; max-width:1200px; margin:auto; padding-top:60px;">
            <header style="margin-bottom:30px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h1 style="font-size:22px; margin:0;">VANTAGE <span class="accent-text">VAULT</span></h1>
                </div>
                <div style="display:flex; gap:10px; align-items:center; position:relative;">
                    <input id="q" class="input-field" placeholder="Search archives..." onkeyup="if(event.key==='Enter') search()">
                    <button onclick="startVoiceInput(event)" class="mic-btn" style="position:absolute; right:10px;">🎤</button>
                </div>
                <div id="results" class="glass" style="display:none; position:absolute; left:15px; right:15px; z-index:100; max-height:300px; overflow-y:auto; margin-top:5px;"></div>
                
                <div class="chrono-link" id="schedule-bar"></div>
            </header>

            <h2 style="font-size:12px; letter-spacing:2px; opacity:0.5; margin-left:8px;">ACTIVE_SYNC</h2>
            <div style="white-space:nowrap; overflow-x:auto; padding-bottom:10px;">
                ${activeSyncs.map(s => renderCard(s)).join('')}
            </div>

            ${hallOfFame.length ? `<h2 style="font-size:12px; letter-spacing:2px; opacity:0.5; margin-top:30px; margin-left:8px;">COMPLETED_ARCHIVE</h2>
            <div style="white-space:nowrap; overflow-x:auto;">
                ${hallOfFame.map(s => renderCard(s, true)).join('')}
            </div>` : ''}
        </div>
        ${VOICE_SCRIPT}
        <script>
            async function search(){
                const q = document.getElementById('q').value;
                const resDiv = document.getElementById('results');
                if(!q) { resDiv.style.display='none'; return; }
                resDiv.style.display = 'block'; resDiv.innerHTML = '<p style="padding:10px;">Scanning...</p>';
                const r = await fetch('/api/search?q='+q);
                const d = await r.json();
                let html = d.mal.concat(d.tmdb).map(i => \`
                    <div style="padding:12px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px;">\${i.title}</span>
                        <button class="btn" style="padding:5px 10px;" onclick="location.href='/save?title=\${encodeURIComponent(i.title)}&id=\${i.id}&poster=\${encodeURIComponent(i.poster_path)}&type=\${i.media_type}&source=\${i.source}&total=\${i.total}'">ADD</button>
                    </div>
                \`).join('');
                resDiv.innerHTML = html || '<p style="padding:10px;">No signal.</p>';
            }
            async function updateEp(id, action){
                await fetch('/api/update/'+id+'?action='+action);
                location.reload();
            }
            async function loadSchedule() {
                const r = await fetch('/api/schedule');
                const d = await r.json();
                document.getElementById('schedule-bar').innerHTML = d.map(item => \`
                    <div class="chrono-item \${item.status === 'today' ? 'chrono-today' : ''}">\${item.title} • \${item.time}</div>
                \`).join('');
            }
            loadSchedule();
        </script>
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
            <link rel="manifest" href="/manifest.json">
            ${HUD_STYLE}
        </head>
        <body>
        ${NAV_COMPONENT}
        <div class="split-view" style="padding-top:40px;">
            <div class="side-panel">
                <img src="${displayPoster}" style="width:100%; border-radius:12px; margin-bottom:20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <h1 style="font-size:20px; margin:0 0 10px 0;">${local?.title || data.title}</h1>
                <p style="font-size:13px; opacity:0.6; line-height:1.5; margin-bottom:20px;">${data.overview?.substring(0, 250)}...</p>
                
                <div style="display:flex; flex-wrap:wrap; justify-content:center; margin-bottom:20px;">
                    ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button class="rating-orb ${local?.personalRating==n?'active':''}" onclick="setRating(${n})">${n}</button>`).join('')}
                </div>
                
                <div style="display:flex; gap:10px;">
                    <button onclick="location.href='/watchlist'" class="btn" style="flex:1;">Vault</button>
                    <button onclick="purgeShow()" class="btn" style="border-color:var(--red); color:var(--red);">Delete</button>
                </div>
            </div>
            <div class="main-panel">
                <div class="glass" style="padding:20px; margin-bottom:20px;">
                    <div id="chat-win" style="height:120px; overflow-y:auto; font-size:13px; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">
                        <div style="color:var(--accent);">VANTAGE: Waiting for command...</div>
                    </div>
                    <div style="display:flex; gap:10px; position:relative;">
                        <input id="chat-in" class="input-field" placeholder="Ask Vantage..." onkeyup="if(event.key==='Enter') chat()">
                        <button onclick="startVoiceInput(event)" class="mic-btn" style="position:absolute; right:70px; top:8px;">🎤</button>
                        <button class="btn" onclick="chat()">Send</button>
                    </div>
                </div>

                <div class="glass" style="padding:20px;">
                    <textarea id="logText" class="input-field" style="height:100px; margin-bottom:15px;" placeholder="Entry log..."></textarea>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:12px;">EP</span>
                            <input id="ep" type="number" value="${local?.currentEpisode || 0}" class="input-field" style="width:60px; padding:5px;">
                        </div>
                        <button class="btn" onclick="saveLog()">Archive Entry</button>
                    </div>
                </div>

                <div id="log-list" style="margin-top:20px;">
                    ${Object.keys(logs).sort((a,b)=>b-a).map(ep => `
                        <div class="glass" style="padding:15px; margin-bottom:10px; border-left:3px solid var(--accent);">
                            <div style="font-size:11px; color:var(--accent); margin-bottom:5px;">EPISODE ${ep} • ${logs[ep].date}</div>
                            <div style="font-size:13px; line-height:1.4;">${logs[ep].text}</div>
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
                win.innerHTML += '<div><b>USER:</b> '+inp.value+'</div>';
                const r = await fetch('/api/vantage-chat/${id}', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:inp.value})});
                const d = await r.json();
                win.innerHTML += '<div style="color:var(--accent);"><b>VANTAGE:</b> '+d.response+'</div>';
                inp.value = ''; win.scrollTop = win.scrollHeight;
            }
            function purgeShow(){ if(confirm('Erase from archive?')) location.href='/api/delete-show/${id}'; }
        </script>
    </body></html>`);
});

// --- API ROUTES RETAINED ---
app.get('/api/schedule', async (req, res) => {
    const watchlist = await getWatchlist();
    const results = [];
    const animeIds = watchlist.filter(s => s.source === 'mal').map(s => s.id);
    if (animeIds.length > 0) {
        try {
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const today = days[new Date().getDay()];
            const schedRes = await axios.get(`https://api.jikan.moe/v4/schedules?filter=${today}`);
            schedRes.data.data.forEach(a => {
                if(animeIds.includes(a.mal_id.toString())) {
                    results.push({ title: a.title, time: a.broadcast.time || "TBA", type: 'anime', status: 'today' });
                }
            });
        } catch (e) { console.log("Jikan Fail"); }
    }
    res.json(results);
});

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
    const { id, title, poster, type, source, total } = req.query;
    await saveWatchlist({ 
        id, title: decodeURIComponent(title), poster: decodeURIComponent(poster), 
        type, source, currentEpisode: 0, totalEpisodes: parseInt(total) || 12, 
        logs: {}, personalRating: 0, startDate: new Date().toISOString() 
    });
    res.redirect('/watchlist');
});

app.get('/api/update/:id', async (req, res) => {
    const show = await Show.findOne({ id: req.params.id });
    if (show) {
        if (req.query.action === 'plus') show.currentEpisode++;
        if (req.query.rating) show.personalRating = parseInt(req.query.rating);
        await show.save();
        res.json({ success: true });
    } else { res.json({ success: false }); }
});

app.post('/api/journal/:id', async (req, res) => {
    const show = await Show.findOne({ id: req.params.id });
    if (show) {
        if (!show.logs) show.logs = new Map();
        show.logs.set(req.body.ep.toString(), { text: req.body.text, date: new Date().toLocaleDateString() });
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