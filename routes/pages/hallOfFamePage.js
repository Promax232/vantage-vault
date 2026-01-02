const express = require('express');
const router = express.Router();
const { getWatchlist } = require('../../db/index');
const { HUD_STYLE, NAV_COMPONENT } = require('../../ui/layout');


// --- NEW PAGE: HALL OF FAME ---
router.get('/hall-of-fame', async (req, res) => {
    const list = await getWatchlist();
    const completed = list.filter(s => s.status === 'completed');
    const renderHallCard = (s) => {
        let posterUrl = s.poster;
        if (posterUrl && !posterUrl.startsWith('http')) posterUrl = `https://image.tmdb.org/t/p/w500${posterUrl}`;
        return `
        <div class="glass" style="padding:10px; position:relative; border-color:var(--gold); background:rgba(255, 204, 0, 0.03);">
            <div style="position:absolute; top:15px; right:15px; background:var(--gold); color:black; font-weight:900; padding:5px 10px; border-radius:8px; font-size:12px; z-index:10; box-shadow:0 0 15px rgba(255,204,0,0.5);">${s.personalRating || 'NR'}</div>
            <a href="/show/${s.type}/${s.id}"><img src="${posterUrl}" style="width:100%; height:240px; object-fit:cover; border-radius:12px;"></a>
            <div style="padding:10px; text-align:center;">
                <h4 style="font-size:13px; margin:5px 0; font-weight:800; color:var(--gold);">${s.title.toUpperCase()}</h4>
                <div style="font-size:9px; opacity:0.5; letter-spacing:1px;">MISSION ACCOMPLISHED</div>
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
            <h1 style="font-size:24px; margin:0 0 10px 0; font-weight:900;">HALL OF <span style="color:var(--gold);">FAME</span></h1>
            <p style="opacity:0.5; font-size:12px; margin-bottom:40px;">ELITE ARCHIVES & HIGHEST RATINGS</p>
            <div class="poster-grid">
                ${completed.map(s => renderHallCard(s)).join('')}
                ${completed.length === 0 ? '<div style="grid-column: 1/-1; text-align:center; padding:100px; opacity:0.3;">Hall is empty. Complete a show to induct it.</div>' : ''}
            </div>
        </div>
    </body></html>`);
});

module.exports = router;