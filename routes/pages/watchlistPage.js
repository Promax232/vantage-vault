const express = require('express');
const router = express.Router();
const { getWatchlist } = require('../../db/index');
const { HUD_STYLE, NAV_COMPONENT, VOICE_SCRIPT } = require('../../ui/layout');

router.get('/watchlist', async (req, res) => {
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

module.exports = router;
