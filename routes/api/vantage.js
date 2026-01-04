const express = require('express');
const router = express.Router();
const axios = require('axios');

// --- THE SATELLITE UPLINK (GraphQL) ---
const aniListQuery = async (query, variables) => {
    try {
        const response = await axios.post('https://graphql.anilist.co', {
            query: query,
            variables: variables
        }, { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } });
        
        if (response.data.errors) throw new Error("AniList API Error");
        return response.data.data;
    } catch (e) {
        throw new Error("Uplink Severed");
    }
};

// 1. VANTAGE SEARCH
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

// 2. VANTAGE DATA (Airing, Archive, Top)
router.get('/vantage-data', async (req, res) => {
    const { type, year, season } = req.query;
    let gqlQuery = '';
    let variables = { perPage: 24 };

    if (type === 'airing') {
        const start = Math.floor(Date.now() / 1000);
        const end = start + 86400;
        gqlQuery = `query($start: Int, $end: Int) { Page(perPage: 24) { airingSchedules(airingAt_greater: $start, airingAt_less: $end, sort: TIME) { media { id title { english romaji } coverImage { large color } averageScore } } } }`;
        variables.start = start; variables.end = end;
    } else if (type === 'archive') {
        gqlQuery = `query($year: Int, $season: MediaSeason) { Page(perPage: 24) { media(seasonYear: $year, season: $season, type: ANIME, sort: POPULARITY_DESC) { id title { english romaji } coverImage { large color } averageScore } } }`;
        variables.year = parseInt(year);
        variables.season = season ? season.toUpperCase() : 'WINTER';
    } else if (type === 'top') {
        gqlQuery = `query { Page(perPage: 24) { media(sort: SCORE_DESC, type: ANIME, isAdult: false) { id title { english romaji } coverImage { large color } averageScore } } }`;
    } else {
        gqlQuery = `query { Page(perPage: 24) { media(season: WINTER, seasonYear: 2026, type: ANIME, sort: POPULARITY_DESC) { id title { english romaji } coverImage { large color } averageScore } } }`;
    }

    try {
        const data = await aniListQuery(gqlQuery, variables);
        let results = type === 'airing' ? data.Page.airingSchedules.map(s => s.media) : data.Page.media;
        res.json(results.map(a => ({
            id: a.id,
            title: a.title.english || a.title.romaji,
            poster: a.coverImage.large,
            color: a.coverImage.color || '#00d4ff',
            score: a.averageScore ? (a.averageScore / 10).toFixed(1) : '??'
        })));
    } catch (e) { res.status(500).json({ error: "Uplink Failed" }); }
});

module.exports = router;