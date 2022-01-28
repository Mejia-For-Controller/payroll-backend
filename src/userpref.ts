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
import _ from 'lodash';
const TimeUuid = require('cassandra-driver').types.TimeUuid;
const Long = require('cassandra-driver').types.Long;


export async function getuserpref(req, res) {
      withCacheVerifyIdToken(req.body.firebasetoken)
    .then(async (decodedIdToken:any) => {
      await cassandraclient.execute("SELECT * FROM texter.userpref WHERE userid = ?", [decodedIdToken.uid])
      .then(async(resultsOfUserPref:any) => {
        if (resultsOfUserPref.rows.length > 0)  {
          var firstrow = resultsOfUserPref.rows[0]
  
          var lexendstate;
          if (firstrow.lexend === null || firstrow.lexend === undefined) {
            lexendstate = false
          }  else {
            lexendstate = firstrow.lexend
          }
  
          var profstate;
          if (firstrow.profilepic === null || firstrow.profilepic === undefined) {
            profstate = false
          }  else {
           profstate = firstrow.profilepic
          }
  
  
          res.send({
            seperatesides: firstrow.seperatesides,
            lexend: lexendstate,
            profilepic: profstate
  
          })
        } else { 
          res.send({
            seperatesides: false,
            lexend: false,
            profilepic: false
          });
  
          await cassandraclient.execute("INSERT INTO texter.userpref (userid, seperatesides, lexend, profilepic) VALUES (?,?,?,?)",[decodedIdToken.uid, false, false, false])
          .catch((error) => {
            console.error(error)
          })
        }
      })
    }
  
    )
  }