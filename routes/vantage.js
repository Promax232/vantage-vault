const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const axios = require('axios');
const { HUD_STYLE, NAV_COMPONENT } = require('../ui/layout');
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// --- IMAGE HANDLING FIXES FOR MOBILE ---
const getImageUrl = (url) => {
    if (!url) return '/placeholder.jpg';
    // Fix for mobile: Use HTTPS and ensure proper URL
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('http:')) return url.replace('http:', 'https:');
    return url;
};

// --- IMPROVED SATELLITE UPLINK ---
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
        return null;
    }
};

// 1. VANTAGE SEARCH (Fixed for mobile)
router.get('/api/vantage-search', async (req, res) => {
    const query = `
    query ($search: String) {
        Page(perPage: 12) {
            media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
                id 
                title { english romaji } 
                coverImage { 
                    large 
                    medium
                    color 
                } 
                episodes
            }
        }
    }`;
    try {
        const data = await aniListQuery(query, { search: req.query.q });
        if (!data || !data.Page || !data.Page.media) {
            return res.json([]);
        }
        
        const mapped = data.Page.media.map(a => ({
            id: a.id,
            title: a.title.english || a.title.romaji || 'Unknown',
            poster: getImageUrl(a.coverImage.medium || a.coverImage.large),
            color: a.coverImage.color || '#00d4ff',
            total: a.episodes || 0
        }));
        res.json(mapped);
    } catch (e) { 
        console.error("Search error:", e);
        res.status(500).json({ error: "Search Failed" }); 
    }
});

// 2. VANTAGE DATA (Fixed + Added Airing Today)
router.get('/vantage-data', async (req, res) => {
    const { type, year, season, page } = req.query;
    const cacheKey = `v_ani_${type}_${year || 'now'}_${season || 'now'}_${page || 1}`;
    const cached = myCache.get(cacheKey);
    if (cached) return res.json(cached);

    let gqlQuery = '';
    let variables = { perPage: 20 };

    // --- AIRING TODAY QUERY ---
    if (type === 'airing_today') {
        const today = Math.floor(Date.now() / 1000);
        const tomorrow = today + 86400; // 24 hours
        
        gqlQuery = `
        query ($today: Int, $tomorrow: Int) {
            Page(perPage: 20) {
                airingSchedules(airingAt_greater: $today, airingAt_less: $tomorrow, sort: TIME) {
                    media {
                        id
                        title { english romaji }
                        coverImage { large medium color }
                        episodes
                        nextAiringEpisode { episode airingAt }
                        averageScore
                    }
                }
            }
        }`;
        variables.today = today;
        variables.tomorrow = tomorrow;
    } 
    else if (type === 'top') {
        gqlQuery = `
        query { 
            Page(perPage: 20) { 
                media(sort: SCORE_DESC, type: ANIME, isAdult: false) { 
                    id 
                    title { english romaji } 
                    coverImage { large medium color } 
                    averageScore 
                } 
            } 
        }`;
    } 
    else if (type === 'archive') {
        // FIXED ARCHIVE QUERY
        if (!year || !season) {
            return res.status(400).json({ error: "Year and season required for archive" });
        }
        
        gqlQuery = `
        query ($year: Int, $season: Season) { 
            Page(perPage: 20) { 
                media(seasonYear: $year, season: $season, type: ANIME, sort: POPULARITY_DESC) { 
                    id 
                    title { english romaji } 
                    coverImage { large medium color } 
                    averageScore 
                } 
            } 
        }`;
        variables.year = parseInt(year);
        variables.season = season.toUpperCase();
    } 
    else {
        // Current season (updated to 2024)
        gqlQuery = `
        query { 
            Page(perPage: 20) { 
                media(season: WINTER, seasonYear: 2024, type: ANIME, sort: POPULARITY_DESC) { 
                    id 
                    title { english romaji } 
                    coverImage { large medium color } 
                    averageScore 
                } 
            } 
        }`;
    }

    try {
        const data = await aniListQuery(gqlQuery, variables);
        let mapped = [];
        
        if (type === 'airing_today') {
            if (data && data.Page && data.Page.airingSchedules) {
                mapped = data.Page.airingSchedules.map(s => {
                    const media = s.media;
                    return {
                        id: media.id,
                        title: media.title.english || media.title.romaji || 'Unknown',
                        poster: getImageUrl(media.coverImage.medium || media.coverImage.large),
                        color: media.coverImage.color || '#00d4ff',
                        score: media.averageScore ? (media.averageScore / 10).toFixed(1) : 'AIRING',
                        nextEpisode: media.nextAiringEpisode?.episode,
                        airingAt: media.nextAiringEpisode?.airingAt
                    };
                });
            }
        } 
        else if (data && data.Page && data.Page.media) {
            mapped = data.Page.media.map(a => ({
                id: a.id,
                title: a.title.english || a.title.romaji || 'Unknown',
                poster: getImageUrl(a.coverImage.medium || a.coverImage.large),
                color: a.coverImage.color || '#00d4ff',
                score: a.averageScore ? (a.averageScore / 10).toFixed(1) : 'N/A'
            }));
        }
        
        myCache.set(cacheKey, mapped);
        res.json(mapped);
    } catch (e) {
        console.error("Data Uplink Error:", e);
        res.status(500).json({ error: "Data Uplink Failed", details: e.message });
    }
});

