const mongoose = require('mongoose');

const MissionLogSchema = new mongoose.Schema({
    topic: { type: String, default: 'main-hud' }, // The Session ID
    userInput: { type: String, required: true },
    aiResponse: { type: String, required: true },
    
    // --- VAULT SPECIFIC FIELDS ---
    isVaultItem: { type: Boolean, default: false }, // Flag for "Save" intent
    extractedInfo: { type: String }, // The "savePayload" from the Router
    category: { type: String, default: 'General' }, // Engineering, Anime, Strategy, etc.
    
    timestamp: { type: Date, default: Date.now }
});

module.exports = { MissionLog: mongoose.model('MissionLog', MissionLogSchema) };