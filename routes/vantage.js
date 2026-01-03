const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const axios = require('axios');
const { HUD_STYLE, NAV_COMPONENT } = require('../ui/layout');
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// --- THE ANILIST UPLINK (GraphQL Wrapper) ---
const aniListQuery = async (query, variables) => {
    try {
        const response = await axios.post('https://graphql.anilist.co', {
            query: query,
            variables: variables
        }, { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } });
        return response.data.data;
    } catch (e) {
        console.error("AniList Uplink Failure:", e.message);
        throw new Error("Uplink Severed");
    }
};

// 1. VANTAGE SEARCH (Replaces Jikan Search)
router.get('/api/vantage-search', async (req, res) => {
    const query = `
    query ($search: String) {
        Page(perPage: 12) {
            media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
                id title { english romaji } coverImage { large } episodes
            }
        }
    }`;
    try {
        const data = await aniListQuery(query, { search: req.query.q });
        const mapped = data.Page.media.map(a => ({
            id: a.id,
            title: a.title.english || a.title.romaji,
            poster: a.coverImage.large,
            total: a.episodes || 0
        }));
        res.json(mapped);
    } catch (e) { res.status(500).json({ error: "Search Failed" }); }
});

// 2. VANTAGE DATA (Seasonal/Top/Archive)
router.get('/vantage-data', async (req, res) => {
    const { type, year, season } = req.query;
    const cacheKey = `v_ani_${type}_${year || 'now'}_${season || 'now'}`;
    const cached = myCache.get(cacheKey);
    if (cached) return res.json(cached);

    let gqlQuery = '';
    let variables = { perPage: 20 };

    if (type === 'top') {
        gqlQuery = `query { Page(perPage: 20) { media(sort: SCORE_DESC, type: ANIME) { id title { english romaji } coverImage { large } averageScore } } }`;
    } else if (type === 'archive') {
        gqlQuery = `query ($year: Int, $season: Season) { Page(perPage: 20) { media(seasonYear: $year, season: $season, type: ANIME, sort: POPULARITY_DESC) { id title { english romaji } coverImage { large } averageScore } } }`;
        variables.year = parseInt(year);
        variables.season = season.toUpperCase();
    } else {
        // Current Season
        gqlQuery = `query { Page(perPage: 20) { media(season: WINTER, seasonYear: 2026, type: ANIME, sort: POPULARITY_DESC) { id title { english romaji } coverImage { large } averageScore } } }`;
    }

    try {
        const data = await aniListQuery(gqlQuery, variables);
        const mapped = data.Page.media.map(a => ({
            id: a.id,
            title: a.title.english || a.title.romaji,
            poster: a.coverImage.large,
            score: (a.averageScore / 10).toFixed(1) || '??'
        }));
        myCache.set(cacheKey, mapped);
        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: "Data Uplink Failed" });
    }
});

