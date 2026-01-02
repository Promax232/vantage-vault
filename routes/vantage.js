const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const jikanjs = require('@mateoaranda/jikanjs');
const axios = require('axios');
const { getWatchlist } = require('../db');
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const { HUD_STYLE, NAV_COMPONENT } = require('../ui/layout'); // Add this!


const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });


router.get('/anime-detail/:id', async (req, res) => {
    const malId = req.params.id;
    const cacheKey = `v_full_intel_${malId}`;
    let data = myCache.get(cacheKey);
    
    if (!data) {
        try {
            const main = await jikanjs.loadAnime(malId, 'full');
            await stall(350);
            const chars = await jikanjs.loadAnime(malId, 'characters');
            await stall(350);
            const recs = await jikanjs.loadAnime(malId, 'recommendations');
            data = {
                ...main.data,
                characters: chars.data?.slice(0, 6) || [],
                recommendations: recs.data?.slice(0, 10) || []
            };
            myCache.set(cacheKey, data);
        } catch (error) {
            return res.status(404).send("Intelligence Core: Subject Not Found");
        }
    }

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${HUD_STYLE}
        <style>
            .hero-section { position: relative; height: 50vh; overflow: hidden; display: flex; align-items: flex-end; padding: 40px; border-radius: 0 0 40px 40px; }
            .hero-blur { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('\${data.images.jpg.large_image_url}') center/cover; filter: blur(60px) brightness(0.3); z-index: -1; }
            .char-circle { width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--accent); object-fit: cover; transition: 0.3s; }
            .char-circle:hover { transform: scale(1.1); box-shadow: 0 0 15px var(--accent); }
            .rec-card { width: 120px; flex-shrink: 0; cursor: pointer; transition: 0.3s; }
            .rec-card:hover { transform: translateY(-5px); }
        </style>
    </head>
    <body>
        ${NAV_COMPONENT}
        <div class="main-panel" style="padding: 0;">
            <div class="hero-section">
                <div class="hero-blur"></div>
                <div style="display: flex; gap: 30px; align-items: center; flex-wrap: wrap;">
                    <img src="\${data.images.jpg.large_image_url}" style="width: 200px; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); border: 1px solid var(--border);">
                    <div>
                        <h1 class="accent-text" style="font-size: clamp(24px, 5vw, 48px); margin: 0;">\${data.title}</h1>
                        <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                            <span class="glass" style="padding: 5px 15px; font-size: 10px; color: var(--gold);">★ \${data.score || 'N/A'}</span>
                            <span class="glass" style="padding: 5px 15px; font-size: 10px;">\${data.year || 'Classic'}</span>
                            <span class="glass" style="padding: 5px 15px; font-size: 10px; color: var(--accent);">\${data.status}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style="padding: 40px;">
                <div class="split-view" style="min-height: auto; gap: 40px;">
                    <div style="flex: 2;">
                        <h3 class="accent-text" style="letter-spacing: 2px; font-size: 12px;">// SYNOPSIS</h3>
                        <p style="line-height: 1.8; opacity: 0.8; font-size: 15px;">\${data.synopsis}</p>
                        
                        <h3 class="accent-text" style="letter-spacing: 2px; font-size: 12px; margin-top: 40px;">// CAST_DIRECTIVE</h3>
                        <div style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px;">
                            \${data.characters.map(c => \`
                                <div style="text-align: center; width: 80px;">
                                    <img src="\${c.character.images.jpg.image_url}" class="char-circle">
                                    <p style="font-size: 9px; margin-top: 8px; opacity: 0.6;">\${c.character.name.split(',')[0]}</p>
                                </div>
                            \`).join('')}
                        </div>
                    </div>

                    <div style="flex: 1;">
                        <div class="glass" style="padding: 25px;">
                            <h3 class="accent-text" style="font-size: 12px; margin-top: 0;">UPLINK ACTIONS</h3>
                            <button class="btn" style="width: 100%; margin-bottom: 10px;" onclick="saveToVault('\${data.mal_id}', '\${encodeURIComponent(data.title)}', '\${encodeURIComponent(data.images.jpg.large_image_url)}')">ADD TO VAULT</button>
                            \${data.trailer?.url ? \`<a href="\${data.trailer.url}" target="_blank" class="btn" style="display: block; text-align: center; text-decoration: none;">VIEW TRAILER</a>\` : ''}
                        </div>
                    </div>
                </div>

                <h3 class="accent-text" style="letter-spacing: 2px; font-size: 12px; margin-top: 50px;">// SIMILAR_INTELLIGENCE</h3>
                <div style="display: flex; gap: 20px; overflow-x: auto; padding: 20px 0;">
                    \${data.recommendations.map(r => \`
                        <div class="rec-card" onclick="location.href='/api/anime-detail/\${r.entry.mal_id}'">
                            <img src="\${r.entry.images.jpg.image_url}" style="width: 100%; border-radius: 10px; aspect-ratio: 2/3; object-fit: cover;">
                            <p style="font-size: 10px; margin-top: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">\${r.entry.title}</p>
                        </div>
                    \`).join('')}
                </div>
            </div>
        </div>
        <script>
            function saveToVault(id, title, poster) {
                window.location.href = \`/api/watchlist/save?id=\${id}&title=\${title}&poster=\${poster}&type=anime&source=mal&total=12&status=planned\`;
            }
        </script>
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
