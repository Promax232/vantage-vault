const { tavily } = require("@tavily/core");
const axios = require("axios");
const { search } = require("duck-duck-scrape");

/**
 * Unified perception contract
 */
function perception(verdict, content = null, confidence = 0.0, source = "INTERNAL") {
    return { verdict, content, confidence, source };
}

/**
 * PHASE 0 — SHOULD SEARCH?
 * Lightweight heuristic. Fast. Cheap.
 */
function shouldSearch(query) {
    const triggers = [
        "current", "latest", "today", "now",
        "release date", "news", "price",
        "who is", "what is", "when did",
        "how many", "statistics"
    ];
    return triggers.some(t => query.toLowerCase().includes(t));
}

/**
 * Filter search results by relevance keywords
 */
function filterRelevant(content, query) {
    const lowerQuery = query.toLowerCase();
    const lines = content.split("\n");
    const filtered = lines.filter(l => l.toLowerCase().includes(lowerQuery));
    return filtered.length ? filtered.join("\n") : content;
}

// ─────────────────────────────
// PHASE 1 — ANSWER-FIRST INTELLIGENCE
// ─────────────────────────────
async function tavilyAnswer(query) {
    if (!process.env.TAVILY_API_KEY) throw new Error("Tavily unavailable");

    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const response = await client.search(query, {
        search_depth: "advanced",
        max_results: 5,
        include_answer: true
    });

    if (!response?.answer) throw new Error("Low Tavily signal");

    const filteredAnswer = filterRelevant(response.answer, query);

    return perception(
        "ANSWERED",
        filteredAnswer,
        0.85,
        "TAVILY"
    );
}

// ─────────────────────────────
// PHASE 2 — VERIFICATION (SILENT)
// ─────────────────────────────
async function verifyWithBrave(query) {
    if (!process.env.BRAVE_API_KEY) return 0;

    try {
        const response = await axios.get(
            "https://api.search.brave.com/res/v1/web/search",
            {
                headers: {
                    "Accept": "application/json",
                    "X-Subscription-Token": process.env.BRAVE_API_KEY
                },
                params: { q: query, count: 3 }
            }
        );
        const results = response.data?.web?.results || [];
        const relevantCount = results.filter(r => r.title.toLowerCase().includes(query.toLowerCase())).length;
        return relevantCount ? 0.1 : 0;
    } catch {
        return 0;
    }
}

async function verifyWithDDG(query) {
    try {
        const result = await search(query, { safeSearch: 1 });
        const relevantCount = (result?.results || []).filter(r => r.title.toLowerCase().includes(query.toLowerCase())).length;
        return relevantCount ? 0.05 : 0;
    } catch {
        return 0;
    }
}

// ─────────────────────────────
// PHASE 3 — SILENCE PROTOCOL
// ─────────────────────────────
function silence() {
    return perception(
        "UNCERTAIN",
        "External intelligence is inconclusive. Recommend internal reasoning.",
        0.25,
        "SILENCE_PROTOCOL"
    );
}

// ─────────────────────────────
// COGNITIVE PERCEPTION ORCHESTRATOR
// ─────────────────────────────
async function executeFailsafeSearch(query) {
    // Phase 0 — Judgment first
    if (!shouldSearch(query)) {
        return perception("INTERNAL_ONLY", null, 1.0, "CORE_REASONING");
    }

    try {
        // Phase 1 — Primary answer
        const primary = await tavilyAnswer(query);

        // Phase 2 — Parallel verification (Brave + DDG)
        const [braveBoost, ddgBoost] = await Promise.allSettled([
            verifyWithBrave(query),
            verifyWithDDG(query)
        ]).then(results => results.map(r => r.status === "fulfilled" ? r.value : 0));

        const finalConfidence = Math.min(primary.confidence + braveBoost + ddgBoost, 0.95);

        return { ...primary, confidence: finalConfidence };
    } catch (err) {
        console.warn("⚠️ [GRID] Primary intelligence degraded.");
        return silence();
    }
}

module.exports = { executeFailsafeSearch };
