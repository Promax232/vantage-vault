const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const axios = require('axios');
const { HUD_STYLE, NAV_COMPONENT } = require('../ui/layout');
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Helper function to ensure HTTPS for images
const ensureHttps = (url) => {
    if (!url) return 'https://via.placeholder.com/400x600/0b0c10/00d4ff?text=NO+IMAGE';
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
};

// --- THE SATELLITE UPLINK (GraphQL) ---
const aniListQuery = async (query, variables) => {
    try {
        const response = await axios.post('https://graphql.anilist.co', {
            query: query,
            variables: variables
        }, { 
            headers: { 
                'Content-Type': 'application/json', 
                'Accept': 'application/json' 
            },
            timeout: 10000
        });
        return response.data.data;
    } catch (e) {
        console.error("AniList Uplink Failure:", e.message);
        throw new Error("Uplink Severed");
    }
};

// 1. VANTAGE SEARCH (High Speed)
router.get('/api/vantage-search', async (req, res) => {
    const query = `
    query ($search: String) {
        Page(perPage: 12) {
            media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
                id title { english romaji } coverImage { large color } episodes
            }
        }
    }`;
    try {
        const data = await aniListQuery(query, { search: req.query.q });
        const mapped = data.Page.media.map(a => ({
            id: a.id,
            title: a.title.english || a.title.romaji,
            poster: ensureHttps(a.coverImage.large),
            color: a.coverImage.color || '#00d4ff',
            total: a.episodes || 0
        }));
        res.json(mapped);
    } catch (e) { 
        res.status(500).json({ error: "Search Failed" }); 
    }
});

// 2. VANTAGE DATA (Dashboard Feeds)
router.get('/vantage-data', async (req, res) => {
    const { type, year, season } = req.query;
    const cacheKey = `v_ani_${type}_${year || 'now'}_${season || 'now'}`;
    const cached = myCache.get(cacheKey);
    if (cached) return res.json(cached);

    let gqlQuery = '';
    let variables = { perPage: 24 };

    if (type === 'top') {
        gqlQuery = `query ($perPage: Int) { Page(perPage: $perPage) { media(sort: SCORE_DESC, type: ANIME, status_in: [FINISHED, RELEASING]) { id title { english romaji } coverImage { large color } averageScore } } }`;
    } else if (type === 'archive') {
        gqlQuery = `query ($year: Int, $season: Season, $perPage: Int) { Page(perPage: $perPage) { media(seasonYear: $year, season: $season, type: ANIME, sort: POPULARITY_DESC) { id title { english romaji } coverImage { large color } averageScore } } }`;
        variables.year = parseInt(year);
        variables.season = season.toUpperCase();
    } else if (type === 'airing') {
        gqlQuery = `query ($perPage: Int) { Page(perPage: $perPage) { media(status: RELEASING, type: ANIME, sort: POPULARITY_DESC) { id title { english romaji } coverImage { large color } averageScore nextAiringEpisode { airingAt episode } } } }`;
    } else {
        // Current season
        const currentYear = new Date().getFullYear();
        const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
        const currentMonth = new Date().getMonth();
        const currentSeason = seasons[Math.floor(currentMonth / 3)];
        
        gqlQuery = `query ($year: Int, $season: Season, $perPage: Int) { Page(perPage: $perPage) { media(seasonYear: $year, season: $season, type: ANIME, sort: POPULARITY_DESC) { id title { english romaji } coverImage { large color } averageScore } } }`;
        variables.year = currentYear;
        variables.season = currentSeason;
    }

    try {
        const data = await aniListQuery(gqlQuery, variables);
        const mapped = data.Page.media.map(a => ({
            id: a.id,
            title: a.title.english || a.title.romaji,
            poster: ensureHttps(a.coverImage.large),
            color: a.coverImage.color || '#00d4ff',
            score: a.averageScore ? (a.averageScore / 10).toFixed(1) : '??',
            airingAt: a.nextAiringEpisode ? a.nextAiringEpisode.airingAt : null,
            episode: a.nextAiringEpisode ? a.nextAiringEpisode.episode : null
        }));
        myCache.set(cacheKey, mapped);
        res.json(mapped);
    } catch (e) {
        console.error("Vantage Data Error:", e);
        res.status(500).json({ error: "Data Uplink Failed" });
    }
});

