
/* --------------------------------- */
/*              REQUIRES             */
/* --------------------------------- */
const axios = require( 'axios' ); // Used for getting movie ratings pages so we can get scores
const cheerio = require( 'cheerio' ); // Used to extract media scores from page markup
const express = require('express');
const mongoose = require('mongoose');


/* --------------------------------- */
/*           DATABASE SETUP          */
/* --------------------------------- */
const Schema = mongoose.Schema;
const mongoDb = process.env.MONGOURL;
mongoose.connect(mongoDb, {})
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Mongo connection error!'));

/* Define what we store about each IMDB film/show */
const MediaItem = mongoose.model(
  'MediaItem',
  new Schema(
    {
      _id: {type: String, required: true},
      trimmedRating: {type: Number, required: false}
    },
    { 
      timestamps: { updatedAt: 'last_updated' }
    }
  )
);


/* --------------------------------- */
/*                APP                */
/* --------------------------------- */

/* ------------ Init App ----------- */
const app = express();
app.use(express.json());

/* ------------ Endpoints ---------- */

/* Server running confirmation */
app.get(
  '/',
  function(req, res) {
    res.send('Server running ok... Probably.');
  })

/* Get trimmed media item score - this is the main endpoint */
app.get(
    '/mediaItemScore',
    async function(req, res) {
        let query = req.query;
        if (query.id && query.id !== undefined ) {
          let score = await new Score(query.id).trimmedScore;
          res.send( JSON.stringify( score ) );
        } else {
          res.send( JSON.stringify( 'Oops theres been an issue!') );
        }
    })

/* ----------- Run Server ---------- */
const PORT = process.env.PORT || 3001;
app.listen(PORT, function() {
  console.log(`App running on port ${PORT ? PORT : '3001'}, Woo!`);
})


/* --------------------------------- */
/*             FUNCTIONS             */
/* --------------------------------- */

/* Score class to encapsulate all the score calculation and extraction logic */
class Score {
  constructor( queryID ) {
    this.id = queryID;
    this.recentScore = this.checkForRecentTrimmedScore();
    this.trimmedScore = this.calculateTrimmedScore();
  }

  /* Check the database for if we have a trimmed score from today, if so get it */
  async checkForRecentTrimmedScore() {

  }

  /* Calculate a trimmed score */
  async calculateTrimmedScore() {
    let url = `https://www.imdb.com/title/${this.id}/ratings/`;

    /* Cloudfront on IMDB does not allow axios user agent so spoof a common browser one */
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36';
    }
    try {
      console.log('Checking: ' + url );
      let res = await axios.get( url, {
        headers
      }); 
  
      /* If 200 (i.e. success) then add to results array */
      if (res.status === 200 ) {
          console.log('GOOD');

          /* Find the wider data from page source, and grab the content data we want */
          const $ = cheerio.load(res.data);
          let dataSelector = $('#__NEXT_DATA__').text();
          let contentData = JSON.parse(dataSelector).props.pageProps.contentData;

          /* Loop through through 2-9 star ratings, counting total votecounts and summed ratings */
          let totalVotes = 0;
          let voteSum = 0;
          let oneTo10 = contentData.histogramData.histogramValues;
          for (let i=1; i<=8; i++) {
            totalVotes += oneTo10[i].voteCount;
            voteSum += oneTo10[i].rating * oneTo10[i].voteCount;
          }

          /* Final calculation, finding the mean of our newly found data */
          let trimmedScore = ( voteSum / totalVotes ).toFixed(1);
          return trimmedScore;
      }
      /* If anything else (i.e. NOT success) then move on */
      else {
          console.log('BAD');
      }  
    } catch ( error ) {
          console.log('Error with Axios finding that page...');
          console.log(error);
    }
  }
}