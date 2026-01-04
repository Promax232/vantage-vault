const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getWatchlist } = require('../../db/index');
const { HUD_STYLE, NAV_COMPONENT, VOICE_SCRIPT } = require('../../ui/layout');

const API_KEY = process.env.TMDB_KEY;

router.get(['/show/:type/:id', '/show/:id'], async (req, res) => {
    let { type, id } = req.params;
    if (!type) type = 'anime';

    const watchlist = await getWatchlist();
    const local = watchlist.find(s => s.id == id);
    let intel = {}; // High-level AniList/TMDB data

    try {
        // PRIORITY: ANILIST UPLINK (For rich metadata)
        if (type === 'anime' || (local && local.source === 'mal')) {
            const query = `
            query ($id: Int) {
                Media (id: $id, type: ANIME) {
                    title { english romaji native }
                    description bannerImage coverImage { extraLarge color }
                    averageScore popularity status format episodes duration
                    nextAiringEpisode { episode timeUntilAiring }
                    rankings { rank type context allTime }
                    studios(isMain: true) { nodes { name } }
                    characters(sort: ROLE, perPage: 6) { nodes { name { full } image { medium } } }
                    trailer { site id }
                }
            }`;
            const aniRes = await axios.post('https://graphql.anilist.co', { 
                query, 
                variables: { id: parseInt(id.split('_')[0]) } 
            });
            const m = aniRes.data.data.Media;
            intel = {
                title: m.title.english || m.title.romaji,
                native: m.title.native,
                overview: m.description,
                poster: m.coverImage.extraLarge,
                banner: m.bannerImage,
                color: m.coverImage.color,
                score: m.averageScore ? (m.averageScore / 10).toFixed(1) : '??',
                rank: m.rankings?.find(r => r.type === 'RATED' && r.allTime)?.rank,
                chars: m.characters?.nodes || [],
                studio: m.studios?.nodes[0]?.name || "Unknown",
                trailer: m.trailer?.site === 'youtube' ? m.trailer.id : null,
                nextEp: m.nextAiringEpisode
            };
        } else {
            // TMDB FALLBACK (For Movies/Series)
            const tmdbRes = await axios.get(`https://api.themoviedb.org/3/${type}/${id.split('_')[0]}?api_key=${API_KEY}`);
            intel = {
                title: tmdbRes.data.title || tmdbRes.data.name,
                overview: tmdbRes.data.overview,
                poster: `https://image.tmdb.org/t/p/w500${tmdbRes.data.poster_path}`,
                score: tmdbRes.data.vote_average?.toFixed(1)
            };
        }
    } catch(e) { 
        console.error("Satellite Offline:", e.message);
        return res.status(500).send("<h2>SATELLITE ERROR: UPLINK SEVERED</h2>"); 
    }

    const logs = local?.logs ? (local.logs instanceof Map ? Object.fromEntries(local.logs) : local.logs) : {};
    const displayPoster = local?.poster || intel.poster;

    res.send(`
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${HUD_STYLE}
            <style>
                .score-blur { filter: blur(8px); transition: 0.4s; cursor: pointer; }
                .score-blur:hover { filter: blur(0); }
                .char-pill { background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; align-items: center; gap: 10px; padding: 5px; margin-bottom: 8px; border: 1px solid var(--border); }
                .char-img { width: 35px; height: 35px; border-radius: 5px; object-fit: cover; }
            </style>
        </head>
        <body>
            ${NAV_COMPONENT}
            <div class="split-view" style="padding-top:40px;">
                <div class="side-panel">
                    <img src="${displayPoster}" style="width:100%; border-radius:18px; margin-bottom:20px; box-shadow: 0 0 30px ${intel.color || 'var(--accent)'}44;">
                    
                    <h1 style="font-size:24px; margin:0 0 5px 0; font-weight:800;">${local?.title || intel.title}</h1>
                    <p style="font-size:12px; opacity:0.4; margin-bottom:20px; letter-spacing:1px;">${intel.native || intel.studio || ''}</p>

                    <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:15px; margin-bottom:20px; display:flex; justify-content:space-around; text-align:center;">
                        <div><div style="font-size:10px; opacity:0.5;">SCORE</div><div class="score-blur" style="font-weight:bold; color:var(--accent);">${intel.score}</div></div>
                        <div><div style="font-size:10px; opacity:0.5;">RANK</div><div style="font-weight:bold;">#${intel.rank || '??'}</div></div>
                    </div>

                    <div style="font-size:13px; opacity:0.7; line-height:1.6; margin-bottom:25px; max-height:150px; overflow-y:auto;">
                        ${intel.overview}
                    </div>

                    ${intel.chars.length > 0 ? `
                        <div style="margin-bottom:25px;">
                            <div style="font-size:10px; font-weight:bold; margin-bottom:10px; opacity:0.5;">KEY PERSONNEL</div>
                            ${intel.chars.map(c => `
                                <div class="char-pill">
                                    <img src="${c.image.medium}" class="char-img">
                                    <span style="font-size:12px;">${c.name.full}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    <div style="display:flex; gap:12px;">
                        <button onclick="location.href='/watchlist'" class="btn" style="flex:1;">Vault</button>
                        ${local ? `<button onclick="purgeShow()" class="btn" style="border-color:var(--red); color:var(--red);">Purge</button>` : 
                                 `<button onclick="saveToVault()" class="btn" style="border-color:var(--accent); color:var(--accent);">Track</button>`}
                    </div>
                </div>

                <div class="main-panel">
                    <div class="glass" style="padding:25px; margin-bottom:25px; border-top: 2px solid ${intel.color || 'var(--accent)'};">
                        <div id="chat-win" style="height:150px; overflow-y:auto; font-size:14px; margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:15px;">
                            <div style="color:var(--accent); font-weight:bold;">VANTAGE: Systems Active. Standing by for Intel request.</div>
                        </div>
                        <div style="display:flex; gap:12px;">
                            <input id="chat-in" class="input-field" placeholder="Analyze ${intel.title}..." onkeyup="if(event.key==='Enter') chat()">
                            <button class="btn" onclick="chat()">Analyze</button>
                        </div>
                    </div>

                    <div class="glass" style="padding:25px;">
                        <textarea id="logText" class="input-field" style="height:100px; margin-bottom:20px; resize:none;" placeholder="Log your observations..."></textarea>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="font-size:11px; font-weight:bold; opacity:0.6;">EPISODE</span>
                                <input id="ep" type="number" value="${local?.currentEpisode || 0}" class="input-field" style="width:70px; text-align:center;">
                            </div>
                            <button class="btn" onclick="saveLog()">Record Entry</button>
                        </div>
                    </div>

                    <div id="log-list" style="margin-top:30px;">
                        ${Object.keys(logs).sort((a,b)=>b-a).map(ep => `
                            <div class="glass" style="padding:20px; margin-bottom:15px; border-left:4px solid ${intel.color || 'var(--accent)'};">
                                <div style="font-size:10px; color:${intel.color || 'var(--accent)'}; font-weight:900; margin-bottom:8px;">ENTRY EP\${ep} // \${logs[ep].date}</div>
                                <div style="font-size:14px; opacity:0.9;">\${logs[ep].text}</div>
                            </div>`).join('')}
                    </div>
                </div>
            </div>
            ${VOICE_SCRIPT}
            <script>
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
                    win.innerHTML += '<div style="margin-bottom:10px;"><b>SIR:</b> '+inp.value+'</div>';
                    const r = await fetch('/api/vantage-chat/${id}', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:inp.value})});
                    const d = await r.json();
                    win.innerHTML += '<div style="color:var(--accent); margin-bottom:15px;"><b>JARVIS:</b> '+d.response+'</div>';
                    inp.value = ''; win.scrollTop = win.scrollHeight;
                }
                async function saveToVault() {
                    location.href = \`/api/watchlist/save?id=${id}&title=${encodeURIComponent(intel.title)}&poster=${encodeURIComponent(displayPoster)}&type=anime&source=anilist&status=planned\`;
                }
                function purgeShow(){ if(confirm('Erase from archive?')) location.href='/api/delete-show/${id}'; }
            </script>
        </body></html>
    `);
});

module.exports = router;
