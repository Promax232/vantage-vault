const express = require('express');
const router = express.Router();
const { MissionLog } = require('../../db/index');

// GET: Fetch only the "Core Directives" for the Ghost Overlay
router.get('/directives', async (req, res) => {
    const { sessionId = "main-hud" } = req.query;
    try {
        // We filter for isVaultItem: true to keep the overlay high-signal
        const directives = await MissionLog.find({ 
            topic: sessionId, 
            isVaultItem: true 
        }).sort({ timestamp: -1 }).limit(10);

        res.json(directives);
    } catch (err) {
        console.error("⚠️ Vault Retrieval Error:", err);
        res.status(500).json({ error: "Could not access the Vault, Sir." });
    }
});

module.exports = router;