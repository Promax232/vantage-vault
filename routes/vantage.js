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
const stall = (ms) => new Promise(resolve => setTimeout(resolve, ms));




router.get('/anime-detail/:id', async (req, res) => {
    const malId = req.params.id;
    const cacheKey = `v_full_intel_${malId}`;
    let data = myCache.get(cacheKey);

    if (!data) {
        try {
            const main = await jikanjs.loadAnime(malId, 'full');
            await stall(400); // Protective delay
            const chars = await jikanjs.loadAnime(malId, 'characters');
            await stall(400);
            const recs = await jikanjs.loadAnime(malId, 'recommendations');
            
            data = {
                ...main.data,
                characters: chars.data?.slice(0, 6) || [],
                recommendations: recs.data?.slice(0, 10) || []
            };
            myCache.set(cacheKey, data);
        } catch (error) {
            return res.status(404).send("Uplink Lost: Subject Not Found");
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
            .hero-header { 
                position: relative; height: 50vh; display: flex; align-items: flex-end; 
                padding: 40px; overflow: hidden; border-radius: 0 0 40px 40px; 
            }
            .hero-bg { 
                position: absolute; top: 0; left: 0; width: 100%; height: 100%; 
                background: url('\${data.images.jpg.large_image_url}') center/cover; 
                filter: blur(60px) brightness(0.2); z-index: -1; transform: scale(1.1);
            }
            .intel-grid { 
                display: grid; grid-template-columns: 320px 1fr; gap: 40px; 
                max-width: 1400px; margin: -120px auto 60px; padding: 0 20px; 
            }
            .char-avatar { 
                width: 75px; height: 75px; border-radius: 50%; 
                border: 2px solid var(--accent); object-fit: cover; 
                transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
            }
            .char-avatar:hover { transform: scale(1.1) rotate(5deg); box-shadow: 0 0 15px var(--accent); }
            
            @media (max-width: 900px) {
                .intel-grid { grid-template-columns: 1fr; margin-top: 20px; }
                .hero-header { height: 35vh; padding: 20px; }
                .poster-img { width: 200px !important; margin: 0 auto; display: block; }
            }
        </style>
    </head>
    <body>
        ${NAV_COMPONENT}
        <div class="main-panel" style="padding:0;">
            <div class="hero-header">
                <div class="hero-bg"></div>
                <h1 class="accent-text" style="font-size: clamp(28px, 5vw, 56px); margin: 0; text-shadow: 0 10px 30px rgba(0,0,0,0.5);">\${data.title}</h1>
            </div>

            <div class="intel-grid">
                <div class="side-bar">
                    <img src="\${data.images.jpg.large_image_url}" class="glass poster-img" style="width:100%; border-radius:24px; box-shadow: 0 30px 60px rgba(0,0,0,0.8);">
                    <div class="glass" style="margin-top:20px; padding:20px;">
                        <p style="font-size:12px; opacity:0.6; letter-spacing:1px;">IDENTIFIER: MAL_\${data.mal_id}</p>
                        <p style="color:var(--accent); font-weight:bold;">SCORE: ★ \${data.score || '??'}</p>
                        <p>RANK: #\${data.rank || 'N/A'}</p>
                        <button class="btn" style="width:100%; margin-top:15px;" onclick="history.back()">RETURN TO HUD</button>
                    </div>
                </div>

                <div class="briefing-area">
                    <div class="glass" style="padding:30px; margin-bottom:30px;">
                        <h3 class="accent-text" style="font-size:12px; letter-spacing:2px; margin-top:0;">// MISSION_SYNOPSIS</h3>
                        <p style="line-height:1.8; opacity:0.8; font-size:16px;">\${data.synopsis}</p>
                    </div>

                    <h3 class="accent-text" style="font-size:12px; letter-spacing:2px; margin: 40px 0 20px;">// CAST_DIRECTIVE</h3>
                    <div style="display:flex; gap:25px; overflow-x:auto; padding-bottom:15px;">
                        \${data.characters.map(c => \`
                            <div style="text-align:center; min-width:80px;">
                                <img src="\${c.character.images.jpg.image_url}" class="char-avatar">
                                <p style="font-size:10px; margin-top:10px; opacity:0.7;">\${c.character.name.split(',')[0]}</p>
                            </div>
                        \`).join('')}
                    </div>

                    <h3 class="accent-text" style="font-size:12px; letter-spacing:2px; margin: 40px 0 20px;">// SIMILAR_INTELLIGENCE</h3>
                    <div style="display:flex; gap:15px; overflow-x:auto; padding-bottom:20px;">
                        \${data.recommendations.map(r => \`
                            <div class="glass" style="padding:8px; min-width:110px; cursor:pointer;" onclick="location.href='/api/anime-detail/\${r.entry.mal_id}'">
                                <img src="\${r.entry.images.jpg.image_url}" style="width:100%; border-radius:8px; aspect-ratio:2/3; object-fit:cover;">
                                <p style="font-size:9px; margin-top:8px; height:22px; overflow:hidden; text-overflow:ellipsis;">\${r.entry.title}</p>
                            </div>
                        \`).join('')}
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
