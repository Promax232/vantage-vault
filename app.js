const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose'); // Swapped from FS
const Groq = require("groq-sdk");
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
// Schema reflects your EXACT JSON structure
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
// Building on your core logic: Swapping local file for Cloud DB
const getWatchlist = async () => {
    return await Show.find({});
};
const saveWatchlist = async (showData) => {
    // Finds show by ID and updates it, or creates it if it doesn't exist
    await Show.findOneAndUpdate({ id: showData.id }, showData, { upsert: true });
};
// --- 1. AI CORE (VANTAGE 4-TIER INTELLIGENCE) ---
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
        if (!externalIntel && BRAVE_KEY) {
            try {
                const braveRes = await axios.get(`https://api.search.brave.com/res/v1/web/search`, {
                    params: { q: `${show.title} 2025 news release date season`, count: 3 },
                    headers: { 'X-Subscription-Token': BRAVE_KEY, 'Accept': 'application/json' }
                });
                if (braveRes.data.web?.results?.length > 0) {
                    externalIntel = braveRes.data.web.results.map(r => r.description).join(" ");
                    tierUsed = "Brave (Library Tier)";
                }
            } catch (e) { console.log("Brave failed"); }
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
const HUD_STYLE = `
<style>
:root { --accent: #00d4ff; --gold: #ffcc00; --red: #ff4c4c; --bg: #05070a; --card: rgba(22, 27, 34, 0.7); --border: #30363d; }
body { background: var(--bg); color: #f0f6fc; font-family: 'Segoe UI', system-ui; margin: 0; overflow-x: hidden; }
.glass { background: var(--card); backdrop-filter: blur(10px); border: 1px solid var(--border); border-radius: 16px; transition: 0.3s; }
.glass:hover { border-color: var(--accent); transform: translateY(-5px); }
.gold-card { border: 1px solid var(--gold) !important; box-shadow: 0 0 15px rgba(255, 204, 0, 0.1); }
.gold-card:hover { box-shadow: 0 0 25px rgba(255, 204, 0, 0.3); }
.accent-text { color: var(--accent); text-shadow: 0 0 10px rgba(0,212,255,0.3); }
.gold-text { color: var(--gold); text-shadow: 0 0 10px rgba(255,204,0,0.3); }
.input-field { background: #010409; border: 1px solid var(--border); color: white; padding: 12px; border-radius: 8px; outline: none; box-sizing: border-box; }
.btn { background: transparent; border: 1px solid var(--accent); color: var(--accent); padding: 8px 16px; cursor: pointer; border-radius: 6px; font-weight: 600; text-transform: uppercase; font-size: 10px; }
.btn:hover { background: var(--accent); color: #000; }
.mood-tag { font-size: 10px; padding: 3px 8px; border-radius: 10px; background: rgba(0,212,255,0.1); color: var(--accent); border: 1px solid rgba(0,212,255,0.3); margin-right: 5px; cursor: pointer; }
.mood-tag.selected { background: var(--accent); color: black; }
.pace-badge { font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(0,212,255,0.1); color: var(--accent); border: 1px solid var(--accent); font-family: monospace; }
.type-tag { font-size: 8px; padding: 2px 4px; border-radius: 3px; background: #30363d; color: #8b949e; margin-left: 5px; vertical-align: middle; }
.search-header { background: rgba(0,212,255,0.1); color: var(--accent); padding: 5px 15px; font-size: 10px; font-weight: bold; letter-spacing: 1px; border-bottom: 1px solid var(--border); }
.chrono-link { display: flex; gap: 10px; overflow-x: auto; padding: 10px 0; border-top: 1px solid var(--border); margin-top: 10px; scrollbar-width: none; }
.chrono-item { font-size: 10px; padding: 5px 12px; border: 1px solid var(--border); border-radius: 4px; white-space: nowrap; color: #8b949e; display: flex; align-items: center; gap: 8px; }
.chrono-today { border-color: var(--accent); color: var(--accent); background: rgba(0,212,255,0.05); }
.chrono-future { border-color: #58a6ff; color: #58a6ff; }
.mic-btn { background: none; border: none; color: var(--accent); cursor: pointer; font-size: 18px; margin-left: -40px; z-index: 101; transition: 0.3s; }
.mic-active { color: var(--red) !important; text-shadow: 0 0 10px var(--red); transform: scale(1.2); }
@media (max-width: 1024px) {
    .glass { width: 200px !important; margin: 10px !important; }
    .input-field#q { width: 250px !important; }
}
@media (max-width: 600px) {
    body { overflow-y: auto; }
    header div { flex-direction: column; align-items: flex-start !important; gap: 20px; }
    .input-field#q { width: 100% !important; margin-bottom: 10px; }
    .mic-btn { margin-left: -35px; margin-top: -10px; }
    .glass { width: 90% !important; display: block !important; margin: 20px auto !important; }
    body[style*="flex"] { flex-direction: column !important; height: auto !important; overflow: auto !important; }
    div[style*="width:380px"] { width: 100% !important; border-right: none !important; border-bottom: 1px solid var(--border); padding: 20px !important; box-sizing: border-box; }
    div[style*="flex:1"] { padding: 20px !important; }
}
@media (min-width: 1800px) {
    .glass { width: 300px !important; }
    h1 { font-size: 48px; }
    .btn { font-size: 14px; padding: 12px 24px; }
}
</style>
`;
const VOICE_SCRIPT = `
<script>
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        function startVoiceInput(targetId) {
            const mic = document.getElementById('mic-icon');
            if(mic) {
                mic.classList.add('mic-active');
                mic.innerText = '🛑'; 
            }
            recognition.start();
            recognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                const input = document.getElementById(targetId);
                if(input) {
                    input.value = text;
                    if(targetId === 'q') search();
                    if(targetId === 'chat-in') chat();
                }
            };
            recognition.onend = () => {
                if(mic) {
                    mic.classList.remove('mic-active');
                    mic.innerText = '🎤';
                }
            };
            recognition.onerror = (event) => {
                console.error("Speech Error: ", event.error);
                if(mic) {
                    mic.classList.remove('mic-active');
                    mic.innerText = '🎤';
                }
            };
        }
    } else {
        console.log("Speech Recognition not supported in this browser.");
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
        let paceHtml = "";
        if (s.currentEpisode > 0) {
            const start = s.startDate ? new Date(s.startDate) : new Date();
            const now = new Date();
            const daysDiff = Math.max(1, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
            const dpe = (daysDiff / s.currentEpisode).toFixed(1);
            paceHtml = `<span class="pace-badge">⚡ ${dpe} DAYS / EP</span>`;
        }
        let posterUrl = s.poster;
        if (posterUrl && !posterUrl.startsWith('http')) posterUrl = `https://image.tmdb.org/t/p/w500${posterUrl}`;
        const accentColor = isGold ? 'var(--gold)' : 'var(--accent)';
        return `
        <div class="glass ${isGold ? 'gold-card' : ''}" id="card-${s.id}" style="width:240px; padding:20px; text-align:left; display:inline-block; margin:15px; vertical-align:top;">
            <div style="position:relative;">
                <img src="${posterUrl}" style="width:100%; height:330px; object-fit:cover; border-radius:10px; margin-bottom:15px; ${isGold ? 'filter: sepia(0.3);' : ''}">
                <div style="position:absolute; bottom:20px; left:0; width:100%; height:4px; background:rgba(0,0,0,0.5); border-radius:2px; overflow:hidden;">
                    <div id="prog-${s.id}" style="width:${progress}%; height:100%; background:${accentColor}; shadow: 0 0 10px ${accentColor};"></div>
                </div>
            </div>
            <h3 style="font-size:16px; margin:0 0 5px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                <a href="/show/${s.type}/${s.id}" style="color:white; text-decoration:none;">${s.title}</a>
            </h3>
            <div style="height: 20px; margin-bottom: 5px;">${paceHtml}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px; background:#010409; padding:5px 10px; border-radius:6px; border:1px solid var(--border);">
                    <button onclick="updateEp('${s.id}', 'minus')" style="color:var(--red); border:none; background:none; cursor:pointer;">-</button>
                    <span id="ep-count-${s.id}" style="font-family:monospace; color:${accentColor}; font-weight:bold;">${s.currentEpisode}/${total}</span>
                    <button onclick="updateEp('${s.id}', 'plus')" style="color:${accentColor}; border:none; background:none; cursor:pointer;">+</button>
                </div>
                <span style="font-size:10px; opacity:0.5; font-family:monospace;">${isGold ? 'ARCHIVED' : progress + '% SYNC'}</span>
            </div>
        </div>`;
    };
    res.send(`<html><head>${HUD_STYLE}</head><body>
        <div style="padding:50px; max-width:1400px; margin:auto; text-align:center;">
            <header style="border-bottom:1px solid var(--border); padding-bottom:30px; margin-bottom:50px; text-align:left;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                    <div><h1>VANTAGE <span class="accent-text">VAULT</span></h1></div>
                    <div style="position:relative; display:flex; align-items:center;">
                        <input id="q" class="input-field" style="width:350px;" placeholder="Search MAL or TMDB..." onkeyup="if(event.key==='Enter') search()">
                        <button onclick="startVoiceInput('q')" class="mic-btn" id="mic-icon">🎤</button>
                        <div id="results" style="display:none; position:absolute; top:55px; left:0; width:100%; z-index:100; max-height:400px; overflow-y:auto;" class="glass"></div>
                    </div>
                </div>
                <div id="chrono-link-area">
                    <div style="font-size: 10px; letter-spacing: 1px; color: var(--accent); margin-top:20px; font-weight:bold; display:flex; align-items:center; gap:8px;">
                        <span>CHRONO-LINK</span>
                        <span style="height:1px; flex:1; background:var(--border);"></span>
                    </div>
                    <div class="chrono-link" id="schedule-bar"><span style="font-size:10px; opacity:0.3;">Scanning airwaves...</span></div>
                </div>
            </header>
            <h2 style="text-align:left; font-size:14px; letter-spacing:2px; opacity:0.6; margin-left:15px;">ACTIVE SYNC</h2>
            <div style="display:block; text-align:left;">${activeSyncs.length ? activeSyncs.map(s => renderCard(s, false)).join('') : '<p style="opacity:0.3; padding:20px;">No active archives.</p>'}</div>
            ${hallOfFame.length ? `
                <h2 class="gold-text" style="text-align:left; font-size:14px; letter-spacing:2px; margin-top:60px; margin-left:15px;">HALL OF FAME</h2>
                <div style="display:block; text-align:left;">${hallOfFame.map(s => renderCard(s, true)).join('')}</div>
            ` : ''}
        </div>
        ${VOICE_SCRIPT}
        <script>
            async function loadSchedule() {
                const r = await fetch('/api/schedule');
                const d = await r.json();
                const bar = document.getElementById('schedule-bar');
                if(d.length === 0) {
                    bar.innerHTML = '<span class="chrono-item">Static on all frequencies. No live broadcasts today.</span>';
                    return;
                }
                bar.innerHTML = d.map(item => {
                    const statusClass = item.status === 'today' ? 'chrono-today' : 'chrono-future';
                    const icon = item.type === 'anime' ? '📺' : '🎬';
                    return \`<div class="chrono-item \${statusClass}">\${icon} \${item.title} - \${item.time}</div>\`;
                }).join('');
            }
            loadSchedule();
            async function search(){
                const q = document.getElementById('q').value;
                const resDiv = document.getElementById('results');
                resDiv.style.display = 'block'; resDiv.innerHTML = '<p style="padding:15px;">Scanning...</p>';
                const r = await fetch('/api/search?q='+q);
                const d = await r.json();
                let html = "";
                if(d.mal.length > 0) {
                    html += '<div class="search-header">ANIME (MAL)</div>';
                    html += d.mal.map(i => renderSearchItem(i)).join('');
                }
                if(d.tmdb.length > 0) {
                    html += '<div class="search-header">WORLD MEDIA (TMDB)</div>';
                    html += d.tmdb.map(i => renderSearchItem(i)).join('');
                }
                resDiv.innerHTML = html || '<p style="padding:15px;">No results found.</p>';
            }
            function renderSearchItem(i) {
                let actions = '';
                if(i.seasons) {
                    actions = i.seasons.map(sn => \`<button class="btn" style="margin:2px; padding:2px 5px;" onclick="location.href='/save?title=\${encodeURIComponent(i.title+" (S"+sn.season_number+")")}&id=\${i.id}_S\${sn.season_number}&poster=\${encodeURIComponent(sn.poster_path||i.poster_path)}&type=tv&source=tmdb&total=\${sn.episode_count}'">S\${sn.season_number}</button>\`).join('');
                } else {
                    actions = \`<button class="btn" onclick="location.href='/save?title=\${encodeURIComponent(i.title)}&id=\${i.id}&poster=\${encodeURIComponent(i.poster_path)}&type=\${i.media_type}&source=\${i.source}&total=\${i.total}'">ADD</button>\`;
                }
                return \`<div style="padding:15px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #30363d;">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:12px;">\${i.title} <span class="type-tag">\${i.media_type.toUpperCase()}</span></span>
                        <span style="font-size:10px; opacity:0.5; margin-top:4px;">\${i.year || 'N/A'}</span>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; justify-content:flex-end; max-width:150px;">\${actions}</div>
                </div>\`;
            }
            async function updateEp(id, action){
                const r = await fetch('/api/update/'+id+'?action='+action);
                location.reload();
            }
        </script>
    </body></html>`);
});
app.get('/show/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const watchlist = await getWatchlist();
    const local = watchlist.find(s => s.id == id);
    let data = {};
    let studioInfo = "";
    try {
        if (local && local.source === 'mal') {
            const jikan = await axios.get(`https://api.jikan.moe/v4/anime/${id.split('_')[0]}`);
            const anime = jikan.data.data;
            data = { title: anime.title, overview: anime.synopsis || "No data available.", poster_path: anime.images.jpg.large_image_url };
            studioInfo = `<div style="font-size:10px; color:var(--accent); margin-bottom:15px; border:1px solid rgba(0,212,255,0.2); padding:5px; border-radius:4px;">MAL UPLINK: ${anime.studios[0]?.name || 'Unknown'}</div>`;
        } else {
            const cleanId = id.split('_')[0];
            const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${cleanId}?api_key=${API_KEY}`);
            data = tmdbRes.data;
        }
    } catch(e) { return res.send(`Error retrieving data.`); }
    // Convert Map back to plain object for display
    const logs = local?.logs ? Object.fromEntries(local.logs) : {};
    const moods = ["Intrigued", "Tense", "Melancholic", "Inspired", "Shocked", "Nostalgic"];
    let displayPoster = local?.poster || data.poster_path;
    if (displayPoster && !displayPoster.startsWith('http')) displayPoster = `https://image.tmdb.org/t/p/w500${displayPoster}`;
    res.send(`<html><head>${HUD_STYLE}</head><body style="display:flex; height:100vh; overflow:hidden;">
        <div style="width:380px; border-right:1px solid var(--border); background:#0d1117; padding:40px; overflow-y:auto;">
            <img src="${displayPoster}" style="width:100%; border-radius:15px; margin-bottom:30px;">
            <h2 style="margin:0 0 10px 0;">${local?.title || data.title}</h2>
            ${studioInfo}
            <p style="font-size:13px; opacity:0.6; line-height:1.6;">${data.overview?.substring(0, 300)}...</p>
            <div style="text-align:center; margin:30px 0;">
                <div id="rating-box">
                    ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button onclick="setRating(${n})" style="width:28px; height:28px; margin:3px; border:1px solid var(--accent); background:${local?.personalRating==n?'var(--accent)':'none'}; color:${local?.personalRating==n?'#000':'var(--accent)'}; border-radius:50%; cursor:pointer; font-size:10px;">${n}</button>`).join('')}
                </div>
            </div>
            <button onclick="location.href='/watchlist'" class="btn" style="width:100%; margin-bottom:10px;">Vault</button>
            <button onclick="purgeShow()" class="btn btn-red" style="width:100%; opacity:0.5;">Delete</button>
        </div>
        <div style="flex:1; padding:60px; overflow-y:auto; background:#05070a;">
            <div class="glass" style="padding:30px; margin-bottom:40px;">
                <div id="chat-win" style="height:150px; overflow-y:auto; border-bottom:1px solid var(--border); margin-bottom:20px;">
                    <div style="color:var(--accent);"><b>VANTAGE:</b> Archive Ready. (Say "Vantage" to wake)</div>
                </div>
                <div style="display:flex; gap:15px; align-items:center;">
                    <input id="chat-in" class="input-field" style="flex:1;" placeholder="Query..." onkeyup="if(event.key==='Enter') chat()">
                    <button onclick="startVoiceInput('chat-in')" class="mic-btn" id="mic-icon" style="margin:0; position:static;">🎤</button>
                    <button class="btn" onclick="chat()">Send</button>
                </div>
            </div>
            <div class="glass" style="padding:30px;">
                <div id="mood-picker" style="margin-bottom:15px;">
                    ${moods.map(m => `<span class="mood-tag" onclick="selectMood(this, '${m}')">${m}</span>`).join('')}
                </div>
                <textarea id="logText" class="input-field" style="width:100%; height:80px; margin-bottom:15px;" placeholder="Log..."></textarea>
                <div style="display:flex; justify-content:space-between;">
                    <span>EP <input id="ep" type="number" value="${local?.currentEpisode || 0}" class="input-field" style="width:60px;"></span>
                    <button class="btn" onclick="saveLog()">Save</button>
                </div>
            </div>
            <div id="log-list" style="margin-top:30px;">
                ${Object.keys(logs).sort((a,b)=>b-a).map(ep => `
                    <div class="glass" style="padding:20px; margin-bottom:15px; border-left:4px solid var(--accent);">
                        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:10px;">
                            <b style="color:var(--accent);">EPISODE ${ep}</b><span>${logs[ep].mood || ''} | ${logs[ep].date}</span>
                        </div>
                        <p style="margin:0; opacity:0.9;">${logs[ep].text}</p>
                    </div>`).join('')}
            </div>
        </div>
        ${VOICE_SCRIPT}
        <script>
            let curMood = "";
            function selectMood(el, m){ document.querySelectorAll('.mood-tag').forEach(t=>t.classList.remove('selected')); el.classList.add('selected'); curMood=m; }
            async function setRating(n){ await fetch('/api/update/${id}?rating='+n); location.reload(); }
            async function saveLog(){
                const text = document.getElementById('logText').value;
                const ep = document.getElementById('ep').value;
                await fetch('/api/journal/${id}', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ep, text, mood: curMood})});
                location.reload();
            }
            function purgeShow(){ if(confirm('Wipe?')) location.href='/api/delete-show/${id}'; }
            async function chat(){
                const inp = document.getElementById('chat-in');
                const win = document.getElementById('chat-win');
                if(!inp.value) return;
                win.innerHTML += '<div><b>You:</b> '+inp.value+'</div>';
                const r = await fetch('/api/vantage-chat/${id}', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:inp.value})});
                const d = await r.json();
                win.innerHTML += '<div style="color:var(--accent);"><b>VANTAGE:</b> '+d.response+'</div>';
                inp.value = ''; win.scrollTop = win.scrollHeight;
            }
        </script>
    </body></html>`);
});
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
        } catch (e) { console.log("Jikan Sched Fail"); }
    }
    const tmdbItems = watchlist.filter(s => s.source === 'tmdb' && s.currentEpisode === 0);
    for (const item of tmdbItems) {
        try {
            const cleanId = item.id.split('_')[0];
            const detail = await axios.get(`https://api.themoviedb.org/3/${item.type}/${cleanId}?api_key=${API_KEY}`);
            const date = detail.data.release_date || detail.data.first_air_date;
            if (date) {
                const releaseDate = new Date(date);
                const today = new Date();
                if (releaseDate > today) {
                    results.push({ title: item.title, time: releaseDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}), type: item.type, status: 'upcoming' });
                }
            }
        } catch (e) { console.log("TMDB Sched Fail"); }
    }
    res.json(results);
});
app.get('/api/search', async (req, res) => {
    try {
        let malResults = [];
        let tmdbResults = [];
        const malRes = await axios.get(`https://api.jikan.moe/v4/anime?q=${req.query.q}&limit=5`).catch(()=>({data:{data:[]}}));
        if (malRes.data.data) {
            malResults = malRes.data.data.map(a => ({ 
                id: a.mal_id, title: a.title, poster_path: a.images.jpg.image_url, 
                media_type: 'anime', source: 'mal', total: a.episodes || 12,
                year: a.year || a.aired?.from?.split('-')[0]
            }));
        }
        const { data } = await axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${req.query.q}`).catch(()=>({data:{results:[]}}));
        tmdbResults = await Promise.all(data.results.filter(i => i.poster_path).slice(0, 6).map(async i => {
            let seasons = null;
            if (i.media_type === 'tv') {
                const det = await axios.get(`https://api.themoviedb.org/3/tv/${i.id}?api_key=${API_KEY}`).catch(()=>({data:{seasons:[]}}));
                seasons = det.data.seasons.filter(s => s.season_number > 0);
            }
            return { 
                id: i.id, title: i.name || i.title, poster_path: i.poster_path, 
                media_type: i.media_type, source: 'tmdb', total: 1, seasons: seasons,
                year: (i.release_date || i.first_air_date || "").split('-')[0]
            };
        }));
        res.json({ mal: malResults, tmdb: tmdbResults });
    } catch (e) { res.json({ mal: [], tmdb: [] }); }
});
app.get('/save', async (req, res) => {
    const { id, title, poster, type, source, total } = req.query;
    await saveWatchlist({ 
        id, title: decodeURIComponent(title), poster: decodeURIComponent(poster), 
        type, source, currentEpisode: 0, 
        totalEpisodes: type === 'movie' ? 1 : (parseInt(total) || 12), 
        logs: {}, personalRating: 0,
        startDate: new Date().toISOString() 
    });
    res.redirect('/watchlist');
});
app.get('/api/update/:id', async (req, res) => {
    const show = await Show.findOne({ id: req.params.id });
    if (show) {
        const total = show.totalEpisodes || 1;
        if (req.query.action === 'plus' && show.currentEpisode < total) show.currentEpisode++;
        if (req.query.action === 'minus' && show.currentEpisode > 0) show.currentEpisode--;
        if (req.query.rating) show.personalRating = parseInt(req.query.rating);
        await show.save();
        res.json({ success: true });
    } else { res.json({ success: false }); }
});
app.post('/api/journal/:id', async (req, res) => {
    const show = await Show.findOne({ id: req.params.id });
    if (show) {
        if (!show.logs) show.logs = new Map();
        // Since logs is a Map in Mongoose, we use .set()
        show.logs.set(req.body.ep.toString(), { 
            text: req.body.text, 
            mood: req.body.mood, 
            date: new Date().toLocaleDateString() 
        });
        await show.save();
    }
    res.json({ success: true });
});
app.get('/api/delete-show/:id', async (req, res) => {
    await Show.deleteOne({ id: req.params.id });
    res.redirect('/watchlist');
});
app.listen(PORT, () => console.log(`🚀 VANTAGE ONLINE | PORT ${PORT}`));