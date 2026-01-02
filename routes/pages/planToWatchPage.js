const express = require('express');
const router = express.Router();
const { getWatchlist } = require('../../db/index');
const { HUD_STYLE, NAV_COMPONENT } = require('../../ui/layout');


// --- NEW PAGE: PLAN TO WATCH ---
router.get('/plan-to-watch', async (req, res) => {
    const list = await getWatchlist();
    const planned = list.filter(s => s.status === 'planned');
    const renderPlannedCard = (s) => {
        let posterUrl = s.poster;
        if (posterUrl && !posterUrl.startsWith('http')) posterUrl = `https://image.tmdb.org/t/p/w500${posterUrl}`;
        return `
        <div class="glass" style="padding:10px; position:relative;">
            <img src="${posterUrl}" style="width:100%; height:240px; object-fit:cover; border-radius:12px; filter: grayscale(0.4);">
            <div style="padding:10px;">
                <h4 style="font-size:13px; margin:5px 0; font-weight:600;">${s.title}</h4>
                <button class="btn" style="width:100%; margin-top:10px;" onclick="startSync('${s.id}')">START SYNC</button>
            </div>
        </div>`;
    };
    res.send(`<html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${HUD_STYLE}
        </head>
        <body>
        ${NAV_COMPONENT}
        <div style="padding:20px; max-width:1400px; margin:auto; padding-top:80px;">
            <h1 style="font-size:24px; margin:0 0 10px 0; font-weight:900;">PLAN TO <span class="accent-text">WATCH</span></h1>
            <p style="opacity:0.5; font-size:12px; margin-bottom:40px;">FUTURE LOGS & UPCOMING INTEL</p>
            <div class="poster-grid">
                ${planned.map(s => renderPlannedCard(s)).join('')}
                ${planned.length === 0 ? '<div style="grid-column: 1/-1; text-align:center; padding:100px; opacity:0.3;">Archive Empty. Add from Search.</div>' : ''}
            </div>
        </div>
        <script>
            async function startSync(id) {
                await fetch('/api/update-status/'+id+'?status=watching');
                location.href = '/watchlist';
            }
        </script>
    </body></html>`);
});

module.exports = router;