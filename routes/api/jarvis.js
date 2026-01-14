const express = require('express');
const router = express.Router();
const { processUserQuery } = require('../../utils/intelligenceCore');
const { MissionLog } = require('../../db/index'); 

router.post('/query', async (req, res) => {
    const { message } = req.body;
    
    try {
        // 1. Context Retrieval (Last 3 missions for JIT learning)
        // Sir, we limit this to 3 to prevent "Context Bloat" in the Groq buffer.
        const recentLogs = await MissionLog.find()
            .sort({ createdAt: -1 })
            .limit(3)
            .lean(); // Faster execution
            
        const history = recentLogs.length > 0 
            ? recentLogs.reverse().map(l => `User: ${l.userInput}\nJarvis: ${l.aiResponse}`).join('\n---\n')
            : "First contact protocol initiated.";

        // 2. Intelligence Execution
        // This triggers the Tavily/Groq logic we built in the Core.
        const result = await processUserQuery(message, history);

        // 3. Vault Logging (Async - No 'await' to keep the HUD snappy)
        MissionLog.create({ 
            userInput: message, 
            aiResponse: result.response, 
            topic: "Neuro-Engineering / General" 
        }).catch(err => console.error("⚠️ Vault Save Error:", err.message));

        // 4. Transmission
        res.json(result);

    } catch (err) {
        console.error("🔥 Route Failure:", err);
        res.status(500).json({ 
            response: "Sir, a neural spike has disrupted the transmission. Check the server logs.",
            source: "SYSTEM_ERROR" 
        });
    }
});

module.exports = router;