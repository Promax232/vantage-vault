const express = require('express');
const router = express.Router();
const { Show } = require('../../db');

// --- VAULT ENTRY: SAVE OR UPDATE ---
router.get('/save', async (req, res) => {
    const { id, title, poster, type, source, total, status } = req.query;
    try {
        // We use findOneAndUpdate with upsert to avoid duplicate 'Intelligence' files
        await Show.findOneAndUpdate(
            { id: id }, 
            { 
                id, 
                title: decodeURIComponent(title), 
                poster: decodeURIComponent(poster), 
                type: type || 'anime', 
                source: source || 'anilist', 
                // We only reset episode to 0 if the show doesn't already exist
                $setOnInsert: { currentEpisode: 0 }, 
                totalEpisodes: parseInt(total) || 12, 
                status: status || 'watching',
                startDate: new Date().toISOString() 
            }, 
            { upsert: true, new: true }
        );
        
        // Redirect sir to the appropriate wing of the Vault
        res.redirect(status === 'planned' ? '/plan-to-watch' : '/watchlist');
    } catch (e) {
        console.error("Vault Write Error:", e);
        res.status(500).send("Vault Write Error: System Integrity Compromised");
    }
});

// --- EPISODE & RATING INCREMENT ---
router.get('/update/:id', async (req, res) => {
    try {
        const show = await Show.findOne({ id: req.params.id });
        if (show) {
            if (req.query.action === 'plus') {
                show.currentEpisode++;
                // Savorer Protocol: Automatically move to completed when last episode is reached
                if (show.currentEpisode >= show.totalEpisodes) {
                    show.status = 'completed';
                }
            }
            if (req.query.rating) show.personalRating = parseInt(req.query.rating);
            await show.save();
            res.json({ success: true, current: show.currentEpisode });
        } else { res.json({ success: false, error: "Show not in local archive" }); }
    } catch (e) { res.status(500).json({ success: false }); }
});

router.get('/update-status/:id', async (req, res) => {
    await Show.findOneAndUpdate({ id: req.params.id }, { status: req.query.status });
    res.json({ success: true });
});

// --- THE JOURNALING PROTOCOL ---
router.post('/journal/:id', async (req, res) => {
    try {
        const show = await Show.findOne({ id: req.params.id });
        if (show) {
            if (!show.logs) show.logs = new Map();
            
            // Record the observation
            show.logs.set(req.body.ep.toString(), { 
                text: req.body.text, 
                date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) 
            });

            // Update progress based on the log entry
            const logEp = parseInt(req.body.ep);
            if (logEp > show.currentEpisode) show.currentEpisode = logEp;
            
            // Final check: If it's the last episode, mark as complete
            if (logEp >= show.totalEpisodes) show.status = 'completed';
            
            await show.save();
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: "Intel target not found" });
        }
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

router.get('/delete-show/:id', async (req, res) => {
    await Show.deleteOne({ id: req.params.id });
    res.redirect('/watchlist');
});

module.exports = router;