const { HUD_STYLE, NAV_COMPONENT } = require('../ui/layout'); // Add this!
const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const jikanjs = require('@mateoaranda/jikanjs');
const axios = require('axios');
const { getWatchlist } = require('../db');
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });



// ... (keep search and vantage-data routes exactly as they are)
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
            const errorMsg = error.response?.status === 429
                ? "Intelligence Core: Rate Limit Exceeded. Please slow down."
                : "Intelligence Core: Subject Not Found";
            return res.status(error.response?.status || 404).send(errorMsg);
        }
    }

    // --- VANTAGE OS RENDER ---
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${HUD_STYLE}
        <style>
            /* CUSTOM HERO STYLING */
            .hero-header { position: relative; height: 55vh; min-height: 400px; display: flex; align-items: flex-end; padding: 40px; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.1); }
            .hero-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('${data.images?.jpg?.large_image_url}') center/cover; filter: blur(50px) brightness(0.2); z-index: -1; transform: scale(1.1); }
            .content-wrapper { max-width: 1300px; margin: -100px auto 60px; padding: 0 30px; display: flex; gap: 50px; position: relative; z-index: 10; }
            .main-poster { width: 320px; border-radius: 20px; box-shadow: 0 40px 80px rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.1); aspect-ratio: 2/3; object-fit: cover; }
            
            /* TAGS & BUTTONS */
            .meta-tag { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2); color: var(--text); padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; backdrop-filter: blur(10px); }
            .action-btn { background: var(--accent); color: white; border: none; padding: 16px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; transition: 0.3s; width: 100%; margin-top: 20px; text-decoration: none; display: inline-block; text-align: center; }
            .action-btn:hover { background: white; color: black; transform: translateY(-2px); box-shadow: 0 0 30px var(--accent); }

            /* CHARACTERS */
            .char-ring { width: 85px; height: 85px; border-radius: 50%; padding: 3px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); transition: 0.3s; }
            .char-ring img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
            .char-ring:hover { border-color: var(--accent); transform: scale(1.1); }

            /* MOBILE OPTIMIZATION */
            @media (max-width: 900px) {
                .content-wrapper { flex-direction: column; align-items: center; margin-top: -50px; }
                .hero-header { height: 35vh; min-height: unset; align-items: center; justify-content: center; text-align: center; }
                .hero-header h1 { font-size: 32px !important; }
                .right-col { width: 100%; }
                .main-poster { width: 220px; margin-bottom: 30px; }
                .char-scroll { justify-content: flex-start; }
            }
        </style>
    </head>
    <body>
        ${NAV_COMPONENT}
        <div class="main-panel" style="padding: 0;">
            <div class="hero-header">
                <div class="hero-bg"></div>
                <div style="width: 100%; max-width: 1300px; margin: 0 auto;">
                    <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; justify-content: inherit;">
                        <span class="meta-tag" style="color: var(--accent);">★ ${data.score || 'N/A'}</span>
                        <span class="meta-tag">${data.year || 'Classic'}</span>
                        <span class="meta-tag">${data.status || 'Unknown'}</span>
                    </div>
                    <h1 style="font-size: 56px; font-weight: 800; margin: 0; line-height: 1.1; letter-spacing: -1px; text-shadow: 0 10px 30px rgba(0,0,0,0.5);">${data.title}</h1>
                </div>
            </div>

            <div class="content-wrapper">
                <div class="left-col">
                    <img src="${data.images?.jpg?.large_image_url}" class="main-poster">
                    ${data.trailer?.url ? `<a href="${data.trailer.url}" target="_blank" class="action-btn">WATCH TRAILER</a>` : ''}
                    <div class="glass" style="margin-top: 20px; padding: 20px; border-radius: 12px;">
                        <div style="font-size: 11px; opacity: 0.5; margin-bottom: 5px;">STUDIO</div>
                        <div style="font-size: 14px; font-weight: 600;">${data.studios?.map(s => s.name).join(', ') || 'Unknown'}</div>
                        <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 15px 0;"></div>
                        <div style="font-size: 11px; opacity: 0.5; margin-bottom: 5px;">SOURCE</div>
                        <div style="font-size: 14px; font-weight: 600;">${data.source || 'Original'}</div>
                    </div>
                </div>

                <div class="right-col" style="flex: 1;">
                    <h3 style="font-size: 12px; letter-spacing: 2px; color: var(--accent); margin-bottom: 15px;">INTELLIGENCE_BRIEF</h3>
                    <p style="font-size: 16px; line-height: 1.8; opacity: 0.85; margin-bottom: 50px; font-weight: 300;">
                        ${data.synopsis || 'No classified data available.'}
                    </p>

                    <h3 style="font-size: 12px; letter-spacing: 2px; opacity: 0.5; margin-bottom: 25px;">CAST_DIRECTIVE</h3>
                    <div class="char-scroll" style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; scrollbar-width: none;">
                        ${data.characters.map(c => `
                            <div style="text-align: center; min-width: 90px;">
                                <div class="char-ring">
                                    <img src="${c.character.images?.jpg?.image_url}">
                                </div>
                                <div style="font-size: 11px; margin-top: 10px; font-weight: 600;">${c.character.name.split(',')[0]}</div>
                            </div>
                        `).join('')}
                    </div>

                    <h3 style="font-size: 12px; letter-spacing: 2px; color: var(--accent); margin-top: 40px; margin-bottom: 25px;">SIMILAR_ENTITIES</h3>
                    <div style="display: flex; gap: 15px; overflow-x: auto; padding-bottom: 20px;">
                        ${data.recommendations.map(r => `
                            <div onclick="location.href='/api/anime-detail/${r.entry.mal_id}'" style="cursor: pointer; min-width: 120px; transition: 0.3s;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                                <img src="${r.entry.images?.jpg?.image_url}" style="width: 100%; border-radius: 12px; aspect-ratio: 2/3; object-fit: cover; box-shadow: 0 10px 20px rgba(0,0,0,0.3);">
                                <div style="font-size: 11px; margin-top: 10px; opacity: 0.7; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${r.entry.title}</div>
                            </div>
                        `).join('')}
                    </div>
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
