const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();

const API_KEY = process.env.TMDB_KEY;

// Clean AniList Helper for Search
const searchAniList = async (term) => {
    const query = `query ($search: String) { Page(perPage: 5) { media(search: $search, type: ANIME, sort: POPULARITY_DESC) { id title { english romaji } coverImage { medium } episodes } } }`;
    try {
        const res = await axios.post('https://graphql.anilist.co', 
            { query, variables: { search: term } }, 
            { headers: { 'Content-Type': 'application/json' } }
        );
        return res.data.data.Page.media.map(a => ({
            id: a.id,
            title: a.title.english || a.title.romaji,
            poster_path: a.coverImage.medium,
            media_type: 'anime',
            source: 'anilist', // Mark as AniList
            total: a.episodes || 12
        }));
    } catch (e) { return []; }
};

router.get('/', async (req, res) => {
    try {
        // Run AniList (Anime) and TMDB (Live Action) in parallel
        const [animeResults, tmdbRes] = await Promise.all([
            searchAniList(req.query.q),
            axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${req.query.q}`).catch(()=>({data:{results:[]}}))
        ]);

        const tmdbResults = tmdbRes.data.results ? tmdbRes.data.results.filter(i => i.poster_path).slice(0, 5).map(i => ({
            id: i.id, 
            title: i.name || i.title, 
            poster_path: `https://image.tmdb.org/t/p/w200${i.poster_path}`, 
            media_type: i.media_type, 
            source: 'tmdb', 
            total: 1
        })) : [];

        res.json({ mal: animeResults, tmdb: tmdbResults }); // Keeping key 'mal' for frontend compatibility
    } catch (e) { 
        res.json({ mal: [], tmdb: [] }); 
    }
});

module.exports = router;