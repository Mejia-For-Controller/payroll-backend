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


var twilioFormat = function (req, res, next) {
    if (!req.header('X-Twilio-Signature')) {
        return res.type('text/plain')
          .status(400)
          .send('No signature header error - X-Twilio-Signature header does not exist, maybe this request is not coming from Twilio.');
    }
    console.log("middleware didn't stop x-twilio-sig, move to regular flow")
    next()
}

twiliorouter.post('/voice', [twilioFormat], (req, res) => {
    // Twilio Voice URL - receives incoming calls from Twilio
    const response = new twilio.twiml.VoiceResponse();
  
    response.say(
      `Thanks for calling Mejia For Controller! Our volunteers are currently busy and will return your call shortly. Goodbye!`
    );
  
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
                        'campaignid, channelid, twilionumber, messagesid, fromtwilio, totwilio, campaignvolunteeruidsender, body, messagestatus)' +
                    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                    
                    var actualTimestamp = snowflake.getDate().getTime();

                    console.log('actualTimestamp', actualTimestamp)
                    
                    var channelTimestamp = channelidToInsertMsg.getDate().getTime()

                    var bucket = bucketCalc(actualTimestamp, channelTimestamp)

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
                    req.body.SmsStatus
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

twiliorouter.all('/statuscallback/:campaignid', [twilioFormat], function(req, res, next) {
    console.log(req.body)

   //do a lookup of the campaign, see if it exists, and validate the accound sid and twilio origin

        // if it exists, update the status of that specific message
        res.send("Success")
});