// 3. ANIME DETAIL (The "Full Power" Single Request)
router.get('/anime-detail/:id', async (req, res) => {
    const aniId = req.params.id;
    
    // This query fetches EVERYTHING in one shot: Banner, Chars, Recs, Studio
    const query = `
    query ($id: Int) {
        Media (id: $id, type: ANIME) {
            id
            title { english romaji }
            description
            bannerImage
            coverImage { large }
            averageScore
            status
            episodes
            seasonYear
            studios(isMain: true) { nodes { name } }
            characters(sort: ROLE, perPage: 10) { nodes { name { full } image { medium } } }
            recommendations(sort: RATING_DESC, perPage: 8) { nodes { mediaRecommendation { id title { english romaji } coverImage { medium } } } }
            trailer { site id }
        }
    }`;

    try {
        const raw = await aniListQuery(query, { id: parseInt(aniId) });
        const media = raw.Media;
        
        // Format for Vantage OS
        const data = {
            id: media.id,
            title: media.title.english || media.title.romaji,
            desc: media.description || "No Intel Available.",
            banner: media.bannerImage || media.coverImage.large, // Fallback if no banner
            poster: media.coverImage.large,
            score: media.averageScore ? (media.averageScore / 10).toFixed(1) : "N/A",
            status: media.status,
            year: media.seasonYear,
            eps: media.episodes,
            studio: media.studios.nodes[0]?.name || "Unknown",
            chars: media.characters.nodes,
            recs: media.recommendations.nodes.map(n => n.mediaRecommendation).filter(Boolean),
            trailer: media.trailer?.site === 'youtube' ? `https://www.youtube.com/watch?v=${media.trailer.id}` : null
        };

        res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${HUD_STYLE}
            <style>
                .hero-header { position: relative; height: 50vh; display: flex; align-items: flex-end; padding: 40px; border-bottom: 1px solid rgba(255,255,255,0.1); }
                .hero-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('${data.banner}') center/cover; mask-image: linear-gradient(to bottom, black 20%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%); z-index: -1; opacity: 0.6; }
                .content-grid { display: grid; grid-template-columns: 300px 1fr; gap: 50px; max-width: 1400px; margin: -80px auto 50px; padding: 0 30px; position: relative; }
                
                @media (max-width: 900px) {
                    .content-grid { grid-template-columns: 1fr; margin-top: 0; }
                    .hero-header { height: 30vh; }
                }
            </style>
        </head>
        <body>
            ${NAV_COMPONENT}
            <div class="main-panel" style="padding:0;">
                <div class="hero-header">
                    <div class="hero-bg"></div>
                    <div style="z-index:2;">
                        <h1 class="accent-text" style="font-size: clamp(30px, 5vw, 60px); text-shadow: 0 5px 20px black; margin:0;">${data.title}</h1>
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <span class="glass" style="padding:5px 10px; font-size:11px;">${data.year || 'CLASSIC'}</span>
                            <span class="glass" style="padding:5px 10px; font-size:11px; color:var(--accent);">${data.studio}</span>
                        </div>
                    </div>
                </div>

                <div class="content-grid">
                    <div class="side-intel">
                        <img src="${data.poster}" class="glass" style="width:100%; border-radius:15px; box-shadow: 0 20px 50px rgba(0,0,0,0.6);">
                        <button class="btn" style="width:100%; margin-top:20px; padding: 15px;" onclick="addToVault()">SAVE TO VAULT</button>
                        <div class="glass" style="margin-top:20px; padding:20px;">
                            <p style="font-size:12px; opacity:0.7;">SCORE</p>
                            <h2 style="margin:0; color:var(--accent);">★ ${data.score}</h2>
                            <p style="font-size:12px; opacity:0.7; margin-top:15px;">STATUS</p>
                            <h4 style="margin:0;">${data.status}</h4>
                        </div>
                    </div>

                    <div class="main-intel">
                        <div class="glass" style="padding:25px; margin-bottom:30px;">
                            <h3 class="accent-text" style="font-size:12px; margin-top:0;">// INTELLIGENCE_BRIEFING</h3>
                            <p style="opacity:0.8; line-height:1.7;">${data.desc}</p>
                        </div>

                        <h3 class="accent-text" style="font-size:12px;">// CAST_DIRECTIVE</h3>
                        <div style="display:flex; gap:15px; overflow-x:auto; padding-bottom:15px; margin-bottom:30px;">
                            ${data.chars.map(c => `
                                <div style="min-width:80px; text-align:center;">
                                    <img src="${c.image.medium}" style="width:70px; height:70px; border-radius:50%; object-fit:cover; border:2px solid #333;">
                                    <p style="font-size:10px; margin-top:5px;">${c.name.full}</p>
                                </div>
                            `).join('')}
                        </div>

                        <h3 class="accent-text" style="font-size:12px;">// SIMILAR_ENTITIES</h3>
                        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap:15px;">
                            ${data.recs.map(r => `
                                <div onclick="location.href='/api/anime-detail/${r.id}'" style="cursor:pointer;">
                                    <img src="${r.coverImage.medium}" style="width:100%; border-radius:8px; aspect-ratio:2/3; object-fit:cover;">
                                    <p style="font-size:11px; margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.title.english || r.title.romaji}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <script>
                function addToVault() {
                    const url = \`/api/watchlist/save?id=${data.id}&title=${encodeURIComponent(data.title)}&poster=${encodeURIComponent(data.poster)}&type=anime&source=anilist&total=${data.eps || 12}&status=planned\`;
                    window.location.href = url;
                }
            </script>
        </body>
        </html>
        `);
    } catch (e) {
        res.status(404).send("<h2>404: INTELLIGENCE LOST</h2>");
    }
});

module.exports = router;
