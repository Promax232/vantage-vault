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
            <title>Vantage OS | Intelligence HUD</title>
            ${HUD_STYLE}
            <style>
                /* EXTRA GRIDS FOR DASHBOARD */
                .poster-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: 25px;
                    min-height: 300px;
                }
                .grid-card {
                    transition: 0.3s;
                    border: 1px solid rgba(255,255,255,0.05);
                    background: rgba(0,0,0,0.3);
                    position: relative;
                    overflow: hidden;
                }
                .grid-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 40px rgba(0,0,0,0.6);
                    background: rgba(255,255,255,0.02);
                }
                
                /* MOBILE OPTIMIZATIONS */
                @media (max-width: 768px) {
                    .poster-grid {
                        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                        gap: 15px;
                    }
                    
                    .btn-group {
                        flex-wrap: nowrap;
                        overflow-x: auto;
                        padding-bottom: 10px;
                        -webkit-overflow-scrolling: touch;
                    }
                    
                    .btn-group .btn {
                        flex-shrink: 0;
                        white-space: nowrap;
                        font-size: 12px;
                        padding: 10px 15px;
                    }
                    
                    .main-panel {
                        padding: 15px !important;
                    }
                }
                
                @media (max-width: 480px) {
                    .poster-grid {
                        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                        gap: 12px;
                    }
                    
                    h1.accent-text {
                        font-size: 24px !important;
                    }
                }
                
                /* AIRING TODAY BADGE */
                .airing-badge {
                    position: absolute;
                    top: 5px;
                    left: 5px;
                    background: linear-gradient(135deg, #ff4757, #ff3838);
                    color: white;
                    font-size: 9px;
                    font-weight: bold;
                    padding: 3px 8px;
                    border-radius: 4px;
                    z-index: 2;
                    box-shadow: 0 2px 10px rgba(255, 71, 87, 0.5);
                }
                
                /* IMAGE FALLBACK */
                .poster-fallback {
                    width: 100%;
                    aspect-ratio: 2/3;
                    background: linear-gradient(135deg, #0b0c10, #1a1c23);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #666;
                    font-size: 10px;
                    border-radius: 6px;
                }
            </style>
        </head>
        <body>
            ${NAV_COMPONENT}
            <div class="main-panel">
                <h1 class="accent-text" style="font-size: 36px; margin-bottom: 5px;">VANTAGE OS <span style="font-size: 14px; color: #666; vertical-align: middle; letter-spacing: 2px;">// SATELLITE UPLINK</span></h1>
                <p style="color: #888; margin-bottom: 30px; font-size: 12px;">CONNECTED TO ANILIST GRAPHQL NODE</p>
                
                <div class="glass btn-group" style="padding: 15px; margin-bottom: 20px; display: flex; gap: 10px; overflow-x: auto;">
                    <button class="btn" onclick="setMode('airing_today')" id="btn-airing">AIRING TODAY</button>
                    <button class="btn" onclick="setMode('current')" id="btn-current">CURRENT SEASON</button>
                    <button class="btn" onclick="setMode('top')" id="btn-top">TOP RATED</button>
                    <button class="btn" onclick="setMode('archive')" id="btn-archive">DEEP ARCHIVE</button>
                </div>

                <div id="archiveControls" class="glass" style="padding: 25px; margin-bottom: 30px; display: none; gap: 15px; align-items: flex-end; flex-wrap: wrap; border-left: 2px solid var(--accent);">
                    <div style="flex: 1; min-width: 120px;">
                        <label style="font-size: 9px; letter-spacing: 1px; color: var(--accent);">TARGET_YEAR</label>
                        <select id="yearSelect" class="input-field" style="margin-top: 5px; width: 100%;">
                            ${Array.from({length: 46}, (_, i) => 2024 - i).map(y => `<option value="${y}" ${y === 2024 ? 'selected' : ''}>${y}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 120px;">
                        <label style="font-size: 9px; letter-spacing: 1px; color: var(--accent);">SEASON_CYCLE</label>
                        <select id="seasonSelect" class="input-field" style="margin-top: 5px; width: 100%;">
                            <option value="winter">WINTER</option>
                            <option value="spring">SPRING</option>
                            <option value="summer">SUMMER</option>
                            <option value="fall">FALL</option>
                        </select>
                    </div>
                    <button class="btn" onclick="engageUplink('archive')" style="height: 40px;">INITIATE SCAN</button>
                </div>

                <div id="archiveGrid" class="poster-grid">
                    <p class="accent-text">Awaiting Command...</p>
                </div>
            </div>

            <script>
                let currentMode = 'airing_today';
                let isLoading = false;

                function setMode(mode) {
                    if (isLoading) return;
                    
                    currentMode = mode;
                    // Reset Button States
                    document.querySelectorAll('.btn').forEach(b => b.style.opacity = '0.5');
                    document.getElementById('btn-' + mode).style.opacity = '1';

                    document.getElementById('archiveControls').style.display = 
                        (mode === 'archive') ? 'flex' : 'none';
                    
                    engageUplink(mode);
                }

                async function engageUplink(mode) {
                    if (isLoading) return;
                    
                    isLoading = true;
                    const grid = document.getElementById('archiveGrid');
                    const year = document.getElementById('yearSelect')?.value;
                    const season = document.getElementById('seasonSelect')?.value;
                    
                    grid.innerHTML = '<p class="accent-text" style="animation: blink 1s infinite; padding: 50px; text-align: center;">ESTABLISHING UPLINK...</p>';
                    
                    try {
                        let url = \`/api/vantage-data?type=\${mode}\`;
                        
                        if (mode === 'archive' && year && season) {
                            url += \`&year=\${year}&season=\${season}\`;
                        }
                        
                        console.log('Fetching:', url);
                        const res = await fetch(url);
                        
                        if (!res.ok) {
                            throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
                        }
                        
                        const data = await res.json();
                        
                        if (data.error) {
                            throw new Error(data.error);
                        }
                        
                        if (!data || data.length === 0) {
                            grid.innerHTML = \`
                                <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                                    <p style="color: #666; font-size: 14px;">NO DATA RECEIVED</p>
                                    <p style="color: #888; font-size: 12px; margin-top: 10px;">Try a different season or mode</p>
                                </div>
                            \`;
                            return;
                        }
                        
                        grid.innerHTML = data.map(show => {
                            const isAiringToday = mode === 'airing_today';
                            const badgeText = isAiringToday ? 'LIVE' : (show.score === 'AIRING' ? 'AIRING' : '');
                            
                            return \`
                            <div class="glass grid-card" style="padding: 10px; cursor: pointer; position: relative; overflow: hidden;" onclick="location.href='/api/anime-detail/\${show.id}'">
                                \${isAiringToday || badgeText ? \`
                                <div class="airing-badge">\${badgeText}</div>
                                \` : ''}
                                
                                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: \${show.color || '#00d4ff'}; box-shadow: 0 0 15px \${show.color || '#00d4ff'};"></div>

                                <div style="position:relative;">
                                    <div class="poster-fallback" style="display: none;" id="fallback-\${show.id}">
                                        <span>\${show.title?.substring(0, 20) || 'No Image'}</span>
                                    </div>
                                    <img src="\${show.poster || ''}" 
                                         style="width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 6px;"
                                         onerror="document.getElementById('fallback-\${show.id}').style.display='flex'; this.style.display='none';"
                                         onload="document.getElementById('fallback-\${show.id}').style.display='none';">
                                    <div style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.8); padding:3px 8px; border-radius:4px; font-size:10px; color:\${show.color || '#00d4ff'}; font-weight: bold; border: 1px solid rgba(255,255,255,0.1);">
                                        \${isAiringToday ? 'EP ' + (show.nextEpisode || '?') : '★ ' + (show.score || 'N/A')}
                                    </div>
                                </div>
                                
                                <p style="font-size: 11px; margin-top: 12px; height: 30px; overflow: hidden; line-height:1.3; color: #ddd; font-weight:500;">\${show.title || 'Unknown Title'}</p>
                                
                                <button class="btn" style="width: 100%; font-size: 9px; margin-top:8px; padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);" 
                                    onmouseover="this.style.background='\${show.color || '#00d4ff'}'; this.style.color='#000'; this.style.boxShadow='0 0 10px \${show.color || '#00d4ff'}';"
                                    onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#fff'; this.style.boxShadow='none';"
                                    onclick="event.stopPropagation(); saveToVault('\${show.id}', '\${encodeURIComponent(show.title || 'Unknown')}', '\${encodeURIComponent(show.poster || '')}')">
                                    + TRACK
                                </button>
                            </div>
                        \`}).join('');
                        
                    } catch(e) {
                        console.error('Uplink error:', e);
                        grid.innerHTML = \`
                            <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                                <p style="color: #ff4757; margin-bottom: 10px;">SATELLITE LINK SEVERED</p>
                                <p style="color: #888; font-size: 12px;">\${e.message}</p>
                                <button class="btn" onclick="engageUplink(currentMode)" style="margin-top: 20px; padding: 10px 20px;">RETRY UPLINK</button>
                            </div>
                        \`;
                    } finally {
                        isLoading = false;
                    }
                }

                async function saveToVault(id, title, poster) {
                    try {
                        const url = \`/api/watchlist/save?id=\${id}&title=\${title}&poster=\${poster}&type=anime&source=anilist&total=12&status=planned\`;
                        const res = await fetch(url);
                        
                        if (res.ok) {
                            // Show success feedback
                            const btn = event.target;
                            const originalText = btn.textContent;
                            btn.textContent = '✓ ADDED';
                            btn.style.background = '#00b894';
                            btn.style.color = '#000';
                            btn.style.boxShadow = '0 0 10px #00b894';
                            
                            setTimeout(() => {
                                btn.textContent = originalText;
                                btn.style.background = '';
                                btn.style.color = '';
                                btn.style.boxShadow = '';
                            }, 2000);
                        } else {
                            alert('Failed to add to vault');
                        }
                    } catch (error) {
                        console.error('Save error:', error);
                        alert('Error adding to vault');
                    }
                }

                // Auto-load on startup
                window.onload = () => {
                    document.getElementById('btn-airing').style.opacity = '1';
                    engageUplink('airing_today');
                    
                    // Set current year as default
                    const currentYear = new Date().getFullYear();
                    const yearSelect = document.getElementById('yearSelect');
                    if (yearSelect) {
                        // Try to find current year in options
                        for (let option of yearSelect.options) {
                            if (parseInt(option.value) === currentYear) {
                                option.selected = true;
                                break;
                            }
                        }
                    }
                    
                    // Set current season
                    const month = new Date().getMonth();
                    let season = 'winter';
                    if (month >= 2 && month <= 4) season = 'spring';
                    else if (month >= 5 && month <= 7) season = 'summer';
                    else if (month >= 8 && month <= 10) season = 'fall';
                    
                    const seasonSelect = document.getElementById('seasonSelect');
                    if (seasonSelect) {
                        seasonSelect.value = season;
                    }
                };
                
                // Prevent multiple clicks
                let clickLock = false;
                document.addEventListener('click', function(e) {
                    if (e.target.classList.contains('btn') && !clickLock) {
                        clickLock = true;
                        setTimeout(() => { clickLock = false; }, 500);
                    }
                }, true);
            </script>
            <style>
                @keyframes blink { 
                    0% { opacity: 1; } 
                    50% { opacity: 0.3; } 
                    100% { opacity: 1; } 
                }
                
                /* SMOOTH SCROLLING FOR MOBILE */
                body {
                    -webkit-overflow-scrolling: touch;
                }
                
                /* FIX FOR IOS ZOOM */
                input, select, textarea {
                    font-size: 16px; /* Prevents iOS zoom on focus */
                }
                
                /* LOADING ANIMATION */
                .loading-dots:after {
                    content: '.';
                    animation: dots 1.5s steps(5, end) infinite;
                }
                
                @keyframes dots {
                    0%, 20% { content: '.'; }
                    40% { content: '..'; }
                    60% { content: '...'; }
                    80%, 100% { content: ''; }
                }
                
                /* TOUCH FRIENDLY */
                .btn, .grid-card {
                    touch-action: manipulation;
                }
            </style>
        </body>
        </html>
    `);
});

module.exports = router;