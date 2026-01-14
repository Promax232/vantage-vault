const express = require('express');
const router = express.Router();
const { HUD_STYLE, NAV_COMPONENT, VOICE_SCRIPT } = require('../../ui/layout');

router.get('/vantage', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vantage OS | Intelligence HUD</title>
${HUD_STYLE}
<link rel="manifest" href="/public/manifest.json">
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/public/service-worker.js')
      .then(reg => console.log('✅ Service Worker Registered', reg))
      .catch(err => console.error('❌ Service Worker Registration Failed', err));
  });
}
</script>
<style>
.poster-grid {
    display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:20px; margin-top:20px;
}
.grid-card { transition:0.3s; border:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.25); border-radius:12px; overflow:hidden; }
.grid-card:hover { transform:translateY(-5px); box-shadow:0 15px 40px rgba(0,0,0,0.6); background:rgba(255,255,255,0.02); }
.score-badge { filter:blur(4px); opacity:0.7; transition:0.3s; }
.grid-card:hover .score-badge { filter:blur(0); opacity:1; }

#jarvis-console { border-top:1px solid var(--accent); background:rgba(0,0,0,0.85); position:fixed; bottom:0; left:0; width:100%; padding:18px; z-index:1000; display:flex; flex-direction:column; gap:10px; }
#jarvis-console input { flex:1; }
.glass-buttons { display:flex; flex-wrap:wrap; gap:10px; overflow-x:auto; }
.glass-buttons .btn { flex:1 0 120px; min-width:100px; }
#archiveControls { display:none; flex-wrap:wrap; gap:10px; }

@media(max-width:768px){ .poster-grid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr));} .btn{font-size:11px;padding:8px 16px;} #jarvis-console{padding:12px;} }
@media(max-width:480px){ .poster-grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr));} }
</style>
</head>
<body>
${NAV_COMPONENT}

<div class="main-panel" style="padding-bottom:180px; padding-top:40px;">
<h1 class="accent-text" style="font-size:36px; margin-bottom:10px;">VANTAGE OS 
<span style="font-size:14px;color:#666;vertical-align:middle;letter-spacing:2px;">// SATELLITE UPLINK</span>
</h1>


<div id="archiveControls" class="glass" style="padding:15px;">
<div style="flex:1; min-width:100px;">
<label style="font-size:9px;color:var(--accent)">TARGET_YEAR</label>
<select id="yearSelect" class="input-field" style="width:100%; margin-top:4px;">
${Array.from({length:46},(_,i)=>2026-i).map(y => `<option value="${y}" ${y===2026?'selected':''}>${y}</option>`).join('')}
</select>
</div>
<div style="flex:1; min-width:100px;">
<label style="font-size:9px;color:var(--accent)">SEASON_CYCLE</label>
<select id="seasonSelect" class="input-field" style="width:100%; margin-top:4px;">
<option value="winter">WINTER</option>
<option value="spring">SPRING</option>
<option value="summer">SUMMER</option>
<option value="fall">FALL</option>
</select>
</div>
<button class="btn" onclick="engageUplink('archive')" style="height:36px;">INITIATE SCAN</button>
</div>

<div id="archiveGrid" class="poster-grid">
<p class="accent-text">Awaiting Command...</p>
</div>
</div>

<div id="jarvis-console" class="glass">
<div id="jarvis-output" style="color:#aaa;font-size:13px;max-height:80px;overflow-y:auto;font-family:monospace;">
System Idle... Ready for input, Sir.
</div>
<div style="display:flex; gap:8px;">
<input type="text" id="jarvis-input" class="input-field" placeholder="Ask Jarvis anything">
<button class="btn" onclick="askJarvis()" style="width:100px;">SEND</button>
</div>
</div>

${VOICE_SCRIPT}

<script>
let currentMode='current';
function setMode(mode){currentMode=mode; document.getElementById('archiveControls').style.display=mode==='archive'?'flex':'none'; engageUplink(mode);}
async function askJarvis(){const input=document.getElementById('jarvis-input'); const output=document.getElementById('jarvis-output'); if(!input.value)return; output.innerHTML='<span class="accent-text">JARVIS IS THINKING...</span>'; const message=input.value; input.value=''; try{ const res=await fetch('/api/jarvis-core-query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})}); const data=await res.json(); output.innerHTML=\`<b>JARVIS:</b> \${data.response}\`; }catch(e){ output.innerHTML='<span style="color:red;">ERROR: UPLINK SEVERED</span>';} }
async function engageUplink(mode){const grid=document.getElementById('archiveGrid'); grid.innerHTML='<p class="accent-text">Loading...</p>'; setTimeout(()=>{grid.innerHTML='<p class="accent-text">Data Loaded for '+mode.toUpperCase()+'</p>';},700);}
window.onload=()=>{document.getElementById('btn-current').style.opacity='1'; engageUplink('current');};
</script>
</body>
</html>
    `);
});

module.exports = router;
