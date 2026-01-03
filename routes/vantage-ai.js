const express = require('express');
const router = express.Router();
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const axios = require('axios');
const NodeCache = require('node-cache');

// Cache for anime data (5 minutes) and AI responses (10 minutes)
const animeCache = new NodeCache({ stdTTL: 300, checkperiod: 120 });
const aiCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// VANTAGE AI CHAT ENDPOINT - ENHANCED
router.post('/vantage-chat/:id', async (req, res) => {
    try {
        const animeId = req.params.id;
        const userMessage = req.body.message?.trim();
        
        // Validate input
        if (!userMessage || userMessage.length === 0) {
            return res.status(400).json({ 
                error: "Query required",
                response: "Please provide a question about this anime."
            });
        }

        if (userMessage.length > 500) {
            return res.status(400).json({ 
                error: "Query too long",
                response: "Please keep your question under 500 characters."
            });
        }

        // Create cache key
        const cacheKey = `ai_${animeId}_${Buffer.from(userMessage).toString('base64').substring(0, 50)}`;
        const cachedResponse = aiCache.get(cacheKey);
        
        if (cachedResponse) {
            console.log(`Cache hit for AI query: ${cacheKey}`);
            return res.json(cachedResponse);
        }

        // Get anime info from AniList (with cache)
        const animeCacheKey = `anime_${animeId}`;
        let anime = animeCache.get(animeCacheKey);
        
        if (!anime) {
            const animeQuery = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    id
                    title { 
                        english 
                        romaji 
                        native 
                    }
                    description(asHtml: false)
                    status
                    episodes
                    duration
                    averageScore
                    genres
                    season
                    seasonYear
                    studios(isMain: true) { 
                        nodes { name } 
                    }
                    characters(perPage: 8, sort: ROLE) {
                        nodes { 
                            name { 
                                full 
                                native 
                            } 
                        }
                    }
                    trailer { id site }
                }
            }`;

            const animeResponse = await axios.post('https://graphql.anilist.co', {
                query: animeQuery,
                variables: { id: parseInt(animeId) }
            }, {
                timeout: 10000
            });

            if (!animeResponse.data.data || !animeResponse.data.data.Media) {
                return res.status(404).json({ 
                    error: "Anime not found",
                    response: "Unable to retrieve information for this anime."
                });
            }

            anime = animeResponse.data.data.Media;
            animeCache.set(animeCacheKey, anime);
        }

        const title = anime.title.english || anime.title.romaji || 'Unknown Anime';
        const studio = anime.studios?.nodes[0]?.name || 'Unknown Studio';
        const status = anime.status?.toLowerCase() || 'unknown';
        const description = anime.description 
            ? anime.description.replace(/<[^>]*>/g, '').substring(0, 400)
            : 'No description available.';
        
        const mainCharacters = anime.characters?.nodes 
            ? anime.characters.nodes.slice(0, 5).map(c => c.name.full).join(', ')
            : 'Unknown characters';

        // Create optimized context for AI
        const currentYear = new Date().getFullYear();
        const seasonInfo = anime.season && anime.seasonYear 
            ? `${anime.season.toLowerCase()} ${anime.seasonYear}`
            : 'unknown season';

        const context = `
        YOU ARE: Vantage AI, an expert anime assistant for Vantage OS. You provide insightful, concise analysis.
        
        ANIME DETAILS:
        - Title: ${title} (${anime.title.native || 'N/A'})
        - Status: ${status}
        - Episodes: ${anime.episodes || 'Unknown'}
        - Score: ${anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A'} / 10
        - Genres: ${anime.genres?.join(', ') || 'Not specified'}
        - Season: ${seasonInfo}
        - Studio: ${studio}
        - Characters: ${mainCharacters}
        - Description: ${description}
        
        CURRENT DATE: ${currentYear}
        
        USER QUESTION: "${userMessage}"
        
        INSTRUCTIONS:
        1. Provide detailed but concise analysis (150-250 words max)
        2. If discussing plot, clearly mark [SPOILER] sections
        3. Consider the anime's current status (airing/completed/etc.)
        4. If historical, compare to modern anime trends
        5. Focus on answering the user's specific question
        6. Format with clear paragraphs, use **bold** for emphasis
        7. If rating/score is mentioned, provide context
        8. Suggest similar anime if relevant
        9. Keep tone professional but engaging
        10. End with a short summary
        
        RESPONSE FORMAT:
        [Brief introduction addressing the question]
        [Detailed analysis]
        [Key points]
        [Conclusion/summary]
        `;

        console.log(`Calling Groq API for anime: ${title}`);
        
        // Call Groq API with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are Vantage AI, an expert anime analysis system. You provide insightful, detailed analysis of anime with attention to production quality, cultural impact, and narrative themes. You mark spoilers clearly and maintain a professional yet engaging tone."
                    },
                    {
                        role: "user",
                        content: context
                    }
                ],
                model: "mixtral-8x7b-32768",
                temperature: 0.7,
                max_tokens: 800,
                top_p: 0.9,
                stream: false
            }, {
                signal: controller.signal
            });

            clearTimeout(timeout);

            const aiResponse = chatCompletion.choices[0]?.message?.content || 
                "I couldn't generate a response. Please try rephrasing your question.";

            const responseObj = {
                response: aiResponse,
                metadata: {
                    animeId: animeId,
                    title: title,
                    timestamp: new Date().toISOString()
                }
            };

            // Cache the response
            aiCache.set(cacheKey, responseObj);
            
            res.json(responseObj);

        } catch (groqError) {
            clearTimeout(timeout);
            
            if (groqError.name === 'AbortError') {
                console.error('Groq API timeout');
                return res.status(504).json({
                    error: "AI timeout",
                    response: "The AI analysis is taking too long. Please try a simpler question or try again later."
                });
            }

            console.error('Groq API error:', groqError.message);
            
            // Fallback response
            const fallbackResponse = `
            **Vantage AI Analysis: ${title}**

            I'm having trouble connecting to the AI analysis system, but here's what I can tell you about **${title}**:

            **Basic Info:**
            • Status: ${status.charAt(0).toUpperCase() + status.slice(1)}
            • Episodes: ${anime.episodes || 'Unknown'}
            • Score: ${anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A'}/10
            • Genres: ${anime.genres?.join(', ') || 'Not specified'}
            • Studio: ${studio}

            Regarding your question about "${userMessage}", I suggest checking:
            1. The anime's community discussions on AniList or MyAnimeList
            2. Episode reviews for detailed analysis
            3. Production notes if available

            For real-time AI analysis, please try again in a moment.
            `;

            res.json({
                response: fallbackResponse,
                metadata: {
                    animeId: animeId,
                    title: title,
                    fallback: true,
                    timestamp: new Date().toISOString()
                }
            });
        }

    } catch (error) {
        console.error("Vantage AI System Error:", error.message);
        
        let errorMessage = "AI analysis failed. ";
        let statusCode = 500;

        if (error.response?.status === 404) {
            errorMessage = "Anime not found in database. ";
            statusCode = 404;
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorMessage = "Unable to connect to anime database. ";
            statusCode = 503;
        }

        res.status(statusCode).json({ 
            error: "System error",
            response: `${errorMessage}Please try again later or contact support if the issue persists.`
        });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'vantage-ai',
        cache_stats: {
            anime_cache: animeCache.getStats(),
            ai_cache: aiCache.getStats()
        },
        timestamp: new Date().toISOString()
    });
});

// Clear cache endpoint (admin only)
router.post('/clear-cache', (req, res) => {
    if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: "Unauthorized" });
    }
    
    animeCache.flushAll();
    aiCache.flushAll();
    
    res.json({ 
        success: true, 
        message: "Cache cleared",
        timestamp: new Date().toISOString()
    });
});

module.exports = router;