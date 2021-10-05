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

createDatabases()

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(cors())
app.use('/twilio', twiliorouter);
app.use(express.urlencoded())
app.use(cookieParser())
app.use(helmet())

// define a route handler for the default home page
app.all("/", cors(), (req, res) => {
    console.log(req)
    res.send( "Hello world!" );
});

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
.verifyIdToken(idToken)
.then((decodedToken) => {
  const uid = decodedToken.uid;
  // ...
})
    .catch((error) => {
      //res.redirect("/login");
      console.log(error)
      return res.type('text/plain')
      .status(400)
      .send('Invalid');
    });
})

// start the Express server
app.listen( port, () => {
    console.log( `server started at http://localhost:${port}` );
} );