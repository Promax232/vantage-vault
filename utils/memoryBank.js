// utils/memoryBank.js
const { Redis } = require("@upstash/redis");
const Groq = require("groq-sdk");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * THE SUMMARIZER: Compresses old history into a "Mission Briefing"
 */
async function updateMissionSummary(sessionId, historyArray) {
    try {
        // We only summarize if history is getting long
        if (historyArray.length < 31) return;

        const summaryPrompt = `Summarize the key decisions, code snippets, and goals discussed in this mission so far into a concise bulleted list. Focus on technical specs and user preferences.`;
        
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are the Archive Specialist. compress history without losing technical intent." },
                { role: "user", content: `${summaryPrompt}\n\nHistory:\n${JSON.stringify(historyArray)}` }
            ],
            model: "llama-3-8b-8192", // We use a smaller/faster model for internal chores
        });

        const newSummary = completion.choices[0].message.content;
        await redis.set(`summary:${sessionId}`, newSummary);
    } catch (err) {
        console.error("⚠️ Summarization Failed:", err.message);
    }
}

async function saveChatHistory(sessionId, messages) {
    // 1. Keep the last 30 for high-fidelity "Muscle Memory"
    const highFidelityHistory = messages.slice(-30); 
    await redis.set(`session:${sessionId}`, JSON.stringify(highFidelityHistory));
    
    // 2. If we just pushed a message past the 30-limit, update the Briefing
    if (messages.length > 30) {
        // We don't 'await' this so the user doesn't feel the lag
        updateMissionSummary(sessionId, messages).catch(console.error);
    }

    await redis.expire(`session:${sessionId}`, 172800); 
}

async function getChatHistory(sessionId) {
    // Pull both the Briefing and the Muscle Memory
    const [history, summary] = await Promise.all([
        redis.get(`session:${sessionId}`),
        redis.get(`summary:${sessionId}`)
    ]);

    const historyArray = history ? history : [];
    const summaryText = summary ? `MISSION BRIEFING (PREVIOUS CONTEXT):\n${summary}\n\n` : "";

    return { historyArray, summaryText };
}

module.exports = { saveChatHistory, getChatHistory };