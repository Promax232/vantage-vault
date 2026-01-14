const HUD_STYLE = `
<style>
:root { 
    --accent: #00d4ff; 
    --soft-blue: rgba(0, 212, 255, 0.15);
    --gold: #ffcc00; 
    --bg: #030508; 
    --card: rgba(255, 255, 255, 0.03); 
    --border: rgba(255, 255, 255, 0.08); 
}

body { 
    background: radial-gradient(circle at top right, #0a111a, var(--bg)); 
    color: #e6edf3; 
    font-family: 'SF Pro Display', -apple-system, sans-serif; 
    margin: 0; padding: 0; 
    -webkit-font-smoothing: antialiased; 
}

/* GLASS EFFECT */
.glass { 
    background: var(--card); 
    backdrop-filter: blur(20px); 
    border: 1px solid var(--border); 
    border-radius: 24px; 
    transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1); 
}

.glass:hover { 
    border-color: rgba(0, 212, 255, 0.4); 
    box-shadow: 0 0 40px rgba(0, 212, 255, 0.1); 
    transform: translateY(-4px); 
}

.accent-text { 
    background: linear-gradient(135deg, #fff, var(--accent));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-weight: 700;
}

.input-field { 
    background: rgba(255, 255, 255, 0.05); 
    border: 1px solid var(--border); 
    color: white; padding: 16px 20px; 
    border-radius: 16px; outline: none; 
    width: 100%; box-sizing: border-box; 
    font-size: 16px; transition: 0.4s; 
}

.input-field:focus { 
    border-color: var(--accent); 
    background: rgba(255, 255, 255, 0.08);
}

.btn { 
    background: var(--soft-blue); 
    border: 1px solid rgba(0, 212, 255, 0.3); 
    color: var(--accent); 
    padding: 12px 28px; cursor: pointer; 
    border-radius: 14px; font-weight: 600; 
    font-size: 12px; letter-spacing: 0.5px; 
    transition: 0.3s; 
}

.btn:hover { 
    background: var(--accent); 
    color: #000; 
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
}

.sidebar { 
    position: fixed; top: 0; left: -340px; 
    width: 320px; height: 100vh; 
    background: rgba(3, 5, 8, 0.9); 
    backdrop-filter: blur(40px); 
    border-right: 1px solid var(--border); 
    z-index: 1001; transition: 0.6s cubic-bezier(0.19, 1, 0.22, 1); 
    padding: 60px 40px; 
}

.sidebar.active { left: 0; box-shadow: 40px 0 100px rgba(0,0,0,0.8); }

.nav-link { 
    color: #999; text-decoration: none; 
    padding: 20px; margin: 10px 0; 
    border-radius: 18px; font-size: 14px; 
    display: flex; align-items: center; gap: 20px; 
    transition: 0.4s; font-weight: 500; 
}

.nav-link:hover, .nav-link.active { 
    color: #fff; background: rgba(255, 255, 255, 0.05); 
}

.nav-link i { font-size: 18px; color: var(--accent); }

.nav-burger { 
    position: fixed; left: 30px; top: 30px; 
    z-index: 1000; background: rgba(255, 255, 255, 0.03); 
    backdrop-filter: blur(10px); border: 1px solid var(--border); 
    color: var(--accent); width: 50px; height: 50px; 
    border-radius: 15px; cursor: pointer; 
    display: flex; align-items: center; justify-content: center; 
}
</style>
`;

const NAV_COMPONENT = `
<button class="nav-burger" onclick="toggleNav()">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
</button>
<div id="overlay" class="overlay" onclick="toggleNav()" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.4); z-index:1000; opacity:0; pointer-events:none; transition:0.5s; visibility:hidden;"></div>
<div id="sidebar" class="sidebar">
    <div style="margin-bottom:60px;">
        <h2 style="font-size:18px; font-weight:700; color:white; margin:0;">JARVIS <span style="opacity:0.4; font-weight:300;">CORE</span></h2>
        <div style="width:20px; height:2px; background:var(--accent); margin-top:8px;"></div>
    </div>

    <a href="/intelligence-core" class="nav-link"><span>⚡</span> Jarvi Core</a>
    <a href="/vantage" class="nav-link"><span>🌌</span> VANTAGE POINT</a>
    
    <div style="margin-top:auto; padding:25px; border-radius:20px; background:linear-gradient(135deg, rgba(0,212,255,0.05), transparent); border:1px solid rgba(0,212,255,0.1);">
        <div style="font-size:11px; color:var(--accent); font-weight:700; margin-bottom:5px;">SYSTEM STATUS</div>
        <div style="font-size:10px; color:#666; line-height:1.4;">Memory Uplink Stable.<br>Ready for the next move, Sir.</div>
    </div>
</div>
<script>
    function toggleNav() {
        const side = document.getElementById('sidebar');
        const over = document.getElementById('overlay');
        side.classList.toggle('active');
        over.style.opacity = side.classList.contains('active') ? "1" : "0";
        over.style.visibility = side.classList.contains('active') ? "visible" : "hidden";
        over.style.pointerEvents = side.classList.contains('active') ? "all" : "none";
    }
</script>
`;

const VOICE_SCRIPT = `
<script>
const recognition = (window.SpeechRecognition || window.webkitSpeechRecognition) ? new (window.SpeechRecognition || window.webkitSpeechRecognition)() : null;
if (recognition) {
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        const activeInput = document.getElementById('jarvis-input') || document.querySelector('.input-field:focus');
        if(activeInput) activeInput.value = text;
    };
}
</script>
`;

module.exports = { HUD_STYLE, NAV_COMPONENT, VOICE_SCRIPT };

