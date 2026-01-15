require('dotenv').config();
const mongoose = require('mongoose');

const { Show } = require('./showModel'); 
const { MissionLog } = require('./missionLogModel'); 

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Vault Uplink Established (MongoDB)"))
    .catch(err => console.error("Vault Connection Error:", err));

// --- Legacy Media Methods ---
const getWatchlist = async () => { return await Show.find({}); };
const saveWatchlist = async (showData) => {
    await Show.findOneAndUpdate({ id: showData.id }, showData, { upsert: true });
};

// --- JARVIS MISSION CONTROL ---
/**
 * Saves both standard history and high-importance Vault directives.
 * @param {string} topic - The sessionId (e.g., 'main-hud', 'anime-list').
 * @param {string} input - User's raw message.
 * @param {string} response - Jarvis's response.
 * @param {object|null} saveData - Extracted intent from the Neural Router.
 */
const saveMissionMemory = async (topic, input, response, saveData = null) => {
    const logEntry = {
        topic: topic,
        userInput: input,
        aiResponse: response
    };

    // If the Neural Router flagged this as a directive to remember [cite: 2026-01-13]
    if (saveData) {
        logEntry.isVaultItem = true;
        logEntry.extractedInfo = saveData.content; // The cleaned-up technical data
        logEntry.category = saveData.category;      // Engineering, Strategy, etc.
    }

    return await MissionLog.create(logEntry);
};

module.exports = { 
    Show, 
    MissionLog, 
    getWatchlist, 
    saveWatchlist, 
    saveMissionMemory 
};
