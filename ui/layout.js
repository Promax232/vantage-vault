// --- UI SYSTEMS (APPLE-POLISHED REFINE) ---
const HUD_STYLE = `
<style>
:root { --accent: #00d4ff; --gold: #ffcc00; --red: #ff4c4c; --bg: #05070a; --card: rgba(22, 27, 34, 0.6); --border: rgba(48, 54, 61, 0.5); }
body { background: var(--bg); color: #f0f6fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
/* LAYOUT ENGINE */
.split-view { display: flex; flex-direction: column; min-height: 100vh; }
.side-panel { width: 100%; padding: 25px; box-sizing: border-box; }
.main-panel { width: 100%; padding: 20px; box-sizing: border-box; }
@media (min-width: 1025px) {
    .split-view { flex-direction: row; height: 100vh; overflow: hidden; }
    .side-panel { width: 420px; border-right: 1px solid var(--border); overflow-y: auto; background: rgba(255,255,255,0.02); }
    .main-panel { flex: 1; overflow-y: auto; padding: 60px; }
}
/* UI ELEMENTS */
.glass { background: var(--card); backdrop-filter: blur(25px); border: 0.5px solid var(--border); border-radius: 18px; transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); }
.glass:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
.accent-text { color: var(--accent); font-weight: 800; letter-spacing: -0.5px; }
.input-field { background: rgba(1, 4, 9, 0.8); border: 1px solid var(--border); color: white; padding: 14px; border-radius: 12px; outline: none; width: 100%; box-sizing: border-box; font-size: 15px; transition: 0.3s; }
.input-field:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(0,212,255,0.1); }
.btn { background: transparent; border: 1px solid var(--accent); color: var(--accent); padding: 12px 24px; cursor: pointer; border-radius: 10px; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 1.5px; transition: 0.3s; }
.btn:hover { background: var(--accent); color: black; }
/* SIDEBAR REFINEMENT */
#nav-trigger { position: fixed; top: 0; left: 0; width: 15px; height: 100vh; z-index: 999; cursor: pointer; }
.sidebar { position: fixed; top: 0; left: -320px; width: 300px; height: 100vh; background: rgba(5, 7, 10, 0.98); backdrop-filter: blur(30px); border-right: 1px solid var(--border); z-index: 1001; transition: 0.5s cubic-bezier(0.19, 1, 0.22, 1); padding: 50px 30px; display: flex; flex-direction: column; visibility: hidden; }
.sidebar.active { left: 0; visibility: visible; box-shadow: 20px 0 80px rgba(0,0,0,0.9); }
.nav-link { color: #8b949e; text-decoration: none; padding: 18px; margin: 8px 0; border-radius: 12px; font-size: 12px; letter-spacing: 1.2px; display: flex; align-items: center; gap: 15px; transition: 0.3s; font-weight: 600; }
.nav-link:hover, .nav-link.active { color: var(--accent); background: rgba(0, 212, 255, 0.08); border-left: 4px solid var(--accent); }
.nav-burger { position: fixed; left: 25px; top: 25px; z-index: 1000; background: rgba(22, 27, 34, 0.5); backdrop-filter: blur(10px); border: 1px solid var(--border); color: var(--accent); width: 45px; height: 45px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.overlay { position: fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); z-index:1000; opacity:0; pointer-events:none; transition:0.4s; visibility: hidden; }
.overlay.active { opacity:1; pointer-events:all; visibility: visible; }
/* POSTER GRID */
.poster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 20px; padding: 10px; }
@media (max-width: 600px) { .poster-grid { grid-template-columns: 1fr 1fr; gap: 12px; } }
.rating-orb { width: 34px; height: 34px; margin: 5px; border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: #8b949e; border-radius: 50%; cursor: pointer; font-size: 12px; transition: 0.3s; }
.rating-orb.active { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 15px rgba(0,212,255,0.3); background: rgba(0,212,255,0.1); }
/* CHRONO STYLE */
.chrono-row { display: flex; align-items: center; gap: 20px; padding: 20px; margin-bottom: 15px; }
.chrono-timeline { flex: 1; height: 8px; background: rgba(255,255,255,0.05); border-radius: 10px; position: relative; overflow: hidden; }
.chrono-progress { height: 100%; background: linear-gradient(90deg, var(--accent), #00ffaa); box-shadow: 0 0 15px var(--accent); transition: 1s ease-out; }
</style>
`;
const NAV_COMPONENT = `
<button class="nav-burger" onclick="toggleNav()">☰</button>
<div id="nav-trigger" onmouseover="toggleNav()"></div>
<div id="overlay" class="overlay" onclick="toggleNav()"></div>
<div id="sidebar" class="sidebar">
    <h2 style="color:var(--accent); font-size:12px; margin-bottom:50px; letter-spacing:4px; font-weight:900;">VANTAGE <span style="color:white; opacity:0.5;">HUD</span></h2>
    <a href="/watchlist" class="nav-link"><span class="nav-icon">⦿</span> ACTIVE SYNC</a>
    <a href="/plan-to-watch" class="nav-link"><span class="nav-icon">🔖</span> PLAN TO WATCH</a>
    <a href="/hall-of-fame" class="nav-link"><span class="nav-icon">🏆</span> HALL OF FAME</a>
<a href="/vantage" class="nav-link"><span class="nav-icon">⏳</span> VANTAGE OS</a>
    <a href="/intelligence-core" class="nav-link"><span class="nav-icon">🧠</span> INTELLIGENCE CORE</a>
    <div style="margin-top:auto; padding:20px; background:rgba(255,255,255,0.03); border-radius:15px; border:1px solid var(--border);">
        <div style="font-size:10px; color:var(--accent); letter-spacing:1px; margin-bottom:5px;">● SYSTEM ONLINE</div>
        <div style="font-size:9px; color:#8b949e; opacity:0.6;">PHASE 5: INTELLIGENCE CORE ACTIVE</div>
    </div>
</div>
<script>
    function toggleNav() {
        document.getElementById('sidebar').classList.toggle('active');
        document.getElementById('overlay').classList.toggle('active');
    }
</script>
`;
const VOICE_SCRIPT = `
<script>
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            const activeInput = document.querySelector('.input-field:focus') || document.getElementById('chat-in') || document.getElementById('q');
            if(activeInput) {
                activeInput.value = text;
                if(activeInput.id === 'q') search();
            }
        };
        function startVoiceInput(e) {
            e.target.classList.add('mic-active');
            recognition.start();
            recognition.onend = () => e.target.classList.remove('mic-active');
        }
    }
</script>
`;

module.exports = {
  HUD_STYLE,
  NAV_COMPONENT,
  VOICE_SCRIPT
};