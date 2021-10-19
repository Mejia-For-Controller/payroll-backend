import tracer from './tracer'; 
import express from 'express';
import cors from 'cors'
const app = express();
const port = 3000; // default port to listen
import { twiliorouter } from "./routes/twilio";
const TimeUuid = require('cassandra-driver').types.TimeUuid;
import * as admin from 'firebase-admin';
const serviceAccount = require("./../serviceAccountKey.json");
import { createDatabases } from './createDatabases'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { cassandraclient } from './cassandra'
import {logger} from './logger'
import axios from 'axios'
import qs from 'qs';
import { bucketCalc } from './utils';
import { myCache } from './cache';
const Long = require('cassandra-driver').types.Long;
var rangeInclusive = require('range-inclusive')

var cacheOfSecureTokens = {
}

function uploadUserDetailsFromDecodedIdToken(decodedIdToken) {
  cassandraclient.execute("INSERT INTO texter.userinfo (uid, email, name, picture) VALUES (?,?,?,?)",
  [decodedIdToken.uid, decodedIdToken.email, decodedIdToken.name, decodedIdToken.picture],
{prepare: true})
  .then((resultofuserupdate) => console.log(resultofuserupdate))
.catch((error) => {console.log(error)})
}

function withCacheVerifyIdToken(firebaseToken) {
  return new Promise<admin.auth.DecodedIdToken>((resolve, reject) => {
    if (cacheOfSecureTokens[firebaseToken]) {
      resolve(cacheOfSecureTokens[firebaseToken])
    uploadUserDetailsFromDecodedIdToken(cacheOfSecureTokens[firebaseToken])
    } else {
      admin
        .auth()
        .verifyIdToken(firebaseToken)
        .then(async (decodedIdToken) => {
          resolve(decodedIdToken)
          cacheOfSecureTokens[firebaseToken] = decodedIdToken;
          uploadUserDetailsFromDecodedIdToken(decodedIdToken)
        })
        .catch((error) => {
          reject(error)
        })
    }
  })
}


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
   // console.log(req)
    res.send( "Hello world!" );
});

function purifyHtml(input) {
  return DOMPurify.sanitize(input, {USE_PROFILES: {html: false}});
}

app.all('/online', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({"online": true,"time": Date.now()}));
})

app.all('/securetokens', (req, res) => {
  console.log(cacheOfSecureTokens)
  res.end('success')
})

app.all('/clean', [cors(),express.json()], (req, res) => {
  res.send(purifyHtml(req.body.text))
})

app.get('/robots.txt', function (req, res) {
  res.type('text/plain');
  res.send("User-agent: *\nDisallow: /");
});

app.all('/campaignname', [cors(), cookieParser(), express.json()], function (req, res) {
  withCacheVerifyIdToken(req.body.firebaseToken)
    .then(async (decodedIdToken) => {
      const queryformycampaigns = 'SELECT * FROM texter.memberships WHERE userid = ? AND campaignid = ?'
      const paramsformycampaigns = [decodedIdToken.uid, req.body.campaignid]

      await cassandraclient.execute(queryformycampaigns, paramsformycampaigns).then(async (membershipsforuid) => {
        if (membershipsforuid.rows.length > 0) {
          await cassandraclient.execute("SELECT * FROM texter.campaigns WHERE campaignid = ?", [req.body.campaignid]).then((resultOfCampaign) => {
            if (resultOfCampaign.rows.length > 0) {
              res.send({
                name: `${resultOfCampaign.rows[0].name}`
              })
            } else {
              res.send({
                name: `null`
              })
            }
          })
        }
      });
    })
});

