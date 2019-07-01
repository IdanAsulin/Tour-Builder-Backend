const artist = require('./db_models/artist')
const artistsStatus = require('./db_models/artistStatus')
const user = require('./db_models/user')
const isEmail = require('isemail')
const crypto = require('crypto')
const _ = require('lodash')
const uuid = require('uuid/v1')
const config = require('./config')
const sgMail = require('@sendgrid/mail')
const request = require('request')

class TourBuilderClient {
    async getAllArtists(req, res) {
        let responseObj = {}
        if (req.headers.managertoken !== config.MANAGER_ACCESS_TOKEN) {
            responseObj.statusCode = 401
            responseObj.message = 'Unauthorized'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        try {
            let data = await artist.find({})
            responseObj.statusCode = 200
            responseObj.message = 'Ok'
            responseObj.data = data
            res.json(responseObj)
        } catch (ex) {
            responseObj.statusCode = 500
            responseObj.message = 'Internal server error'
            responseObj.data = []
            res.json(responseObj)
        }
    }

    async vote(req, res) {
        let responseObj = {}
        if (req.headers.managertoken !== config.MANAGER_ACCESS_TOKEN) {
            responseObj.statusCode = 401
            responseObj.message = 'Unauthorized'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!req.body.country || !req.body.songs || !req.params.artist || !req.body.sessionID) {
            responseObj.statusCode = 500
            responseObj.message = 'Missing mandatory parameters'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!_.isString(req.body.country) || !_.isString(req.params.artist) || !_.isArray(req.body.songs) | !_.isString(req.body.sessionID)) {
            responseObj.statusCode = 500
            responseObj.message = 'Bad parameters type'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        try {
            let currentUser = await user.findOne({ sessionID: req.body.sessionID })
            if (!currentUser) {
                responseObj.statusCode = 500
                responseObj.message = 'SessionID does not exist'
                responseObj.data = []
                res.json(responseObj)
                return
            }
            if (currentUser.voteFor.includes(req.params.artist)) {
                responseObj.statusCode = 400
                responseObj.message = 'You are trying to vote twice'
                responseObj.data = []
                res.json(responseObj)
                return
            }
            let data = await artistsStatus.findOne({ spotifyID: req.params.artist })
            if (!data) { // In case this is the first voter for that artist
                let songsArray = []
                for (let song of req.body.songs)
                    songsArray.push({
                        spotifyID: song.songSpotifyID,
                        votes: 1,
                        name: song.songName,
                        singers: song.songSingers,
                        album: song.songAlbum,
                        preview: song.songPreviewURL
                    })
                let newArtist = new artistsStatus({
                    spotifyID: req.params.artist,
                    countries: [{ countryCode: req.body.country, votes: 1, songs: songsArray }]
                })
                await newArtist.save()
                currentUser.voteFor.push(req.params.artist)
                await user.updateOne({ sessionID: req.body.sessionID }, {
                    $set: {
                        voteFor: currentUser.voteFor
                    }
                })
                responseObj.statusCode = 200
                responseObj.message = 'Ok'
                responseObj.data = []
                res.json(responseObj)
                return
            }
            let isCountryFound = false
            for (let country of data.countries) {
                if (country.countryCode === req.body.country) {
                    isCountryFound = true
                    country.votes++
                    for (let song of req.body.songs) {
                        let isSongFound = false
                        for (let i = 0; i < country.songs.length; i++) {
                            if (song.songSpotifyID === country.songs[i].spotifyID) {
                                country.songs[i].votes++
                                isSongFound = true
                                break
                            }
                        }
                        !isSongFound ? country.songs.push({
                            spotifyID: song.songSpotifyID,
                            votes: 1,
                            name: song.songName,
                            singers: song.songSingers,
                            album: song.songAlbum,
                            preview: song.songPreviewURL
                        }) : null
                    }
                    break
                }
            }
            if (!isCountryFound) {
                let songsArray = []
                for (let song of req.body.songs)
                    songsArray.push({
                        spotifyID: song.songSpotifyID,
                        votes: 1,
                        name: song.songName,
                        singers: song.songSingers,
                        album: song.songAlbum,
                        preview: song.songPreviewURL
                    })
                data.countries.push({ countryCode: req.body.country, votes: 1, songs: songsArray })
            }
            await artistsStatus.updateOne({ spotifyID: req.params.artist }, {
                $set: {
                    countries: data.countries
                }
            })
            currentUser.voteFor.push(req.params.artist)
            await user.updateOne({ sessionID: req.body.sessionID }, {
                $set: {
                    voteFor: currentUser.voteFor
                }
            })
            responseObj.statusCode = 200
            responseObj.message = 'Ok'
            responseObj.data = []
            res.json(responseObj)
            return
        } catch (ex) {
            console.log(ex)
            responseObj.statusCode = 500
            responseObj.message = 'Internal server error'
            responseObj.data = []
            res.json(responseObj)
            return
        }
    }

    async getTopCountries(req, res) {
        let responseObj = {}
        if (req.headers.managertoken !== config.MANAGER_ACCESS_TOKEN) {
            responseObj.statusCode = 401
            responseObj.message = 'Unauthorized'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!req.params.artist) {
            responseObj.statusCode = 500
            responseObj.message = 'Missing mandatory parameters'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!_.isString(req.params.artist)) {
            responseObj.statusCode = 500
            responseObj.message = 'Bad parameters type'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        try {
            let artist = await artistsStatus.findOne({ spotifyID: req.params.artist })
            if (!artist) {
                responseObj.statusCode = 500
                responseObj.message = 'Artist not found'
                responseObj.data = []
                res.json(responseObj)
                return
            }
            let countries = artist.countries
            let totalVotes = 0
            for (let country of countries)
                totalVotes += country.votes
            countries.sort((a, b) => b.votes - a.votes)
            let votesForOthers = 0;
            for (let i = 4; i < countries.length; ++i)
                votesForOthers += countries[i].votes
            responseObj.statusCode = 200
            responseObj.message = 'Ok'
            responseObj.data = {
                first: (countries[0] && totalVotes > 0) ? { countryCode: countries[0].countryCode, votes: (countries[0].votes / totalVotes * 100).toFixed(2) } : { countryCode: "", votes: 0 },
                second: (countries[1] && totalVotes > 0) ? { countryCode: countries[1].countryCode, votes: (countries[1].votes / totalVotes * 100).toFixed(2) } : { countryCode: "", votes: 0 },
                third: (countries[2] && totalVotes > 0) ? { countryCode: countries[2].countryCode, votes: (countries[2].votes / totalVotes * 100).toFixed(2) } : { countryCode: "", votes: 0 },
                fourth: (countries[3] && totalVotes > 0) ? { countryCode: countries[3].countryCode, votes: (countries[3].votes / totalVotes * 100).toFixed(2) } : { countryCode: "", votes: 0 },
                others: (votesForOthers > 0 && totalVotes > 0) ? { countryCode: "Others", votes: (votesForOthers / totalVotes * 100).toFixed(2) } : { countryCode: "Others", votes: 0 }
            }
            res.json(responseObj)
            return
        } catch (ex) {
            responseObj.statusCode = 500
            responseObj.message = 'Internal server error'
            responseObj.data = []
            res.json(responseObj)
            return
        }
    }

    async getTopSongs(req, res) {
        let responseObj = {}
        if (req.headers.managertoken !== config.MANAGER_ACCESS_TOKEN) {
            responseObj.statusCode = 401
            responseObj.message = 'Unauthorized'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!req.params.country || !req.params.artist) {
            responseObj.statusCode = 500
            responseObj.message = 'Missing mandatory parameters'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!_.isString(req.params.country) || !_.isString(req.params.artist)) {
            responseObj.statusCode = 500
            responseObj.message = 'Bad parameters type'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        try {
            let artist = await artistsStatus.findOne({ spotifyID: req.params.artist })
            if (!artist) {
                responseObj.statusCode = 500
                responseObj.message = 'Artist not found'
                responseObj.data = []
                res.json(responseObj)
                return
            }
            for (let country of artist.countries) {
                if (country.countryCode === req.params.country) {
                    let songs = country.songs
                    songs.sort((a, b) => b.votes - a.votes)
                    let topTen = []
                    for (let i = 0; i < 10; ++i)
                        if (songs[i])
                            topTen.push({ songID: songs[i].spotifyID, songName: songs[i].name, songAlbum: songs[i].album, songSingers: songs[i].singers, songPreview: songs[i].preview })
                    responseObj.statusCode = 200
                    responseObj.message = 'Ok'
                    responseObj.data = topTen
                    res.json(responseObj)
                    return
                }
            }
            responseObj.statusCode = 500
            responseObj.message = 'Country not found for that artist'
            responseObj.data = []
            res.json(responseObj)
            return
        } catch (ex) {
            responseObj.statusCode = 500
            responseObj.message = 'Internal server error'
            responseObj.data = []
            res.json(responseObj)
            return
        }
    }

    async signupUser(req, res) {
        let responseObj = {}
        if (req.headers.managertoken !== config.MANAGER_ACCESS_TOKEN) {
            responseObj.statusCode = 401
            responseObj.message = 'Unauthorized'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!req.body.username || !req.body.email || !req.body.password) {
            responseObj.statusCode = 500
            responseObj.message = 'Missing mandatory parameters'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!_.isString(req.body.username) || !_.isString(req.body.email) || !_.isString(req.body.password)) {
            responseObj.statusCode = 500
            responseObj.message = 'Bad parameters type'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!isEmail.validate(req.body.email)) {
            responseObj.statusCode = 500
            responseObj.message = 'Bad email address'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        try {
            let existUser = await user.findOne({ email: req.body.email })
            if (existUser && existUser.isGoogleUser) {
                responseObj.statusCode = 500
                responseObj.message = 'You are already sign up with your google account please sign in with google'
                responseObj.data = []
                res.json(responseObj)
                return
            }
            if (existUser) {
                responseObj.statusCode = 500
                responseObj.message = 'User already exist'
                responseObj.data = []
                res.json(responseObj)
                return
            }
            let verificationCode = uuid().slice(0, 6)
            let newUser = new user({
                email: req.body.email,
                isGoogleUser: false,
                username: req.body.username,
                password: crypto.createHash('sha256').update(req.body.password).digest('hex'),
                sessionID: uuid(),
                voteFor: [],
                verificationCode: verificationCode
            })
            await newUser.save()
            sgMail.setApiKey(config.SENDGRID_API_KEY)
            let msg = {
                to: req.body.email,
                from: 'info@tourbuilder.com',
                subject: 'Tour Builder email verification',
                text: `Please enter the verification code inside the Tour Builder app:\n ${verificationCode}`
            }
            sgMail.send(msg)
            responseObj.statusCode = 200
            responseObj.message = 'Ok'
            responseObj.data = []
            res.json(responseObj)
            return
        } catch (ex) {
            console.log(ex)
            responseObj.statusCode = 500
            responseObj.message = 'Internal server error'
            responseObj.data = []
            res.json(responseObj)
            return
        }
    }

    async loginUser(req, res) {
        let responseObj = {}
        if (req.headers.managertoken !== config.MANAGER_ACCESS_TOKEN) {
            responseObj.statusCode = 401
            responseObj.message = 'Unauthorized'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!req.body.email || !req.body.password) {
            responseObj.statusCode = 500
            responseObj.message = 'Missing mandatory parameters'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!_.isString(req.body.email) || !_.isString(req.body.password)) {
            responseObj.statusCode = 500
            responseObj.message = 'Bad parameters type'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!isEmail.validate(req.body.email)) {
            responseObj.statusCode = 500
            responseObj.message = 'Bad email address'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        try {
            let userExist = await user.findOne({ email: req.body.email })
            if (!userExist) {
                responseObj.statusCode = 500
                responseObj.message = 'User does not exist'
                responseObj.data = []
                res.json(responseObj)
                return
            }
            if (!userExist.isVerified) {
                responseObj.statusCode = 500
                responseObj.message = 'Unverified account, Please sign up with a different email address'
                responseObj.data = []
                res.json(responseObj)
                return
            }
            if (userExist.isGoogleUser) {
                responseObj.statusCode = 500
                responseObj.message = 'This account has been registered with google, Please sign in with google'
                responseObj.data = []
                res.json(responseObj)
                return
            }
            if (userExist.password === crypto.createHash('sha256').update(req.body.password).digest('hex')) {
                let sessionID = uuid()
                await user.updateOne({ email: req.body.email }, {
                    $set: {
                        sessionID: sessionID
                    }
                })
                responseObj.statusCode = 200
                responseObj.message = 'Ok'
                responseObj.data = { sessionID: sessionID }
                res.json(responseObj)
                return
            }
            responseObj.statusCode = 500
            responseObj.message = 'Email or password are incorrect '
            responseObj.data = []
            res.json(responseObj)
            return
        } catch (ex) {
            responseObj.statusCode = 500
            responseObj.message = 'Internal server error'
            responseObj.data = []
            res.json(responseObj)
            return
        }

    }

    async verifyAccount(req, res) {
        let responseObj = {}
        if (req.headers.managertoken !== config.MANAGER_ACCESS_TOKEN) {
            responseObj.statusCode = 401
            responseObj.message = 'Unauthorized'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!req.body.verificationCode) {
            responseObj.statusCode = 500
            responseObj.message = 'Missing mandatory parameters'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!_.isString(req.body.verificationCode)) {
            responseObj.statusCode = 500
            responseObj.message = 'Bad parameters type'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        try {
            let userToVerify = await user.findOne({ verificationCode: req.body.verificationCode })
            if (!userToVerify) {
                responseObj.statusCode = 500
                responseObj.message = 'Wrong verification code'
                responseObj.data = []
                res.json(responseObj)
                return
            }
            await user.updateOne({ verificationCode: req.body.verificationCode }, {
                $set: {
                    isVerified: true
                }
            })
            responseObj.statusCode = 200
            responseObj.message = 'Ok'
            responseObj.data = []
            res.json(responseObj)
            return
        } catch (ex) {
            responseObj.statusCode = 500
            responseObj.message = 'Internal server error'
            responseObj.data = []
            res.json(responseObj)
            return
        }
    }

    async getArtistSongs(req, res) {
        let responseObj = {}
        if (req.headers.managertoken !== config.MANAGER_ACCESS_TOKEN) {
            responseObj.statusCode = 401
            responseObj.message = 'Unauthorized'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!req.params.artist) {
            responseObj.statusCode = 500
            responseObj.message = 'Missing mandatory parameters'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!_.isString(req.params.artist)) {
            responseObj.statusCode = 500
            responseObj.message = 'Bad parameters type'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        let options = {
            url: 'https://accounts.spotify.com/api/token',
            headers: {
                Authorization: `Basic ${Buffer.from(`${config.SPOTIFY_CLIENT}:${config.SPOTIFY_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            form: {
                grant_type: 'client_credentials'
            }
        }
        request.post(options, (error, response, body) => {
            if (error || response.statusCode !== 200) {
                responseObj.statusCode = 500
                responseObj.message = 'Spotify internal server error'
                responseObj.data = []
                res.json(responseObj)
                return
            }
            let token = JSON.parse(body).access_token
            options = {
                url: `https://api.spotify.com/v1/artists/${req.params.artist}/albums`,
                qs: {
                    include_groups: 'album'
                },
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
            request.get(options, (error, response, body) => {
                if (error) {
                    responseObj.statusCode = 500
                    responseObj.message = 'Spotify internal server error'
                    responseObj.data = []
                    res.json(responseObj)
                    return
                }
                if (response.statusCode !== 200) {
                    responseObj.statusCode = 500
                    responseObj.message = 'Can not find that artist'
                    responseObj.data = []
                    res.json(responseObj)
                    return
                }
                let albumsIDs = new Set()
                let albumItems = JSON.parse(body).items
                for (let albumItem of albumItems)
                    albumsIDs.add(albumItem.id)
                albumsIDs = [...albumsIDs]
                albumsIDs = albumsIDs.join(',')
                options = {
                    url: `https://api.spotify.com/v1/albums`,
                    qs: {
                        ids: albumsIDs
                    },
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
                request.get(options, (error, response, body) => {
                    if (error) {
                        responseObj.statusCode = 500
                        responseObj.message = 'Spotify internal server error'
                        responseObj.data = []
                        res.json(responseObj)
                        return
                    }
                    if (response.statusCode !== 200) {
                        responseObj.statusCode = 500
                        responseObj.message = 'Can not find albums for that artist'
                        responseObj.data = []
                        res.json(responseObj)
                        return
                    }
                    let artistAlbums = JSON.parse(body).albums
                    let artistSongs = new Array()
                    let songsExample = new Set()
                    for (let album of artistAlbums) {
                        for (let song of album.tracks.items) {
                            if (song.preview_url) {
                                if (!songsExample.has(song.preview_url)) {
                                    artistSongs.push({
                                        songName: song.name,
                                        songSingers: song.artists[0] ? album.artists[0].name : 'Unknown',
                                        songSpotifyID: song.id,
                                        songAlbum: album.name,
                                        songPreviewURL: song.preview_url
                                    })
                                }
                                songsExample.add(song.preview_url)
                            }
                        }
                    }
                    songsExample = [...songsExample]
                    responseObj.statusCode = 200
                    responseObj.message = 'Ok'
                    responseObj.data = artistSongs
                    res.json(responseObj)
                    return
                })
            })
        })
    }

    async googleSignin(req, res) {
        let responseObj = {}
        if (req.headers.managertoken !== config.MANAGER_ACCESS_TOKEN) {
            responseObj.statusCode = 401
            responseObj.message = 'Unauthorized'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!req.body.username || !req.body.email) {
            responseObj.statusCode = 500
            responseObj.message = 'Missing mandatory parameters'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!_.isString(req.body.username) || !_.isString(req.body.email)) {
            responseObj.statusCode = 500
            responseObj.message = 'Bad parameters type'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        if (!isEmail.validate(req.body.email)) {
            responseObj.statusCode = 500
            responseObj.message = 'Bad email address'
            responseObj.data = []
            res.json(responseObj)
            return
        }
        try {
            let existUser = await user.findOne({ email: req.body.email })
            if (existUser) {
                let newSessionID = uuid()
                await user.updateOne({ email: req.body.email }, {
                    $set: {
                        sessionID: newSessionID
                    }
                })
                responseObj.statusCode = 200
                responseObj.message = 'Ok'
                responseObj.data = { sessionID: newSessionID }
                res.json(responseObj)
                return
            }
            let userObj = {
                email: req.body.email,
                username: req.body.username,
                password: crypto.createHash('sha256').update('NO_NEED_PASSWORD').digest('hex'),
                sessionID: uuid(),
                voteFor: [],
                verificationCode: 'NO_NEED_VERIFICATION',
                isVerified: true,
                isGoogleUser: true
            }
            let newUser = new user(userObj)
            await newUser.save()
            responseObj.statusCode = 200
            responseObj.message = 'Ok'
            responseObj.data = { sessionID: userObj.sessionID }
            res.json(responseObj)
            return
        } catch (ex) {
            console.log(ex)
            responseObj.statusCode = 500
            responseObj.message = 'Internal server error'
            responseObj.data = []
            res.json(responseObj)
            return
        }
    }
}

module.exports = TourBuilderClient
