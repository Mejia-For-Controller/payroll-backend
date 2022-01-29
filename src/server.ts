import { Server } from "socket.io";
//import tracer from './tracer'; 
import express from "express";
import { createServer } from "http";
const editJsonFile = require("edit-json-file");

// If the file doesn't exist, the content will be an empty object by default.
let file = editJsonFile(`${__dirname}/employees9.json`);

function processStringToFloat(stringin) {
    if (stringin === "" || stringin === null || stringin === NaN) {
        return 0
    }  else {
        return parseFloat(stringin)
    }
}

var employees = file.get('employees')

console.log('json', employees)

const app = express(); 
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});


io.on("connection", (socket) => {
    socket.on("employeereq",async (message) => {
    
        

    });
});

io.engine.on("connection_error", (err) => {
    console.log(err.req);      // the request object
    console.log(err.code);     // the error code, for example 1
    console.log(err.message);  // the error message, for example "Session ID unknown"
    console.log(err.context);  // some additional error context
  });

io.listen(4927);