app.all('/getmembershiproster', [cors(), cookieParser(), express.json()], function (req, res) {
  withCacheVerifyIdToken(req.body.firebaseToken)
    .then(async (decodedIdToken) => {

      const queryformycampaigns = 'SELECT * FROM texter.memberships WHERE userid = ? AND campaignid = ?'
      const paramsformycampaigns = [decodedIdToken.uid, req.body.campaignid]

      await cassandraclient.execute(queryformycampaigns, paramsformycampaigns).then(async (membershipsforuid) => {
        if (membershipsforuid.rows.length > 0) {
          if (membershipsforuid.rows[0].isadmin || membershipsforuid.rows[0].isowner) {
            //authorized

            

            const queryformembershiplist = 'SELECT * FROM texter.memberships WHERE campaignid = ?'
            const paramsformembershiplist = [req.body.campaignid]
            
            await Promise.all([
              cassandraclient.execute('SELECT * FROM texter.invitations WHERE campaignid =?',
                [req.body.campaignid], { prepare: true }),
                 cassandraclient.execute(queryformembershiplist, paramsformembershiplist, { prepare: true })
            ]).then((resultOfBothCassandraQueries) => {

              var rowsOfInvites = resultOfBothCassandraQueries[0].rows

              var resultOfMembershipList = resultOfBothCassandraQueries[1]
                console.log(resultOfMembershipList)

                // map all of them into promises
                var rowsOfMembership = resultOfMembershipList.rows;

                var promisesMembershipLookup = rowsOfMembership.map((eachRow) => cassandraclient.execute('SELECT * FROM texter.userinfo WHERE uid = ?', [eachRow.userid], {prepare: true}))
                
                //fetch them from the database via promise all
                Promise.all(promisesMembershipLookup)
                  .then((usersProfileResponse) => {
                    //usersProfileResponse is an array of cassandra formats
                    var resultToSendBack = usersProfileResponse.map((eachUserProfile:any, eachUserProfileIndex:any) => {
                      //eachUserProfile is a cassandra format
                      if (eachUserProfile.rows.length === 0) {
                        return {
                          name: "null",
                          uid: rowsOfMembership[eachUserProfileIndex].userid,
                          email: "null",
                          picture: "null",
                          isowner: rowsOfMembership[eachUserProfileIndex].isowner,
                          isadmin: rowsOfMembership[eachUserProfileIndex].isadmin,
                          isvolunteer: rowsOfMembership[eachUserProfileIndex].isvolunteer,
                          joinedtimestamp: rowsOfMembership[eachUserProfileIndex].joinedtime.getDate().getTime()
                      }
                      } else {
                        return {
                          name: eachUserProfile.rows[0].name,
                          uid: eachUserProfile.rows[0].uid,
                          email: eachUserProfile.rows[0].email,
                          picture: eachUserProfile.rows[0].picture,
                          isowner: rowsOfMembership[eachUserProfileIndex].isowner,
                          isadmin: rowsOfMembership[eachUserProfileIndex].isadmin,
                          isvolunteer: rowsOfMembership[eachUserProfileIndex].isvolunteer,
                          joinedtimestamp: rowsOfMembership[eachUserProfileIndex].joinedtime.getDate().getTime()
                      }
                      }

                      
                    })
                    
                    res.send({
                      members: resultToSendBack,
                      invites: rowsOfInvites
                    })
                })

                // then return the result
              })
              .catch((error) => {
              console.log(error)
            })
          } else {
            res.send({
              "success": false
            })
          }
        }
      })
    });
  
  
}
)


app.all('/invitenewemail', [cors(), cookieParser(), express.json()], function (req, res) {
  withCacheVerifyIdToken(req.body.firebaseToken)
    .then(async (decodedIdToken) => {

      const queryformycampaigns = 'SELECT * FROM texter.memberships WHERE userid = ? AND campaignid = ?'
      const paramsformycampaigns = [decodedIdToken.uid, req.body.campaignid]

      await cassandraclient.execute(queryformycampaigns, paramsformycampaigns).then(async (membershipsforuid) => {
        if (membershipsforuid.rows.length > 0) {
          if (membershipsforuid.rows[0].isadmin || membershipsforuid.rows[0].isowner) {
            //authorized

            

            const insertinvitelist = 'INSERT INTO texter.invitations (campaignid, email, invitetime, isowner, isadmin, accepted) VALUES (?,?,?,?,?,?)'

            var adminState = false;

            if (req.body.permissions === "admin") {
              adminState = true
            }

            var paramsinsertinvitelist = [req.body.campaignid,req.body.email,TimeUuid.now(),false,adminState,false]
           
            cassandraclient.execute(insertinvitelist, paramsinsertinvitelist, { prepare: true })
              .then((result) => {
              res.send({success: true})
            }).catch((error) => {console.log(error)})
          } else {
            res.send({
              "success": false,
              "noperms": true
            })
          }
        }
      })
    });
  
  
}
)

