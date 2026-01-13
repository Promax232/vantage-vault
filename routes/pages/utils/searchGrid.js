// utils/searchGrid.js
const { tavily } = require("@tavily/core");
const axios = require('axios');
const { search } = require('duck-duck-scrape');

// TIER 2: TAVILY (The Sniper)
async function searchTavily(query) {
    if (!process.env.TAVILY_API_KEY) throw new Error("No Tavily Key");
    console.log("⚡ [GRID] Engaging Tier 2: Tavily...");
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const response = await client.search(query, {
        search_depth: "basic",
        max_results: 5,
        include_answer: true
    });
    return `TAVILY INSIGHT: ${response.answer}\nSOURCES: ${JSON.stringify(response.results)}`;
}

// TIER 3: BRAVE (The Scout)
async function searchBrave(query) {
    if (!process.env.BRAVE_API_KEY) throw new Error("No Brave Key");
    console.log("🛡️ [GRID] Engaging Tier 3: Brave...");
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': process.env.BRAVE_API_KEY
        },
        params: { q: query, count: 5 }
    });
    
    const results = response.data.web.results.map(r => `Title: ${r.title}\nDesc: ${r.description}`).join('\n---\n');
    return `BRAVE SEARCH DATA:\n${results}`;
}

// TIER 4: DUCKDUCKGO (The Scavenger - Free Fallback)
async function searchDDG(query) {
    console.log("🦆 [GRID] Engaging Tier 4: DuckDuckGo (Failsafe)...");
    const searchResults = await search(query, { safeSearch: 1 }); // safeSearch: 1 (Moderate)
    
    if (!searchResults.results || searchResults.results.length === 0) {
        return "No intel found even on deep scan.";
    }

    const data = searchResults.results.slice(0, 5).map(r => `Title: ${r.title}\nDesc: ${r.description}`).join('\n---\n');
    return `DDG SCRAPE DATA:\n${data}`;
}

// THE COORDINATOR (Executes the Cascade)
async function executeFailsafeSearch(query) {
    try {
        return await searchTavily(query);
    } catch (errTavily) {
        console.warn("⚠️ Tier 2 Failed (Tavily):", errTavily.message);
        
        try {
            return await searchBrave(query);
        } catch (errBrave) {
            console.warn("⚠️ Tier 3 Failed (Brave):", errBrave.message);
            
            try {
                return await searchDDG(query);
            } catch (errDDG) {
                console.error("❌ CRITICAL: All Search Tiers Failed.");
                return "CRITICAL FAILURE: Unable to retrieve external intelligence.";
            }
        }
    }
}

module.exports = { executeFailsafeSearch };