// 3. AIRING TODAY ENDPOINT
router.get('/api/airing-today', async (req, res) => {
    const cacheKey = 'airing_today';
    const cached = myCache.get(cacheKey);
    if (cached) return res.json(cached);

    try {
        const today = Math.floor(Date.now() / 1000);
        const tomorrow = today + 86400;
        
        const query = `
        query ($today: Int, $tomorrow: Int) {
            Page(perPage: 30) {
                media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
                    id
                    title { english romaji }
                    coverImage { large color }
                    nextAiringEpisode {
                        airingAt
                        episode
                    }
                }
            }
        }`;

        const data = await aniListQuery(query, { today, tomorrow });
        
        const filtered = data.Page.media.filter(media => {
            if (!media.nextAiringEpisode) return false;
            const airingAt = media.nextAiringEpisode.airingAt;
            return airingAt >= today && airingAt < tomorrow;
        });

        const mapped = filtered.map(a => ({
            id: a.id,
            title: a.title.english || a.title.romaji,
            poster: ensureHttps(a.coverImage.large),
            color: a.coverImage.color || '#00d4ff',
            airingAt: a.nextAiringEpisode.airingAt,
            episode: a.nextAiringEpisode.episode,
            airTime: new Date(a.nextAiringEpisode.airingAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        // Sort by airing time
        mapped.sort((a, b) => a.airingAt - b.airingAt);
        
        myCache.set(cacheKey, mapped, 600); // Cache for 10 minutes
        res.json(mapped);
    } catch (e) {
        console.error("Airing Today Error:", e);
        res.status(500).json({ error: "Failed to fetch airing schedule" });
    }
});

// 4. VANTAGE AI CHAT ENDPOINT
router.post('/api/vantage-chat/:id', async (req, res) => {
    try {
        const { message } = req.body;
        const animeId = req.params.id;
        
        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: "Message required" });
        }

        // First get anime details
        const animeQuery = `
        query ($id: Int) {
            Media(id: $id, type: ANIME) {
                title { english romaji }
                description
                genres
                averageScore
                status
                episodes
                studios(isMain: true) { nodes { name } }
                characters(sort: ROLE, perPage: 5) { nodes { name { full } } }
            }
        }`;

        const animeData = await aniListQuery(animeQuery, { id: parseInt(animeId) });
        const anime = animeData.Media;
        
        // Prepare context for AI
        const context = {
            title: anime.title.english || anime.title.romaji,
            description: anime.description ? anime.description.replace(/<[^>]*>/g, '').substring(0, 500) : "No description available.",
            genres: anime.genres || [],
            score: anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "N/A",
            status: anime.status,
            episodes: anime.episodes || "Unknown",
            studio: anime.studios.nodes[0]?.name || "Unknown",
            characters: anime.characters.nodes.slice(0, 3).map(c => c.name.full).join(", ")
        };

        // Create AI prompt
        const prompt = `
        You are VANTAGE AI, an anime expert assistant. Analyze the following anime based on user query.
        
        ANIME INFO:
        Title: ${context.title}
        Status: ${context.status}
        Episodes: ${context.episodes}
        Score: ${context.score}/10
        Studio: ${context.studio}
        Genres: ${context.genres.join(', ')}
        Main Characters: ${context.characters}
        
        USER QUERY: "${message}"
        
        Please provide a detailed, insightful response about this anime. If the user asks for recommendations, suggest similar anime. If asking about plot, summarize without spoilers. Be analytical but engaging.
        
        RESPONSE:`;

        // Call Groq API
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are VANTAGE AI, an expert anime analyst. Provide detailed, insightful analysis of anime. Format responses in HTML with paragraphs. Use <strong> for emphasis and <br> for line breaks."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.7,
            max_tokens: 1000,
        });

        const response = completion.choices[0]?.message?.content || "No response generated.";
        
        res.json({ 
            response: response,
            context: {
                title: context.title,
                query: message
            }
        });

    } catch (error) {
        console.error("Vantage AI Error:", error);
        res.status(500).json({ 
            response: `<div style="color: #ff4444;">⚠️ AI UPLINK FAILED. ERROR: ${error.message}</div>
                      <div style="margin-top: 10px; color: #888; font-size: 12px;">Please check your GROQ API key or try again later.</div>`
        });
    }
});

