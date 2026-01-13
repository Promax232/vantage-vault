const express = require('express');
const router = express.Router();
const Groq = require("groq-sdk");
const { MissionLog } = require('../../db/index');
// IMPORT THE GRID: This connects the brain to the search tools
const { executeFailsafeSearch } = require('../../utils/searchGrid'); 

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- MAIN INTELLIGENCE ROUTE ---
// This replaces the old simple chat. It determines INTENT first.
router.post('/jarvis-core-query', async (req, res) => {
    const { message } = req.body;
    
    try {
        console.log(`🧠 [CORE] Processing: "${message.substring(0, 30)}..."`);

        // --- TIER 1: INTENT CLASSIFICATION ---
        // Does Sir need live data (Search) or just logic (Internal)?
        const intentCheck = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a classifier. Analyze the user input. Does it require REAL-TIME data, specific documentation, news, or external facts? Reply ONLY with 'SEARCH' or 'NO_SEARCH'." },
                { role: "user", content: message }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0 
        });

        const intent = intentCheck.choices[0].message.content.trim().toUpperCase();
        let searchContext = "NO_EXTERNAL_DATA_NEEDED";
        let sourceUsed = "INTERNAL_MEMORY";

        // --- TIER 2-4: THE GRID ACTIVATION ---
        if (intent.includes("SEARCH")) {
            console.log("🚀 [CORE] Search Protocol Initiated.");
            // This function triggers Tavily -> Brave -> DDG automatically
            searchContext = await executeFailsafeSearch(message); 
            sourceUsed = "VANTAGE_GRID_ONLINE";
        }

        // --- CONTEXT LOADING ---
        // Load recent conversation history from MongoDB to keep flow
        const history = await MissionLog.find({}).sort({ createdAt: -1 }).limit(3);
        const historyContext = history.map(h => `User: ${h.userInput} | Jarvis: ${h.aiResponse}`).join("\n");

        // --- FINAL SYNTHESIS ---
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: `You are JARVIS. A high-agency engineering assistant.
                
                YOUR RESOURCES:
                1. MISSION CONTEXT (Past Chat): 
                ${historyContext}
                
                2. LIVE INTELLIGENCE (The Grid): 
                ${searchContext}
                
                INSTRUCTIONS:
                - If 'LIVE INTELLIGENCE' contains data, prioritize it. Cite it naturally.
                - If the search failed or wasn't needed, use your internal C++/Engineering knowledge.
                - Tone: Brotherly, Precise, "Stark-like". Call him Sir.
                - Focus: "The Work" (Neuro-engineering, C++, Systems).` },
                { role: "user", content: message }
            ],
            model: "llama-3.3-70b-versatile",
        });

        const finalResponse = completion.choices[0].message.content;

        // --- SELECTIVE SAVING (Memory) ---
        if (message.toLowerCase().includes("save this") || message.toLowerCase().includes("remember this")) {
            await MissionLog.create({
                topic: "Engineering", // Default tag, can be refined later
                userInput: message,
                aiResponse: finalResponse
            });
            console.log("💾 [MEMORY] Insight saved to Vault.");
        }

        // Return response + debug info (so you know if it used the Grid)
        res.json({ response: finalResponse, meta: { source: sourceUsed } });

    } catch (e) {
        console.error("❌ [CORE ERROR]:", e);
        res.status(500).json({ response: "Sir, the Neural Link is unresponsive. Check server logs." });
    }
});

// --- UTILITY ROUTES (Memory Management) ---

// DELETE: Pruning the Brain
router.delete('/memory/:memoryId', async (req, res) => {
    try {
        await MissionLog.findByIdAndDelete(req.params.memoryId);
        res.json({ success: true, message: "Memory purged successfully, Sir." });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete memory." });
    }
});

// UPDATE: Refining Knowledge
router.put('/memory/:memoryId', async (req, res) => {
    try {
        const updatedMemory = await MissionLog.findByIdAndUpdate(
            req.params.memoryId, 
            { userInput: req.body.newContent }, 
            { new: true }
        );
        res.json({ success: true, memory: updatedMemory });
    } catch (e) {
        res.status(500).json({ error: "Failed to update memory." });
    }
});

module.exports = router;