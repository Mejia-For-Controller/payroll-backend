import tracer from './tracer'; 
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { cassandraclient } from './cassandra'
var forEach = require("for-each")
import _ from 'lodash';
var r = require('rethinkdbdash')({
  db: 'texterpresence',
  cursor: true
});
const TimeUuid = require('cassandra-driver').types.TimeUuid;
import { cacheOfSecureTokens, uploadUserDetailsFromDecodedIdToken, withCacheVerifyIdToken } from './cacheIdTokens'
import {recountunreadmessages} from './recountListUnreadMessages'
import { AllTimePayload } from "twilio/lib/rest/api/v2010/account/usage/record/allTime";
import { logger } from "./logger";
const app = express(); 
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});

// looks like /campaign/mejiaforcontroller
const campaignmainpage = io.of(/^\/campaignmainpage\/\w+$/).use(async (socket, next) => {
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

campaignmainpage.on('connection', async (socket) => {

  var lastlistid = ""

  var lastsentlist = [];

  const campaignid:any = socket.handshake.query.campaignid;

  console.log('campaignid', campaignid)

  recountunreadmessages(campaignid)
  
  var initialDecodedIdToken = await withCacheVerifyIdToken(socket.handshake.query.token);

  var firsttime = true;
  var n=0

  function sendTheList () {
    n++;
    cassandraclient.execute("SELECT * FROM texter.numberofunreadchannelsineachlist WHERE campaignid = ?", [campaignid])
  .then((results) => {
    var outputJsonString:any = JSON.stringify(results.rows)
    console.log('outputjson', outputJsonString)
    if ((lastsentlist != outputJsonString) || firsttime === true) {
      var resultsToSendBack = {
        campaignid: campaignid,
        rows: results.rows
      }

    

      

    socket.emit("listoflists",resultsToSendBack);

      
    firsttime === false;
    lastsentlist = outputJsonString;

    if (results.rows.length === 0 && n < 5) {
      recountunreadmessages(campaignid)
      sendTheList()
    }
    
    }

  })
  }

  sendTheList();

  setInterval(() => {
    sendTheList();
  }, 1000);

  socket.on("getListChannels",async (message) => {

    if (message.listid) {
      await cassandraclient.execute("SELECT * FROM texter.listindex WHERE campaignid = ? AND listid = ?", [
        campaignid, TimeUuid.fromString(message.listid)
      ])
      .then(async(listindexresults) => {
        if (listindexresults.rows.length > 0) {
          await cassandraclient.execute('SELECT * FROM texter.phonenumberslist WHERE listid = ?', 
      [message.listid])
      .then(async(resultOfNumbers:any) => {
      
        var uniqedNumbersList =   _.uniq(resultOfNumbers.rows)

        var rowsPromise = uniqedNumbersList.map((eachRow) => {
          return cassandraclient.execute("SELECT * FROM texter.channelevents WHERE twilionumber = ?",
           [eachRow.phonenumber])
        })

       Promise.all(rowsPromise)
       .then((rowsPromiseResults:any) => {
         var listOfChannels:any = []

          rowsPromiseResults.forEach((eachPhoneNumber:any) => {
            if (eachPhoneNumber.rows.length > 0) {
              var chosenItemArray = eachPhoneNumber.rows
              .map((eachRow) => eachRow)
              .sort((firstEl:any, secondEl:any) => {
                var firstElTime = firstEl.timestamp.getDate().getTime()
                var secondElTime = secondEl.timestamp.getDate().getTime()

                if (firstElTime > secondElTime) {
                  return -1;
                } else {
                  return 1;
                }
              })

              logger.info({
                data: chosenItemArray,
                type: 'chosenItemArray'
              })

              
              logger.info({
                data: chosenItemArray[0],
                type: 'chosenItemArray0'
              })

         

              listOfChannels.push(chosenItemArray[0])

            }
          });

          var listOfChannelsCleaned = listOfChannels.map((item:any) => {
              var row:any = item;

              row["timestamp"] = item.timestamp.getDate().getTime();

              row["timeuuid"] = item.timestamp;

              return row;
          })

          socket.emit('sendListOfChannelsForList', {
            listofchannels: listOfChannelsCleaned,
            listid: message.listid
          })
       })
       
      });
        }
      }).catch((errorlist) => {logger.error(errorlist)})

      
    }

  })


  if (true) {
    r.dbList().contains('texterpresence')
      .do(function (databaseExists) {
        return r.branch(
          databaseExists,
          { dbs_created: 0 },
          r.dbCreate('texterpresence')
        );
      }).run();

   // console.log('socket.handshake.query', socket.handshake.query)

    if (socket.handshake.query) {
      if (socket.handshake.query.campaignid) {
        try {
          r.db('texterpresence').tableList().run().then(function(tableNames) {
            //console.log(tableNames)
            if (_.includes(tableNames._data[0], socket.handshake.query.campaignid)) {
              return;
            } else {
              return r.db('texterpresence').tableCreate(socket.handshake.query.campaignid).run().catch((error) => {
                console.log(error)
              });
              }
            })
        } catch (err) {
        }
        console.log('table changes')
        console.log('campaingid:', socket.handshake.query.campaignid)
        r.db('texterpresence').table(socket.handshake.query.campaignid).changes({
          includeInitial: true,
          squash: true,
          includeTypes: true
        }).run(function (err: any, cursor: any) {
          if (!err) {
            console.log('cursor', cursor)
            cursor.each(function (err, row) {
            //  console.log(row)
  
              var rowToSend = row;
  
  
              //later, optimize this by preventing "aloners" and removing viewers that are the uid
              if (row.new_val) {
                socket.emit("presenceDownloadv1", rowToSend);
              }
            });
          } else {
            console.error(err)
          }
         
        });

        socket.on('uploadreads', async (data) => {
          var arrayOfReads = data.reads;

          arrayOfReads.forEach(async (snowflake:string) => {
            var uuidsnowflake = TimeUuid.fromString(snowflake)
         await   cassandraclient.execute("SELECT * FROM texter.readmsgs WHERE snowflake = ? AND campaignid = ? ALLOW FILTERING",
            [
              uuidsnowflake,
              campaignid
            ])
            .then(async (results) => {
              if (results.rows.length > 0) {
               await cassandraclient.execute("UPDATE texter.readmsgs SET read = ? WHERE campaignid = ? AND channelid = ? AND snowflake = ?",
                [true, campaignid, results.rows[0].channelid, uuidsnowflake])
                .catch((rowserror) => {
                  logger.error(rowserror)
                })
            } else {
              logger.error('cant find the read msg', {
                snowflake: uuidsnowflake,
                campaignid
              })
            }
            })
            .catch((rowserror) => {
              logger.error(rowserror)
            })
          
          })

          
  recountunreadmessages(campaignid);

  sendTheList();
        })


        socket.on("uploadPresence", async (data) => {
          //      console.log(data);

          if (data.removeView) {
            var decodedIdToken = await withCacheVerifyIdToken(data.idToken)

            r.db('texterpresence').table(data.campaignid).get(data.removeView.twilionumber).run(function (err, result) {
            //  console.log(result)

              if (result) {
                var viewingUpdated;

                viewingUpdated = {}

                if (result.viewing) {
                  forEach(result.viewing, function (value, key, object) {
                    //can we keep this user at all?
                    //check if ANY tab contains a time less than 10 seconds ago
                    if (Object.values(value.tabs).some(eachTabTime => eachTabTime > Date.now() - 10000)) {
                      var newViewingForUserTabs = {};

                      forEach(value.tabs, function (valueTab, keyTab) {
                        //if it's not the tab to delete AND the value isn't older than 20 seconds
                        if (keyTab != data.tabId && valueTab > Date.now() - 20000) {
                          //add it to the newViewingForUser
                          newViewingForUserTabs[keyTab] = valueTab;
                        }
                      })

                      var newViewingForUser = value;

                      newViewingForUser.tabs = newViewingForUserTabs;

                      viewingUpdated[key] = newViewingForUser;
                    } else {
                      //trash the user from the viewing object
                    }
                  })

                  r.db('texterpresence').table(data.campaignid).get(data.removeView.twilionumber)
                    .update(
                      {
                        viewing: r.literal(viewingUpdated)
                      }
                    )
                    .then(function (deletingOldTabsResult) {
                   //   console.log(deletingOldTabsResult)
                    })
                }
              }




            });


          }

          if (data.addView) {
            if (data.addView.time > Date.now() - 10000) {
              //lookup in cache
              var decodedIdToken = await withCacheVerifyIdToken(data.idToken)

              var updateDoc: any = {
                id: data.addView.twilionumber,
                viewing: {

                }
              }

              var tabs: any = {

              }

              tabs[data.tabId] = data.addView.time

              var decodedIdTokenSelective = {
                name: decodedIdToken.name,
                uid:  decodedIdToken.uid,
                email: decodedIdToken.email,
                picture: decodedIdToken.picture
              }

              updateDoc.viewing[decodedIdToken.uid] = {
                tabs,
                ...decodedIdTokenSelective
              }



              await r.db('texterpresence').table(data.campaignid).insert(
                updateDoc,
                {
                  conflict: "update"
                }
              ).run(function (err, result) {
                if (err) throw err;
                // console.log(result);
              })
            }

          }
        });

      }

    }


    console.log('someone connected');
  }


})

//rethink io .changes()
//emit to sockets in campaign room with table

function filterOutUnwantedKeyUid(obj, uid) {
  Object.fromEntries(
    Object.entries(obj).filter(([key, value]) => key != uid)
  )
}



httpServer.listen(5023, () => {
  console.log(`listening on *:5023`);
});