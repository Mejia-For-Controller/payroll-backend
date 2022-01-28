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


export async function getmembershiproster(req,res) {
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

export async function invitenewemail(req,res) {
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