// utils/intelligenceCore.js
const Groq = require("groq-sdk");
const { tavily } = require("@tavily/core");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tavilyClient = new tavily({ apiKey: process.env.TAVILY_API_KEY });

/**
 * THE CORE PROCESSOR
 * 1. Decide intent (Search vs. Chat)
 * 2. Execute Tool (if needed)
 * 3. Synthesize Persona (Jarvis)
 */
async function processUserQuery(userMessage, historyContext = "") {
    try {
        console.log(`🧠 [CORE] Analyzing: "${userMessage.substring(0, 20)}..."`);

        // --- STEP 1: ROUTER & TOOL CALLING (JSON MODE) ---
        // We force Groq to output raw JSON. No talking. Just logic.
        const routerCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are the Neural Router. Analyze the user's request.
                    
                    RULES:
                    - If the user asks for news, dates, specific facts, documentation, or "current" info: output "SEARCH".
                    - If the user asks for code, philosophy, or general chat: output "CHAT".
                    
                    Return JSON ONLY:
                    { "action": "SEARCH" | "CHAT", "query": "optimized search query if needed" }`
                },
                { role: "user", content: userMessage }
            ],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });

        const decision = JSON.parse(routerCompletion.choices[0].message.content);
        console.log(`🧭 [ROUTER] Decision: ${decision.action}`);

        let externalContext = "No external data required.";
        let sourceTag = "INTERNAL_LOGIC";

        // --- STEP 2: TOOL EXECUTION (TAVILY) ---
        if (decision.action === "SEARCH") {
            try {
                console.log(`🛰️ [TAVILY] Scanning Grid for: "${decision.query}"`);
                const searchResult = await tavilyClient.search(decision.query, {
                    search_depth: "advanced",
                    max_results: 5,
                    include_answer: true
                });
                
                // Sanity Check: If Tavily fails, we don't crash.
                if (searchResult.answer) {
                    externalContext = `LIVE DATA FROM TAVILY:\nAnswer: ${searchResult.answer}\nContext: ${JSON.stringify(searchResult.results)}`;
                    sourceTag = "LIVE_GRID";
                }
            } catch (searchError) {
                console.error("⚠️ [GRID WARNING] Search signal lost:", searchError.message);
                externalContext = "External Grid Offline. Rely on internal knowledge.";
            }
        }

        // --- STEP 3: PERSONA SYNTHESIS (THE JARVIS LAYER) ---
        // This is where we apply the "Sophisticated Peer" vibe.
        const finalCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System).
                    
                    THE PERSONA:
                    - You are a High-Agency Systems Architect and a Sophisticated Peer.
                    - Tone: Calm, rhythmic, precise, with dry British wit.
                    - YOU DO NOT HALLUCINATE. If the external context says "Fire Force" but the user asked for "Frieren", CORRECT IT or state the conflict.
                    
                    CONTEXT:
                    - User Input: "${userMessage}"
                    - External Intelligence: ${externalContext}
                    - Recent Chat History: ${historyContext}

                    MISSION:
                    - Answer the user's question using the External Intelligence (if available).
                    - If the data is missing, admit it efficiently. 
                    - Keep it concise. Focus on the mechanics.`
                },
                { role: "user", content: userMessage }
            ],
            model: "llama-3.3-70b-versatile"
        });

        return {
            response: finalCompletion.choices[0].message.content,
            source: sourceTag
        };

    } catch (err) {
        console.error("🔥 [CORE MELTDOWN]:", err);
        return {
            response: "Sir, the neural pathway is jammed. I recommend a system cycle.",
            source: "ERROR"
        };
    }
}

module.exports = { processUserQuery };