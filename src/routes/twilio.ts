import express from 'express'
import { cassandraclient } from '../cassandra';
import twilio from 'twilio'
const TimeUuid = require('cassandra-driver').types.TimeUuid;
import tracer from '../tracer';
import { urlencoded } from 'body-parser';
const { config } = require('./../../config.json');
import { logger } from '../logger'
import {generateIdempotency} from './../idempotency'
export let twiliorouter = express.Router();
const Long = require('cassandra-driver').types.Long;
import { bucketCalc } from '../utils'
import { myCache } from './../cache';

import {recountunreadmessages} from '../recountListUnreadMessages'

var twilioFormat = function (req, res, next) {
    if (!req.header('X-Twilio-Signature')) {
        return res.type('text/plain')
          .status(400)
          .send('No signature header error - X-Twilio-Signature header does not exist, maybe this request is not coming from Twilio.');
    }
    console.log("middleware didn't stop x-twilio-sig, move to regular flow")
    next()
}

twiliorouter.post('/voice', [twilioFormat, urlencoded({ extended: false })], (req, res) => {
    // Twilio Voice URL - receives incoming calls from Twilio
    const response = new twilio.twiml.VoiceResponse();
  
   // response.say(
  //    `Thanks for calling Mejia For Controller! Our volunteers are currently busy. Please visit Mejia for controller dot com for more information or email kenneth @ mejia for controller dot com. Thank you and goodbye!`
   // );

    response.play({
        loop: 1
    }, 'https://mejiaforcontroller.com/wp-content/gallery/mejia-speech.mp3');
  
    res.set('Content-Type', 'text/xml');
    res.send(response.toString());
});

