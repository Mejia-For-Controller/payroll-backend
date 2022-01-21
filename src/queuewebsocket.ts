import tracer from './tracer';
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { cassandraclient } from './cassandra'
import qs from 'qs';
import _ from 'lodash';
import axios from 'axios'

import { cacheOfSecureTokens, uploadUserDetailsFromDecodedIdToken, withCacheVerifyIdToken } from './cacheIdTokens'
import { recountunreadmessages } from './recountListUnreadMessages'
import { AllTimePayload } from "twilio/lib/rest/api/v2010/account/usage/record/allTime";
import { logger } from "./logger";

import {generateIdempotency} from './idempotency'
import { bucketCalc } from './utils';
var forEach = require("for-each")


var r = require('rethinkdbdash')({
    db: 'texterpresence',
    cursor: true
});
const TimeUuid = require('cassandra-driver').types.TimeUuid;
const app = express();
const httpServer = createServer(app);

const Long = require('cassandra-driver').types.Long;
const io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});

// looks like /campaign/mejiaforcontroller
const queuecampaignws = io.of(/^\/queuecampaignws\/\w+$/).use(async (socket, next) => {
    // const user = await fetchUser(socket.handshake.query);

    // console.log(socket.handshake.auth.firebasetoken)

    console.log(socket.handshake.query)


    //fetch cassandra database for the user id
    //socket.handshake.query.uid

    // is the user a volunteer

    // if so, next
    console.log('token', socket.handshake.query.token)

    await withCacheVerifyIdToken(socket.handshake.query.token)
        .then(async (decodedIdToken) => {
            const queryformycampaigns = 'SELECT * FROM texter.memberships WHERE userid = ? AND campaignid = ?'
            const paramsformycampaigns = [decodedIdToken.uid, socket.handshake.query.campaignid]

            await cassandraclient.execute(queryformycampaigns, paramsformycampaigns)
                .then(async (membershipsforuid) => {
                    if (membershipsforuid.rows.length > 0) {
                        next()
                    } else {
                        next(new Error('forbidden no membership found'))
                    }
                })
        })
        .catch((error) => {
            console.error(error)
            // next(new Error('forbidden, error'))
            next()
        })

    // else throw error
    //if (user.isAdmin) {
    //socket.user = user;
    //next();
    //} else {
    // next(new Error('forbidden'));
    //}
});

