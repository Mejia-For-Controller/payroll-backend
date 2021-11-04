
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
var forEach = require("for-each")
import _ from 'lodash';
var r = require('rethinkdbdash')({
  db: 'texterpresence',
  cursor: true
});
import { cacheOfSecureTokens, uploadUserDetailsFromDecodedIdToken, withCacheVerifyIdToken } from './cacheIdTokens'

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});

// looks like /campaign/mejiaforcontroller
const campaign = io.of(/^\/campaign\/\w+$/).use(async (socket, next) => {
  // const user = await fetchUser(socket.handshake.query);

  // console.log(socket.handshake.auth.firebasetoken)

  console.log(socket.handshake.query)


  //fetch cassandra database for the user id
  //socket.handshake.query.uid

  // is the user a volunteer

  // if so, next

  await withCacheVerifyIdToken(socket.handshake.query.token).then((info) => {
    next()
  })
    .catch((error) => {
      next(new Error('forbidden'))
    })

  // else throw error
  //if (user.isAdmin) {
  //socket.user = user;
  //next();
  //} else {
  // next(new Error('forbidden'));
  //}
});




//rethink io .changes()
//emit to sockets in campaign room with table

function filterOutUnwantedKeyUid(obj, uid) {
  Object.fromEntries(
    Object.entries(obj).filter(([key, value]) => key != uid)
  )
}

campaign.on('connection', async (socket) => {

  var initialDecodedIdToken = await withCacheVerifyIdToken(socket.handshake.query.token);

  const workspace = socket.nsp;

  //socket.handshake.query.name

  //workspace.emit('hello');

  if (true) {
    r.dbList().contains('texterpresence')
      .do(function (databaseExists) {
        return r.branch(
          databaseExists,
          { dbs_created: 0 },
          r.dbCreate('texterpresence')
        );
      }).run();

    console.log('socket.handshake.query', socket.handshake.query)

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


});



httpServer.listen(5023, () => {
  console.log(`listening on *:5023`);
});