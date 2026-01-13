require('dotenv').config();
const mongoose = require('mongoose');

const { Show } = require('./showModel'); 
const { MissionLog } = require('./missionLogModel'); // ADD THIS

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Vault Uplink Established (MongoDB)"))
    .catch(err => console.error("Vault Connection Error:", err));

// --- Legacy Media Methods ---
const getWatchlist = async () => { return await Show.find({}); };
const saveWatchlist = async (showData) => {
    await Show.findOneAndUpdate({ id: showData.id }, showData, { upsert: true });
};

// --- NEW JARVIS METHODS ---
const saveMissionMemory = async (topic, input, response) => {
    return await MissionLog.create({
        topic: topic,
        userInput: input,
        aiResponse: response
    });
};

module.exports = { Show, MissionLog, getWatchlist, saveWatchlist, saveMissionMemory };

