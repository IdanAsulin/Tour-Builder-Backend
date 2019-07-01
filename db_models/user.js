const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        index: 1
    },
    username: String,
    password: String,
    sessionID: String,
    voteFor: [String],
    isVerified: { type: Boolean, default: false },
    verificationCode: String,
    isGoogleUser: Boolean
})

module.exports = mongoose.model('user', userSchema)