app.all('/getmessagesfromnumber', [cors(), cookieParser(), express.json()], function (req, res) {
   //const sessionCookie = req.cookies.session || "";
  //console.log(sessionCookie)
  withCacheVerifyIdToken(req.body.firebaseToken)
    .then(async (decodedIdToken) => {
     // console.log(decodedIdToken, decodedIdToken)
    //  console.log(`req.body.campaignid`,req.body.campaignid)
      // look up memberships

      const queryformycampaigns = 'SELECT * FROM texter.memberships WHERE userid = ? AND campaignid = ?'
      const paramsformycampaigns = [decodedIdToken.uid, req.body.campaignid]


      await cassandraclient.execute(queryformycampaigns, paramsformycampaigns).then(async (membershipsforuid) => {
        if (membershipsforuid.rows.length > 0) {

          await cassandraclient.execute("SELECT * FROM texter.channels WHERE campaignid = ? AND twilionumber = ?", [req.body.campaignid, req.body.twilionumber])
            .then((channelresult) => {

              var channeltimestamp = channelresult.rows[0].channelid.getDate().getTime();
       
              var rangeOfBuckets = rangeInclusive(0, bucketCalc(Date.now(), channeltimestamp), 1);

              const queryForTextsInThisBucket = "SELECT * FROM texter.messages WHERE channelid = ? and bucket = ?"

              var promisesForAllBuckets = rangeOfBuckets.map((itemBucket, indexBucket) =>
                cassandraclient.execute(queryForTextsInThisBucket, [channelresult.rows[0].channelid, itemBucket], { prepare: true }))
              
              Promise.all(promisesForAllBuckets).then((values) => {
              //  console.log(values);

                var allMessagesInOneArray = [];

                values.forEach((eachBucketResult:any) => {
                  allMessagesInOneArray = [...allMessagesInOneArray, ...eachBucketResult.rows]
                })

                var messagesArray = allMessagesInOneArray.map((eachRow) => {
                 
                  var mediaArray = []

                  if (eachRow.mediaurl && eachRow.mediatype) {
                    if (eachRow.mediaurl.length === eachRow.mediatype.length) {
                      //valid
                      mediaArray = eachRow.mediatype.map((mediatypeeach, mediaindex) => {
                        return {
                          type: mediatypeeach,
                          url: eachRow.mediaurl[mediaindex]
                        }
                      })
                    }
                  }

                  return {
                    body: eachRow.body,
                    from: eachRow.fromtwilio,
                    to: eachRow.fromtwilio,
                    timestamp: eachRow.snowflake.getDate().getTime(),
                    idempotence: eachRow.idempotence,
                    messagestatus: eachRow.messagestatus,
                    isautomated: eachRow.isAutomated,
                    inbound: eachRow.inbound,
                    outbound: eachRow.outbound,
                    dateToUse: eachRow.snowflake.getDate().getTime(),
                    twilionumber: eachRow.twilionumber,
                    media: mediaArray
                  }
                })

                return res.json({
                  messages: messagesArray
                })
              }) .catch((error) => {
                res.type('text/plain').status(500).send("cassandra fetching messages error")
                console.log(error)
              });
             
          })
            .catch((error) => {
            console.log(error)
            return res.type('text/plain')
          .status(500)
          .send('Query for Channel failed');
        })

       
        } else {
          return res.type('text/plain')
          .status(401)
          .send('Invalid, membership nonexistant');
        }

      }).catch((error) => {
      //res.redirect("/login");
      console.log(error)
      return res.type('text/plain')
        .status(500)
        .send('Query for Membership failed');
    });
        
     
    }).catch((error) => {
      //res.redirect("/login");
      console.log(error)
      return res.type('text/plain')
        .status(401)
        .send('Invalid, Auth Failed');
    });
})

app.all('/invitetocampaign', [cors(), cookieParser(), express.json()])

