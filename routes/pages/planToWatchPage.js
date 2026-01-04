const express = require('express');
const router = express.Router();
const { getWatchlist } = require('../../db/index');
const { HUD_STYLE, NAV_COMPONENT } = require('../../ui/layout');

router.get('/plan-to-watch', async (req, res) => {
    const list = await getWatchlist();
    const planned = list.filter(s => s.status === 'planned');

    const renderPlannedCard = (s) => {
        let posterUrl = s.poster;
        if (posterUrl && !posterUrl.startsWith('http')) posterUrl = `https://image.tmdb.org/t/p/w500${posterUrl}`;
        
        return `
        <div class="cryo-pod" onclick="location.href='/show/anime/${s.id}'">
            <div class="poster-wrapper">
                <img src="${posterUrl}" class="cryo-img">
                <div class="scan-line"></div>
                <div class="pod-overlay">
                    <div class="pod-stats">
                        <span>EPS: ${s.totalEpisodes || '??'}</span>
                        <span style="color:var(--accent);">TYPE: ${s.type?.toUpperCase() || 'INTEL'}</span>
                    </div>
                </div>
            </div>
            <div class="pod-info">
                <h4 class="pod-title">${s.title}</h4>
                <div style="display:flex; gap:8px; margin-top:12px;">
                    <button class="sync-btn" onclick="event.stopPropagation(); startSync('${s.id}')">
                        <span class="sync-icon">⚡</span> DEPLOY TO WATCHLIST
                    </button>
                </div>
            </div>
        </div>`;
    };

    res.send(`<html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${HUD_STYLE}
            <style>
                body { background: #08090a; }
                .cryo-pod { 
                    background: rgba(255,255,255,0.03); 
                    border-radius: 16px; 
                    overflow: hidden; 
                    border: 1px solid rgba(255,255,255,0.05);
                    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                    cursor: pointer;
                    position: relative;
                }
                .cryo-pod:hover { 
                    transform: translateY(-8px); 
                    border-color: var(--accent);
                    box-shadow: 0 15px 30px rgba(0,212,255,0.15);
                    background: rgba(255,255,255,0.06);
                }
                .poster-wrapper { position: relative; width: 100%; aspect-ratio: 2/3; overflow: hidden; }
                .cryo-img { 
                    width: 100%; height: 100%; object-fit: cover; 
                    filter: grayscale(0.6) brightness(0.7); 
                    transition: 0.5s; 
                }
                .cryo-pod:hover .cryo-img { filter: grayscale(0) brightness(1); transform: scale(1.05); }
                
                .scan-line {
                    position: absolute; top: 0; left: 0; width: 100%; height: 2px;
                    background: rgba(0, 212, 255, 0.5); box-shadow: 0 0 10px var(--accent);
                    animation: scan 3s linear infinite; opacity: 0;
                }
                .cryo-pod:hover .scan-line { opacity: 1; }

                .pod-overlay {
                    position: absolute; bottom: 0; width: 100%; padding: 20px;
                    background: linear-gradient(transparent, rgba(0,0,0,0.9));
                    opacity: 0; transition: 0.3s;
                }
                .cryo-pod:hover .pod-overlay { opacity: 1; }
                .pod-stats { display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; letter-spacing: 1px; }

                .pod-info { padding: 18px; }
                .pod-title { 
                    font-size: 14px; margin: 0; font-weight: 700; white-space: nowrap; 
                    overflow: hidden; text-overflow: ellipsis; color: #efefef;
                }
                
                .sync-btn {
                    width: 100%; background: transparent; border: 1px solid var(--accent);
                    color: var(--accent); padding: 10px; border-radius: 8px; font-size: 11px;
                    font-weight: 900; letter-spacing: 1px; cursor: pointer; transition: 0.2s;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                }
                .sync-btn:hover { background: var(--accent); color: #000; box-shadow: 0 0 15px var(--accent); }

                @keyframes scan {
                    0% { top: 0; }
                    100% { top: 100%; }
                }

                .accent-text { color: var(--accent); text-shadow: 0 0 10px var(--accent); }
            </style>
        </head>
        <body>
            ${NAV_COMPONENT}
            <div style="padding:40px 20px; max-width:1400px; margin:auto; padding-top:100px;">
                <div style="display:flex; justify-content:space-between; align-items: flex-end; margin-bottom: 40px;">
                    <div>
                        <h1 style="font-size:32px; margin:0; font-weight:900; letter-spacing:-1px;">DEEP <span class="accent-text">ARCHIVE</span></h1>
                        <p style="opacity:0.4; font-size:12px; margin-top:5px; font-weight:bold; letter-spacing:2px;">STATUS: CRYO-STASIS // READY FOR DEPLOYMENT</p>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:24px; font-weight:900; opacity:0.1;">${planned.length} ITEMS</span>
                    </div>
                </div>

                <div class="poster-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 30px;">
                    ${planned.map(s => renderPlannedCard(s)).join('')}
                    ${planned.length === 0 ? `
                        <div style="grid-column: 1/-1; text-align:center; padding:150px 0; border: 2px dashed rgba(255,255,255,0.05); border-radius: 20px;">
                            <div style="font-size:40px; margin-bottom:20px; opacity:0.2;">❄️</div>
                            <div style="opacity:0.3; letter-spacing:2px; font-size:14px; font-weight:bold;">CHAMBER EMPTY</div>
                        </div>` : ''}
                </div>
            </div>
            <script>
                async function startSync(id) {
                    const btn = event.target.closest('button');
                    btn.innerHTML = 'SYNCING...';
                    await fetch('/api/update-status/'+id+'?status=watching');
                    location.href = '/watchlist';
                }
            </script>
        </body></html>`);
});

module.exports = router;