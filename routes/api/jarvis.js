const express = require('express');
const router = express.Router();
const { processUserQuery } = require('../../utils/intelligenceCore');
const { saveChatHistory, getChatHistory } = require('../../utils/memoryBank');
// We now import saveMissionMemory for the unified Vault/Archive logic
const { MissionLog, saveMissionMemory } = require('../../db/index'); 

router.post('/query', async (req, res) => {
    const { message, sessionId = "main-hud" } = req.body;
    
    try {
        // --- 1. MEMORY RETRIEVAL (The Tiered Approach) ---
        const { historyArray, summaryText } = await getChatHistory(sessionId);
        
        const historyContext = summaryText + (historyArray.length > 0 
            ? historyArray.map(m => `${m.role === 'user' ? 'User' : 'Jarvis'}: ${m.content}`).join('\n')
            : "First contact protocol initiated.");

        // --- 2. INTELLIGENCE EXECUTION ---
        // The Brain now returns 'saveData' if a directive was detected
        const result = await processUserQuery(message, historyContext);

        // --- 3. HOT MEMORY SYNC (Upstash Redis) ---
        const updatedHistory = [...historyArray, 
            { role: 'user', content: message },
            { role: 'assistant', content: result.response }
        ];
        
        saveChatHistory(sessionId, updatedHistory).catch(err => 
            console.error("⚠️ Redis Sync Error:", err.message)
        );

        // --- 4. UNIFIED VAULT & ARCHIVE (MongoDB) ---
        // This handles standard logging AND specific technical saves silently
        saveMissionMemory(
            sessionId, 
            message, 
            result.response, 
            result.saveData 
        ).catch(err => console.error("⚠️ Vault Save Error:", err.message));

        // --- 5. TRANSMISSION ---
        res.json(result);

    } catch (err) {
        console.error("🔥 Route Failure:", err);
        res.status(500).json({ 
            response: "Sir, a neural spike has disrupted the transmission. Memory links remain intact.",
            source: "SYSTEM_ERROR" 
        });
    }
});

module.exports = router;