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
                .score-badge {
                    filter: blur(4px);
                    transition: 0.3s;
                    opacity: 0.7;
                }
                .grid-card:hover .score-badge {
                    filter: blur(0);
                    opacity: 1;
                }
                /* Jarvis Console Styles */
                #jarvis-console {
                    border-top: 1px solid var(--accent);
                    background: rgba(0,0,0,0.8);
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    padding: 20px;
                    z-index: 1000;
                }
            </style>
        </head>
        <body>
            ${NAV_COMPONENT}
            <div class="main-panel" style="padding-bottom: 150px;">
                <h1 class="accent-text" style="font-size: 36px; margin-bottom: 5px;">VANTAGE OS <span style="font-size: 14px; color: #666; vertical-align: middle; letter-spacing: 2px;">// SATELLITE UPLINK</span></h1>
                
                <div class="glass" style="padding: 15px; margin-bottom: 20px; display: flex; gap: 10px; overflow-x: auto;">
                    <button class="btn" onclick="setMode('current')" id="btn-current">SEASONAL</button>
                    <button class="btn" onclick="setMode('airing')" id="btn-airing">AIRING TODAY</button> 
                    <button class="btn" onclick="setMode('top')" id="btn-top">TOP RATED</button>
                    <button class="btn" onclick="setMode('archive')" id="btn-archive">DEEP ARCHIVE</button>
                </div>

                <div id="archiveControls" class="glass" style="padding: 25px; margin-bottom: 30px; display: none; gap: 15px; align-items: flex-end; flex-wrap: wrap; border-left: 2px solid var(--accent);">
                    <div style="flex: 1; min-width: 120px;">
                        <label style="font-size: 9px; letter-spacing: 1px; color: var(--accent);">TARGET_YEAR</label>
                        <select id="yearSelect" class="input-field" style="margin-top: 5px; width: 100%;">
                            ${Array.from({length: 46}, (_, i) => 2026 - i).map(y => `<option value="${y}" ${y === 2026 ? 'selected' : ''}>${y}</option>`).join('')}
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

            <div id="jarvis-console" class="glass">
                <div id="jarvis-output" style="color: #aaa; font-size: 13px; margin-bottom: 10px; max-height: 60px; overflow-y: auto; font-family: monospace;">
                    System Idle... Ready for input, Sir.
                </div>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="jarvis-input" class="input-field" style="flex: 1; background: transparent; border: 1px solid #333;" placeholder="Ask Jarvis (e.g. 'Search for the best C++ libraries for neuro-sims')">
                    <button class="btn" onclick="askJarvis()" style="width: 100px;">SEND</button>
                </div>
            </div>

            <script>
                // ... (Existing setMode logic) ...

                async function askJarvis() {
                    const input = document.getElementById('jarvis-input');
                    const output = document.getElementById('jarvis-output');
                    const message = input.value;
                    if(!message) return;

                    output.innerHTML = '<span class="accent-text">JARVIS IS THINKING...</span>';
                    input.value = '';

                    try {
                        const res = await fetch('/api/jarvis-core-query', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message })
                        });
                        const data = await res.json();
                        output.innerHTML = \`<b>JARVIS:</b> \${data.response}\`;
                    } catch (e) {
                        output.innerHTML = '<span style="color: red;">ERROR: UPLINK SEVERED.</span>';
                    }
                }

                // Keep your existing engageUplink function but ensure it calls the right route
                async function engageUplink(mode) {
                   // ... (Your existing AniList fetch logic remains the same)
                }

                window.onload = () => {
                    document.getElementById('btn-current').style.opacity = '1';
                    engageUplink('current');
                };
            </script>
        </body>
        </html>
    `);
});

module.exports = router;