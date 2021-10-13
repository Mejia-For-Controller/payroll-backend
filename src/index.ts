import tracer from './tracer'; 
import express from 'express';
import cors from 'cors'
const app = express();
const port = 3000; // default port to listen
import { twiliorouter } from "./routes/twilio";
import * as admin from 'firebase-admin';
const serviceAccount = require("./../serviceAccountKey.json");
import { createDatabases } from './createDatabases'
import cookieParser from 'cookie-parser'
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

app.all('/getMessages',[cors(),cookieParser(),express.json()], (res, req) => {
  admin
    .auth()
    .verifyIdToken(req.body.firebaseToken)
    .then(async (decodedIdToken) => {
      if (req.body.campaignid) {
        //campaignid provided
        // lookup membership of user in campaign id
        const lookupMembershipQuery = "SELECT * FROM texter.memberships WHERE campaignid = ? AND userid = ?"
        const lookupMembershipParams = [req.body.campaignid, decodedIdToken.uid]
        
        //lookup channel id

        //lookup latest messages in channel
        //send them to the user
      } else {
        res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({"message": "no campaign id provided"}));
      }
    });
})

function purifyHtml(input) {
  return DOMPurify.sanitize(input, {USE_PROFILES: {html: false}});
}

app.all('/online', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({"online": true,"time": Date.now()}));
})

app.all('/clean', [cors(),express.json()], (req, res) => {
  res.send(purifyHtml(req.body.text))
})

app.all('/submitmessage', [cors(),express.json()], (req, res) => {
  admin
    .auth()
    .verifyIdToken(req.body.firebaseToken)
      .then(async (decodedIdToken) => {
        console.log(decodedIdToken)
        // look up memberships


    })
    .catch((error) => {
      //res.redirect("/login");
      console.log(error)
      return res.type('text/plain')
      .status(401)
      .send('Invalid');
    });
})

