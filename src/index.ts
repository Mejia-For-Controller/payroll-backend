import './tracer'; 
import express from 'express';
import cors from 'cors'
const app = express();
const port = 3000; // default port to listen
import { twiliorouter } from "./routes/twilio";
import * as admin from 'firebase-admin';
const serviceAccount = require("./../serviceAccountKey.json");
import { createDatabases } from './createDatabases'
import cookieParser from 'cookie-parser'
import { config } from './../config.json'
import helmet from 'helmet'
import { cassandraclient } from './cassandra'
const TimeUuid = require('cassandra-driver').types.TimeUuid;

createDatabases()

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(cors())
app.use('/twilio', twiliorouter);
app.use(express.urlencoded())
app.use(cookieParser())
app.use(helmet())

const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// define a route handler for the default home page
app.all("/", cors(), (req, res) => {
    console.log(req)
    res.send( "Hello world!" );
});

function purifyHtml(input) {
  return DOMPurify.sanitize(input, {USE_PROFILES: {html: false}});
}

app.all('/clean', [cors(),express.json()], (req, res) => {
  res.send(purifyHtml(req.body.text))
})

app.all('/mycampaigns', [cors(),cookieParser(),express.json()],(req, res) => {
  //const sessionCookie = req.cookies.session || "";
  //console.log(sessionCookie)
    admin
    .auth()
    .verifyIdToken(req.body.firebaseToken)
      .then((decodedClaims) => {
        console.log(decodedClaims)
        // look up membership
        return res.send({
         "campaignlist": 
            []
      })
    })
    .catch((error) => {
      //res.redirect("/login");
      console.log(error)
      return res.type('text/plain')
      .status(401)
      .send('Invalid');
    });
})

app.all('/createcampaign', [cors(),cookieParser(),express.json()], (req, res) => {
  //const sessionCookie = req.cookies.session || "";
    // idToken comes from the client app
  
    admin
    .auth()
    .verifyIdToken(req.body.firebaseToken)
      .then((decodedIdToken) => {
        console.log(decodedIdToken)
        // ensure authorized user kyler@mejiaforcontroller.com

        if (decodedIdToken.uid === "pDU7JvlefcTtGnSssyMo1hhneqO2") {
          const createCampaignQuery = "INSERT INTO texter.campaigns (campaignid, name, ownerid, iconURL, bannerURL, creationtime) VALUES (?, ?, ?, ?, ?, ?) IF NOT EXISTS; "
          const createCampaignParams = [req.body.creationOptions.campaignid,req.body.creationOptions.name,decodedIdToken.uid,undefined,undefined,TimeUuid.now()]
          cassandraclient.execute(createCampaignQuery, createCampaignParams)
            .then(async result => {
              const createInitMemberQuery = "INSERT INTO texter.memberships (campaignid, userid, joinedtime) VALUES (?, ?, ?) IF NOT EXISTS; "
              const createInitParams = [req.body.creationOptions.campaignid,decodedIdToken.uid,TimeUuid.now()]
              cassandraclient.execute(createCampaignQuery, createCampaignParams)
                .then(async result2 => {
                  console.log(result2)
                  return res.type('text/plain')
                  .status(200)
                  .send('Success');
                })
         // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
        
          console.log(result)
      }).catch(error => console.error(error));
        } else {
          return res.type('text/plain')
          .status(401)
          .send('Unauthorized');
        }

        
    })
    .catch((error) => {
      //res.redirect("/login");
      console.log(error)
      return res.type('text/plain')
      .status(401)
      .send('Invalid');
    });
})

// start the Express server
app.listen( port, () => {
    console.log( `server started at http://localhost:${port}` );
} );