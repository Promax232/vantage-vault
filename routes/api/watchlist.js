const express = require('express');
const router = express.Router();
const { Show } = require('../db');


router.get('/save', async (req, res) => {
    const { id, title, poster, type, source, total, status } = req.query;
    try {
        await Show.findOneAndUpdate(
            { id: id }, 
            { 
                id, 
                title: decodeURIComponent(title), 
                poster: decodeURIComponent(poster), 
                type, 
                source, 
                currentEpisode: 0, 
                totalEpisodes: parseInt(total) || 12, 
                status: status || 'watching',
                startDate: new Date().toISOString() 
            }, 
            { upsert: true }
        );
        // This is where the redirect lives!
        res.redirect(status === 'planned' ? '/plan-to-watch' : '/watchlist');
    } catch (e) {
        res.status(500).send("Vault Write Error");
    }
});


router.get('/update/:id', async (req, res) => {
    const show = await Show.findOne({ id: req.params.id });
    if (show) {
        if (req.query.action === 'plus') {
            show.currentEpisode++;
            if (show.currentEpisode >= show.totalEpisodes) {
                show.status = 'completed';
            }
        }
        if (req.query.rating) show.personalRating = parseInt(req.query.rating);
        await show.save();
        res.json({ success: true });
    } else { res.json({ success: false }); }
});

router.get('/update-status/:id', async (req, res) => {
    await Show.findOneAndUpdate({ id: req.params.id }, { status: req.query.status });
    res.json({ success: true });
});

router.post('/journal/:id', async (req, res) => {
    const show = await Show.findOne({ id: req.params.id });
    if (show) {
        if (!show.logs) show.logs = new Map();
        show.logs.set(req.body.ep.toString(), { text: req.body.text, date: new Date().toLocaleDateString() });
        if (parseInt(req.body.ep) >= show.totalEpisodes) show.status = 'completed';
        await show.save();
    }
    res.json({ success: true });
});

router.get('/delete-show/:id', async (req, res) => {
    await Show.deleteOne({ id: req.params.id });
    res.redirect('/watchlist');
});

module.exports = router;