const mongoose = require('mongoose')

const artistSchema = new mongoose.Schema({
  spotifyID: {
    type: String,
    index: 1
  },
  name: String,
  image: String
})

module.exports = mongoose.model('artist', artistSchema)
