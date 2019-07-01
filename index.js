const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const TourBuilderClient = require('./TourBuilder-Client')
const port = process.env.PORT || 3000
const db = require('./db')

const tourBuilderClient = new TourBuilderClient()

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE')
  res.set('Content-Type', 'application/json')
  next()
})
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)
app.use(express.json())

app.get('/artists', tourBuilderClient.getAllArtists)

app.post('/vote/:artist', tourBuilderClient.vote)

app.get('/topCountries/:artist', tourBuilderClient.getTopCountries)

app.get('/topSongs/:artist/:country', tourBuilderClient.getTopSongs)

app.post('/signup', tourBuilderClient.signupUser)

app.post('/login', tourBuilderClient.loginUser)

app.post('/verify', tourBuilderClient.verifyAccount)

app.post('/googleSignin', tourBuilderClient.googleSignin)

app.get('/songs/:artist', tourBuilderClient.getArtistSongs)

app.all('*', (req, res) => {
  res.json({
    statusCode: 404,
    message: 'Endpoint not found',
    data: []
  })
})

app.listen(port, () => {
  console.log(`Listening on port: ${port}`)
})
