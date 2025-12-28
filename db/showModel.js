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

// Replace your 'const Show = ...' line with this:
const Show = mongoose.models.Show || mongoose.model('Show', showSchema);

// Helper functions
const getWatchlist = async () => {
  return await Show.find({});  // THIS REQUIRES Show to be a Mongoose model
};

const saveWatchlist = async (showData) => {
  await Show.findOneAndUpdate({ id: showData.id }, showData, { upsert: true });
};

module.exports = {
  Show,
  getWatchlist,
  saveWatchlist
};