queuecampaignws.on('connection', async (socket) => {

    var uid;

    await withCacheVerifyIdToken(socket.handshake.query.token)
    .then(async (decodedIdToken) => {
        uid = decodedIdToken;
    });
    const sendOutQueues = async () => {
        //select for all queues...
        // for each, do SELECT COUNT(*) in phone queuelist with SENT = TRUE

        cassandraclient.execute('SELECT * FROM texter.queue WHERE campaignid = ?',
            [socket.handshake.query.campaignid]
        )
            .then((resultsOfAllQueues) => {
                var dupResultsOfAllQueues = resultsOfAllQueues.rows;

                var numberOfSentAlready = dupResultsOfAllQueues.map((eachQueue) => cassandraclient.execute("SELECT COUNT(*) FROM texter.phonenumberqueuelist WHERE queueid =? AND sent = ? ALLOW FILTERING",
                    [
                        eachQueue.queueid, true
                    ]));

                Promise.all(numberOfSentAlready)
                    .then((resultsOfSentCount: any) => {
                        var totalArrayOfRows: Array<any> = [];

                        resultsOfSentCount.forEach((eachItem, itemindex) => {
                            var itemToPush = dupResultsOfAllQueues[itemindex]

                            itemToPush['sentcount'] = eachItem.rows[0].count.low;
                            itemToPush['timestamp'] = itemToPush.queueid.getDate().getTime();

                            totalArrayOfRows.push(itemToPush);
                        })

                        socket.emit("queuesinfo", {
                            queuearray: totalArrayOfRows
                        })
                    })
                    .catch((error) => {
                        logger.error(error);
                        console.error(error)
                    })
            })

        // put into array and send
        console.log('requested queues')
    }

    sendOutQueues()

    socket.on('getListOfQueues', async (data) => {
        sendOutQueues()
    })

    socket.on('sendone', async (data) => {
        //get queue id
        var currentSnowflake = TimeUuid.now()

        // SELECT * FROM queues where queueid = data.queueid

        cassandraclient.execute('SELECT * FROM texter.queue WHERE queueid = ?', [data.queueid])
            .then((resultsOfQueue: any) => {
                if (resultsOfQueue.rows.length > 0) {
                    var queueToUse = resultsOfQueue.rows[0]

                    //SELECT * FROM queuephonelist where queueid = data.queueid AND sent = false Limit 50  allow filtering ;
                    cassandraclient.execute('SELECT * FROM texter.phonenumberqueuelist WHERE queueid = ? AND sent = ? LIMIT 50 ALLOW FILTERING',
                        [
                            data.queueid,
                            false
                        ],
                        {
                            prepare: true
                        })
                        .then(async (resultsofphonenumbers) => {
                            if (resultsofphonenumbers.rows.length > 0) {
                                // pick random
                                var pickedRow = _.sample(resultsofphonenumbers.rows);

                                //check if channels, set up channels, message content, etc
                                var channelidToInsertMsg: any;
                                var campaignid = socket.handshake.query.campaignid

                                const queryForChannelsSearch = "SELECT * FROM texter.channels WHERE campaignid = ? AND twilionumber = ?"
                                const paramsForChannelsSearch = [campaignid, pickedRow.twilionumber]

                                await cassandraclient.execute(queryForChannelsSearch, paramsForChannelsSearch, { prepare: true })
                                    .then(async (resultFromChannelSearch) => {
                                        console.log("searched for channels")
                                        if (resultFromChannelSearch.rows.length === 0) {
                                            //create the channel
                                            const createNewChannelQuery = "INSERT INTO texter.channels (channelid, campaignid, twilionumber, targeteverresponded) VALUES (?, ?, ?, ?) IF NOT EXISTS"
                                            const createNewChannelParams = [
                                                currentSnowflake,
                                                campaignid, 
                                                pickedRow.twilionumber,
                                                false
                                            ]
                                            channelidToInsertMsg = currentSnowflake;
                                            await cassandraclient.execute(createNewChannelQuery, createNewChannelParams, { prepare: true })
                                                .then((resultOfNewChannel) => {
                                                    cassandraclient.execute("UPDATE texter.channelcount SET channelcount = channelcount + 1 WHERE campaignid = ?;", [campaignid], { prepare: true })
                                                        .catch(async (stupidchannelerror) => { logger.error(stupidchannelerror) })
                                                })
                                                .catch((error) => {
                                                    console.log(error)
                                                    logger.error({ type: "cassandraerror" }, error)
                                                })
                                        } else {
                                            channelidToInsertMsg = resultFromChannelSearch.rows[0].channelid
                                        }
                                    });

                                //insert that it has been sent
                                    await cassandraclient.execute("UPDATE texter.phonenumberqueuelist SET sent = ? , clientidempotency = ? WHERE queueid = ? AND twilionumber = ?",
                                    [true,
                                    data.idem,
                                        data.queueid,
                                        pickedRow.twilionumber
                                ]
                                    , {prepare: true})
                                    .then((finishedsetqueuetrue:any) => {
                                        //generate required string
                                        var stringToSendOut = resultsOfQueue.rows[0].smscontent.replace(/:name:/ig, pickedRow.firstname);
                                        
                                        //send to twilio
                                        var headers: any = { 'content-type': 'application/x-www-form-urlencoded' }
                                        const regexValidSid = new RegExp('^[a-zA-Z0-9]+$');
                      
                                        cassandraclient.execute("SELECT * FROM texter.campaigns WHERE campaignid = ?", [campaignid], {prepare: true})
                                        .then((campaignsraw:any) => {
                                            if (campaignsraw.rows.length > 0) {
                                                var campaignresult = campaignsraw.rows[0];
                                            if (regexValidSid.test(campaignresult.accountsid)) {
                                                var b64Auth = Buffer.from(campaignresult.accountsid + ':' + campaignresult.authtoken).toString('base64');
                                                headers.Authorization = 'Basic ' + b64Auth;

                                                  //POST https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json

                                                var data:any = {
                                                    'From': campaignresult.messagingservicesid,
                                                    'To': pickedRow.twilionumber,
                                                    'Body': stringToSendOut
                                                };
                            
                                                if (resultsOfQueue.rows[0].mediastring.length > 0) {
                                                    data["MediaUrl"] = resultsOfQueue.rows[0].mediastring;
                                                }

                                                
                                                var urlSendMsgTwilio = `https://api.twilio.com/2010-04-01/Accounts/${campaignresult.accountsid}/Messages.json`
                    
                    const options:any = {
                        method: 'POST',
                        headers: headers,
                        data: qs.stringify(data),
                        url: urlSendMsgTwilio,
                      };
  
                      var currentSnowflakeForMsgId = TimeUuid.now();

                      axios(options)
                      .then(async (response: any) => {
                        cassandraclient.execute("INSERT INTO texter.messagesid (messagesid, snowflake) VALUES (?, ?)", 
                        [response.data.sid, currentSnowflakeForMsgId], {prepare: true})
                        .then((resultofsid) => {
                        
                        }).catch((error) => {
                          console.log(error);
                          logger.error({type:'cassandramsidcacheerror', error: error})
                        })

                        //insert msg
                        const queryInsertion = 'INSERT INTO texter.messages'
                        + ' (snowflake, timeonnetwork, inbound, outbound, idempotence, bucket, ' +
                        'campaignid, channelid, twilionumber, messagesid, fromtwilio, totwilio, campaignvolunteeruidsender, body, messagestatus,' +
                        'isautomated, blastid, history, mediaurl, mediatype)' +
                        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                        
                        var actualTimestamp = currentSnowflakeForMsgId.getDate().getTime();
      
                        console.log('actualTimestamp', actualTimestamp)
                        
                        var channelTimestamp = channelidToInsertMsg.getDate().getTime()    
                            
                        var bucket = bucketCalc(actualTimestamp, channelTimestamp)
      
                        var mediaurl = []
                        var mediatype = []
      
                     //   var totalCountOfMedia = req.body.num_media
      
                        var hasMediaState = false;
      
                        if (resultsOfQueue.rows[0].mediastring.length > 0) {
                            hasMediaState = true;
                            mediaurl.push(queueToUse.mediastring)
                            mediatype.push(queueToUse.mediamime)
                        }

                        var objectOfHistory = {
                        
                        }
  
                        objectOfHistory[response.data.status] = Long.fromNumber(actualTimestamp) 
      
                       

                        const paramsInsertion = [
                            currentSnowflakeForMsgId,
                          Long.fromNumber(actualTimestamp),
                          false,
                          true,
                          generateIdempotency(),
                          bucket,
                          campaignid,
                          channelidToInsertMsg,
                         pickedRow.twilionumber,
                          response.data.sid,
                          response.data.from,
                          response.data.to,
                          uid,
                          response.data.body,
                          response.data.status,
                          true,
                          queueToUse.queueid,
                          objectOfHistory,
                          mediaurl,
                          mediatype
                          ]

                          await cassandraclient.execute(queryInsertion, paramsInsertion, { prepare: true }).then((resultOfMessageInsert) => {
                            logger.info({ type: "resultofmessageinsert", cassandra: resultOfMessageInsert })
                          console.log(resultOfMessageInsert)
                          console.log('sending it back to client')
      
                        //THIS IS TEMP!!! REMOVE AND REPLACE WITH SEND ONLY NEW COUNTS!!!
                        sendOutQueues()
      
                        }).catch((error) => {
                            logger.info({ type: "errormessageinsert", error })
                            console.log(error)
      //                      res.status(500).send("oops")
                        })




                        //end insert msg
                      }
                      );                    
  
                                            }
                                            }
                                            
                                        })

                                      

                                        // add to msid conversion table

                                        //add to message database

                                        
                                    })
                                    .catch((error) => {
                                        logger.error(error);
                                        console.error(error)
                                    })
                                    
                                 


                                // send using replacement body and media
                                console.log('sendone')

                                //emit back the number of stuff in queue
                            }
                        })


                }
            })

    })
})

//rethink io .changes()
//emit to sockets in campaign room with table

function filterOutUnwantedKeyUid(obj, uid) {
    Object.fromEntries(
        Object.entries(obj).filter(([key, value]) => key != uid)
    )
}



httpServer.listen(5024, () => {
    console.log(`listening on *:5024`);
});