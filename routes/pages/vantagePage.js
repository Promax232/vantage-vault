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
        </head>
        <body>
            ${NAV_COMPONENT}
            <div class="main-panel">
                <h1 class="accent-text">VANTAGE OS <span style="color:white; opacity:0.3;">// GLOBAL INTELLIGENCE</span></h1>
                
                <div class="glass" style="padding: 15px; margin-bottom: 20px; display: flex; gap: 10px; overflow-x: auto;">
                    <button class="btn" onclick="setMode('current')">CURRENT SEASON</button>
                    <button class="btn" onclick="setMode('schedule')">LIVE SCHEDULE</button>
                    <button class="btn" onclick="setMode('top')">TOP RATED</button>
                    <button class="btn" onclick="setMode('archive')">DEEP ARCHIVE</button>
                </div>

                <div id="archiveControls" class="glass" style="padding: 30px; margin-bottom: 40px; display: none; gap: 20px; align-items: center; flex-wrap: wrap;">
                    <div style="flex: 1;">
                        <label style="font-size: 10px; letter-spacing: 2px; opacity: 0.5;">CHRONO_YEAR</label>
                        <select id="yearSelect" class="input-field" style="margin-top: 10px;">
                            ${Array.from({length: 46}, (_, i) => 2026 - i).map(y => `<option value="${y}" ${y === 1995 ? 'selected' : ''}>${y}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 10px; letter-spacing: 2px; opacity: 0.5;">SEASON_PHASE</label>
                        <select id="seasonSelect" class="input-field" style="margin-top: 10px;">
                            <option value="winter">WINTER</option><option value="spring">SPRING</option>
                            <option value="summer">SUMMER</option><option value="fall">FALL</option>
                        </select>
                    </div>
                    <button class="btn" onclick="engageUplink('archive')" style="margin-top: 25px;">ENGAGE ARCHIVE</button>
                </div>

                <div id="archiveGrid" class="poster-grid">
                    <p class="accent-text">Initializing System...</p>
                </div>
            </div>

            <script>
                let currentMode = 'current';

                function setMode(mode) {
                    currentMode = mode;
                    document.getElementById('archiveControls').style.display = (mode === 'archive') ? 'flex' : 'none';
                    engageUplink(mode);
                }

                async function engageUplink(mode) {
                    const grid = document.getElementById('archiveGrid');
                    const year = document.getElementById('yearSelect').value;
                    const season = document.getElementById('seasonSelect').value;
                    
                    grid.innerHTML = '<p class="accent-text">UPLINKING TO MAL CORE...</p>';
                    
                    try {
                        const url = \`/api/vantage-data?type=\${mode}&year=\${year}&season=\${season}\`;
                        const res = await fetch(url);
                        const data = await res.json();
                        
                        grid.innerHTML = data.map(show => \`
                            <div class="glass" style="padding: 10px; text-align: center; cursor: pointer;" onclick="location.href='/api/anime-detail/\${show.id}'">
                                <div style="position:relative;">
                                    <img src="\${show.poster}" style="width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 10px;">
                                    <div style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.8); padding:2px 6px; border-radius:4px; font-size:10px; color:var(--accent);">★ \${show.score}</div>
                                </div>
                                <p style="font-size: 11px; margin-top: 10px; height: 35px; overflow: hidden; line-height:1.2;">\${show.title}</p>
                                <button class="btn" style="width: 100%; font-size: 8px; margin-top:5px;" onclick="event.stopPropagation(); saveToVault('\${show.id}', '\${encodeURIComponent(show.title)}', '\${encodeURIComponent(show.poster)}')">SAVE TO VAULT</button>
                            </div>
                        \`).join('');
                    } catch(e) {
                        grid.innerHTML = '<p style="color: var(--red);">Uplink Interrupted. Jikan Rate Limit Hit.</p>';
                    }
                }

                async function saveToVault(id, title, poster) {
                    window.location.href = \`/api/watchlist/save?id=\${id}&title=\${title}&poster=\${poster}&type=anime&source=mal&total=12&status=planned\`;
                }

                // Auto-load on startup
                window.onload = () => engageUplink('current');
            </script>
        </body>
        </html>
    `);
});

module.exports = router;