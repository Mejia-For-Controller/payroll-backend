
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { r } from 'rethinkdb-ts';
import {cacheOfSecureTokens,uploadUserDetailsFromDecodedIdToken,withCacheVerifyIdToken} from './cacheIdTokens'

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
 });

 let connection;
    r.connect({host: 'localhost', port: 28015, db: 'texterpresence'})
        .then(conn => {
          connection = conn;
        });

        

 // looks like /campaign/mejiaforcontroller
const campaign = io.of(/^\/campaign\/\w+$/).use(async (socket, next) => {
 // const user = await fetchUser(socket.handshake.query);
  
 // console.log(socket.handshake.auth.firebasetoken)

 console.log(socket.handshake.query)

  next()
  //fetch cassandra database for the user id
  //socket.handshake.query.uid

  // is the user a volunteer

  // if so, next

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
 
campaign.on('connection',async (socket) => {
  const workspace = socket.nsp;

  //socket.handshake.query.name

  //workspace.emit('hello');

  if (connection) {
    r.dbList().contains('texterpresence')
        .do(function(databaseExists) {
          return r.branch(
            databaseExists,
            { dbs_created: 0 },
            r.dbCreate('texterpresence')
          );
        }).run(connection);

console.log('socket.handshake.query', socket.handshake.query)

if (socket.handshake.query) {
  if (socket.handshake.query.campaignid) {
    try {
      await r.tableCreate(socket.handshake.query.campaignid).run(connection);
    } catch (err) {

    }
    await r.table(socket.handshake.query.campaignid).changes({
      include_initial: true
    }).run(connection, function(err, cursor) {
      cursor.each((eachItem:any) => {
        console.log(eachItem)
      });
    });


    socket.on("uploadPresence",async (data) => {
      console.log(data);

      if (data.addView) {
        //lookup in cache
        var decodedIdToken = await withCacheVerifyIdToken(data.idToken)

        var updateDoc:any = {
          viewing: {

          }
        }

        updateDoc.viewing[decodedIdToken.uid] = {
          time: data.addView.time
        }

        r.table(data.campaignid).get(data.addView.twilionumber).update(
          updateDoc
          )}
        ).run(connection)
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