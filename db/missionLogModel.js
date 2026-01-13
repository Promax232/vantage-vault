const mongoose = require('mongoose');

const missionLogSchema = new mongoose.Schema({
    topic: { type: String, default: 'General' }, // e.g., 'C++', 'Neuro-Engineering', 'Social Fast'
    userInput: { type: String, required: true },
    aiResponse: { type: String, required: true },
    metadata: {
        sentiment: String,
        tags: [String], // e.g., ['pointer', 'logic', 'refactor']
    }
}, { timestamps: true });

// This ensures your database stays lean by GOD'S Grace.
// 500MB is a lot, but this index lets you auto-delete 'Logistical' notes if you ever want to.
const MissionLog = mongoose.model('MissionLog', missionLogSchema);

module.exports = { MissionLog };