app.all('/mycampaigns', [cors(),cookieParser(),express.json()],async (req, res) => {
  //const sessionCookie = req.cookies.session || "";
  //console.log(sessionCookie)
    admin
    .auth()
    .verifyIdToken(req.body.firebaseToken)
      .then(async (decodedIdToken) => {
        console.log(decodedIdToken)
        // look up memberships

        const queryformycampaigns = 'SELECT * FROM texter.memberships WHERE userid = ?'
        const paramsformycampaigns = [decodedIdToken.uid]

         var membershipsforuid = await cassandraclient.execute(queryformycampaigns, paramsformycampaigns)

        var listOfPromises = membershipsforuid.rows.map(eachRow => {
          return new Promise((resolve, reject) => {
            cassandraclient.execute("SELECT * FROM texter.campaigns WHERE campaignid = ? ", [eachRow.campaignid])
              .then((result) => {
              resolve({
                campaignid: eachRow.campaignid,
                nameOfCampaign: result.rows[0].name,
                iconurl: result.rows[0].iconurl,
                bannerurl: result.rows[0].bannerurl
              })
              })
              .catch((error) => {
                console.log(error)
              reject("error")
            })
          })
        })

        var arrayOfPromisesResult:any = await Promise.allSettled(listOfPromises)
          
        var arrayOfCleanedPromiseResults = arrayOfPromisesResult.filter(function(campaignObj) {
          if (campaignObj.status != "fulfilled") {
            return false; // skip
          }
          return true;
        }).map(function(campaignObj) { return campaignObj.value; });
        
        return res.json({
          "campaignlist": arrayOfCleanedPromiseResults
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

app.all('/campaignsettings', [cors(),cookieParser(),express.json()], (req, res) => {
  //const sessionCookie = req.cookies.session || "";
    // idToken comes from the client app
  
  /*
  {
  firebaseToken: asdfsdfaff,
  creationOptions: {
    campaignid: mejiaforcontroller,
    name: Mejia For Controller,
    about: Progressive running for LA City Controller,
    Website: https://mejiaforcontroller.com,
    iconurl: dfdsfdf,
    bannerurl: dfjdflsfjhafl
    twilio: {
    accountsid: fdajdshffsf
    authtoken: adsjkfahdkfajfdhfd
    }
  }
  }
  */
  
    admin
    .auth()
    .verifyIdToken(req.body.firebaseToken)
      .then((decodedIdToken) => {
        console.log(decodedIdToken)

        //select req.body.creationOptions.campaignid

          const searchForFindingCampaignQuery = 'SELECT * FROM texter.campaigns WHERE campaignid = ?'
          const paramsForFindingCampaignQuery = [req.body.campaignid]
          
          cassandraclient.execute(searchForFindingCampaignQuery, paramsForFindingCampaignQuery)
            .then(async result => {
              console.log(result)
              if (result.rows.length === 0) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  campaignexists: false
                }));
              } else {
                if (result.rows[0].ownerid === decodedIdToken.uid) {
                  var fakeAuthTokenPlaceholder = "0".repeat(result.rows[0].authtoken.length)
                  console.log(fakeAuthTokenPlaceholder)
                  res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  campaignexists: true,
                  authorized: true,
                  campaignsettings: {
                    campaignid: result.rows[0].campaignid,
                    name: result.rows[0].name,
                    about: result.rows[0].about,
                    website: result.rows[0].website,
                    iconurl: result.rows[0].iconurl,
                    bannerurl: result.rows[0].bannerurl,
                    accountsid: result.rows[0].accountsid,
                   // authtoken: result.rows[0].authtoken,
                    authtoken: fakeAuthTokenPlaceholder,
                    messagingservice: result.rows[0].messagingservicesid
                  }
                }));
                } else {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    campaignexists: true,
                    authorized: false,
                  }));
                }
              }
            }).catch((error) => {
              console.log(error)
              return res.type('text/plain')
      .status(500)
      .send('Database error');
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
  
  /*
  {
  firebaseToken: asdfsdfaff,
  creationOptions: {
    campaignid: mejiaforcontroller,
    name: Mejia For Controller,
    about: Progressive running for LA City Controller,
    Website: https://mejiaforcontroller.com,
    iconurl: dfdsfdf,
    bannerurl: dfjdflsfjhafl
    twilio: {
    accountsid: fdajdshffsf
    authtoken: adsjkfahdkfajfdhfd
    }
  }
  }
  */
  
    admin
    .auth()
    .verifyIdToken(req.body.firebaseToken)
      .then((decodedIdToken) => {
        console.log(decodedIdToken)
        // ensure authorized user kyler@mejiaforcontroller.com

        if (decodedIdToken.uid === "pDU7JvlefcTtGnSssyMo1hhneqO2") {
          const createCampaignQuery = "INSERT INTO texter.campaigns (campaignid, name, about, website, ownerid, iconURL, bannerURL, creationtime, accountsid, authtoken, messagingservicesid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) IF NOT EXISTS; "
          const createCampaignParams = [req.body.creationOptions.campaignid,
            req.body.creationOptions.name,
            req.body.creationOptions.about,
            req.body.creationOptions.website,
            decodedIdToken.uid,
            req.body.creationOptions.iconurl,
            req.body.creationOptions.bannerurl,
            TimeUuid.now(),
            req.body.creationOptions.twilio.accountsid,
            req.body.creationOptions.twilio.authtoken,
            req.body.creationOptions.twilio.messagingservicesid]

          const searchForFindingCampaignQuery = 'SELECT * FROM texter.campaigns WHERE campaignid = ?'
          const paramsForFindingCampaignQuery = [req.body.creationOptions.campaignid]
          
          cassandraclient.execute(searchForFindingCampaignQuery, paramsForFindingCampaignQuery)
            .then(async result => {
              if (result.rows.length > 0) {
                return res.type('text/plain')
              .status(400)
              .send('Campaign Exists');
              } else {
                cassandraclient.execute(createCampaignQuery, createCampaignParams)
                .then(async result => {
                  const createInitMemberQuery = "INSERT INTO texter.memberships (campaignid, userid, joinedtime, isowner, isadmin, isvolunteer) VALUES (?, ?, ?, ?, ?, ?) IF NOT EXISTS; "
                  const createInitMemberParams = [req.body.creationOptions.campaignid, decodedIdToken.uid, TimeUuid.now(),
                  true, true, true
                  ]
                  cassandraclient.execute(createInitMemberQuery, createInitMemberParams)
                    .then(async result2 => {
                      console.log(result2)

                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({"success": true,"time": Date.now()}));
                    })
             // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
            
              console.log(result)
          }).catch(error => console.error(error));
             }
            }).catch(error => {
              console.log(error)
              res.type('text/plain')
                .status(500)
              .send("SELECT campaigns crashed")
          })

      
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

app.all('/editcampaignsettings', [cors(),cookieParser(),express.json()], (req, res) => {
  //const sessionCookie = req.cookies.session || "";
    // idToken comes from the client app
  
  /*
  {
  firebaseToken: asdfsdfaff,
  creationOptions: {
    campaignid: mejiaforcontroller,
    name: Mejia For Controller,
    about: Progressive running for LA City Controller,
    Website: https://mejiaforcontroller.com,
    iconurl: dfdsfdf,
    bannerurl: dfjdflsfjhafl
    twilio: {
    accountsid: fdajdshffsf
    authtoken: adsjkfahdkfajfdhfd
    }
  }
  }
  */
  
    admin
    .auth()
    .verifyIdToken(req.body.firebaseToken)
      .then((decodedIdToken) => {
        console.log(decodedIdToken)
        // ensure authorized user kyler@mejiaforcontroller.com

        if (decodedIdToken.uid === "pDU7JvlefcTtGnSssyMo1hhneqO2") {
          // /^0*$/.test(subject)

          const searchForFindingCampaignQuery = 'SELECT * FROM texter.campaigns WHERE campaignid = ?'
          const paramsForFindingCampaignQuery = [req.body.creationOptions.campaignid]
          
          cassandraclient.execute(searchForFindingCampaignQuery, paramsForFindingCampaignQuery)
            .then(async result => {
              if (result.rows.length === 0) {
                return res.status(400).end(JSON.stringify({"success": false,"note": "This campaign doesn\'t exist"}));
              } else {
                var authTokenToWrite: string;

                if (/^0*$/.test(req.body.creationOptions.twilio.authtoken)) {
                  //the string only contains zeros, it means we can write the old auth token back in
                  authTokenToWrite = result.rows[0].authtoken
                } else {
                  //the string is different, write the new auth token in
                  authTokenToWrite = req.body.creationOptions.twilio.authtoken
                }

                const editCampaignQuery = "INSERT INTO texter.campaigns (campaignid, name, about, website, ownerid, iconURL, bannerURL, creationtime, accountsid, authtoken, messagingservicesid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?); "
                const editCampaignParams = [req.body.creationOptions.campaignid,
                  req.body.creationOptions.name,
                  req.body.creationOptions.about,
                  req.body.creationOptions.website,
                  decodedIdToken.uid,
                  req.body.creationOptions.iconurl,
                  req.body.creationOptions.bannerurl,
                  TimeUuid.now(),
                  req.body.creationOptions.twilio.accountsid,
                 // req.body.creationOptions.twilio.authtoken,
                  authTokenToWrite,
                  req.body.creationOptions.twilio.messagingservicesid]
                cassandraclient.execute(editCampaignQuery, editCampaignParams)
                  .then(async result => {
                  console.log(result)
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({"success": true,"time": Date.now()}));
                    
             // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
            
              console.log(result)
          }).catch(error => console.error(error));
             }
            }).catch(error => {
              console.log(error)
              res.type('text/plain')
                .status(500)
              .send("SELECT campaigns crashed")
          })

      
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