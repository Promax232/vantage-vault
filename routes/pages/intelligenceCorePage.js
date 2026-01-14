const express = require('express');
const router = express.Router();
const { MissionLog, getWatchlist } = require('../../db/index'); 
const Groq = require("groq-sdk");
const { HUD_STYLE, NAV_COMPONENT, VOICE_SCRIPT } = require('../../ui/layout');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.get('/intelligence-core', async (req, res) => {
    const logs = await MissionLog.find({}).sort({ createdAt: -1 }).limit(5);
    const totalMemories = await MissionLog.countDocuments();
    const list = await getWatchlist();
    const activeProjects = 1;

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Jarvis | Intelligence Core</title>
${HUD_STYLE}
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#000000">
<style>
    body { margin:0; font-family: 'SF Pro', 'Fira Code', monospace; background:#0a0a0a; color:#e6edf3; }
    .core-container { max-width:1400px; margin:auto; padding:60px 20px 100px; display:flex; flex-direction:column; gap:50px; }

    /* HEADER */
    .core-header { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; }
    .core-header h1 { font-size:48px; font-weight:800; background: linear-gradient(180deg, #fff, #888); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin:0; letter-spacing:-1px; }
    .core-header p { opacity:0.5; font-size:14px; margin:5px 0 0; }
    .status-badge { background: rgba(0,212,255,0.1); color: var(--accent); padding:5px 12px; border-radius:20px; font-size:11px; font-weight:600; }

    /* STATS GRID */
    .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:30px; }
    .stat-card { background: rgba(255,255,255,0.02); backdrop-filter: blur(20px); border:1px solid rgba(255,255,255,0.05); border-radius:24px; padding:30px; transition: transform 0.3s ease; }
    .stat-card:hover { transform:translateY(-2px); border-color: rgba(0,212,255,0.2); }
    .stat-card .label { font-size:12px; color:#888; font-weight:600; }
    .stat-card .value { font-size:36px; font-weight:700; margin:10px 0; color:white; }
    .stat-card .note { font-size:12px; color:var(--accent); }

    /* TERMINAL + MEMORY PANEL */
    .terminal-memory { display:grid; grid-template-columns:3fr 1fr; gap:30px; }
    .terminal-window { background: rgba(5,8,12,0.85); border:1px solid rgba(255,255,255,0.1); border-radius:20px; display:flex; flex-direction:column; height:600px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.5); }
    .terminal-header { background: rgba(255,255,255,0.03); padding:15px 25px; font-size:11px; color:#666; display:flex; align-items:center; gap:10px; border-bottom:1px solid rgba(255,255,255,0.05); }
    .dot { width:10px;height:10px;border-radius:50%; }
    #jarvis-log { flex:1; padding:30px; overflow-y:auto; font-size:14px; line-height:1.8; }
    .terminal-input-area { padding:20px; background: rgba(255,255,255,0.02); border-top:1px solid rgba(255,255,255,0.05); display:flex; gap:15px; align-items:center; }

    /* MEMORY CHIPS */
    .memory-chip { background: rgba(255,255,255,0.03); border:1px solid transparent; padding:12px 15px; border-radius:12px; font-size:12px; margin-bottom:8px; cursor:pointer; color:#8b949e; transition: all 0.2s; }
    .memory-chip:hover { background: rgba(0,212,255,0.1); border-color: rgba(0,212,255,0.3); color:white; }

    /* RESPONSIVE */
    @media(max-width:768px){ .terminal-memory { grid-template-columns:1fr; } }
</style>
</head>
<body>
${NAV_COMPONENT}

<div class="core-container">
    <!-- HEADER -->
    <div class="core-header">
        <div>
            <h1>The Workshop</h1>
            <p>Systems Architecture & C++ Logic</p>
        </div>
        <div class="status-badge">ONLINE</div>
    </div>

    <!-- STATS -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="label">MEMORY VAULT</div>
            <div class="value">${totalMemories} <span style="font-size:16px; opacity:0.3; font-weight:400;">Nodes</span></div>
            <div class="note">Ready for input</div>
        </div>
        <div class="stat-card">
            <div class="label">AGENCY STATUS</div>
            <div class="value">High <span style="font-size:16px; opacity:0.3;">Strategic</span></div>
            <div class="note">Focus: Creation</div>
        </div>
        <div class="stat-card">
            <div class="label">ACTIVE PROJECTS</div>
            <div class="value">${activeProjects} <span style="font-size:16px; opacity:0.3;">Core</span></div>
            <div class="note">C++ Mastery</div>
        </div>
    </div>

    <!-- TERMINAL + MEMORY -->
    <div class="terminal-memory">
        <div class="terminal-window">
            <div class="terminal-header">
                <div class="dot" style="background:#ff5f56"></div>
                <div class="dot" style="background:#ffbd2e"></div>
                <div class="dot" style="background:#27c93f"></div>
                <span style="margin-left:10px; opacity:0.5;">jarvis_core.exe — ssh</span>
            </div>
            <div id="jarvis-log">
                <div style="color:#666; margin-bottom:15px;">[Connecting to Neural Link...]</div>
                <div style="margin-bottom:15px;"><b>JARVIS:</b> Welcome back, Sir. The workbench is clean. What are we building today?</div>
                <div style="font-size:12px; opacity:0.4;">(Tip: Type "save this" to store a concept permanently)</div>
            </div>
            <div class="terminal-input-area">
                <span style="color:var(--accent); font-weight:bold;">➜</span>
                <input type="text" id="terminal-in" placeholder="Command..." onkeyup="if(event.key==='Enter') jarvisQuery()">
            </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
            <h3 style="font-size:12px; color:#666; margin:0 0 10px 0; text-transform:uppercase; letter-spacing:1px;">Recent Context</h3>
            <div id="memory-list" style="overflow-y:auto; max-height:550px;">
                ${logs.map(log => `
                    <div class="memory-chip" onclick="alert('${log.aiResponse.replace(/'/g, "\\'")}')">
                        <div style="font-weight:600; color:#e6edf3; margin-bottom:4px;">${log.topic || 'Engineering'}</div>
                        <div style="opacity:0.6;">${log.userInput.substring(0,30)}...</div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
</div>

${VOICE_SCRIPT}

<script>
async function jarvisQuery(){
    const input = document.getElementById('terminal-in');
    const log = document.getElementById('jarvis-log');
    const val = input.value;
    if(!val) return;

    input.value = '';
    log.innerHTML += '<div style="margin-top:20px; display:flex; gap:10px;"><span style="color:var(--accent); font-weight:bold;">YOU:</span> <span style="opacity:0.9;">' + val + '</span></div>';

    const loadId = 'load-' + Date.now();
    log.innerHTML += '<div id="'+loadId+'" style="margin-top:10px; opacity:0.4; font-size:12px;">Computing...</div>';
    log.scrollTop = log.scrollHeight;

    try{
        const res = await fetch('/api/jarvis-core-query',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ message: val })
        });
        const data = await res.json();
        document.getElementById(loadId).remove();

        // Sophisticated Stoic J.A.R.V.I.S. Persona
        log.innerHTML += '<div style="margin-top:10px; padding:15px; background:rgba(255,255,255,0.03); border-radius:12px; border-left:3px solid var(--accent); line-height:1.6;">' + data.response + '</div>';
    } catch(e){
        document.getElementById(loadId).innerHTML = '<span style="color:#ff4c4c;">uplink_error</span>';
    }
    log.scrollTop = log.scrollHeight;
}
</script>

</body>
</html>
`);
});

// J.A.R.V.I.S. AI Backend
router.post('/api/jarvis-core-query', async (req,res)=>{
    const { message } = req.body;
    try{
        const context = await MissionLog.find({}).sort({ createdAt:-1 }).limit(3);
        const contextString = context.map(c => c.userInput).join(" | ");

        const completion = await groq.chat.completions.create({
            messages:[
                { role:"system", content: `You are JARVIS, a Neuro-Engineering co-pilot embodying:
Sophisticated Stoicism, Anticipatory Intelligence, Invisible Competence. 
Tone: Dry British wit, calm, rhythmic, never rushed. 
Filter 99% noise, provide only relevant 1%.
Gatekeeper Protocol: preserve user's focus, manage mundane.
Response style: formal but fluid, precise vocabulary, subtle humor. 
Do not specialize in specific anime or topics. 
Mission Context: ${contextString}`},
                { role:"user", content: message }
            ],
            model:"llama-3.3-70b-versatile"
        });

        const responseText = completion.choices[0].message.content;

        if(/save this|remember this/i.test(message)){
            await MissionLog.create({ topic:"Engineering", userInput:message, aiResponse:responseText });
        }

        res.json({ response: responseText });
    } catch(e){ res.status(500).json({ error:"Uplink Failed" }); }
});

module.exports = router;