// 3. VANTAGE AI CHAT ENDPOINT (FIXED)
router.post('/vantage-chat/:id', async (req, res) => {
    try {
        const animeId = req.params.id;
        const userMessage = req.body.message;
        
        if (!userMessage) {
            return res.status(400).json({ error: "No message provided" });
        }

        // Get anime info first
        const animeQuery = `
        query ($id: Int) {
            Media(id: $id, type: ANIME) {
                title { english romaji }
                description
                status
                episodes
                duration
                averageScore
                genres
                characters(perPage: 5) {
                    nodes { name { full } }
                }
            }
        }`;

        const animeResponse = await axios.post('https://graphql.anilist.co', {
            query: animeQuery,
            variables: { id: parseInt(animeId) }
        });

        const anime = animeResponse.data.data.Media;
        const title = anime.title.english || anime.title.romaji;
        
        // Create context for AI
        const context = `
        You are Vantage AI, an expert anime analysis assistant. Analyze the following anime based on user query.
        
        Anime: ${title}
        Status: ${anime.status}
        Episodes: ${anime.episodes || 'Unknown'}
        Score: ${anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A'}
        Genres: ${anime.genres?.join(', ') || 'Unknown'}
        Description: ${anime.description?.replace(/<[^>]*>/g, '').substring(0, 300) || 'No description'}
        
        User Question: ${userMessage}
        
        Provide a detailed, insightful response. If discussing plot, mark spoilers with [SPOILER]. Keep response under 200 words.
        `;

        // Call Groq API
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are Vantage AI, an expert anime assistant providing detailed analysis and insights."
                },
                {
                    role: "user",
                    content: context
                }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.7,
            max_tokens: 400
        });

        res.json({ 
            response: chatCompletion.choices[0]?.message?.content || "No response generated"
        });

    } catch (error) {
        console.error("Vantage AI Error:", error);
        res.status(500).json({ 
            error: "AI analysis failed",
            details: error.message 
        });
    }
});