app.all('/getchannelevents', [cors(), cookieParser(), express.json()], async (req, res) => {
  //const sessionCookie = req.cookies.session || "";
  //console.log(sessionCookie)
  withCacheVerifyIdToken(req.body.firebaseToken)
    .then(async (decodedIdToken) => {
     // console.log(decodedIdToken, decodedIdToken)
    //  console.log(`req.body.campaignid`,req.body.campaignid)
      // look up memberships

      const queryformycampaigns = 'SELECT * FROM texter.memberships WHERE userid = ? AND campaignid = ?'
      const paramsformycampaigns = [decodedIdToken.uid, req.body.campaignid]

      await cassandraclient.execute(queryformycampaigns, paramsformycampaigns).then(async (membershipsforuid) => {
        if (membershipsforuid.rows.length > 0) {
          cassandraclient.execute("SELECT * FROM texter.channelevents WHERE campaignid = ? ", [req.body.campaignid])
          .then((result) => {
            var eventsArray = []
            result.rows.forEach(async (eachRow) => {
              //the row twilio number already exists in the array
              if (eventsArray.some(rowChecker => rowChecker.twilionumber === eachRow.twilionumber)) {
                var eventOfConcern = eventsArray.filter(rowChecker => rowChecker.twilionumber === eachRow.twilionumber)[0]
                if (eventOfConcern.timestamp < eachRow.timestamp.getDate().getTime()) {
                    //delete the old event
                  eventsArray = eventsArray.filter((eachEventFilter) => (eventOfConcern != eachEventFilter))
                  //add new one
                  eventsArray.push({
                    channelid: eachRow.channelid,
                    timestamp: eachRow.timestamp.getDate().getTime(),
                    twilionumber: eachRow.twilionumber,
                    type: eachRow.type,
                    body: eachRow.body,
                    fromtwilio: eachRow.fromtwilio,
                    totwilio: eachRow.totwilio
                  })
                  }
              } else {
                eventsArray.push({
                  channelid: eachRow.channelid,
                  timestamp: eachRow.timestamp.getDate().getTime(),
                  twilionumber: eachRow.twilionumber,
                  type: eachRow.type,
                  body: eachRow.body,
                  fromtwilio: eachRow.fromtwilio,
                  totwilio: eachRow.totwilio
                })
             }
            })
            return res.json({
              events: eventsArray
            })
          })
          .catch((error) => {
            console.log(error)
          })
        } else {
          return res.type('text/plain')
          .status(401)
          .send('Invalid, membership nonexistant');
        }

      }).catch((error) => {
      //res.redirect("/login");
      console.log(error)
      return res.type('text/plain')
        .status(500)
        .send('Query for Membership failed');
    });
        
     
    }).catch((error) => {
      //res.redirect("/login");
      console.log(error)
      return res.type('text/plain')
        .status(401)
        .send('Invalid, Auth Failed');
    });
});
      

