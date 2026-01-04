const express = require('express');
const router = express.Router();
const { getWatchlist } = require('../../db/index');
const Groq = require("groq-sdk");
const { HUD_STYLE, NAV_COMPONENT } = require('../../ui/layout');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.get('/intelligence-core', async (req, res) => {
    const list = await getWatchlist();
    const completed = list.filter(s => s.status === 'completed');
    const watching = list.filter(s => s.status === 'watching');
    
    // Neural Analytics
    const avgRating = completed.length > 0
        ? (completed.reduce((acc, s) => acc + (s.personalRating || 0), 0) / completed.length).toFixed(1)
        : "N/A";
    const totalEps = list.reduce((acc, s) => acc + (s.currentEpisode || 0), 0);

    res.send(`<html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${HUD_STYLE}
            <style>
                .core-container { padding:40px 20px; max-width:1200px; margin:auto; padding-top:100px; }
                .stat-card { background: rgba(0,0,0,0.4); border: 1px solid var(--border); border-radius: 20px; padding: 25px; position: relative; overflow: hidden; }
                .stat-card::before { content:''; position:absolute; top:0; left:0; width:100%; height:2px; background: linear-gradient(90deg, transparent, var(--accent), transparent); }
                
                .pulse { animation: pulse-red 2s infinite; }
                @keyframes pulse-red { 
                    0% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(0, 212, 255, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0); }
                }

                .terminal-window {
                    background: #050505;
                    border: 1px solid #1a1a1a;
                    border-radius: 12px;
                    font-family: 'Courier New', monospace;
                    height: 400px;
                    display: flex;
                    flex-direction: column;
                }
                .terminal-header { background: #1a1a1a; padding: 10px 20px; font-size: 10px; letter-spacing: 2px; color: #666; display: flex; justify-content: space-between; }
                #jarvis-log { flex: 1; padding: 20px; overflow-y: auto; color: #00d4ff; font-size: 13px; line-height: 1.6; }
                .terminal-input-area { border-top: 1px solid #1a1a1a; padding: 15px; display: flex; gap: 10px; }
                .t-input { background: transparent; border: none; color: white; flex: 1; outline: none; font-family: inherit; }
                
                .matrix-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.05; pointer-events: none; z-index: 0; }
            </style>
        </head>
        <body>
            ${NAV_COMPONENT}
            <div class="core-container">
                <div style="margin-bottom: 40px;">
                    <h1 style="font-size:32px; font-weight:900; margin:0;">INTELLIGENCE <span class="accent-text">CORE</span></h1>
                    <p style="opacity:0.4; font-size:11px; letter-spacing:3px;">NEURAL ARCHITECTURE V3.3 // STATUS: ACTIVE</p>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:25px; margin-bottom:40px;">
                    <div class="stat-card">
                        <div style="font-size:10px; opacity:0.5; letter-spacing:2px;">ANALYTIC_RATING</div>
                        <div style="font-size:42px; font-weight:900; color:var(--accent);">${avgRating}</div>
                        <div style="font-size:10px; margin-top:10px; color:#444;">DATASET: ${completed.length} TITLES</div>
                    </div>
                    <div class="stat-card pulse">
                        <div style="font-size:10px; opacity:0.5; letter-spacing:2px;">COGNITIVE_LOAD</div>
                        <div style="font-size:42px; font-weight:900; color:white;">${watching.length} <span style="font-size:16px; opacity:0.3;">ACTIVE SYNC</span></div>
                        <div style="font-size:10px; margin-top:10px; color:var(--accent);">SAVORER PROTOCOL: OPTIMAL</div>
                    </div>
                    <div class="stat-card">
                        <div style="font-size:10px; opacity:0.5; letter-spacing:2px;">TIME_DILATION</div>
                        <div style="font-size:42px; font-weight:900; color:var(--accent);">${totalEps} <span style="font-size:16px; opacity:0.3;">EPS</span></div>
                        <div style="font-size:10px; margin-top:10px; color:#444;">RECORDS RETRIEVED FROM VAULT</div>
                    </div>
                </div>

                <div class="terminal-window">
                    <div class="terminal-header">
                        <span>JARVIS_COGNITIVE_INTERFACE</span>
                        <span>ENCRYPTED_UPLINK</span>
                    </div>
                    <div id="jarvis-log">
                        <div style="color:#666; margin-bottom:10px;">[System Initialization...]</div>
                        <div>Welcome back, sir. I have analyzed your Hall of Fame. Should we look for a new masterpiece to savor, or shall I provide a tactical breakdown of your current watching habits?</div>
                    </div>
                    <div class="terminal-input-area">
                        <span style="color:var(--accent)">></span>
                        <input type="text" id="terminal-in" class="t-input" placeholder="Enter command or query..." onkeyup="if(event.key==='Enter') jarvisQuery()">
                        <button onclick="jarvisQuery()" class="btn" style="padding: 5px 15px; font-size: 10px;">EXECUTE</button>
                    </div>
                </div>
            </div>

            <script>
                async function jarvisQuery() {
                    const input = document.getElementById('terminal-in');
                    const log = document.getElementById('jarvis-log');
                    const val = input.value;
                    if(!val) return;

                    input.value = '';
                    log.innerHTML += '<div style="color:#fff; margin-top:15px; opacity:0.6;">SIR: ' + val + '</div>';
                    log.innerHTML += '<div id="loading" style="color:#444;">[Processing Intelligence...]</div>';
                    log.scrollTop = log.scrollHeight;

                    try {
                        const res = await fetch('/api/jarvis-core-query', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: val })
                        });
                        const data = await res.json();
                        document.getElementById('loading').remove();
                        log.innerHTML += '<div style="margin-top:10px; padding-left:10px; border-left:2px solid var(--accent);">JARVIS: ' + data.response + '</div>';
                    } catch(e) {
                        log.innerHTML += '<div style="color:var(--red);">UPLINK ERROR: SATELLITE OFFLINE</div>';
                    }
                    log.scrollTop = log.scrollHeight;
                }
            </script>
        </body></html>`);
});

// NEW ENDPOINT FOR THE CORE AGENT
router.post('/api/jarvis-core-query', async (req, res) => {
    const list = await getWatchlist();
    const taste = list.filter(s => s.personalRating >= 8).map(s => s.title).join(", ");
    
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are JARVIS. You are an agentic AI built into the VANTAGE Intelligence Core. You help the user (sir) manage his elite watchlist. He is a 'savorer' (no binging). He likes HBO-style masterpieces and high-quality anime. Be tactical, concise, and professional. Address him as sir." },
                { role: "user", content: `Context: My Hall of Fame includes: ${taste}. My request: ${req.body.message}` }
            ],
            model: "llama-3.3-70b-versatile",
        });
        res.json({ response: completion.choices[0].message.content });
    } catch (e) { res.status(500).json({ error: "AI Error" }); }
});

module.exports = router;