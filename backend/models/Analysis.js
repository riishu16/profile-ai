const mongoose = require("mongoose");
module.exports = mongoose.model("Analysis", new mongoose.Schema({
  candidateName: String,
  score: Number,
  matchingSkills: [String],
  missingSkills: [String],
  experienceMet: Boolean,
  verdict: String,
  jobTitle: String,
  createdAt: { type: Date, default: Date.now },
}));