// 5. ANIME DETAIL (The "God Tier" Interface)
router.get('/anime-detail/:id', async (req, res) => {
    const aniId = req.params.id;
    
    // THE MASTER QUERY: Fetches everything AniList has in one shot
    const query = `
    query ($id: Int) {
        Media (id: $id, type: ANIME) {
            id
            title { english romaji native }
            description
            bannerImage
            coverImage { extraLarge color }
            averageScore
            popularity
            favourites
            status
            format
            episodes
            duration
            seasonYear
            season
            nextAiringEpisode { airingAt timeUntilAiring episode }
            rankings { rank type context allTime }
            studios(isMain: true) { nodes { name } }
            characters(sort: ROLE, perPage: 12) { nodes { name { full } image { medium } } }
            relations { nodes { id title { english romaji } coverImage { medium } type } }
            recommendations(sort: RATING_DESC, perPage: 10) { nodes { mediaRecommendation { id title { english romaji } coverImage { medium } } } }
            trailer { site id }
            externalLinks { site url }
        }
    }`;

    try {
        const raw = await aniListQuery(query, { id: parseInt(aniId) });
        const media = raw.Media;
        
        // Data Extraction
        const data = {
            id: media.id,
            title: media.title.english || media.title.romaji,
            native: media.title.native,
            desc: media.description ? media.description.replace(/<[^>]*>/g, '') : "No Intel Available.",
            banner: ensureHttps(media.bannerImage) || ensureHttps(media.coverImage.extraLarge),
            poster: ensureHttps(media.coverImage.extraLarge),
            color: media.coverImage.color || '#00d4ff',
            score: media.averageScore ? (media.averageScore / 10).toFixed(1) : "N/A",
            popularity: media.popularity,
            rank: media.rankings.find(r => r.type === 'RATED' && r.allTime) ? `#${media.rankings.find(r => r.type === 'RATED' && r.allTime).rank} All Time` : 'Unranked',
            status: media.status,
            format: media.format,
            year: media.seasonYear,
            season: media.season,
            eps: media.episodes,
            duration: media.duration,
            nextEp: media.nextAiringEpisode,
            studio: media.studios.nodes[0]?.name || "Unknown",
            chars: media.characters.nodes.map(c => ({
                ...c,
                image: { medium: ensureHttps(c.image.medium) }
            })),
            relations: media.relations.nodes.filter(n => n.type === 'ANIME').map(r => ({
                ...r,
                coverImage: { medium: ensureHttps(r.coverImage.medium) }
            })),
            recs: media.recommendations.nodes.map(n => n.mediaRecommendation).filter(Boolean).map(r => ({
                ...r,
                coverImage: { medium: ensureHttps(r.coverImage.medium) }
            })),
            trailer: media.trailer?.site === 'youtube' ? `https://www.youtube.com/watch?v=${media.trailer.id}` : null,
            links: media.externalLinks
        };

        // RENDER GOD TIER UI
        res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <meta name="theme-color" content="${data.color}">
            <title>${data.title} | VANTAGE OS</title>
            ${HUD_STYLE}
            <style>
                :root { --hero-color: ${data.color}; }
                
                body { 
                    background: #0b0c10; 
                    overflow-x: hidden;
                    -webkit-tap-highlight-color: transparent;
                }

                * {
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                }

                /* CINEMATIC HERO */
                .hero-banner { 
                    position: relative; 
                    height: 300px; 
                    width: 100%;
                    background: url('${data.banner}') center/cover no-repeat;
                    background-attachment: fixed;
                }
                .hero-overlay {
                    position: absolute; 
                    width: 100%; 
                    height: 100%;
                    background: linear-gradient(to top, #0b0c10 5%, rgba(11,12,16,0.7) 40%, rgba(11,12,16,0.3) 80%);
                }
                
                /* LAYOUT GRID */
                .layout-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 15px;
                    position: relative;
                    z-index: 10;
                    margin-top: -80px;
                }

                @media(min-width: 768px) {
                    .layout-grid {
                        grid-template-columns: 240px 1fr;
                        gap: 30px;
                        margin-top: -150px;
                    }
                }

                /* LEFT COLUMN */
                .poster-card {
                    width: 160px;
                    height: 240px;
                    border-radius: 8px;
                    box-shadow: 0 0 30px rgba(0,0,0,0.5), 0 0 15px var(--hero-color);
                    background: url('${data.poster}') center/cover no-repeat;
                    background-color: #1a1a1a;
                    margin: 0 auto 20px;
                }
                
                .action-menu { 
                    display: flex; 
                    flex-direction: column; 
                    gap: 10px; 
                    margin-bottom: 20px;
                }
                .action-btn {
                    background: rgba(255,255,255,0.08);
                    color: white;
                    border: none;
                    padding: 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    gap: 8px;
                    transition: all 0.2s ease;
                    backdrop-filter: blur(10px);
                }
                .action-btn.primary { 
                    background: var(--hero-color); 
                    color: #000; 
                    box-shadow: 0 0 20px var(--hero-color);
                }
                .action-btn:hover { 
                    transform: translateY(-2px); 
                    filter: brightness(1.2); 
                }

                .data-list { 
                    margin-top: 20px; 
                    font-size: 12px; 
                    color: #aaa; 
                    background: rgba(255,255,255,0.03);
                    border-radius: 8px;
                    padding: 15px;
                }
                .data-row { 
                    display: flex; 
                    justify-content: space-between; 
                    padding: 8px 0; 
                    border-bottom: 1px solid rgba(255,255,255,0.05); 
                }
                .data-val { 
                    color: white; 
                    font-weight: 500; 
                    text-align: right; 
                }

                /* RIGHT COLUMN */
                .content-header { 
                    text-align: center;
                    margin-bottom: 20px; 
                }
                @media(min-width: 768px) {
                    .content-header {
                        text-align: left;
                        margin-top: 110px;
                    }
                }
                
                .anime-title { 
                    font-size: 24px; 
                    font-weight: 700; 
                    color: white; 
                    margin: 0; 
                    line-height: 1.2;
                    word-break: break-word;
                }
                
                /* TABS SYSTEM */
                .tabs { 
                    display: flex; 
                    gap: 15px; 
                    border-bottom: 1px solid rgba(255,255,255,0.1); 
                    margin-bottom: 20px;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                    padding-bottom: 5px;
                }
                .tabs::-webkit-scrollbar {
                    display: none;
                }
                .tab { 
                    padding: 12px 0; 
                    font-size: 13px; 
                    color: #888; 
                    cursor: pointer; 
                    position: relative;
                    transition: 0.2s;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .tab.active { 
                    color: white; 
                    font-weight: 600; 
                }
                .tab.active::after {
                    content: ''; 
                    position: absolute; 
                    bottom: -1px; 
                    left: 0; 
                    width: 100%; 
                    height: 3px; 
                    background: var(--hero-color);
                    box-shadow: 0 0 10px var(--hero-color);
                }

                .tab-content { 
                    display: none; 
                    animation: fadeIn 0.3s ease; 
                }
                .tab-content.active { 
                    display: block; 
                }

                /* STATS BAR */
                .stats-bar { 
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin-bottom: 20px; 
                    background: rgba(255,255,255,0.03); 
                    padding: 15px; 
                    border-radius: 8px;
                }
                @media(min-width: 480px) {
                    .stats-bar {
                        grid-template-columns: repeat(4, 1fr);
                    }
                }
                .stat-box { 
                    text-align: center; 
                }
                .stat-label { 
                    font-size: 9px; 
                    color: var(--hero-color); 
                    letter-spacing: 1px; 
                    margin-bottom: 5px;
                    text-transform: uppercase;
                }
                .stat-value { 
                    font-size: 16px; 
                    font-weight: 700; 
                    color: white; 
                }

                /* GRIDS */
                .char-grid { 
                    display: grid; 
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); 
                    gap: 12px; 
                }
                .char-card { 
                    display: flex; 
                    background: rgba(255,255,255,0.05); 
                    border-radius: 6px; 
                    overflow: hidden; 
                    transition: 0.2s; 
                    height: 70px;
                }
                .char-card:hover { 
                    transform: translateY(-3px); 
                    background: rgba(255,255,255,0.1); 
                }
                .char-img { 
                    width: 50px; 
                    height: 100%; 
                    object-fit: cover;
                    flex-shrink: 0;
                }
                .char-info { 
                    padding: 8px; 
                    display: flex; 
                    flex-direction: column; 
                    justify-content: center;
                    overflow: hidden;
                }

                /* AI CHAT STYLES */
                #aiInput {
                    width: 100%;
                    padding: 12px 15px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 6px;
                    color: white;
                    font-size: 14px;
                    margin-bottom: 10px;
                }
                #aiInput:focus {
                    outline: none;
                    border-color: var(--hero-color);
                    box-shadow: 0 0 0 2px rgba(var(--hero-color-rgb), 0.2);
                }
                #aiResponse {
                    margin-top: 15px;
                    padding: 15px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 6px;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #ddd;
                    border-left: 3px solid var(--hero-color);
                }
                #aiResponse p {
                    margin-bottom: 10px;
                }

                /* MOBILE OPTIMIZATIONS */
                @media(max-width: 767px) {
                    .hero-banner { height: 200px; }
                    .anime-title { font-size: 20px; }
                    .stat-value { font-size: 14px; }
                    .char-grid {
                        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                    }
                }

                @keyframes fadeIn { 
                    from { opacity:0; transform:translateY(10px); } 
                    to { opacity:1; transform:translateY(0); } 
                }
            </style>
        </head>
        <body>
            ${NAV_COMPONENT}
            
            <div class="main-panel" style="padding: 0;">
                <div class="hero-banner">
                    <div class="hero-overlay"></div>
                </div>

                <div class="layout-grid">
                    <div class="left-col">
                        <div class="poster-card"></div>
                        <div class="action-menu">
                            <button class="action-btn primary" onclick="addToVault('planned')">
                                <span style="font-size: 16px;">+</span> ADD TO PLANNING
                            </button>
                            <button class="action-btn" onclick="addToVault('watching')">
                                <span style="font-size: 14px;">▶</span> SET AS WATCHING
                            </button>
                            ${data.trailer ? `<a href="${data.trailer}" target="_blank" class="action-btn"><span style="font-size: 14px;">⏵</span> WATCH TRAILER</a>` : ''}
                        </div>

                        <div class="data-list">
                            <div class="data-row"><span>Format</span><span class="data-val">${data.format}</span></div>
                            <div class="data-row"><span>Episodes</span><span class="data-val">${data.eps || '?'}</span></div>
                            <div class="data-row"><span>Duration</span><span class="data-val">${data.duration} mins</span></div>
                            <div class="data-row"><span>Status</span><span class="data-val">${data.status}</span></div>
                            <div class="data-row"><span>Season</span><span class="data-val">${data.season} ${data.year}</span></div>
                            <div class="data-row"><span>Studio</span><span class="data-val">${data.studio}</span></div>
                            <div class="data-row"><span>Source</span><span class="data-val">AniList</span></div>
                        </div>
                    </div>

                    <div class="right-col">
                        <div class="content-header">
                            <h1 class="anime-title">${data.title}</h1>
                            <p style="color: #666; font-size: 13px; margin-top: 5px;">${data.native || ''}</p>
                        </div>

                        <div class="stats-bar">
                            <div class="stat-box">
                                <div class="stat-label">SCORE</div>
                                <div class="stat-value">${data.score}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">RANK</div>
                                <div class="stat-value" style="font-size: 12px;">${data.rank}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">POPULARITY</div>
                                <div class="stat-value">#${data.popularity}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">VAULT STATUS</div>
                                <div class="stat-value" style="color: var(--hero-color); font-size: 12px;">TRACKING</div>
                            </div>
                        </div>

                        <div class="tabs">
                            <div class="tab active" onclick="switchTab('overview')">Overview</div>
                            <div class="tab" onclick="switchTab('chars')">Characters</div>
                            <div class="tab" onclick="switchTab('relations')">Relations</div>
                            <div class="tab" onclick="switchTab('ai')">Vantage AI</div>
                        </div>

                        <div id="overview" class="tab-content active">
                            ${data.nextEp ? `
                            <div class="glass" style="border-left: 3px solid var(--hero-color); padding: 15px; margin-bottom: 20px; background: rgba(var(--hero-color-rgb, 0, 212, 255), 0.1);">
                                <div style="font-size: 11px; color: var(--hero-color); font-weight: bold; margin-bottom: 5px;">AIRING SOON</div>
                                <div style="font-size: 14px; color: #fff;">Episode ${data.nextEp.episode} airs in ${Math.floor(data.nextEp.timeUntilAiring / 86400)} days</div>
                            </div>` : ''}
                            
                            <p style="line-height: 1.7; color: #ccc; font-size: 14px; margin-bottom: 20px;">${data.desc}</p>
                            
                            <h3 style="font-size: 14px; color: #fff; margin-top: 25px; border-bottom: 1px solid #333; padding-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                                <span>RECOMMENDATIONS</span>
                                <span style="font-size: 10px; color: var(--hero-color);">(${data.recs.length})</span>
                            </h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; margin-top: 15px;">
                                ${data.recs.map(r => `
                                <div onclick="location.href='/api/anime-detail/${r.id}'" style="cursor: pointer;">
                                    <img src="${r.coverImage.medium}" style="width: 100%; border-radius: 6px; aspect-ratio: 2/3; object-fit: cover;">
                                    <div style="font-size: 10px; margin-top: 6px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r.title.english || r.title.romaji}</div>
                                </div>
                                `).join('')}
                            </div>
                        </div>

                        <div id="chars" class="tab-content">
                            <div class="char-grid">
                                ${data.chars.map(c => `
                                <div class="char-card">
                                    <img src="${c.image.medium}" class="char-img" loading="lazy">
                                    <div class="char-info">
                                        <div style="font-size: 11px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.name.full}</div>
                                        <div style="font-size: 9px; color: #666;">Main Cast</div>
                                    </div>
                                </div>
                                `).join('')}
                            </div>
                        </div>

                        <div id="relations" class="tab-content">
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px;">
                                ${data.relations.length > 0 ? data.relations.map(r => `
                                <div onclick="location.href='/api/anime-detail/${r.id}'" style="cursor: pointer;">
                                    <img src="${r.coverImage.medium}" style="width: 100%; border-radius: 6px; aspect-ratio: 2/3; object-fit: cover;">
                                    <div style="font-size: 9px; margin-top: 6px; color: var(--hero-color);">${r.type}</div>
                                    <div style="font-size: 10px; color: #fff; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r.title.english || r.title.romaji}</div>
                                </div>
                                `).join('') : '<p style="color:#666; padding: 20px; text-align: center;">No linked intelligence files found.</p>'}
                            </div>
                        </div>

                        <div id="ai" class="tab-content">
                            <div class="glass" style="padding: 20px;">
                                <p style="color: var(--hero-color); font-weight: 600; margin-bottom: 5px;">VANTAGE AI ANALYTICS</p>
                                <p style="font-size: 12px; color: #888; margin-bottom: 15px;">Ask specific questions about ${data.title}...</p>
                                
                                <input type="text" id="aiInput" placeholder="Example: What is the main theme? Who are the main characters? Is there romance?" 
                                       onkeypress="if(event.key === 'Enter') askJarvis(${data.id})">
                                
                                <button onclick="askJarvis(${data.id})" class="action-btn primary" style="width: 100%; margin-bottom: 10px;">
                                    <span style="font-size: 14px;">⚡</span> ANALYZE
                                </button>
                                
                                <div style="font-size: 10px; color: #666; text-align: center; margin-bottom: 15px;">
                                    Powered by Groq AI • Real-time Analysis
                                </div>
                                
                                <div id="aiResponse">
                                    <div style="text-align: center; color: #666; padding: 20px;">
                                        <div style="font-size: 24px; margin-bottom: 10px;">🤖</div>
                                        <div>Ask a question to get AI analysis</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                function switchTab(tabId) {
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    
                    event.currentTarget.classList.add('active');
                    document.getElementById(tabId).classList.add('active');
                }

                function addToVault(status) {
                    const url = \`/api/watchlist/save?id=${data.id}&title=${encodeURIComponent(data.title)}&poster=${encodeURIComponent(data.poster)}&type=anime&source=anilist&total=${data.eps || 12}&status=\${status}\`;
                    window.location.href = url;
                }

                async function askJarvis(id) {
                    const input = document.getElementById('aiInput');
                    const respBox = document.getElementById('aiResponse');
                    
                    if (!input.value.trim()) {
                        input.focus();
                        return;
                    }
                    
                    const question = input.value;
                    input.value = "";
                    respBox.innerHTML = \`
                        <div style="text-align: center; padding: 20px;">
                            <div class="spinner" style="width: 30px; height: 30px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--hero-color); border-radius: 50%; margin: 0 auto 15px; animation: spin 1s linear infinite;"></div>
                            <div style="color: var(--hero-color);">ANALYZING...</div>
                            <div style="font-size: 11px; color: #666; margin-top: 5px;">Query: "\${question}"</div>
                        </div>
                    \`;
                    
                    try {
                        const res = await fetch(\`/api/vantage-chat/\${id}\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: question })
                        });
                        
                        const json = await res.json();
                        respBox.innerHTML = \`
                            <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <div style="font-size: 11px; color: var(--hero-color);">QUESTION</div>
                                <div style="font-size: 13px; color: #fff; margin-top: 2px;">\${question}</div>
                            </div>
                            <div>
                                <div style="font-size: 11px; color: var(--hero-color); margin-bottom: 5px;">AI ANALYSIS</div>
                                \${json.response}
                            </div>
                            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 10px; color: #666; text-align: right;">
                                VANTAGE AI • \${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        \`;
                    } catch(error) {
                        respBox.innerHTML = \`
                            <div style="color: #ff4444; text-align: center; padding: 20px;">
                                <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
                                <div>AI UPLINK FAILED</div>
                                <div style="font-size: 11px; color: #888; margin-top: 10px;">Please try again later or check your connection</div>
                            </div>
                        \`;
                    }
                }

                // Add spinner animation
                const style = document.createElement('style');
                style.textContent = \`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                \`;
                document.head.appendChild(style);
            </script>
        </body>
        </html>
        `);
    } catch (e) {
        console.error(e);
        res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            ${HUD_STYLE}
            <style>
                body { background: #0b0c10; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; }
                h2 { color: #ff4444; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <h2>404: INTELLIGENCE LOST</h2>
            <p style="color: #666;">Anime data could not be retrieved.</p>
            <a href="/vantage" style="color: #00d4ff; margin-top: 20px;">Return to VANTAGE OS</a>
        </body>
        </html>`);
    }
});

module.exports = router;