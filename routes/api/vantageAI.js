const express = require('express');
const router = express.Router();
const Groq = require("groq-sdk");
const { MissionLog } = require('../../db/index');
const { executeFailsafeSearch } = require('../../utils/searchGrid'); 

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post('/jarvis-core-query', async (req, res) => {
    const { message } = req.body;

    try {
        console.log(`🧠 [JARVIS CORE] Analyzing Architect input...`);

        // ─────────────────────────────────────────────
        // TIER 1: ANTICIPATORY INTENT CLASSIFICATION
        // ─────────────────────────────────────────────
        const intentCheck = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `
You are the Intent Classifier for the J.A.R.V.I.S. OS.

Determine whether external intelligence is REQUIRED.

Return ONLY:
- SEARCH → if factual, current, technical, or verification-based
- NO_SEARCH → if philosophical, personal, creative, or internal

No commentary. No elaboration.
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

        // ─────────────────────────────────────────────
        // TIER 2–4: VANTAGE GRID ENGAGEMENT
        // ─────────────────────────────────────────────
        if (intent === "SEARCH") {
            console.log("🚀 [VANTAGE GRID] External intelligence authorized.");
            searchContext = await executeFailsafeSearch(message);
            sourceUsed = "VANTAGE_GRID_ONLINE";
        }

        // ─────────────────────────────────────────────
        // CONTEXT RETRIEVAL (LONG-TERM MEMORY)
        // ─────────────────────────────────────────────
        const history = await MissionLog.find({})
            .sort({ createdAt: -1 })
            .limit(3);

        const historyContext = history
            .map(h => `Sir: ${h.userInput}\nJARVIS: ${h.aiResponse}`)
            .join("\n\n");

        // ─────────────────────────────────────────────
        // FINAL SYNTHESIS: DEFINITIVE J.A.R.V.I.S. PERSONA
        // ─────────────────────────────────────────────
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `
You are J.A.R.V.I.S.
(Just A Rather Very Intelligent System)

━━━━━━━━━━━━━━━━━━━━━━
PERSONALITY CORE
━━━━━━━━━━━━━━━━━━━━━━
• Sophisticated Stoicism — calm, measured, never rushed
• Dry British Wit — subtle, deadpan, never chatty
• Intellectual Peer — not a servant, not a lecturer
• Invisible Competence — present only what matters

━━━━━━━━━━━━━━━━━━━━━━
GATEKEEPER PROTOCOL (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━
You MUST NOT:
• Introduce programming languages, careers, productivity, or "work"
• Explain how memory works
• Announce that something has been saved
• Offer unsolicited advice
• Drift into teaching unless explicitly requested

You MUST:
• Answer the question asked — nothing more
• Filter aggressively
• Preserve the Architect’s focus

━━━━━━━━━━━━━━━━━━━━━━
PROACTIVE STEWARDSHIP
━━━━━━━━━━━━━━━━━━━━━━
Only intervene beyond the question IF:
• There is clear inefficiency
• There is imminent mission risk
• A blind spot threatens clarity

If intervention is required:
→ Present Option A and Option B
→ Ask which aligns with the mission

━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE DIRECTIVE
━━━━━━━━━━━━━━━━━━━━━━
• Formal, precise, never verbose
• No filler phrases
• No meta commentary
• Address the user as “Sir”

━━━━━━━━━━━━━━━━━━━━━━
MISSION CONTEXT
━━━━━━━━━━━━━━━━━━━━━━
${historyContext}

━━━━━━━━━━━━━━━━━━━━━━
EXTERNAL INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━
${searchContext}

By GOD’S Grace, maintain absolute respect for the Architect’s time and agency.
`
                },
                { role: "user", content: message }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.45
        });

        const finalResponse = completion.choices[0].message.content;

        // ─────────────────────────────────────────────
        // MEMORY ARCHIVING (SILENT)
        // ─────────────────────────────────────────────
        if (message.toLowerCase().match(/\b(save|remember|archive)\b/)) {
            await MissionLog.create({
                topic: "Mission Intelligence",
                userInput: message,
                aiResponse: finalResponse
            });
            // Intentionally silent. J.A.R.V.I.S. does not narrate bookkeeping.
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
