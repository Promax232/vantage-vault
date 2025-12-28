require('dotenv').config();
const mongoose = require('mongoose');

// THE FIX: You MUST use curly braces {} here because showModel exports an object
const { Show } = require('./showModel'); 

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Vault Uplink Established (MongoDB)"))
    .catch(err => console.error("Vault Connection Error:", err));

const getWatchlist = async () => {
    return await Show.find({}); // Now this will work!
};

const saveWatchlist = async (showData) => {
    await Show.findOneAndUpdate({ id: showData.id }, showData, { upsert: true });
};

module.exports = { Show, getWatchlist, saveWatchlist };


