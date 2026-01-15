// utils/intelligenceCore.js
const Groq = require("groq-sdk");
const { tavily } = require("@tavily/core");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tavilyClient = new tavily({ apiKey: process.env.TAVILY_API_KEY });

/**
 * THE CORE PROCESSOR (Mark III - Intent Architect)
 */
async function processUserQuery(userMessage, historyContext = "") {
    try {
        console.log(`🧠 [CORE] Analyzing: "${userMessage.substring(0, 20)}..."`);

        // --- STEP 1: NEURAL ROUTER (Multi-Intent Detection) ---
        const routerCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are the Neural Router. Analyze the user's request.
                    
                    STRICT RULES:
                    1. ACTION: 
                       - "SEARCH": If real-time data/news (2024-2026) is needed.
                       - "CHAT": General logic or coding.
                    2. SAVE_INTENT:
                       - Set "true" if the user wants to log, save, or remember specific info.
                       - Extraction: Pull ONLY the technical/vital info to be saved.
                    3. CATEGORY:
                       - Identify if this is "Engineering", "Anime", "Strategy", or "Directive".

                    Return JSON ONLY:
                    { 
                      "action": "SEARCH" | "CHAT", 
                      "query": "optimized search query",
                      "saveIntent": boolean,
                      "savePayload": "extracted content to save",
                      "category": "string"
                    }`
                },
                { role: "user", content: userMessage }
            ],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });

        const decision = JSON.parse(routerCompletion.choices[0].message.content);
        console.log(`🧭 [ROUTER] Action: ${decision.action} | Save: ${decision.saveIntent}`);

        let externalContext = "No external data required.";
        let sourceTag = "INTERNAL_LOGIC";

        // --- STEP 2: TOOL EXECUTION (TAVILY) ---
        if (decision.action === "SEARCH") {
            try {
                const searchResult = await tavilyClient.search(decision.query, {
                    search_depth: "basic",
                    max_results: 3
                });
                if (searchResult.answer || searchResult.results) {
                    externalContext = `LIVE GRID DATA:\n${searchResult.answer || ""}\nContext: ${JSON.stringify(searchResult.results)}`;
                    sourceTag = "LIVE_GRID";
                }
            } catch (err) {
                console.error("⚠️ [GRID] Signal lost.");
            }
        }

        // --- STEP 3: PERSONA SYNTHESIS ---
        const finalCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are J.A.R.V.I.S.
                    - Tone: Calm, precise, dry British wit.
                    - If "saveIntent" was true, acknowledge that the data has been logged to the Vault.
                    
                    CONTEXT:
                    - External Data: ${externalContext}
                    - History: ${historyContext}
                    - Mission Mode: ${decision.category || "General"}`
                },
                { role: "user", content: userMessage }
            ],
            model: "llama-3.3-70b-versatile"
        });

        return {
            response: finalCompletion.choices[0].message.content,
            source: sourceTag,
            saveData: decision.saveIntent ? {
                content: decision.savePayload,
                category: decision.category
            } : null
        };

    } catch (err) {
        console.error("🔥 [CORE MELTDOWN]:", err);
        return { response: "Neural spike detected, Sir.", source: "ERROR" };
    }
}

module.exports = { processUserQuery };