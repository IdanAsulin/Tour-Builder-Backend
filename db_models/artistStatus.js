const mongoose = require('mongoose')

const songSchema = new mongoose.Schema({
    spotifyID: {
        type: String,
        index: 1
    },
    name: String,
    singers: String,
    album: String,
    preview: String,
    votes: Number
})

const countrySchema = new mongoose.Schema({
    countryCode: {
        type: String,
        index: 1
    },
    votes: Number,
    songs: [songSchema]
})

const artistStatusSchema = new mongoose.Schema({
    spotifyID: {
        type: String,
        index: 1
    },
    countries: [countrySchema]
})

module.exports = mongoose.model('artists_status', artistStatusSchema)
