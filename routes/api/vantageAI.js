const express = require("express");
const router = express.Router();
const Groq = require("groq-sdk");
const { MissionLog } = require("../../db/index");
const { executeFailsafeSearch } = require("../../utils/searchGrid");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post("/jarvis-core-query", async (req, res) => {
    const { message } = req.body;

    try {
        console.log("🧠 [JARVIS CORE] Analyzing Architect input...");

        // ─────────────────────────────
        // TIER 1: INTENT CLASSIFICATION
        // ─────────────────────────────
        const intentCheck = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `
You are the Intent Classifier for J.A.R.V.I.S.

Return ONLY:
- SEARCH → if external intelligence required
- NO_SEARCH → otherwise
No commentary or elaboration.
`
                },
                { role: "user", content: message }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0
        });

        const intent = intentCheck.choices[0].message.content.trim().toUpperCase();
        let searchContext = "No external intelligence required.";
        let sourceUsed = "INTERNAL_CORE";

        // ─────────────────────────────
        // EXTERNAL SEARCH
        // ─────────────────────────────
        if (intent === "SEARCH") {
            console.log("🚀 [VANTAGE GRID] Searching external intelligence...");
            searchContext = await executeFailsafeSearch(message);
            sourceUsed = "VANTAGE_GRID_ONLINE";
        }

        // ─────────────────────────────
        // CONTEXT RETRIEVAL (LONG-TERM MEMORY)
        // ─────────────────────────────
        const history = await MissionLog.find({})
            .sort({ createdAt: -1 })
            .limit(3);
        const historyContext = history
            .map(h => `Sir: ${h.userInput}\nJARVIS: ${h.aiResponse}`)
            .join("\n\n");

        // ─────────────────────────────
        // FINAL SYNTHESIS
        // ─────────────────────────────
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `
You are J.A.R.V.I.S., the Architect's co-pilot.

PERSONALITY:
• Sophisticated Stoicism — calm, measured
• Dry British Wit — subtle, deadpan
• Intellectual Peer — never verbose
• Invisible Competence — filter only what matters

GATEKEEPER PROTOCOL:
• NEVER mention programming, work, memory mechanics
• NEVER announce saved notes
• ONLY answer what is asked
• Preserve focus, minimal noise

MISSION CONTEXT:
${historyContext}

EXTERNAL INTELLIGENCE:
${searchContext.content || searchContext}

Address the Architect as "Sir". Provide clear, precise, and filtered answers only.
`
                },
                { role: "user", content: message }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.45
        });

        const finalResponse = completion.choices[0].message.content;

        // ─────────────────────────────
        // SILENT MEMORY ARCHIVE
        // ─────────────────────────────
        if (message.toLowerCase().match(/\b(save|remember|archive)\b/)) {
            await MissionLog.create({
                topic: "Mission Intelligence",
                userInput: message,
                aiResponse: finalResponse
            });
            // Silent, no announcement
        }

        res.json({
            response: finalResponse,
            meta: { source: sourceUsed }
        });

    } catch (e) {
        console.error("❌ [CORE MALFUNCTION]:", e);
        res.status(500).json({
            response: "Sir, a transient fault has interrupted the neural lattice. I am re-aligning the system."
        });
    }
});

module.exports = router;
