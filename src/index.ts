import './tracer'; 
import express from 'express';
import cors from 'cors'
const app = express();
const port = 3000; // default port to listen
import { twiliorouter } from "./routes/twilio";
import * as admin from 'firebase-admin';
const serviceAccount = require("./../serviceAccountKey.json");
import {createDatabases} from './createDatabases'
import { config } from './../config.json'

createDatabases()

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(cors())
app.use('/twilio', twiliorouter);
app.use(express.urlencoded())

// define a route handler for the default home page
app.all("/", (req, res) => {
    console.log(req)
    res.send( "Hello world!" );
});

app.all('/mycampaigns', cors(),(req, res) => {
    const sessionCookie = req.cookies.session || "";
    admin
    .auth()
    .verifySessionCookie(sessionCookie, true /** checkRevoked */)
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
      return res.type('text/plain')
      .status(401)
      .send('Invalid');
    });
})

app.all('/createcampaign', (req, res) => {
    const sessionCookie = req.cookies.session || "";
    admin
    .auth()
    .verifySessionCookie(sessionCookie, true /** checkRevoked */)
      .then((decodedClaims) => {
          console.log(decodedClaims)
            // check if the name doen't exist, then create it with the user id as the owner.
        return res.send({
             "success": true
      })
    })
    .catch((error) => {
      //res.redirect("/login");
      return res.type('text/plain')
      .status(400)
      .send('Invalid');
    });
})

// start the Express server
app.listen( port, () => {
    console.log( `server started at http://localhost:${port}` );
} );