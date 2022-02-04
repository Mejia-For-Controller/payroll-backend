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

var employees = file.get('employees').map((eachEmployee) => {
  return {
    //shorten key names for networking savings

    //b means base
    b: eachEmployee.base,
    id: eachEmployee.id,
    //map d to department
    d: eachEmployee.dept,
    // h means amount in healthcare costs
    h: eachEmployee.healthcare,
    // f means firstname
    f: eachEmployee.first,
    j: eachEmployee.jobtitle,
    l: eachEmployee.last,
    ot: eachEmployee.other,
    ov: eachEmployee.overtime,
    r: eachEmployee.retirement
  }
})

//console.log('json', employees)

const app = express(); 
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});


io.on("connection", (socket) => {
    socket.on("employeereq",async (message) => {
    
        console.log(message)

     //   socket.emit("orderprocessing", {success: true})

        var employeeFilter = employees;

        if (message.requestedFilters.firstName.trim().length > 0) {
          employeeFilter = employeeFilter.filter((eachEmployee) => eachEmployee.f.toLowerCase().includes(message.requestedFilters.firstName.toLowerCase()))
        }

        if (message.requestedFilters.lastName.trim().length > 0) {
          var lastNameFilter = message.requestedFilters.lastName.toLowerCase();
          console.log('lastNameFilter', lastNameFilter)
          employeeFilter = employeeFilter.filter((eachEmployee) => eachEmployee.l.toLowerCase().includes(lastNameFilter))
        }

        if (message.requestedFilters.j.trim().length > 0) {
          employeeFilter = employeeFilter.filter((eachEmployee) => eachEmployee.j.toLowerCase().includes(message.requestedFilters.j.toLowerCase()))
        }

      var totalCount =  employeeFilter.length;

        console.log('totalCount', totalCount)

      // if the current loaded filters match the requested features, 

      // starting point = message.loadedEmployeeRowsCount

      //if the current loaded filters are different, 
      //the starting point is 0

      var startingpoint = 0

      if (message.newSeq === false) {
        startingpoint = message.loadedEmployeeRowsCount
      }

      var  endpoint = startingpoint + 100

      var croppedEmployees = employeeFilter.slice(startingpoint,endpoint)


        socket.emit("result", {
          employeePortion: croppedEmployees,
          meta: {
            totalFiltered: totalCount,
            f: message.requestedFilters.firstName,
            l: message.requestedFilters.lastName,
            j: message.requestedFilters.j
          }
        })

    });
});

io.engine.on("connection_error", (err) => {
    console.log(err.req);      // the request object
    console.log(err.code);     // the error code, for example 1
    console.log(err.message);  // the error message, for example "Session ID unknown"
    console.log(err.context);  // some additional error context
  });

io.listen(4927);