app.all('/submitmessage', [cors(), express.json()], (req, res) => {
  var currentSnowflake = TimeUuid.now()
  /*
  {
  campaignid,
  twilionumber
  bodyofmessage,
  firebaseToken,
  idempotence
  }
  */
  
  if (!(req.body.idempotence)) {
    return res.end("BRUH WHERE THE IDEMP")
  }

  if (!(req.body.campaignid)) {
    return res.end("BRUH WHERE THE CAMPAIGNID")
  }
  
  var idempotence = req.body.idempotence
  withCacheVerifyIdToken(req.body.firebaseToken)
      .then(async (decodedIdToken) => {
      //  console.log(decodedIdToken)
        // look up memberships
       // console.log(`req.body.campaignid`,req.body.campaignid)
        // look up memberships
  
        const queryformycampaigns = 'SELECT * FROM texter.memberships WHERE userid = ? AND campaignid = ?'
        const paramsformycampaigns = [decodedIdToken.uid, req.body.campaignid]
  
       
  
        await cassandraclient.execute(queryformycampaigns, paramsformycampaigns).then(async (membershipsforuid) => {
          if (membershipsforuid.rows.length > 0) {

            await cassandraclient.execute("SELECT * FROM texter.campaigns WHERE campaignid = ?", [req.body.campaignid], {prepare: true})
              .then(async (campaignquerysettings) => {
              
                if (campaignquerysettings.rows.length > 0) {

                  var campaignresult = campaignquerysettings.rows[0]


                  //create the channel
                // create chnanel
                const queryForChannelsSearch = "SELECT * FROM texter.channels WHERE campaignid = ? AND twilionumber = ?"
                const paramsForChannelsSearch = [req.body.campaignid, req.body.twilionumber]

                var channelidToInsertMsg: any;

                await cassandraclient.execute(queryForChannelsSearch, paramsForChannelsSearch, { prepare: true })
                .then(async (resultFromChannelSearch) => {
                    console.log("searched for channels")
                    if (resultFromChannelSearch.rows.length === 0) {
                    //create the channel
                    const createNewChannelQuery = "INSERT INTO texter.channels (channelid, campaignid, twilionumber, targeteverresponded) VALUES (?, ?, ?, ?)"
                        const createNewChannelParams = [currentSnowflake, req.body.campaignid, req.body.twilionumber, false]
                        channelidToInsertMsg =currentSnowflake;
                        await cassandraclient.execute(createNewChannelQuery, createNewChannelParams, { prepare: true })
                            .then((resultOfNewChannel) => {
                                cassandraclient.execute("UPDATE texter.channelcount SET channelcount = channelcount + 1 WHERE campaignid = ?;", [req.body.campaignid], { prepare: true })
                                .catch(async (stupidchannelerror) => {logger.error(stupidchannelerror)})
                            })
                            .catch((error) => {
                                console.log(error)
                                logger.error({ type: "cassandraerror" }, error)
                            })
                    } else {
                        channelidToInsertMsg = resultFromChannelSearch.rows[0].channelid
                }
                })
                  //end create the channels

                    var headers: any = { 'content-type': 'application/x-www-form-urlencoded' }
                    const regexValidSid = new RegExp('^[a-zA-Z0-9]+$');

                    if (regexValidSid.test(campaignresult.accountsid)) {
                      var b64Auth = Buffer.from(campaignresult.accountsid + ':' + campaignresult.authtoken).toString('base64');
                      headers.Authorization = 'Basic ' + b64Auth;

                      //POST https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json

                      const data = {
                        'From': campaignresult.messagingservicesid,
                        'To': req.body.twilionumber,
                        'Body': req.body.bodyofmessage
                      };

                      var urlSendMsgTwilio = `https://api.twilio.com/2010-04-01/Accounts/${campaignresult.accountsid}/Messages.json`
                      
                      const options:any = {
                        method: 'POST',
                        headers: headers,
                        data: qs.stringify(data),
                        url: urlSendMsgTwilio,
                      };

                      axios(options)
                        .then(async (response: any) => {
                          //msidtosnowflake[response.data.sid] = currentSnowflake;
                         // setMsid2Snowflake(response.data.sid,currentSnowflake)

                          console.log(response);
                          
                          myCache.set( response.data.sid, currentSnowflake, 10000 );

                          cassandraclient.execute("INSERT INTO texter.messagesid (messagesid, snowflake) VALUES (?, ?)", [response.data.sid, currentSnowflake], {prepare: true})
                            .then((resultofsid) => {
                            
                            }).catch((error) => {
                              console.log(error);
                              logger.error({type:'cassandramsidcacheerror', error: error})
                            })

      
                        try { logger.info({ type: 'instantresponsetwilio', responsedata: response.data }) }
                        catch (error) {console.log(error)}

                        ///// INSERT TWILIO MSG INTO CASSANDRA

                        const queryInsertion = 'INSERT INTO texter.messages'
                    + ' (snowflake, timeonnetwork, inbound, outbound, idempotence, bucket, ' +
                    'campaignid, channelid, twilionumber, messagesid, fromtwilio, totwilio, campaignvolunteeruidsender, body, messagestatus,' +
                    'isautomated, blastid, history, mediaurl, mediatype)' +
                    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                    
                    var actualTimestamp = currentSnowflake.getDate().getTime();

                    console.log('actualTimestamp', actualTimestamp)
                    
                    var channelTimestamp = channelidToInsertMsg.getDate().getTime()    
                        
                    var bucket = bucketCalc(actualTimestamp, channelTimestamp)

                    var mediaurl = []
                    var mediatype = []

                    var totalCountOfMedia = req.body.num_media

                    var hasMediaState;

                    if (totalCountOfMedia > 0) {
                        hasMediaState = true;
                    } else {
                        hasMediaState = false;
                    }

                    var insertionsOfMediaCompleted = 0;
                    //convert twilio's stupid schema into cassandra compatible 2 lists
                    while (insertionsOfMediaCompleted < totalCountOfMedia) {
                        mediaurl.push(req.body[`MediaUrl${insertionsOfMediaCompleted}`])
                        mediatype.push(req.body[`MediaContentType${insertionsOfMediaCompleted}`])
                        insertionsOfMediaCompleted = insertionsOfMediaCompleted + 1;
                    }

                        var objectOfHistory = {
                          
                        }

                        objectOfHistory[response.data.status] = Long.fromNumber(actualTimestamp) 
                        
                    const paramsInsertion = [
                      currentSnowflake,
                    Long.fromNumber(actualTimestamp),
                    false,
                    true,
                    idempotence,
                    bucket,
                    req.body.campaignid,
                    channelidToInsertMsg,
                    req.body.twilionumber,
                    response.data.sid,
                    response.data.from,
                    response.data.to,
                    "outbound",
                    response.data.body,
                    response.data.status,
                    false,
                    null,
                    objectOfHistory,
                    mediaurl,
                    mediatype
                    ]
                    
                    logger.info({ "type": 'outgoingmsgparamsinsert', params: paramsInsertion})
                
                    await cassandraclient.execute(queryInsertion, paramsInsertion, { prepare: true }).then((resultOfMessageInsert) => {
                        logger.info({ type: "resultofmessageinsert", cassandra: resultOfMessageInsert })
                      console.log(resultOfMessageInsert)
                      console.log('sending it back to client')

                      cassandraclient.execute("SELECT * FROM texter.messages WHERE channelid = ? AND bucket = ? and snowflake = ?", [channelidToInsertMsg, bucket, currentSnowflake], {prepare: true}).then((
                         resultOfMessageCheck
                  ) => {
                        console.log(resultOfMessageCheck)
                        console.log(resultOfMessageCheck.rows)
                       })

                      res.end({ "success": true })
                    }).catch((error) => {
                        logger.info({ type: "errormessageinsert", error })
                        console.log(error)
                        res.status(500).send("oops")
                    })
                        //EXIT TWILIO MSG


                      })
                      .catch(function (error) {
                        console.log(error);
                        logger.info({ type: 'instantresponsetwilioerror', error: error })
                        res.send('ooops, twilio crashed')
                      });
                    } else {
                     
                  return res.type('text/plain')
                .status(500)
                .send('Invalid Twilio SID');
                    }

                  


              
                }

              
  
          }).catch(res.status(500).send('Query for Campaign failed'))
  
          
         
          } else {
            return res.type('text/plain')
            .status(401)
            .send('Invalid, membership nonexistant');
          }
  
        }).catch((error) => {
        //res.redirect("/login");
        console.log(error)
        return res.type('text/plain')
          .status(500)
          .send('Query for Membership failed');
      });

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
  withCacheVerifyIdToken(req.body.firebaseToken)
      .then(async (decodedIdToken) => {
     //   console.log(decodedIdToken)
        // look up memberships

        var userEmail = decodedIdToken.email;

        const queryForInvites = 'SELECT * FROM texter.invitations WHERE email = ?'
        const paramsForInvites = [userEmail]

        await cassandraclient.execute(queryForInvites, paramsForInvites, { params: true })
          .then(async (resultsOfInvites) => {

            await resultsOfInvites.rows.forEach(async (eachInviteRow) => {
              await cassandraclient.execute("INSERT INTO texter.memberships (campaignid, userid, joinedtime, isowner, isadmin, isvolunteer) VALUES (?, ?, ?, ?, ?, ?) IF NOT EXISTS; ",
                [
                  eachInviteRow.campaignid,
                  decodedIdToken.uid,
                  TimeUuid.now(),
                  false,
                  eachInviteRow.isadmin,
                  true
                ], { prepare: true })
                .then(async (resultOfMembershipInsert) => {
                  await cassandraclient.execute("DELETE FROM texter.invitations WHERE campaignid = ? AND email = ?", [eachInviteRow.campaignid, eachInviteRow.email], { prepare: true })
                    .then((resultOfInvitationRemovalAfter) => {
                    console.log('invitations deleted afterwards')
                  }).catch((error) => {console.log(error)})
                })
              .catch(error => {console.log(error)})

              
            })

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
       // console.log(decodedIdToken)
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