// 3. ANIME DETAIL (Fixed for mobile images)
router.get('/anime-detail/:id', async (req, res) => {
    const aniId = req.params.id;
    
    // THE MASTER QUERY
    const query = `
    query ($id: Int) {
        Media (id: $id, type: ANIME) {
            id
            title { english romaji native }
            description
            bannerImage
            coverImage { extraLarge large medium color }
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
        if (!raw || !raw.Media) {
            return res.status(404).send("<h2>404: ANIME NOT FOUND</h2>");
        }
        
        const media = raw.Media;
        
        // Data Extraction with FIXED IMAGE URLs
        const data = {
            id: media.id,
            title: media.title.english || media.title.romaji || 'Unknown',
            native: media.title.native || '',
            desc: media.description ? media.description.replace(/<[^>]*>/g, '') : "No Intel Available.",
            banner: getImageUrl(media.bannerImage || media.coverImage.extraLarge),
            poster: getImageUrl(media.coverImage.medium || media.coverImage.large || media.coverImage.extraLarge),
            color: media.coverImage.color || '#00d4ff',
            score: media.averageScore ? (media.averageScore / 10).toFixed(1) : "N/A",
            popularity: media.popularity,
            rank: media.rankings?.find(r => r.type === 'RATED' && r.allTime) ? 
                  `#${media.rankings.find(r => r.type === 'RATED' && r.allTime).rank} All Time` : 'Unranked',
            status: media.status,
            format: media.format,
            year: media.seasonYear,
            season: media.season,
            eps: media.episodes,
            duration: media.duration,
            nextEp: media.nextAiringEpisode,
            studio: media.studios?.nodes[0]?.name || "Unknown",
            chars: media.characters?.nodes || [],
            relations: media.relations?.nodes?.filter(n => n.type === 'ANIME') || [],
            recs: media.recommendations?.nodes?.map(n => n.mediaRecommendation).filter(Boolean) || [],
            trailer: media.trailer?.site === 'youtube' ? `https://www.youtube.com/watch?v=${media.trailer.id}` : null,
            links: media.externalLinks || []
        };

        // RENDER GOD TIER UI WITH MOBILE FIXES
        res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>${data.title} | VANTAGE OS</title>
            ${HUD_STYLE}
            <style>
                :root { --hero-color: ${data.color}; }
                
                body { 
                    background: #0b0c10; 
                    overflow-x: hidden;
                    -webkit-text-size-adjust: 100%;
                    -moz-text-size-adjust: 100%;
                    -ms-text-size-adjust: 100%;
                }

                /* CINEMATIC HERO - FIXED FOR MOBILE */
                .hero-banner { 
                    position: relative; 
                    height: 400px; 
                    width: 100%;
                    background: linear-gradient(rgba(11,12,16,0.7), rgba(11,12,16,0.9)), 
                                url('${data.banner}') center/cover no-repeat;
                    background-attachment: fixed;
                }
                
                .hero-overlay {
                    position: absolute; 
                    width: 100%; 
                    height: 100%;
                    background: linear-gradient(to top, #0b0c10 10%, rgba(11,12,16,0.6) 50%, rgba(11,12,16,0.3) 100%);
                }
                
                /* LAYOUT GRID */
                .layout-grid {
                    display: grid;
                    grid-template-columns: 240px 1fr;
                    gap: 40px;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 20px;
                    position: relative;
                    z-index: 10;
                    margin-top: -150px;
                }

                /* LEFT COLUMN */
                .poster-card {
                    width: 100%;
                    aspect-ratio: 2/3;
                    border-radius: 6px;
                    box-shadow: 0 0 30px rgba(0,0,0,0.5), 0 0 10px var(--hero-color);
                    background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.7)), 
                                url('${data.poster}') center/cover;
                    margin-bottom: 20px;
                }
                
                .action-menu { display: flex; flex-direction: column; gap: 10px; }
                .action-btn {
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border: none;
                    padding: 12px;
                    border-radius: 4px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    gap: 8px;
                    transition: 0.2s;
                    text-decoration: none;
                }
                .action-btn.primary { 
                    background: var(--hero-color); 
                    color: #000; 
                    box-shadow: 0 0 15px var(--hero-color); 
                }
                .action-btn:hover { 
                    transform: scale(1.02); 
                    filter: brightness(1.2); 
                }

                /* IMAGE FIXES FOR MOBILE */
                img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                }
                
                .char-img, .poster-card, .hero-banner {
                    -webkit-user-drag: none;
                    user-select: none;
                }

                /* TABS SYSTEM */
                .tabs { 
                    display: flex; 
                    gap: 30px; 
                    border-bottom: 1px solid rgba(255,255,255,0.1); 
                    margin-bottom: 20px;
                    overflow-x: auto;
                    white-space: nowrap;
                    -webkit-overflow-scrolling: touch;
                }
                
                .tab { 
                    padding: 15px 0; 
                    font-size: 14px; 
                    color: #888; 
                    cursor: pointer; 
                    position: relative;
                    transition: 0.2s;
                    flex-shrink: 0;
                }
                
                .tab.active { color: white; font-weight: 600; }
                .tab.active::after {
                    content: ''; 
                    position: absolute; 
                    bottom: -1px; 
                    left: 0; 
                    width: 100%; 
                    height: 3px; 
                    background: var(--hero-color);
                    box-shadow: 0 -5px 10px var(--hero-color);
                }

                /* MOBILE RESPONSIVE */
                @media(max-width: 900px) {
                    .layout-grid { 
                        grid-template-columns: 1fr; 
                        margin-top: -50px; 
                        gap: 20px;
                    }
                    .poster-card { 
                        width: 160px; 
                        margin: 0 auto 20px; 
                    }
                    .content-header { 
                        margin-top: 0; 
                        text-align: center; 
                    }
                    .tabs { 
                        justify-content: flex-start;
                        padding: 0 10px;
                    }
                    .hero-banner {
                        height: 250px;
                        background-attachment: scroll;
                    }
                    .stats-bar {
                        flex-wrap: wrap;
                    }
                    .stat-box {
                        flex: 1 0 45%;
                        margin-bottom: 10px;
                    }
                }
                
                @media(max-width: 480px) {
                    .layout-grid {
                        padding: 0 15px;
                    }
                    .tab {
                        font-size: 12px;
                        padding: 12px 0;
                    }
                    .action-btn {
                        padding: 10px;
                        font-size: 12px;
                    }
                    .anime-title {
                        font-size: 22px;
                    }
                }
                
                @keyframes fadeIn { 
                    from { opacity:0; transform:translateY(10px); } 
                    to { opacity:1; transform:translateY(0); } 
                }
                
                /* AI RESPONSE STYLING */
                #aiResponse {
                    background: rgba(0, 0, 0, 0.2);
                    padding: 15px;
                    border-radius: 8px;
                    border-left: 3px solid var(--hero-color);
                    margin-top: 15px;
                    max-height: 300px;
                    overflow-y: auto;
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
                                <span>+</span> ADD TO PLANNING
                            </button>
                            <button class="action-btn" onclick="addToVault('watching')">
                                <span>▶</span> SET AS WATCHING
                            </button>
                            ${data.trailer ? `
                            <a href="${data.trailer}" target="_blank" class="action-btn">
                                <span>⏵</span> WATCH TRAILER
                            </a>` : ''}
                        </div>

                        <div class="data-list">
                            <div class="data-row"><span>Format</span><span class="data-val">${data.format}</span></div>
                            <div class="data-row"><span>Episodes</span><span class="data-val">${data.eps || '?'}</span></div>
                            <div class="data-row"><span>Duration</span><span class="data-val">${data.duration || '?'} mins</span></div>
                            <div class="data-row"><span>Status</span><span class="data-val">${data.status}</span></div>
                            <div class="data-row"><span>Season</span><span class="data-val">${data.season} ${data.year}</span></div>
                            <div class="data-row"><span>Studio</span><span class="data-val">${data.studio}</span></div>
                            <div class="data-row"><span>Source</span><span class="data-val">AniList</span></div>
                        </div>
                    </div>

                    <div class="right-col">
                        <div class="content-header">
                            <h1 class="anime-title">${data.title}</h1>
                            <p style="color: #666; font-size: 14px; margin-top: 5px;">${data.native}</p>
                        </div>

                        <div class="stats-bar">
                            <div class="stat-box">
                                <div class="stat-label">SCORE</div>
                                <div class="stat-value">${data.score}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">RANK</div>
                                <div class="stat-value" style="font-size: 14px;">${data.rank}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">POPULARITY</div>
                                <div class="stat-value">${data.popularity.toLocaleString()}</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-label">VAULT</div>
                                <div class="stat-value" style="color: var(--hero-color);">TRACKING</div>
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
                            <div class="glass" style="border-left: 3px solid var(--hero-color); padding: 15px; margin-bottom: 20px;">
                                <div style="font-size: 11px; color: var(--hero-color); font-weight: bold;">AIRING SOON</div>
                                <div style="font-size: 14px;">Episode ${data.nextEp.episode} airs in ${Math.floor(data.nextEp.timeUntilAiring / 86400)} days</div>
                            </div>` : ''}
                            
                            <p style="line-height: 1.8; color: #ccc; font-size: 15px;">${data.desc}</p>
                            
                            ${data.recs.length > 0 ? `
                            <h3 style="font-size: 14px; color: #fff; margin-top: 30px; border-bottom: 1px solid #333; padding-bottom: 10px;">RECOMMENDATIONS</h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 15px; margin-top: 15px;">
                                ${data.recs.map(r => `
                                <div onclick="location.href='/api/anime-detail/${r.id}'" style="cursor: pointer;">
                                    <img src="${getImageUrl(r.coverImage.medium)}" 
                                         style="width: 100%; border-radius: 4px; aspect-ratio: 2/3;"
                                         onerror="this.src='https://via.placeholder.com/130x195/0b0c10/ffffff?text=No+Image'">
                                    <div style="font-size: 11px; margin-top: 5px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                        ${r.title.english || r.title.romaji || 'Unknown'}
                                    </div>
                                </div>
                                `).join('')}
                            </div>` : ''}
                        </div>

                        <div id="chars" class="tab-content">
                            ${data.chars.length > 0 ? `
                            <div class="char-grid">
                                ${data.chars.map(c => `
                                <div class="char-card">
                                    <img src="${getImageUrl(c.image.medium)}" 
                                         class="char-img"
                                         onerror="this.src='https://via.placeholder.com/60x80/0b0c10/ffffff?text=Char'">
                                    <div class="char-info">
                                        <div style="font-size: 12px; font-weight: 600; color: #fff;">${c.name.full}</div>
                                        <div style="font-size: 10px; color: #666;">Main Cast</div>
                                    </div>
                                </div>
                                `).join('')}
                            </div>` : '<p style="color:#666;">No character data available.</p>'}
                        </div>

                        <div id="relations" class="tab-content">
                            ${data.relations.length > 0 ? `
                            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                                ${data.relations.map(r => `
                                <div onclick="location.href='/api/anime-detail/${r.id}'" style="cursor: pointer; width: 140px;">
                                    <img src="${getImageUrl(r.coverImage.medium)}" 
                                         style="width: 100%; border-radius: 4px; aspect-ratio: 2/3;"
                                         onerror="this.src='https://via.placeholder.com/140x210/0b0c10/ffffff?text=No+Image'">
                                    <div style="font-size: 10px; margin-top: 5px; color: var(--hero-color);">${r.type}</div>
                                    <div style="font-size: 11px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                        ${r.title.english || r.title.romaji || 'Unknown'}
                                    </div>
                                </div>
                                `).join('')}
                            </div>` : '<p style="color:#666;">No related anime found.</p>'}
                        </div>

                        <div id="ai" class="tab-content">
                            <div class="glass" style="padding: 20px; text-align: center;">
                                <p style="color: var(--hero-color); font-weight: bold;">VANTAGE AI UPLINK ACTIVE</p>
                                <p style="font-size: 12px; color: #888; margin-bottom: 15px;">Ask anything about ${data.title}</p>
                                <input type="text" 
                                       id="aiInput" 
                                       placeholder="Example: What makes this anime unique?..." 
                                       style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 12px; color: white; margin-top: 10px; border-radius: 4px;"
                                       onkeypress="if(event.key === 'Enter') askJarvis(${data.id})">
                                <button onclick="askJarvis(${data.id})" 
                                        class="action-btn primary" 
                                        style="width: 100%; margin-top: 10px; font-size: 14px;">
                                    🔍 ANALYZE
                                </button>
                                <div id="aiResponse" style="display: none;"></div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <script>
                // Tab switching
                function switchTab(tabId) {
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    
                    event.target.classList.add('active');
                    document.getElementById(tabId).classList.add('active');
                }

                // Add to vault function
                function addToVault(status) {
                    const url = \`/api/watchlist/save?id=${data.id}&title=${encodeURIComponent(data.title)}&poster=${encodeURIComponent(data.poster)}&type=anime&source=anilist&total=${data.eps || 12}&status=\${status}\`;
                    window.location.href = url;
                }

                // Fixed Vantage AI function
                async function askJarvis(id) {
                    const input = document.getElementById('aiInput');
                    const respBox = document.getElementById('aiResponse');
                    const button = event.target;
                    
                    if (!input.value.trim()) {
                        alert('Please enter a question');
                        return;
                    }
                    
                    // Show loading state
                    const originalText = button.textContent;
                    button.textContent = 'PROCESSING...';
                    button.disabled = true;
                    respBox.style.display = 'block';
                    respBox.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--hero-color);">ANALYZING WITH VANTAGE AI...</div>';
                    
                    try {
                        const res = await fetch(\`/api/vantage-chat/\${id}\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: input.value })
                        });
                        
                        const json = await res.json();
                        
                        if (json.error) {
                            respBox.innerHTML = \`<div style="color: #ff4757; padding: 10px; background: rgba(255,71,87,0.1); border-radius: 4px;">Error: \${json.error}</div>\`;
                        } else {
                            respBox.innerHTML = \`<div style="color: #00d4ff; font-size: 12px; margin-bottom: 10px;">VANTAGE AI RESPONSE:</div>\${json.response}\`;
                        }
                    } catch (error) {
                        respBox.innerHTML = \`<div style="color: #ff4757;">Connection failed: \${error.message}</div>\`;
                    } finally {
                        button.textContent = originalText;
                        button.disabled = false;
                    }
                }

                // Fix mobile touch events
                document.addEventListener('touchstart', function() {}, {passive: true});
                
                // Image error fallback
                document.addEventListener('DOMContentLoaded', function() {
                    const images = document.querySelectorAll('img');
                    images.forEach(img => {
                        img.onerror = function() {
                            if (!this.src.includes('placeholder')) {
                                this.src = 'https://via.placeholder.com/300x450/0b0c10/ffffff?text=Image+Not+Found';
                            }
                        };
                    });
                });
            </script>
        </body>
        </html>
        `);
    } catch (e) {
        console.error("Detail page error:", e);
        res.status(404).send(`
            <div style="background: #0b0c10; color: white; padding: 50px; text-align: center;">
                <h2 style="color: #ff4757;">404: INTELLIGENCE LOST</h2>
                <p>Failed to load anime details. Please try again.</p>
                <a href="/vantage" style="color: #00d4ff;">Return to Vantage OS</a>
            </div>
        `);
    }
});

module.exports = router;