twiliorouter.all('/incomingmsg/:campaignid', [twilioFormat, urlencoded({ extended: false })], function (req, res, next) {
    var snowflake = TimeUuid.now();
    var idemp = generateIdempotency();
    console.log(req)
    tracer.trace('incomingmsg', async () => {
    console.log(req.body)
    //do a lookup of the campaign, see if it exists, and validate the accound sid and twilio origin
    await cassandraclient.execute("SELECT * FROM texter.campaigns WHERE campaignid = ?", [req.params.campaignid]).then(async (result) => {
              // if it exists, add the text message to the text database
        if (result.rows.length > 0) {
            // Your Auth Token from twilio.com/console
        const authToken = result.rows[0].authtoken;

        // The Twilio request URL
        const url = `https://api.text.mejiaforcontroller.com/twilio/incomingmsg/${req.params.campaignid}`;

        // The post variables in Twilio's request
        const params = req.body
          
            
// The X-Twilio-Signature header attached to the request
            const twilioSignature = req.header('X-Twilio-Signature');
            console.log('twilioSignature',twilioSignature)
            
            logger.info({
                "type": "ingestmessage",
                "params": req.body,
                "authToken": authToken,
                "twilioSignature": twilioSignature,
                "url": url,
                "paramsToVerify": params
                
            })
       
         
            console.log('validate response')
            var resultOfValidation = await twilio.validateRequest(authToken, twilioSignature, url, params);
            console.log(resultOfValidation)
            console.log("result of validation",typeof(resultOfValidation))
            console.log('validate done')


            if (resultOfValidation === true) {
                console.log("for valid requests only")
                console.log(req.body.AccountSid)
                console.log(result.rows[0].accountsid)
                if (req.body.AccountSid == result.rows[0].accountsid) {
                    console.log(`accountsid matching`)

                const queryForChannelsSearch = "SELECT * FROM texter.channels WHERE campaignid = ? AND twilionumber = ?"
                const paramsForChannelsSearch = [req.params.campaignid, req.body.From]
                
                var channelidToInsertMsg: any;
                    
                await cassandraclient.execute(queryForChannelsSearch, paramsForChannelsSearch, { prepare: true })
                    .then(async (resultFromChannelSearch) => {
                        console.log("searched for channels")
                        if (resultFromChannelSearch.rows.length === 0) {
                        //create the channel
                        const createNewChannelQuery = "INSERT INTO texter.channels (channelid, campaignid, twilionumber, targeteverresponded) VALUES (?, ?, ?, ?)"
                            const createNewChannelParams = [snowflake, req.params.campaignid, req.body.From, true]
                            channelidToInsertMsg = TimeUuid.now();
                            await cassandraclient.execute(createNewChannelQuery, createNewChannelParams, { prepare: true })
                                .then((resultOfNewChannel) => {
                                    cassandraclient.execute("UPDATE texter.channelcount SET channelcount = channelcount + 1 WHERE campaignid = ?;", [req.params.campaignid], { prepare: true })
                                    .catch(async (stupidchannelerror) => {logger.error(stupidchannelerror)})
                                })
                                .catch((error) => {
                                    console.log(error)
                                    logger.error({ type: "cassandraerror" }, error)
                                })
                        } else {
                            //update the channel with the latest msg content
                            channelidToInsertMsg = resultFromChannelSearch.rows[0].channelid
                         const updateChannelQuery = "INSERT INTO texter.channels (channelid, campaignid, twilionumber, targeteverresponded) VALUES (?, ?, ?, ?)"
                            const updateChannelParams = [resultFromChannelSearch.rows[0].channelid,
                                resultFromChannelSearch.rows[0].campaignid,
                                resultFromChannelSearch.rows[0].twilionumber,
                                true]
                            await cassandraclient.execute(updateChannelQuery, updateChannelParams, { prepare: true }).then(resultOfChannelUpdate => {
                                console.log(resultOfChannelUpdate)
                                logger.info({type: 'channelUpdateInbound', result: resultOfChannelUpdate})
                            }).catch(
                                (error) => {
                                    console.log(error)
                                    logger.error({ type: "cassandraerror" }, error)}
                            )
                    }
                    })

                const queryInsertion = 'INSERT INTO texter.messages'
                    + ' (snowflake, timeonnetwork, inbound, outbound, idempotence, bucket, ' +
                    'campaignid, channelid, twilionumber, messagesid, fromtwilio, totwilio, campaignvolunteeruidsender, body, messagestatus,' +
                    'isautomated, blastid, history, mediaurl, mediatype)' +
                    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                    
                    var actualTimestamp = snowflake.getDate().getTime();

                    console.log('actualTimestamp', actualTimestamp)
                    
                    var channelTimestamp = channelidToInsertMsg.getDate().getTime()

                    var bucket = bucketCalc(actualTimestamp, channelTimestamp)

                    var mediaurl = []
                    var mediatype = []

                    var totalCountOfMedia = req.body.NumMedia

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

                    const paramsInsertion = [
                    snowflake,
                    Long.fromNumber(actualTimestamp),
                    true,
                    false,
                    idemp,
                    bucket,
                    req.params.campaignid,
                    channelidToInsertMsg,
                    req.body.From,
                    req.body.MessageSid,
                    req.body.From,
                    req.body.To,
                    "inbound",
                    req.body.Body,
                        req.body.SmsStatus,
                        false,
                        null,
                        { "recieved": Long.fromNumber(actualTimestamp) },
                        mediaurl,
                        mediatype
                    ]
                    
                    logger.info({ "type": 'incomingmsgparamsinsert', params: paramsInsertion})
                
                    await cassandraclient.execute(queryInsertion, paramsInsertion, { prepare: true }).then((resultOfMessageInsert) => {
                        logger.info({ type: "resultofmessageinsert", cassandra: resultOfMessageInsert })
                        console.log(resultOfMessageInsert)
                        res.send("success")
                    }).catch((error) => {
                        logger.info({ type: "errormessageinsert", error })
                        console.log(error)
                        res.status(500).send("oops")
                    })
                    
                    //update channel list of events
                    var queryToUpdateChannelEvents = 'INSERT INTO texter.channelevents (usereversent, campaignid, channelid, timestamp, twilionumber, fromtwilio, totwilio, campaignvolunteeruidassigned, body, type, hasmedia, read) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
                    var paramsToUpdateChannelEvents = [true, req.params.campaignid, channelidToInsertMsg, snowflake, req.body.From, req.body.From, req.body.To, null, req.body.Body,
                        "inbound", hasMediaState, false]
                    
                    cassandraclient.execute(queryToUpdateChannelEvents, paramsToUpdateChannelEvents, { prepare: true })
                        .then(async (resultChannelEventExecute) => {
                            logger.info({ type: "resultofchanneleventadd", result: resultChannelEventExecute })
                            
                        })
                        .catch(async (errorOfChannelUpdate) => {
                            console.log(errorOfChannelUpdate)
                            logger.error({ type: "errorofchanneleventadd", error: errorOfChannelUpdate })
                    })

                    
                   try {
                       //check if the phone number sent stop
                    if (req.body.Body.trim().toLowerCase() === 'stop') {
                        //opt out code
                        logger.info({type: "detectedoptout", body: req.body.Body, from: req.body.From, to: req.body.To
                    })
                    }
                   } catch (optoutdetectionerror) {
                       console.error(optoutdetectionerror)
                   }

                   var queryToAddUnreadMessage = "INSERT INTO texter.readmsgs (snowflake, campaignid, read, channelid, twilionumber, msid) VALUES (?, ?, ?, ?, ?, ?)"
                   var paramsToAddUnreadMessage = [snowflake, req.params.campaignid, false, channelidToInsertMsg, req.body.From, req.body.MessageSid]

                   cassandraclient.execute(queryToAddUnreadMessage, paramsToAddUnreadMessage, {prepare: true})
                   .then((resultReadEvent) => {
                    logger.info({ type: "resultofreadeventadd", result: resultReadEvent })
                   }).catch((errorOfReadEvent) => {
                    logger.error({ type: "errorofreadeventadd", error: errorOfReadEvent })
                   })

                   try {recountunreadmessages( req.params.campaignid)}
                   catch (unreadchannelserr) {
                       console.log(unreadchannelserr)
                   }
                } else {
                    console.log("invalid account sid")
                    res.status(404).send("This campaign doesn't exist!")

                }

            }
        } else {
            res.status(404).send("This campaign doesn't exist!")
    }
    }).catch((error) => {
          // if it exists, add the text message to the text database
    res.status(404).send("This campaign doesn't exist!")
    })
})
});

