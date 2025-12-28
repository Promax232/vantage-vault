const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const jikanjs = require('@mateoaranda/jikanjs');
const axios = require('axios');
const { getWatchlist } = require('../db');
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });


router.get('/api/vantage-search', async (req, res) => {
    try {
        const results = await jikanjs.search('anime', req.query.q, 12);
        const mapped = results.data.map(a => ({
            id: a.mal_id,
            title: a.title_english || a.title,
            poster: a.images.jpg.large_image_url,
            total: a.episodes || 0
        }));
        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: "Uplink Failure" });
    }
});

router.get('/vantage-data', async (req, res) => {
    const { type, year, season } = req.query;
    const cacheKey = `v_cache_${type}_${year || 'now'}_${season || 'now'}`;
    // Check Cache first to save Jikan Rate Limits
    const cached = myCache.get(cacheKey);
    if (cached) return res.json(cached);
    try {
        let rawData;
        if (type === 'top') {
            rawData = await jikanjs.loadTop('anime');
        } else if (type === 'schedule') {
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            rawData = await jikanjs.loadSchedule(days[new Date().getDay()]);
        } else if (type === 'archive') {
            // If user didn't provide year/season, default to a classic "CD Era" year
            rawData = await jikanjs.loadSeason(year || 1998, season || 'fall');
        } else {
            rawData = await jikanjs.loadCurrentSeason();
        }
        const mapped = rawData.data.map(a => ({
            id: a.mal_id,
            title: a.title_english || a.title,
            poster: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url,
            score: a.score || '??'
        }));
        myCache.set(cacheKey, mapped); // Store for 1 hour
        res.json(mapped);
    } catch (e) {
        console.error("Vantage OS Uplink Error:", e);
        res.status(429).json({ error: "System Throttled. Retrying uplink..." });
    }
});
// Helper: System Stall (Micro-Delay to prevent 429 errors)
const stall = (ms) => new Promise(resolve => setTimeout(resolve, ms));
router.get('/anime-detail/:id', async (req, res) => {
    const malId = req.params.id;
    const cacheKey = `v_full_intel_${malId}`;
    let data = myCache.get(cacheKey);
    if (!data) {
        try {
            // SEQUENTIAL UPLINK: We fetch one by one with 350ms gaps
            // This respects the 3-requests-per-second limit perfectly.
            const main = await jikanjs.loadAnime(malId, 'full');
            await stall(350);
            const chars = await jikanjs.loadAnime(malId, 'characters');
            await stall(350);
            const recs = await jikanjs.loadAnime(malId, 'recommendations');
            data = {
                ...main.data,
                characters: chars.data?.slice(0, 6) || [],
                recommendations: recs.data?.slice(0, 5) || []
            };
            myCache.set(cacheKey, data);
        } catch (error) {
            console.error("Uplink Error:", error.message);
            // If it's a 429, we tell the user the system is throttled
            const errorMsg = error.response?.status === 429
                ? "Intelligence Core: Rate Limit Exceeded. Please slow down."
                : "Intelligence Core: Subject Not Found";
            return res.status(error.response?.status || 404).send(errorMsg);
        }
    }
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { background: #000; color: white; font-family: 'Inter', sans-serif; margin:0; }
            .hero { height: 45vh; width:100%; position:relative; display:flex; align-items:flex-end; padding: 40px; box-sizing:border-box; }
            .hero-bg { position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; filter:blur(40px) brightness(0.2); z-index:-1; }
            .content { max-width: 1100px; margin: -120px auto 50px; padding: 0 20px; display: flex; gap: 40px; }
            .poster { width: 300px; border-radius: 20px; box-shadow: 0 30px 60px rgba(0,0,0,1); border: 1px solid rgba(255,255,255,0.1); }
            .right-panel { flex: 1; margin-top: 140px; }
            .t-btn { background: #ff0000; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 900; display: inline-flex; align-items: center; gap: 10px; margin-top: 20px; box-shadow: 0 0 20px rgba(255,0,0,0.3); transition: 0.3s; }
            .t-btn:hover { transform: scale(1.05); background: #cc0000; }
            .char-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; margin-top: 30px; }
            .char-card { text-align: center; }
            .char-card img { width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 50%; border: 2px solid #222; background: #111; }
            .char-card p { font-size: 10px; margin-top: 8px; opacity: 0.6; }
            .rec-tag { background: rgba(0,212,255,0.1); color: #00d4ff; padding: 5px 10px; border-radius: 5px; font-size: 11px; margin: 5px; display: inline-block; border: 1px solid #00d4ff; }
            @media (max-width: 800px) { .content { flex-direction: column; align-items: center; text-align: center; } .right-panel { margin-top: 20px; } }
        </style>
    </head>
    <body>
        <div class="hero">
            <img src="${data.images?.jpg?.large_image_url || ''}" class="hero-bg">
            <h1 style="font-size: clamp(24px, 5vw, 48px); margin:0; text-shadow: 0 10px 30px rgba(0,0,0,1);">${data.title}</h1>
        </div>
        <div class="content">
            <img src="${data.images?.jpg?.large_image_url || ''}" class="poster">
            <div class="right-panel">
                <div style="margin-bottom: 20px;">
                    <span class="rec-tag">${data.source || 'N/A'}</span>
                    <span class="rec-tag">${data.studios?.map(s => s.name).join(', ') || 'Independent'}</span>
                    <span class="rec-tag">RANK: #${data.rank || 'Unranked'}</span>
                </div>
                <p style="opacity:0.8; line-height:1.8; font-size: 15px;">${data.synopsis || 'No intelligence briefing available.'}</p>
                ${data.trailer?.url ? `<a href="${data.trailer.url}" target="_blank" class="t-btn">WATCH TRAILER</a>` : ''}
                <h3 style="margin-top:50px; font-size:12px; letter-spacing:3px; opacity:0.4;">CAST_DIRECTIVE</h3>
                <div class="char-grid">
                    ${data.characters.map(c => `
                        <div class="char-card">
                            <img src="${c.character.images?.jpg?.image_url || 'https://via.placeholder.com/100?text=No+Image'}">
                            <p>${c.character.name ? c.character.name.split(',')[0] : 'Unknown'}</p>
                        </div>
                    `).join('')}
                </div>
                <h3 style="margin-top:30px; font-size:12px; letter-spacing:2px; color:#00d4ff;">SIMILAR INTELLIGENCE</h3>
                <div style="display:flex; flex-wrap:wrap;">
                    ${data.recommendations.map(r => `
                        <div onclick="location.href='/anime-detail/${r.entry.mal_id}'" style="cursor:pointer; margin-right:10px; text-align:center; width:80px; margin-bottom:15px;">
                            <img src="${r.entry.images?.jpg?.image_url || ''}" style="width:100%; border-radius:5px; border: 1px solid #333;">
                            <p style="font-size:9px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; margin-top:5px;">${r.entry.title}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </body>
    </html>
    `);
});

// --- AI CORE (VANTAGE INTELLIGENCE) ---
router.post('/vantage-chat/:id', async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    const watchlist = await getWatchlist();
    const show = watchlist.find(s => s.id == id);
    const TRIGGER_WORD = "UPLINK";
    const isExplicitTrigger = message.toUpperCase().startsWith(TRIGGER_WORD);
    const cleanMessage = isExplicitTrigger ? message.slice(TRIGGER_WORD.length).trim() : message;
    const needsLiveIntel = isExplicitTrigger || /season|release|date|news|future|update|coming|when|latest|new|renewal|production|streaming|where/i.test(cleanMessage);
    let externalIntel = "";
    let tierUsed = "Internal Archive";
    if (show && needsLiveIntel) {
        if (process.env.TAVILY_API_KEY) {
            try {
                const tavilyRes = await axios.post('https://api.tavily.com/search', {
                    api_key: process.env.TAVILY_API_KEY,
                    query: `${show.title} show current status release date news 2025`,
                    search_depth: "advanced",
                    include_answer: true
                });
                if (tavilyRes.data.answer || tavilyRes.data.results.length > 0) {
                    externalIntel = tavilyRes.data.answer || tavilyRes.data.results.map(r => r.content).join(" ");
                    tierUsed = "Tavily (AI Tier)";
                }
            } catch (e) { console.log("Tavily failed"); }
        }
    }
    try {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: `You are VANTAGE. TODAY: ${today}. SOURCE: ${tierUsed}. ${externalIntel ? `INTEL: ${externalIntel}` : "Internal Archive Only."}` },
                { role: "user", content: `Context: ${show?.title}. Message: ${cleanMessage}` }
            ],
            model: "llama-3.3-70b-versatile",
        });
        res.json({ response: chatCompletion.choices[0].message.content });
    } catch (e) { res.status(500).json({ response: "Uplink unstable." }); }
});
module.exports = router;
