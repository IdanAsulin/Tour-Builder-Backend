/* eslint-disable no-console */
const mongoose = require('mongoose')
const config = require('./config')
const options = {
  autoReconnect: true,
  useNewUrlParser: true,
  useCreateIndex: true
}

mongoose.connect(config.DB_CONNECTION_STRING, options).then(
  () => {
    console.log('Connected to Mongo DB...')
  },
  err => {
    console.log(`Connection to Mongo DB failed: ${err.message}`)
  }
)