twiliorouter.all('/statuscallback/:campaignid', [twilioFormat, urlencoded({ extended: false })], function(req, res, next) {
    console.log(req.body)

   //do a lookup of the campaign, see if it exists, and validate the accound sid and twilio origin
    // if it exists, update the status of that specific message
  
    tracer.trace('statuscallback', async () => {
        var currentDate = Date.now()
        var snowflake = TimeUuid.now();
        var idemp = generateIdempotency();
     //   console.log(req)
       // console.log(req.body)
        //do a lookup of the campaign, see if it exists, and validate the accound sid and twilio origin
        await cassandraclient.execute("SELECT * FROM texter.campaigns WHERE campaignid = ?", [req.params.campaignid], { prepare: true }).then(async (result) => {
            // if it exists, add the text message to the text database
            if (result.rows.length > 0) {
                // Your Auth Token from twilio.com/console
                const authToken = result.rows[0].authtoken;

                // The Twilio request URL
                const url = `https://api.text.mejiaforcontroller.com/twilio/statuscallback/${req.params.campaignid}`;

                // The post variables in Twilio's request
                const params = req.body
          
            
                // The X-Twilio-Signature header attached to the request
                const twilioSignature = req.header('X-Twilio-Signature');
                console.log('twilioSignature', twilioSignature)
            
                logger.info({
                    "type": "statuscallbackparams",
                    "params": req.body,
                    "authToken": authToken,
                    "twilioSignature": twilioSignature,
                    "url": url,
                    "paramsToVerify": params
                
                })
       
         
                console.log('validate response')
                var resultOfValidation = await twilio.validateRequest(authToken, twilioSignature, url, params);
                console.log(resultOfValidation)
                console.log("result of validation", typeof (resultOfValidation))
                console.log('validate done')


                if (resultOfValidation === true)
                {

                    console.log('result of validation passed')

                    //this line is prob broken, fix it by moving this to cassandra
                    var snowflakeToSearch;

                    var valueOfCacheMsid = myCache.get( req.body.MessageSid );
                    if ( valueOfCacheMsid == undefined ){
                        // handle miss!
                        snowflakeToSearch = await cassandraclient.execute('SELECT * FROM texter.messagesid WHERE messagesid = ?', [req.body.MessageSid], { prepare: true })
                        .then((result) => result.rows[0].snowflake)
                    }
                    else {
                        snowflakeToSearch = valueOfCacheMsid
                    }

                    const queryForChannelsSearch = "SELECT * FROM texter.channels WHERE campaignid = ? AND twilionumber = ?"
                    const paramsForChannelsSearch = [req.params.campaignid, req.body.To]
                        
                    await cassandraclient.execute(queryForChannelsSearch, paramsForChannelsSearch, { prepare: true })
                        .then(async (resultOfChannelsSearch) => {
                            console.log('channel search result', resultOfChannelsSearch)

                            var channelidToInsertMsg = resultOfChannelsSearch.rows[0].channelid

                            const queryForSpecificMessage = 'SELECT * FROM texter.messages WHERE channelid = ? AND bucket = ? AND snowflake = ?'
                            const paramsForSpecificMessage = [
                                channelidToInsertMsg,
                                bucketCalc(snowflakeToSearch.getDate().getTime(), channelidToInsertMsg.getDate().getTime()),
                                snowflakeToSearch
                            ]

                           /* await cassandraclient.execute(queryForSpecificMessage, paramsForSpecificMessage)
                                .then((messageFromDatabase) => {
                                    
                                })
                                .catch((error) => {
                                    console.log(error)
                                    logger.error(error)
                            })*/

                            const queryForUpdatingSnowflake = "UPDATE texter.messages SET messagestatus = ?, history = history + ? WHERE channelid = ? AND bucket = ? and snowflake = ?"
                            const newHistory = {}
                            newHistory[req.body.MessageStatus] = currentDate
                            const paramsForUpdatingSnowflake = [req.body.MessageStatus,newHistory, channelidToInsertMsg,
                                bucketCalc(snowflakeToSearch.getDate().getTime(), channelidToInsertMsg.getDate().getTime()),
                                snowflakeToSearch]
                            
                            await cassandraclient.execute(queryForUpdatingSnowflake, paramsForUpdatingSnowflake, { prepare: true })
                                .catch(error => {
                                    console.log(error)
                                    logger.error({'type': 'updatemessagefromcallbackerror',error: error})
                                })
                            
                            var queryForNewMessageInfo = "SELECT * FROM texter.messages WHERE channelid = ? AND bucket = ? AND snowflake = ?"
                            var paramsForNewMessageInfo = [channelidToInsertMsg,
                                bucketCalc(snowflakeToSearch.getDate().getTime(), channelidToInsertMsg.getDate().getTime()),
                                snowflakeToSearch]
                            
                            cassandraclient.execute(queryForNewMessageInfo, paramsForNewMessageInfo, { prepare: true })
                                .then(async (resultOfSnowflakeSearch) => {
                                    if (resultOfSnowflakeSearch.rows.length > 0) {
                                        console.log('found snowflake back')
                                        var hasMediaState: boolean;

                                        if (resultOfSnowflakeSearch.rows[0].mediaurl) {
                                            hasMediaState = true;
                                        } else {
                                            hasMediaState = false;
                                        }
                                        //update channel list of events
                      var queryToUpdateChannelEvents = 'INSERT INTO texter.channelevents (usereversent, campaignid, channelid, timestamp, twilionumber, fromtwilio, totwilio, campaignvolunteeruidassigned, body, type, hasmedia, read) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
                      var paramsToUpdateChannelEvents = [true, req.params.campaignid, channelidToInsertMsg,snowflake, req.body.To, req.body.From, req.body.To, null, resultOfSnowflakeSearch.rows[0].body,
                          `outbound-${req.body.MessageStatus}`, hasMediaState, false]
                      
                      await cassandraclient.execute(queryToUpdateChannelEvents, paramsToUpdateChannelEvents, { prepare: true })
                          .then(async (resultChannelEventExecute) => {
                              logger.info({ type: "resultofchanneleventadd", result: resultChannelEventExecute })
                              res.send("Success")
                              
                          })
                          .catch(async (errorOfChannelUpdate) => {
                              console.log(errorOfChannelUpdate)
                              logger.error({ type: "errorofchanneleventadd", error: errorOfChannelUpdate })
                      })
                                    } else {
                                        res.send("Success")
                                }
                            })

                         
                    })
                    .catch((error) => {console.log(error)})
                     

                }
            }
        })
    })
});