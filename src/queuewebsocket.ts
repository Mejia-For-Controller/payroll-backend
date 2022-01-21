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
                .then((resultsOfSentCount:any) => {
                    var totalArrayOfRows:Array<any> = [];

                    resultsOfSentCount.forEach((eachItem,itemindex) => {
                        var itemToPush =  dupResultsOfAllQueues[itemindex]

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

        // SELECT * FROM queues where queueid = data.queueid
        
        //SELECT * FROM queuephonelist where queueid = data.queueid AND sent = false allow filtering Limit 50;

        // pick random

        //check if channels, set up channels, message content, etc

        //insert that it has been sent

        // send using replacement body and media
        console.log('sendone')

        //emit back the number of stuff in queue
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