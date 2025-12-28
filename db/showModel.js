const mongoose = require('mongoose');

const showSchema = new mongoose.Schema({
    id: String,
    title: String,
    poster: String,
    type: String,
    source: String,
    currentEpisode: Number,
    totalEpisodes: Number,
    personalRating: Number,
    status: { type: String, default: 'watching' },
    logs: { type: Map, of: Object, default: {} },
    startDate: String
});

const Show = mongoose.model('Show', showSchema);

const getWatchlist = async () => await Show.find({});
const saveWatchlist = async (showData) => await Show.findOneAndUpdate({ id: showData.id }, showData, { upsert: true });

module.exports = { Show, getWatchlist, saveWatchlist };
