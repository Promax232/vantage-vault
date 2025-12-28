require('dotenv').config();
const mongoose = require('mongoose');
const Show = require('./showModel');

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Vault Uplink Established (MongoDB)"))
    .catch(err => console.error("Vault Connection Error:", err));

const getWatchlist = async () => {
    return await Show.find({});
};
const saveWatchlist = async (showData) => {
    await Show.findOneAndUpdate({ id: showData.id }, showData, { upsert: true });
};
module.exports = { Show, getWatchlist, saveWatchlist };