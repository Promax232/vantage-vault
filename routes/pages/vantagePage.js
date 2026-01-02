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
            <title>Vantage OS | Deep Archive</title>
            ${HUD_STYLE}
        </head>
        <body>
            ${NAV_COMPONENT}
            <div class="main-panel">
                <h1 class="accent-text">VANTAGE OS <span style="color:white; opacity:0.3;">// DEEP ARCHIVE</span></h1>
                
                <div class="glass" style="padding: 30px; margin-bottom: 40px; display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                    <div style="flex: 1;">
                        <label style="font-size: 10px; letter-spacing: 2px; opacity: 0.5;">CHRONO_YEAR</label>
                        <select id="yearSelect" class="input-field" style="margin-top: 10px;">
                            ${Array.from({length: 31}, (_, i) => 2025 - i).map(y => `<option value="${y}">${y}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 10px; letter-spacing: 2px; opacity: 0.5;">SEASON_PHASE</label>
                        <select id="seasonSelect" class="input-field" style="margin-top: 10px;">
                            <option value="winter">WINTER</option>
                            <option value="spring">SPRING</option>
                            <option value="summer">SUMMER</option>
                            <option value="fall" selected>FALL</option>
                        </select>
                    </div>
                    <button class="btn" onclick="engageUplink()" style="margin-top: 25px;">ENGAGE UPLINK</button>
                </div>

                <div id="archiveGrid" class="poster-grid">
                    <p style="opacity: 0.4;">Waiting for Time Dial selection...</p>
                </div>
            </div>

            <script>
                async function engageUplink() {
                    const year = document.getElementById('yearSelect').value;
                    const season = document.getElementById('seasonSelect').value;
                    const grid = document.getElementById('archiveGrid');
                    
                    grid.innerHTML = '<p class="accent-text">FETCHING ARCHIVE DATA...</p>';
                    
                    try {
                        const res = await fetch(\`/api/vantage-data?type=archive&year=\${year}&season=\${season}\`);
                        const data = await res.json();
                        
                        grid.innerHTML = data.map(show => \`
                            <div class="glass" style="padding: 10px; text-align: center; cursor: pointer;" onclick="location.href='/anime-detail/\${show.id}'">
                                <img src="\${show.poster}" style="width: 100%; border-radius: 10px;">
                                <p style="font-size: 12px; margin-top: 10px; height: 35px; overflow: hidden;">\${show.title}</p>
                                <button class="btn" style="width: 100%; font-size: 8px;" onclick="event.stopPropagation(); saveToVault('\${show.id}', '\${encodeURIComponent(show.title)}', '\${encodeURIComponent(show.poster)}')">SAVE TO VAULT</button>
                            </div>
                        \`).join('');
                    } catch(e) {
                        grid.innerHTML = '<p style="color: red;">Uplink Interrupted.</p>';
                    }
                }

                async function saveToVault(id, title, poster) {
                    window.location.href = \`/api/watchlist/save?id=\${id}&title=\${title}&poster=\${poster}&type=anime&source=mal&total=12&status=planned\`;
                }
            </script>
        </body>
        </html>
    `);
});

module.exports = router;