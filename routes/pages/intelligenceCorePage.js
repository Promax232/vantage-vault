const express = require('express');
const router = express.Router();
const { getWatchlist } = require('../../db/index');
const Groq = require("groq-sdk");
const { HUD_STYLE, NAV_COMPONENT } = require('../../ui/layout');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- NEW PAGE: INTELLIGENCE CORE (STATS & AI) ---
router.get('/intelligence-core', async (req, res) => {
    const list = await getWatchlist();
    const completed = list.filter(s => s.status === 'completed');
    const watching = list.filter(s => s.status === 'watching');
    // Stats Logic
    const avgRating = completed.length > 0
        ? (completed.reduce((acc, s) => acc + (s.personalRating || 0), 0) / completed.length).toFixed(1)
        : "N/A";
    const totalEps = list.reduce((acc, s) => acc + (s.currentEpisode || 0), 0);
    // AI Recommendation Engine
    let aiRecs = "Initiating Analysis...";
    try {
        const tasteProfile = completed.map(s => `${s.title} (${s.personalRating}/10)`).join(", ");
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are the VANTAGE Intelligence Core. User is a 'savorer' (no binging). Analyze their Hall of Fame and suggest 3 masterpieces (Anime or HBO style) that reward slow watching. Return brief, tactical descriptions." },
                { role: "user", content: `My Hall of Fame: ${tasteProfile || "Empty. I like high-quality storytelling."}` }
            ],
            model: "llama-3.3-70b-versatile",
        });
        aiRecs = completion.choices[0].message.content.replace(/\n/g, '<br>');
    } catch (e) { aiRecs = "AI Uplink Interrupted."; }
    res.send(`<html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${HUD_STYLE}
        </head>
        <body>
        ${NAV_COMPONENT}
        <div style="padding:20px; max-width:1000px; margin:auto; padding-top:80px;">
            <h1 style="font-size:24px; margin:0 0 10px 0; font-weight:900;">INTELLIGENCE <span class="accent-text">CORE</span></h1>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:20px; margin-bottom:40px;">
                <div class="glass" style="padding:20px; text-align:center;">
                    <div style="font-size:10px; opacity:0.5; letter-spacing:2px;">AVG_RATING</div>
                    <div style="font-size:32px; font-weight:900; color:var(--gold);">${avgRating}</div>
                </div>
                <div class="glass" style="padding:20px; text-align:center;">
                    <div style="font-size:10px; opacity:0.5; letter-spacing:2px;">EPS_CONSUMED</div>
                    <div style="font-size:32px; font-weight:900; color:var(--accent);">${totalEps}</div>
                </div>
                <div class="glass" style="padding:20px; text-align:center;">
                    <div style="font-size:10px; opacity:0.5; letter-spacing:2px;">ACTIVE_SYNC</div>
                    <div style="font-size:32px; font-weight:900;">${watching.length}</div>
                </div>
            </div>
            <div class="glass" style="padding:30px; border-left:4px solid var(--accent); position:relative; overflow:hidden;">
                <div style="position:absolute; top:-10px; right:-10px; font-size:100px; opacity:0.03; font-weight:900;">AI</div>
                <h2 style="font-size:14px; letter-spacing:3px; margin-bottom:20px; color:var(--accent);">● TACTICAL_RECOMMENDATIONS</h2>
                <div style="font-size:15px; line-height:1.8; opacity:0.9;">
                    ${aiRecs}
                </div>
            </div>
        </div>
    </body></html>`);
});

module.exports = router;