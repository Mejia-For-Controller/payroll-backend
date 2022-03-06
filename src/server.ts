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

var deptLookup = {
  'El Pueblo De Los Angeles Historical Monument Authority': "El Pueblo De Los Angeles",
  "Los Angeles Department Of Convention And Tourism Development": "Convention and Tourism Development",
  "Office Of Finance": "Finance",
  "Information Technology Agency": "IT"
}

var requestdeptlookup = {
  'Board of Public Works': "Public Works - Board Of Public Works",
  "Contract Administration": "Public Works - Contract Administration",
      "Engineering": "Public Works - Engineering",
      "Sanitation": "Public Works - Sanitation",
      "Street Lighting": "Public Works - Street Lighting",
      "Street Services": "Public Works - Street Services",
}

var requestdeptlookupkeys = Object.keys(requestdeptlookup)

function convertEachDeptToShort(longdept) {
  var shortdept = longdept;

  if (deptLookup[longdept]) {
    shortdept = deptLookup[longdept];
  } 

  return shortdept;
}

var employees = file.get('employees').map((eachEmployee) => {
  return {
    //shorten key names for networking savings

    //b means base
    b: eachEmployee.base,
    id: eachEmployee.id,
    //map d to department
    d: convertEachDeptToShort(eachEmployee.dept),
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

var lengthOfEmployeesAll = employees.length;

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
          employeeFilter = employeeFilter.filter((eachEmployee) => eachEmployee.f.toLowerCase().includes(message.requestedFilters.firstName.trim().toLowerCase()))
        }

        if (message.requestedFilters.lastName.trim().length > 0) {
          var lastNameFilter = message.requestedFilters.lastName.trim().toLowerCase();
          console.log('lastNameFilter', lastNameFilter)
          employeeFilter = employeeFilter.filter((eachEmployee) => eachEmployee.l.toLowerCase().includes(lastNameFilter))
        }

        if (message.requestedFilters.j.trim().length > 0) {
          employeeFilter = employeeFilter.filter((eachEmployee) => eachEmployee.j.trim().toLowerCase().includes(message.requestedFilters.j.toLowerCase()))
        }



        if (message.requestedFilters.enabledDept != "all" && message.requestedFilters.enabledDept != "none" && Array.isArray(message.requestedFilters.enabledDept)) {
          console.log('enabled filter dept')

          var mappedDepts = message.requestedFilters.enabledDept.map((eachDept) => {
           
            if (requestdeptlookupkeys.includes(eachDept)) {
              var lookupReplacementDep = requestdeptlookup[eachDept];

              if (lookupReplacementDep != undefined) {
                return lookupReplacementDep;
              } else {
                return eachDept;
              }
              
            } else {
              return eachDept;
            } 
            

            return eachDept;
          });

          employeeFilter = employeeFilter.filter((eachEmployee) => {
              return mappedDepts.includes(eachEmployee.d);
          })
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
            startingpoint,
            endpoint,
            newseq: message.newSeq,
            reqLoadedEmployeeRowsCount: message.loadedEmployeeRowsCount,
            totalFiltered: totalCount,
            f: message.requestedFilters.firstName,
            l: message.requestedFilters.lastName,
            j: message.requestedFilters.j,
            d: message.requestedFilters.enabledDept,
            entiresetcount: lengthOfEmployeesAll
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