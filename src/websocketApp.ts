
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { r } from 'rethinkdb-ts';

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
  
  console.log(socket.handshake.auth.firebasetoken)

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
 
campaign.on('connection', socket => {
  const workspace = socket.nsp;

  //workspace.emit('hello');

  console.log('someone connected');
});

httpServer.listen(5023, () => {
  console.log(`listening on *:5023`);
});