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




router.get('/anime-detail/:id', async (req, res) => {
    const malId = req.params.id;
    const cacheKey = `v_full_intel_${malId}`;
    let data = myCache.get(cacheKey);

    if (!data) {
        try {
            // SEQUENTIAL UPLINK with protective delays to avoid 429s
            const main = await jikanjs.loadAnime(malId, 'full');
            await stall(500); // Increased stall to 500ms for safety
            const chars = await jikanjs.loadAnime(malId, 'characters');
            await stall(500);
            const recs = await jikanjs.loadAnime(malId, 'recommendations');
            
            data = {
                ...main.data,
                characters: chars.data?.slice(0, 6) || [],
                recommendations: recs.data?.slice(0, 8) || []
            };
            myCache.set(cacheKey, data);
        } catch (error) {
            return res.status(error.response?.status || 404).send("<h2>Intelligence Core: Throttled or Not Found</h2>");
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
            .hero-header { position: relative; height: 60vh; min-height: 400px; display: flex; align-items: flex-end; padding: 40px; overflow: hidden; border-bottom: 1px solid var(--border); }
            .hero-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('\${data.images.jpg.large_image_url}') center/cover; filter: blur(50px) brightness(0.2); z-index: -1; transform: scale(1.1); }
            .content-grid { display: grid; grid-template-columns: 300px 1fr; gap: 40px; max-width: 1400px; margin: -100px auto 50px; padding: 0 20px; position: relative; z-index: 10; }
            .char-avatar { width: 70px; height: 70px; border-radius: 50%; border: 2px solid var(--accent); object-fit: cover; transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
            .char-avatar:hover { transform: scale(1.15) rotate(5deg); box-shadow: 0 0 20px var(--accent); }
            @media (max-width: 900px) {
                .content-grid { grid-template-columns: 1fr; margin-top: 20px; }
                .hero-header { height: 40vh; padding: 20px; }
            }
        </style>
    </head>
    <body>
        ${NAV_COMPONENT}
        <div class="main-panel" style="padding:0;">
            <div class="hero-header">
                <div class="hero-bg"></div>
                <div>
                    <div style="display:flex; gap:10px; margin-bottom:15px;">
                        <span class="glass" style="padding:5px 12px; font-size:10px; color:var(--accent);">\${data.type}</span>
                        <span class="glass" style="padding:5px 12px; font-size:10px; color:var(--gold);">RANK #\${data.rank || '??'}</span>
                    </div>
                    <h1 class="accent-text" style="font-size: clamp(32px, 6vw, 64px); margin: 0; text-shadow: 0 10px 30px rgba(0,0,0,0.5);">\${data.title}</h1>
                </div>
            </div>

            <div class="content-grid">
                <div class="side-panel-alt">
                    <img src="\${data.images.jpg.large_image_url}" class="glass" style="width:100%; border-radius:20px; box-shadow: 0 30px 60px rgba(0,0,0,0.8);">
                    <button class="btn" style="width:100%; margin-top:20px; padding:20px;" onclick="addToVault()">SAVE TO ACTIVE SYNC</button>
                    <div class="glass" style="margin-top:20px; padding:20px; font-size:12px;">
                        <p><b>Status:</b> \${data.status}</p>
                        <p><b>Episodes:</b> \${data.episodes || '??'}</p>
                        <p><b>Studios:</b> \${data.studios.map(s => s.name).join(', ')}</p>
                    </div>
                </div>

                <div class="main-intel">
                    <div class="glass" style="padding:30px; margin-bottom:30px;">
                        <h3 class="accent-text" style="font-size:12px; letter-spacing:2px;">// INTEL_BRIEFING</h3>
                        <p style="line-height:1.8; opacity:0.8; font-size:16px;">\${data.synopsis}</p>
                    </div>

                    <h3 class="accent-text" style="font-size:12px; letter-spacing:2px; margin: 40px 0 20px;">// CHARACTER_PROFILES</h3>
                    <div style="display:flex; gap:20px; overflow-x:auto; padding-bottom:15px;">
                        \${data.characters.map(c => \`
                            <div style="text-align:center; min-width:80px;">
                                <img src="\${c.character.images.jpg.image_url}" class="char-avatar">
                                <p style="font-size:10px; margin-top:10px; opacity:0.6;">\${c.character.name.split(',')[0]}</p>
                            </div>
                        \`).join('')}
                    </div>

                    <h3 class="accent-text" style="font-size:12px; letter-spacing:2px; margin: 40px 0 20px;">// NEURAL_RECOMMENDATIONS</h3>
                    <div class="poster-grid">
                        \${data.recommendations.map(r => \`
                            <div class="glass" style="padding:10px; cursor:pointer;" onclick="location.href='/anime-detail/\${r.entry.mal_id}'">
                                <img src="\${r.entry.images.jpg.image_url}" style="width:100%; border-radius:10px; aspect-ratio:2/3; object-fit:cover;">
                                <p style="font-size:10px; margin-top:8px; height:24px; overflow:hidden;">\${r.entry.title}</p>
                            </div>
                        \`).join('')}
                    </div>
                </div>
            </div>
        </div>

        <script>
            function addToVault() {
                window.location.href = \`/api/watchlist/save?id=\${data.mal_id}&title=\${encodeURIComponent(data.title)}&poster=\${encodeURIComponent(data.images.jpg.large_image_url)}&type=anime&source=mal&total=\${data.episodes || 12}&status=watching\`;
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
