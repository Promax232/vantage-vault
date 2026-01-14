const { tavily } = require("@tavily/core");
const axios = require('axios');
const { search } = require('duck-duck-scrape');

async function searchTavily(query) {
    if (!process.env.TAVILY_API_KEY) throw new Error("Tavily Key Missing");
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const response = await client.search(query, {
        search_depth: "advanced", // Set to advanced for better anime/tech data
        max_results: 5,
        include_answer: true
    });
    return `PRIMARY SCAN (Tavily): ${response.answer}\nDETAILED DATA: ${JSON.stringify(response.results)}`;
}

async function searchBrave(query) {
    if (!process.env.BRAVE_API_KEY) throw new Error("Brave Key Missing");
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        headers: { 'Accept': 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY },
        params: { q: query, count: 5 }
    });
    const results = response.data.web.results.map(r => `[${r.title}]: ${r.description}`).join('\n');
    return `SECONDARY SCAN (Brave):\n${results}`;
}

async function searchDDG(query) {
    const searchResults = await search(query, { safeSearch: 1 });
    if (!searchResults.results?.length) return "TERTIARY SCAN: No intelligence retrieved from fallback scrapers.";
    const data = searchResults.results.slice(0, 5).map(r => `[${r.title}]: ${r.description}`).join('\n');
    return `TERTIARY SCAN (DuckDuckGo):\n${data}`;
}

async function executeFailsafeSearch(query) {
    try {
        return await searchTavily(query);
    } catch (err) {
        console.warn("⚠️ [GRID] Primary Tier Offline. Failing over...");
        try {
            return await searchBrave(query);
        } catch (errB) {
            console.warn("⚠️ [GRID] Secondary Tier Offline. Deploying Scavengers...");
            return await searchDDG(query);
        }
    }
}

module.exports = { executeFailsafeSearch };