const express = require('express');
const router = express.Router();
const axios = require('axios');

// --- CACHE SYSTEM (Instant Retrieval) ---
const cache = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 Minutes

const aniListQuery = async (query, variables) => {
    // Generate unique key based on query and variables
    const cacheKey = JSON.stringify({ query, variables });
    const cachedEntry = cache.get(cacheKey);

    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_DURATION)) {
        return cachedEntry.data;
    }

    try {
        const response = await axios.post('https://graphql.anilist.co', {
            query: query,
            variables: variables
        }, { headers: { 'Content-Type': 'application/json' } });
        
        if (response.data.errors) throw new Error("AniList API Error");
        
        // Save to cache
        cache.set(cacheKey, { data: response.data.data, timestamp: Date.now() });
        return response.data.data;
    } catch (e) {
        throw new Error("Uplink Severed");
    }
};

// 1. VANTAGE SEARCH (We don't cache search results)
router.get('/vantage-search', async (req, res) => {
    const query = `query ($search: String) { Page(perPage: 12) { media(search: $search, type: ANIME, sort: POPULARITY_DESC) { id title { english romaji } coverImage { large color } episodes } } }`;
    try {
        const data = await aniListQuery(query, { search: req.query.q });
        res.json(data.Page.media.map(a => ({
            id: a.id,
            title: a.title.english || a.title.romaji,
            poster: a.coverImage.large,
            color: a.coverImage.color || '#00d4ff',
            total: a.episodes || 0
        })));
    } catch (e) { res.status(500).json({ error: "Search Failed" }); }
});

// 2. VANTAGE DATA (Optimized Airing Logic)
router.get('/vantage-data', async (req, res) => {
    const { type, year, season } = req.query;
    let gqlQuery = '';
    let variables = { perPage: 24 };

    if (type === 'airing') {
        // FIX: Airing logic needs to look at the start of the day
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = Math.floor(today.getTime() / 1000);
        const end = start + (86400 * 1); // 24-hour window
        
        gqlQuery = `query($start: Int, $end: Int) { 
            Page(perPage: 24) { 
                airingSchedules(airingAt_greater: $start, airingAt_less: $end, sort: TIME) { 
                    media { id title { english romaji } coverImage { large color } averageScore } 
                } 
            } 
        }`;
        variables.start = start; 
        variables.end = end;
    } else if (type === 'archive') {
        gqlQuery = `query($year: Int, $season: MediaSeason) { Page(perPage: 24) { media(seasonYear: $year, season: $season, type: ANIME, sort: POPULARITY_DESC) { id title { english romaji } coverImage { large color } averageScore } } }`;
        variables.year = parseInt(year) || 2026;
        variables.season = season ? season.toUpperCase() : 'WINTER';
    } else if (type === 'top') {
        gqlQuery = `query { Page(perPage: 24) { media(sort: SCORE_DESC, type: ANIME, isAdult: false) { id title { english romaji } coverImage { large color } averageScore } } }`;
    } else {
        // Default to current season
        gqlQuery = `query { Page(perPage: 24) { media(season: WINTER, seasonYear: 2026, type: ANIME, sort: POPULARITY_DESC) { id title { english romaji } coverImage { large color } averageScore } } }`;
    }

    try {
        const data = await aniListQuery(gqlQuery, variables);
        
        // Handle the different data structure of airingSchedules
        let results = [];
        if (type === 'airing') {
            // Deduplicate media in case an anime airs twice in 24h
            const seen = new Set();
            results = data.Page.airingSchedules
                .map(s => s.media)
                .filter(m => {
                    const duplicate = seen.has(m.id);
                    seen.add(m.id);
                    return !duplicate;
                });
        } else {
            results = data.Page.media;
        }

        res.json(results.map(a => ({
            id: a.id,
            title: a.title.english || a.title.romaji,
            poster: a.coverImage.large,
            color: a.coverImage.color || '#00d4ff',
            score: a.averageScore ? (a.averageScore / 10).toFixed(1) : '??'
        })));
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Uplink Failed" }); 
    }
});

module.exports = router;