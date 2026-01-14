const { tavily } = require("@tavily/core");
const axios = require('axios');
const { search } = require('duck-duck-scrape');

function normalize(label, content) {
    return {
        source: label,
        content,
        confidence: label === "TAVILY" ? 0.9 : label === "BRAVE" ? 0.7 : 0.5
    };
}

// ─────────────────────────────
// TIER 1 — AUTHORITATIVE SYNTHESIS
// ─────────────────────────────
async function searchTavily(query) {
    if (!process.env.TAVILY_API_KEY) throw new Error("Tavily Key Missing");

    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const response = await client.search(query, {
        search_depth: "advanced",
        max_results: 5,
        include_answer: true
    });

    if (!response.answer) throw new Error("Low signal");

    return normalize(
        "TAVILY",
        response.answer
    );
}

// ─────────────────────────────
// TIER 2 — REINFORCEMENT SCAN
// ─────────────────────────────
async function searchBrave(query) {
    if (!process.env.BRAVE_API_KEY) throw new Error("Brave Key Missing");

    const response = await axios.get(
        'https://api.search.brave.com/res/v1/web/search',
        {
            headers: {
                'Accept': 'application/json',
                'X-Subscription-Token': process.env.BRAVE_API_KEY
            },
            params: { q: query, count: 5 }
        }
    );

    const results = response.data.web?.results;
    if (!results?.length) throw new Error("No Brave signal");

    const summary = results
        .slice(0, 3)
        .map(r => `• ${r.title}: ${r.description}`)
        .join('\n');

    return normalize("BRAVE", summary);
}

// ─────────────────────────────
// TIER 3 — RAW CORROBORATION
// ─────────────────────────────
async function searchDDG(query) {
    const searchResults = await search(query, { safeSearch: 1 });

    if (!searchResults.results?.length) {
        throw new Error("DDG empty");
    }

    const data = searchResults.results
        .slice(0, 3)
        .map(r => `• ${r.title}: ${r.description}`)
        .join('\n');

    return normalize("DUCKDUCKGO", data);
}

// ─────────────────────────────
// TIER 4 — SILENCE PROTOCOL
// ─────────────────────────────
function controlledSilence() {
    return {
        source: "SILENCE_PROTOCOL",
        content: "External intelligence is inconclusive. Recommend proceeding with internal reasoning.",
        confidence: 0.2
    };
}

// ─────────────────────────────
// FAILSAFE ORCHESTRATOR
// ─────────────────────────────
async function executeFailsafeSearch(query) {
    try {
        return await searchTavily(query);
    } catch {
        console.warn("⚠️ [GRID] Tier 1 offline. Falling back...");
        try {
            return await searchBrave(query);
        } catch {
            console.warn("⚠️ [GRID] Tier 2 degraded. Scavenging...");
            try {
                return await searchDDG(query);
            } catch {
                console.warn("⚠️ [GRID] All tiers degraded. Engaging silence.");
                return controlledSilence();
            }
        }
    }
}

module.exports = { executeFailsafeSearch };
