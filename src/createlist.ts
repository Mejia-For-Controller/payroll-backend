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
import _ from 'lodash';
import helmet from 'helmet'
import {sendBlast} from './sendBlast'
import {recountunreadmessages} from './recountListUnreadMessages'
import { cassandraclient } from './cassandra'
import {logger} from './logger'
import axios from 'axios'
import qs from 'qs';
import { bucketCalc } from './utils';
import { myCache } from './cache';
import { deleteOldEventsForCampaign, deleteOldReadMessages } from './deleteOldChannelEvents';
import {uploadfiles} from './routes/uploadfiles';
import {cacheOfSecureTokens,uploadUserDetailsFromDecodedIdToken,withCacheVerifyIdToken} from './cacheIdTokens';
import * as Papa from 'papaparse';
import { forEachChild } from 'typescript';
import parsePhoneNumber from 'libphonenumber-js'
import {generateIdempotency} from './idempotency'
const Long = require('cassandra-driver').types.Long;
var rangeInclusive = require('range-inclusive')
var busboy = require('connect-busboy');
var http = require('http'),
    path = require('path'),
    os = require('os'),
    fs = require('fs');

var insertlistquery = "INSERT INTO texter.listindex (campaignid, listid, name, fileoriginid, rowcount) VALUES (?,?,?,?,?)"

var inserteachphonerow = "INSERT INTO texter.phonenumberslist (listid, phonenumber, firstname) VALUES (?,?,?)"

export async function createList(req,res) {
    
  var blastid = TimeUuid.now()

  withCacheVerifyIdToken(req.body.firebasetoken)
  .then(async (decodedIdToken) => {
    const queryformycampaigns = 'SELECT * FROM texter.memberships WHERE userid = ? AND campaignid = ?'
    const paramsformycampaigns = [decodedIdToken.uid,  req.body.campaignid]

    cassandraclient.execute(queryformycampaigns,paramsformycampaigns, {prepare: true})
    .then(async (membershipresult:any) => {
      if (membershipresult.rows.length > 0) {
        
          // generate list id
  var assignedListId = TimeUuid.now()

        // grab list name and phone
        var nameColumn = req.body.list.name.trim();
        console.log('namecolumn', {
          name: nameColumn
        })
        var phoneColumn = req.body.list.phone.trim();
        var fileid = req.body.fileid;
        var listnickname = req.body.listnickname

        var fileidtimeuuid = TimeUuid.fromString(fileid);

                             


        if (nameColumn && phoneColumn && fileid) {

          console.log('fileidtimeuuid', fileidtimeuuid)
            // file belongs to campaign id 
            
            cassandraclient.execute("SELECT * FROM texter.filesuploaded WHERE campaignid = ? AND genfilename = ?",
            [req.body.campaignid,fileidtimeuuid])
            .then((resultsoffilesuploaded) => {
              if (resultsoffilesuploaded.rows.length > 0) {
                 // load in fs file and papa parse it with header on 
                 fs.readFile( path.join(`${__dirname}/../filestorage/`, path.basename(req.body.fileid)), 'utf8' , async (err, data) => {
                  if (err) {
                    console.error(err)
                    return
                  } else {
                    console.log(data)
            
                    //remove blank lines
                    var cleanedupdata = data.replace(/^\s*$(?:\r\n?|\n)/gm,"").trim()
                    var paparesult = Papa.parse(cleanedupdata, {
                      header: true
                    })
            
                    console.log(paparesult)
                   // logger.info(paparesult, {type: 'paparesult'})
                          // for each row, send cassandra request
                    var queriesArrayForRows: Array<any> = []

                    paparesult.data.forEach((eachrow) => {
                      console.log(eachrow)
                      console.log('lookfor ', nameColumn)
                      console.log('result is', eachrow[nameColumn])
                      //use batch querying instead
                      queriesArrayForRows.push({
                          query: inserteachphonerow,
                          params: [
                            assignedListId,
                            parsePhoneNumber(eachrow[phoneColumn], 'US').getURI().replace(/tel:/g, ''),
                            eachrow[nameColumn]
                          ]
                      })
                      /*
                    await  cassandraclient.execute(inserteachphonerow,
                      [
                        assignedListId,
                        parsePhoneNumber(eachrow[phoneColumn], 'US').getURI().replace(/tel:/g, ''),
                        eachrow[nameColumn]
                      ])
                      .then()
                      .catch((error) => {
                        logger.error(error, {type: "cassandraerrorcreaterowsinlist"})
                      })*/
                    })

                    //seperate batch into groups of 69, then send them out
                    const chunks = _.chunk(queriesArrayForRows, 69);

                    //map chunks into queries
                    var chunkedQueries = chunks.map((eachChunk) => cassandraclient.batch(eachChunk, { prepare: true })
                    .then(function() {
                      // All queries have been executed successfully
                    })
                    .catch(function(err) {
                      // None of the changes have been applied
                    }));

                    //EXECUTE ALL CHUNKS SIMULTANIOUSLYYY!!!!

                    // in the future, seperate them out by groups of 100 chunks at a time to avoid lag
     
                   await Promise.all(chunkedQueries)
                    .then((resultOfChunkedQueriesInsert:any) => {
                        logger.info('SUCCESSFULLY INSERTED CHUNKS!!!')
                    })
                    .catch((errorOfChunkInsert:any) => {
                        logger.error(errorOfChunkInsert);
                        console.error(errorOfChunkInsert);
                    })


            // then add to list index
            
           await cassandraclient.execute(insertlistquery,
            [
              req.body.campaignid,
              assignedListId,
              listnickname,
              fileidtimeuuid,
              paparesult.data.length
            ],
            {prepare: true})
            .catch((error) => {
              logger.error(error, {type: "cassandraerrorcreatelistindex"})
            })

            res.send({
              success:true
            })

            //now recount the list census
            recountunreadmessages(req.body.campaignid)
                  }
                 })
           
              }
            })  
        }


      
      }})
    });

}