const express = require('express');
const router = express.Router();
const { HUD_STYLE, NAV_COMPONENT } = require('../../ui/layout');

router.get('/vantage', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Vantage OS | Intelligence HUD</title>
            ${HUD_STYLE}
            <style>
                /* EXTRA GRIDS FOR DASHBOARD */
                .poster-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: 25px;
                }
                .grid-card {
                    transition: 0.3s;
                    border: 1px solid rgba(255,255,255,0.05);
                    background: rgba(0,0,0,0.3);
                }
                .grid-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 40px rgba(0,0,0,0.6);
                    background: rgba(255,255,255,0.02);
                }
            </style>
        </head>
        <body>
            ${NAV_COMPONENT}
            <div class="main-panel">
                <h1 class="accent-text" style="font-size: 36px; margin-bottom: 5px;">VANTAGE OS <span style="font-size: 14px; color: #666; vertical-align: middle; letter-spacing: 2px;">// SATELLITE UPLINK</span></h1>
                <p style="color: #888; margin-bottom: 30px; font-size: 12px;">CONNECTED TO ANILIST GRAPHQL NODE</p>
                
                <div class="glass" style="padding: 15px; margin-bottom: 20px; display: flex; gap: 10px; overflow-x: auto;">
                    <button class="btn" onclick="setMode('current')" id="btn-current">CURRENT SEASON</button>
                    <button class="btn" onclick="setMode('top')" id="btn-top">TOP RATED</button>
                    <button class="btn" onclick="setMode('archive')" id="btn-archive">DEEP ARCHIVE</button>
                </div>

                <div id="archiveControls" class="glass" style="padding: 25px; margin-bottom: 30px; display: none; gap: 15px; align-items: flex-end; flex-wrap: wrap; border-left: 2px solid var(--accent);">
                    <div style="flex: 1; min-width: 120px;">
                        <label style="font-size: 9px; letter-spacing: 1px; color: var(--accent);">TARGET_YEAR</label>
                        <select id="yearSelect" class="input-field" style="margin-top: 5px; width: 100%;">
                            ${Array.from({length: 46}, (_, i) => 2026 - i).map(y => `<option value="${y}" ${y === 2024 ? 'selected' : ''}>${y}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 120px;">
                        <label style="font-size: 9px; letter-spacing: 1px; color: var(--accent);">SEASON_CYCLE</label>
                        <select id="seasonSelect" class="input-field" style="margin-top: 5px; width: 100%;">
                            <option value="winter">WINTER</option><option value="spring">SPRING</option>
                            <option value="summer">SUMMER</option><option value="fall">FALL</option>
                        </select>
                    </div>
                    <button class="btn" onclick="engageUplink('archive')" style="height: 40px;">INITIATE SCAN</button>
                </div>

                <div id="archiveGrid" class="poster-grid">
                    <p class="accent-text">Awaiting Command...</p>
                </div>
            </div>

            <script>
                let currentMode = 'current';

                function setMode(mode) {
                    currentMode = mode;
                    // Reset Button States
                    document.querySelectorAll('.btn').forEach(b => b.style.opacity = '0.5');
                    document.getElementById('btn-' + mode).style.opacity = '1';

                    document.getElementById('archiveControls').style.display = (mode === 'archive') ? 'flex' : 'none';
                    engageUplink(mode);
                }

                async function engageUplink(mode) {
                    const grid = document.getElementById('archiveGrid');
                    const year = document.getElementById('yearSelect').value;
                    const season = document.getElementById('seasonSelect').value;
                    
                    grid.innerHTML = '<p class="accent-text" style="animation: blink 1s infinite;">ESTABLISHING UPLINK...</p>';
                    
                    try {
                        const url = \`/api/vantage-data?type=\${mode}&year=\${year}&season=\${season}\`;
                        const res = await fetch(url);
                        const data = await res.json();
                        
                        grid.innerHTML = data.map(show => \`
                            <div class="glass grid-card" style="padding: 10px; cursor: pointer; position: relative; overflow: hidden;" onclick="location.href='/api/anime-detail/\${show.id}'">
                                
                                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: \${show.color}; box-shadow: 0 0 15px \${show.color};"></div>

                                <div style="position:relative;">
                                    <img src="\${show.poster}" style="width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 6px;">
                                    <div style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.8); padding:3px 8px; border-radius:4px; font-size:10px; color:\${show.color}; font-weight: bold; border: 1px solid rgba(255,255,255,0.1);">
                                        ★ \${show.score}
                                    </div>
                                </div>
                                
                                <p style="font-size: 11px; margin-top: 12px; height: 30px; overflow: hidden; line-height:1.3; color: #ddd; font-weight:500;">\${show.title}</p>
                                
                                <button class="btn" style="width: 100%; font-size: 9px; margin-top:8px; padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);" 
                                    onmouseover="this.style.background='\${show.color}'; this.style.color='#000'; this.style.boxShadow='0 0 10px \${show.color}';"
                                    onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#fff'; this.style.boxShadow='none';"
                                    onclick="event.stopPropagation(); saveToVault('\${show.id}', '\${encodeURIComponent(show.title)}', '\${encodeURIComponent(show.poster)}')">
                                    + TRACK
                                </button>
                            </div>
                        \`).join('');
                    } catch(e) {
                        grid.innerHTML = '<p style="color: var(--red);">SATELLITE LINK SEVERED. CHECK CONSOLE.</p>';
                    }
                }

                async function saveToVault(id, title, poster) {
                    // UPDATED: Now logs source as 'anilist'
                    window.location.href = \`/api/watchlist/save?id=\${id}&title=\${title}&poster=\${poster}&type=anime&source=anilist&total=12&status=planned\`;
                }

                // Auto-load on startup
                window.onload = () => {
                    document.getElementById('btn-current').style.opacity = '1';
                    engageUplink('current');
                };
            </script>
            <style>
                @keyframes blink { 50% { opacity: 0.3; } }
            </style>
        </body>
        </html>
    `);
});

module.exports = router;