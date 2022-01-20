import express from 'express';
import cors from 'cors'
import { cassandraclient } from './cassandra';
import {cacheOfSecureTokens,uploadUserDetailsFromDecodedIdToken,withCacheVerifyIdToken} from './cacheIdTokens';
import qs from 'qs';
import {logger} from './logger'
import axios from 'axios'
import { myCache } from './cache';
import {generateIdempotency} from './idempotency'
import { bucketCalc } from './utils';
const TimeUuid = require('cassandra-driver').types.TimeUuid;
const Long = require('cassandra-driver').types.Long;


export async function sendBlast (req,res) {
    const blastid = TimeUuid.now()
  withCacheVerifyIdToken(req.body.firebasetoken)
  .then(async (decodedIdToken) => {
    const queryformycampaigns = 'SELECT * FROM texter.memberships WHERE userid = ? AND campaignid = ?'
    const paramsformycampaigns = [decodedIdToken.uid,  req.body.campaignid]

    cassandraclient.execute(queryformycampaigns,paramsformycampaigns, {prepare: true})
    .then(async (membershipresult:any) => {
      if (membershipresult.rows.length > 0) {

        await cassandraclient.execute("SELECT * FROM texter.campaigns WHERE campaignid = ?", [req.body.campaignid], {prepare: true})
        .then(async (campaignquerysettings) => {
        
          if (campaignquerysettings.rows.length > 0) {
            
            var campaignresult = campaignquerysettings.rows[0]
               //then do it
        cassandraclient.execute('SELECT * FROM texter.listindex WHERE campaignid = ? AND listid = ?',
        [req.body.campaignid,
        TimeUuid.fromString(req.body.listid)]
        )
        .then(async (listindexresult) => {
          if (listindexresult.rows.length > 0) {
            console.log('list found')

            if (req.body.blastmediaurl) {
                //get content header
  
                var axiosheaderresult;
                
                await axios.get(req.body.blastmediaurl)
                .then((mediaurlresponse) => {
                  axiosheaderresult = mediaurlresponse.headers['content-type']
                  logger.info( axiosheaderresult, {type: 'axiosheaderresult'})
                })
                .catch((error) => {
                  logger.error(error, {type: "mediaurlerrorfailed"})
                })
              }

            if (req.body.typeoftext === 'queue') {
                cassandraclient.execute("INSERT INTO texter.queue (campaignid, queueid, smscontent, mediastring, mediamime, sentbyuid, listname, listid) VALUES (?,?,?,?,?,?,?,?)",
                [
                  req.body.campaignid, 
                  blastid,
                  req.body.blasttext,
                  req.body.blastmediaurl,
                  axiosheaderresult,
                  decodedIdToken.uid,
                  listindexresult.rows[0].name,
                  listindexresult.rows[0].listid
                ])
                .catch((errorMakeQueue) => {
                    logger.error(errorMakeQueue)
                    console.error(errorMakeQueue)
                })

//get all the numbers in the list                
            cassandraclient.execute("SELECT * FROM texter.phonenumberslist WHERE listid = ?", [req.body.listid])
            .then(async (listnumberresults) => {
              listnumberresults.rows.forEach(async (eachPhoneNumberRow:any) => {
                  // put it into the queue checkbox list
                  cassandraclient.execute("INSERT INTO phonenumberqueuelist (queueid, twilionumber, sent, firstname, clientidempotency, senttime) VALUES (?,?,?,?,?,?)", 
                  [
                      blastid,
                      eachPhoneNumberRow.phonenumber,
                      false,
                      eachPhoneNumberRow.firstname,
                      null,
                      null
                  ])
                  .then((resultOfQueueRow) => {

                  })
                  .catch((errorOfQueueRow) => {
                    logger.error(errorOfQueueRow)
                  })
              }
              )
            });


            //send it back to the frontend
            res.send({
                success: true,
                type: 'queue'
              })
            }

           if (req.body.typeoftext === 'blast') {
            cassandraclient.execute("INSERT INTO texter.blastindex (campaignid, blastid, senderuid, smscontent) VALUES (?,?,?,?)",
            [
              req.body.campaignid, 
              blastid,
              decodedIdToken.uid,
              req.body.blasttext
            ])


            cassandraclient.execute("SELECT * FROM texter.phonenumberslist WHERE listid = ?", [req.body.listid])
            .then(async (listnumberresults) => {
              listnumberresults.rows.forEach(async (eachPhoneNumberRow:any) => {
                var textmsgtosend = req.body.blasttext.replace(/:name:/ig, eachPhoneNumberRow.firstname)

                console.log(textmsgtosend)
                
              
                const paramsForChannelsSearch = [req.body.campaignid, eachPhoneNumberRow.phonenumber]

                var channelidToInsertMsg: any;

                const queryForChannelsSearch = "SELECT * FROM texter.channels WHERE campaignid = ? AND twilionumber = ?";
                await cassandraclient.execute(queryForChannelsSearch, paramsForChannelsSearch, { prepare: true })
                .then(async (resultFromChannelSearch) => {
                    console.log("searched for channels")
                    if (resultFromChannelSearch.rows.length === 0) {
                    //create the channel
                    var currentSnowflake = TimeUuid.now()

                    const createNewChannelQuery = "INSERT INTO texter.channels (channelid, campaignid, twilionumber, targeteverresponded) VALUES (?, ?, ?, ?)"
                        const createNewChannelParams = [currentSnowflake, req.body.campaignid, eachPhoneNumberRow.phonenumber , false]
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

                  //send to twilio

                

                  var headers: any = { 'content-type': 'application/x-www-form-urlencoded' }
                  const regexValidSid = new RegExp('^[a-zA-Z0-9]+$');

                  if (regexValidSid.test(campaignresult.accountsid)) {
                    var b64Auth = Buffer.from(campaignresult.accountsid + ':' + campaignresult.authtoken).toString('base64');
                    headers.Authorization = 'Basic ' + b64Auth;

                    //POST https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json

                    var data:any = {
                      'From': campaignresult.messagingservicesid,
                      'To': eachPhoneNumberRow.phonenumber,
                      'Body': textmsgtosend
                    };

                    if (req.body.blastmediaurl.length > 0) {
                      data["MediaUrl"] = req.body.blastmediaurl;
                    }

                    var urlSendMsgTwilio = `https://api.twilio.com/2010-04-01/Accounts/${campaignresult.accountsid}/Messages.json`
                    
                    const options:any = {
                      method: 'POST',
                      headers: headers,
                      data: qs.stringify(data),
                      url: urlSendMsgTwilio,
                    };

                    var currentSnowflakeForMsgId = TimeUuid.now()

                    axios(options)
                      .then(async (response: any) => {
                        //msidtosnowflake[response.data.sid] = currentSnowflake;
                       // setMsid2Snowflake(response.data.sid,currentSnowflake)

                        console.log(response);
                        
                  
                        myCache.set( response.data.sid, currentSnowflakeForMsgId, 10000 );

                        cassandraclient.execute("INSERT INTO texter.messagesid (messagesid, snowflake) VALUES (?, ?)", [response.data.sid, currentSnowflakeForMsgId], {prepare: true})
                          .then((resultofsid) => {
                          
                          }).catch((error) => {
                            console.log(error);
                            logger.error({type:'cassandramsidcacheerror', error: error})
                          })

    
                     try { logger.info({ type: 'instantresponsetwilioblast', responsedata: response.data }) }
                      catch (error) {console.log(error)}

                      ///// INSERT TWILIO MSG INTO CASSANDRA

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

                  var totalCountOfMedia = req.body.num_media

                  var hasMediaState;

                  if (totalCountOfMedia > 0) {
                      hasMediaState = true;
                  } else {
                      hasMediaState = false;
                  }

                  var insertionsOfMediaCompleted = 0;
                  //convert twilio's stupid schema into cassandra compatible 2 lists

                  if (req.body.blastmediaurl) {
                    mediaurl.push(req.body.blastmediaurl)
                    mediatype.push(axiosheaderresult)
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
                  req.body.campaignid,
                  channelidToInsertMsg,
                  eachPhoneNumberRow.phonenumber,
                  response.data.sid,
                  response.data.from,
                  response.data.to,
                  decodedIdToken.uid,
                  response.data.body,
                  response.data.status,
                  true,
                  blastid,
                  objectOfHistory,
                  mediaurl,
                  mediatype
                  ]
                  
                  logger.info({ "type": 'outgoingmsgparamsinsert', params: paramsInsertion})
              
                  await cassandraclient.execute(queryInsertion, paramsInsertion, { prepare: true }).then((resultOfMessageInsert) => {
                      logger.info({ type: "resultofmessageinsert", cassandra: resultOfMessageInsert })
                    console.log(resultOfMessageInsert)
                    console.log('sending it back to client')

                    cassandraclient.execute("SELECT * FROM texter.messages WHERE channelid = ? AND bucket = ? and snowflake = ?", [channelidToInsertMsg, bucket, currentSnowflakeForMsgId], {prepare: true}).then((
                       resultOfMessageCheck
                ) => {
                      console.log(resultOfMessageCheck)
                      console.log(resultOfMessageCheck.rows)
                     })

                  }).catch((error) => {
                      logger.info({ type: "errormessageinsert", error })
                      console.log(error)
//                      res.status(500).send("oops")
                  })
                      //EXIT TWILIO MSG


                    })
                    .catch(function (error) {
                      console.log(error);
                      logger.info({ type: 'instantresponsetwilioerror', error: error })
//                      res.send('ooops, twilio crashed')
                    });
                  }


                  //save to our system

              })

              res.send({
                success: true
              })
            })

           }
           
          }
        })
        .catch((error) => {
          console.error(error)
        })
          }
        })

     
      }
    });
  })
}