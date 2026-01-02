const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getWatchlist } = require('../../db/index');
const { HUD_STYLE, NAV_COMPONENT, VOICE_SCRIPT } = require('../../ui/layout');

const API_KEY = process.env.TMDB_KEY;

router.get('/show/:type/:id', async (req, res) => {
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

module.exports = router;
