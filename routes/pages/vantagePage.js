const express = require('express');
const router = express.Router();
const { HUD_STYLE, NAV_COMPONENT } = require('../../ui/layout');

router.get('/vantage', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <meta name="theme-color" content="#0b0c10">
            <title>Vantage OS | Intelligence HUD</title>
            ${HUD_STYLE}
            <style>
                * {
                    -webkit-tap-highlight-color: transparent;
                    -webkit-font-smoothing: antialiased;
                }

                body {
                    background: #0b0c10;
                    overflow-x: hidden;
                    padding-bottom: 20px;
                }

                /* EXTRA GRIDS FOR DASHBOARD */
                .poster-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 20px;
                    padding: 5px;
                }

                @media(max-width: 480px) {
                    .poster-grid {
                        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                        gap: 15px;
                    }
                }

                .grid-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid rgba(255,255,255,0.05);
                    background: rgba(0,0,0,0.3);
                    border-radius: 8px;
                    overflow: hidden;
                    position: relative;
                }
                .grid-card:hover {
                    transform: translateY(-5px) scale(1.02);
                    box-shadow: 0 15px 40px rgba(0,0,0,0.6);
                    background: rgba(255,255,255,0.02);
                }

                /* Tab buttons */
                .tab-buttons {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 20px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                    padding: 5px;
                }
                .tab-buttons::-webkit-scrollbar {
                    display: none;
                }
                .mode-btn {
                    flex-shrink: 0;
                    padding: 12px 20px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #888;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                .mode-btn.active {
                    background: rgba(0, 212, 255, 0.15);
                    border-color: rgba(0, 212, 255, 0.3);
                    color: #00d4ff;
                    box-shadow: 0 0 15px rgba(0, 212, 255, 0.2);
                }
                .mode-btn:hover {
                    transform: translateY(-2px);
                }

                /* Archive controls */
                #archiveControls {
                    display: none;
                    gap: 15px;
                    margin-bottom: 25px;
                    padding: 20px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 8px;
                    border-left: 2px solid var(--accent);
                    flex-wrap: wrap;
                    align-items: flex-end;
                }
                .archive-control-group {
                    flex: 1;
                    min-width: 140px;
                }
                .control-label {
                    font-size: 9px;
                    letter-spacing: 1px;
                    color: var(--accent);
                    margin-bottom: 8px;
                    display: block;
                    text-transform: uppercase;
                }
                .control-select {
                    width: 100%;
                    padding: 12px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 6px;
                    color: white;
                    font-size: 13px;
                    appearance: none;
                    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300d4ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
                    background-repeat: no-repeat;
                    background-position: right 10px center;
                    background-size: 16px;
                }
                .control-select:focus {
                    outline: none;
                    border-color: var(--accent);
                    box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.2);
                }

                /* Airing badge */
                .airing-badge {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: rgba(0, 212, 255, 0.9);
                    color: #000;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 9px;
                    font-weight: bold;
                    z-index: 2;
                    backdrop-filter: blur(10px);
                }

                /* Loader */
                .loader {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 3px solid rgba(255,255,255,0.1);
                    border-top-color: var(--accent);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-right: 10px;
                    vertical-align: middle;
                }

                @keyframes blink { 
                    50% { opacity: 0.3; } 
                }
                @keyframes spin { 
                    to { transform: rotate(360deg); } 
                }
            </style>
        </head>
        <body>
            ${NAV_COMPONENT}
            
            <div class="main-panel">
                <div style="margin-bottom: 25px;">
                    <h1 class="accent-text" style="font-size: 32px; margin-bottom: 5px; line-height: 1.2;">VANTAGE OS</h1>
                    <p style="color: #888; font-size: 12px; letter-spacing: 1px;">SATELLITE UPLINK • ANILIST GRAPHQL NODE</p>
                </div>
                
                <div class="tab-buttons">
                    <button class="mode-btn active" onclick="setMode('current')" id="btn-current">
                        <span style="font-size: 14px;">⚡</span> CURRENT
                    </button>
                    <button class="mode-btn" onclick="setMode('airing')" id="btn-airing">
                        <span style="font-size: 14px;">⏰</span> AIRING TODAY
                    </button>
                    <button class="mode-btn" onclick="setMode('top')" id="btn-top">
                        <span style="font-size: 14px;">⭐</span> TOP RATED
                    </button>
                    <button class="mode-btn" onclick="setMode('archive')" id="btn-archive">
                        <span style="font-size: 14px;">📚</span> DEEP ARCHIVE
                    </button>
                </div>

                <div id="archiveControls">
                    <div class="archive-control-group">
                        <label class="control-label">TARGET YEAR</label>
                        <select id="yearSelect" class="control-select">
                            ${Array.from({length: 50}, (_, i) => 2026 - i).map(y => 
                                `<option value="${y}" ${y === 2024 ? 'selected' : ''}>${y}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="archive-control-group">
                        <label class="control-label">SEASON CYCLE</label>
                        <select id="seasonSelect" class="control-select">
                            <option value="winter">WINTER</option>
                            <option value="spring">SPRING</option>
                            <option value="summer">SUMMER</option>
                            <option value="fall">FALL</option>
                        </select>
                    </div>
                    <button class="btn" onclick="engageUplink('archive')" style="height: 44px; min-width: 120px; background: var(--accent);">
                        INITIATE SCAN
                    </button>
                </div>

                <div id="gridContainer">
                    <div id="archiveGrid" class="poster-grid">
                        <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                            <div class="loader" style="width: 30px; height: 30px; margin: 0 auto 15px;"></div>
                            <p class="accent-text" style="animation: blink 1.5s infinite;">ESTABLISHING UPLINK...</p>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                let currentMode = 'current';

                function setMode(mode) {
                    currentMode = mode;
                    
                    // Update button states
                    document.querySelectorAll('.mode-btn').forEach(b => {
                        b.classList.remove('active');
                        b.style.opacity = '0.7';
                    });
                    document.getElementById('btn-' + mode).classList.add('active');
                    document.getElementById('btn-' + mode).style.opacity = '1';

                    // Show/hide archive controls
                    const archiveControls = document.getElementById('archiveControls');
                    archiveControls.style.display = (mode === 'archive') ? 'flex' : 'none';

                    // Load data for the selected mode
                    engageUplink(mode);
                }

                async function engageUplink(mode) {
                    const grid = document.getElementById('archiveGrid');
                    const year = document.getElementById('yearSelect').value;
                    const season = document.getElementById('seasonSelect').value;
                    
                    // Show loading
                    grid.innerHTML = \`
                        <div style="grid-column: 1 / -1; text-align: center; padding: 30px;">
                            <div class="loader" style="width: 30px; height: 30px; margin: 0 auto 15px;"></div>
                            <p class="accent-text">\${mode === 'airing' ? 'SCANNING TODAY\'S BROADCASTS...' : 
                                               mode === 'archive' ? 'ACCESSING DEEP ARCHIVE...' : 
                                               mode === 'top' ? 'ANALYZING TOP TIER DATA...' : 
                                               'SYNCING CURRENT SEASON...'}</p>
                        </div>
                    \`;
                    
                    try {
                        let url;
                        if (mode === 'airing') {
                            url = '/api/airing-today';
                        } else {
                            url = \`/api/vantage-data?type=\${mode}&year=\${year}&season=\${season}\`;
                        }
                        
                        const res = await fetch(url);
                        const data = await res.json();
                        
                        if (!data || data.error) {
                            throw new Error(data?.error || 'No data received');
                        }

                        if (data.length === 0) {
                            grid.innerHTML = \`
                                <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                                    <div style="font-size: 48px; color: #444; margin-bottom: 20px;">📡</div>
                                    <p class="accent-text">NO DATA FOUND</p>
                                    <p style="color: #666; font-size: 12px; margin-top: 10px;">Try adjusting your search parameters</p>
                                </div>
                            \`;
                            return;
                        }

                        grid.innerHTML = data.map(show => {
                            const airingTime = show.airTime ? \`
                                <div class="airing-badge">
                                    \${show.airTime}
                                </div>
                            \` : '';
                            
                            const airingInfo = show.episode ? \`
                                <div style="font-size: 9px; color: #00d4ff; margin-top: 5px; display: flex; align-items: center; gap: 5px;">
                                    <span style="font-size: 10px;">⏰</span> Ep \${show.episode}
                                </div>
                            \` : '';
                            
                            return \`
                            <div class="glass grid-card" onclick="location.href='/api/anime-detail/\${show.id}'">
                                \${airingTime}
                                
                                <div style="position:relative; aspect-ratio: 2/3; overflow: hidden;">
                                    <img 
                                        src="\${show.poster}" 
                                        style="width: 100%; height: 100%; object-fit: cover;"
                                        loading="lazy"
                                        onerror="this.src='https://via.placeholder.com/400x600/0b0c10/00d4ff?text=NO+IMAGE'"
                                    >
                                    <div style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.8); padding:3px 6px; border-radius:4px; font-size:9px; color:\${show.color}; font-weight: bold; border: 1px solid rgba(255,255,255,0.1);">
                                        ★ \${show.score || '??'}
                                    </div>
                                </div>
                                
                                <div style="padding: 12px;">
                                    <p style="font-size: 12px; height: 36px; overflow: hidden; line-height:1.3; color: #ddd; font-weight:500; margin-bottom: 8px;">
                                        \${show.title}
                                    </p>
                                    \${airingInfo}
                                    <button class="btn" 
                                        style="width: 100%; font-size: 10px; margin-top: 10px; padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);" 
                                        onmouseover="this.style.background='\${show.color}'; this.style.color='#000'; this.style.boxShadow='0 0 10px \${show.color}';"
                                        onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#fff'; this.style.boxShadow='none';"
                                        onclick="event.stopPropagation(); saveToVault('\${show.id}', '\${encodeURIComponent(show.title)}', '\${encodeURIComponent(show.poster)}')">
                                        <span style="font-size: 12px;">+</span> TRACK
                                    </button>
                                </div>
                            </div>
                        \`}).join('');
                    } catch(e) {
                        console.error('Uplink Error:', e);
                        grid.innerHTML = \`
                            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--red);">
                                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                                <p>SATELLITE LINK SEVERED</p>
                                <p style="color: #888; font-size: 12px; margin-top: 10px;">Check console or try again later</p>
                                <button onclick="engageUplink(currentMode)" class="btn" style="margin-top: 20px;">
                                    RETRY CONNECTION
                                </button>
                            </div>
                        \`;
                    }
                }

                async function saveToVault(id, title, poster) {
                    window.location.href = \`/api/watchlist/save?id=\${id}&title=\${title}&poster=\${poster}&type=anime&source=anilist&total=12&status=planned\`;
                }

                // Auto-load on startup
                window.onload = () => {
                    engageUplink('current');
                };

                // Add event listeners for archive controls
                document.getElementById('yearSelect').addEventListener('change', () => {
                    if (currentMode === 'archive') engageUplink('archive');
                });
                document.getElementById('seasonSelect').addEventListener('change', () => {
                    if (currentMode === 'archive') engageUplink('archive');
                });
            </script>
        </body>
        </html>
    `);
});

module.exports = router;