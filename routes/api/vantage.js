const express = require('express');
const router = express.Router();
const axios = require('axios');

const cache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 Minutes

const aniListQuery = async (query, variables) => {
    const cacheKey = JSON.stringify({ query, variables });
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_DURATION)) return cachedEntry.data;

    try {
        const response = await axios.post('https://graphql.anilist.co', { query, variables }, { headers: { 'Content-Type': 'application/json' } });
        if (response.data.errors) throw new Error("AniList Error");
        cache.set(cacheKey, { data: response.data.data, timestamp: Date.now() });
        return response.data.data;
    } catch (e) { throw new Error("Uplink Severed"); }
};

router.get('/vantage-data', async (req, res) => {
    const { type } = req.query;
    let gqlQuery = `query ($sort: [MediaSort], $season: MediaSeason, $year: Int) {
        Page(perPage: 32) {
            media(type: ANIME, sort: $sort, season: $season, seasonYear: $year, isAdult: false) {
                id title { english romaji } coverImage { extraLarge color } 
                averageScore bannerImage trailer { id site } episodes
            }
        }
    }`;

    let variables = { sort: ["POPULARITY_DESC"], season: "WINTER", year: 2026 };
    if (type === 'top') variables.sort = ["SCORE_DESC"];
    if (type === 'trending') variables.sort = ["TRENDING_DESC"];

    try {
        const data = await aniListQuery(gqlQuery, variables);
        res.json(data.Page.media.map(a => ({
            id: a.id,
            title: a.title.english || a.title.romaji,
            poster: a.coverImage.extraLarge,
            banner: a.bannerImage,
            color: a.coverImage.color || '#00d4ff',
            score: a.averageScore ? (a.averageScore / 10).toFixed(1) : '??',
            trailer: a.trailer?.site === 'youtube' ? a.trailer.id : null,
            total: a.episodes
        })));
    } catch (e) { res.status(500).json({ error: "Uplink Failed" }); }
});

module.exports = router;