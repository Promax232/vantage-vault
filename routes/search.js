const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const malRes = await axios.get(`https://api.jikan.moe/v4/anime?q=${req.query.q}&limit=5`).catch(()=>({data:{data:[]}}));
        const malResults = malRes.data.data.map(a => ({ 
            id: a.mal_id, title: a.title, poster_path: a.images.jpg.image_url, 
            media_type: 'anime', source: 'mal', total: a.episodes || 12
        }));
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${req.query.q}`).catch(()=>({data:{results:[]}}));
        const tmdbResults = tmdbRes.data.results.filter(i => i.poster_path).slice(0, 5).map(i => ({
            id: i.id, title: i.name || i.title, poster_path: i.poster_path, 
            media_type: i.media_type, source: 'tmdb', total: 1
        }));
        res.json({ mal: malResults, tmdb: tmdbResults });
    } catch (e) { res.json({ mal: [], tmdb: [] }); }
});

module.exports = router;