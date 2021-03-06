import { Server } from "socket.io";
//import tracer from './tracer'; 
import express from "express";
import { createServer } from "http";
//const editJsonFile = require("edit-json-file");
import editJsonFile from 'edit-json-file'
import { sort, inPlaceSort, createNewSortInstance } from 'fast-sort';
import add from 'add';

import { logger } from "./logger";


var StatsD = require('hot-shots');
var dogstatsd = new StatsD();

function processStringToFloat(stringin) {
  if (stringin === "" || stringin === null || stringin === NaN) {
    return 0
  } else {
    return parseFloat(stringin)
  }
}

function addArrayDeleteUndefined(arrayToAdd: Array<any>) {
  var arrayCleaned = arrayToAdd.filter((eachItem) => eachItem != undefined);

  return add(arrayCleaned);
}

var deptLookup = {
  'El Pueblo De Los Angeles Historical Monument Authority': "El Pueblo De Los Angeles",
  "Los Angeles Department Of Convention And Tourism Development": "Convention and Tourism Development",
  "Office Of Finance": "Finance"
}

var requestdeptlookup = {
  'Board of Public Works': "Public Works - Board Of Public Works",
  "Contract Administration": "Public Works - Contract Administration",
  "Engineering": "Public Works - Engineering",
  "Sanitation": "Public Works - Sanitation",
  "Street Lighting": "Public Works - Street Lighting",
  "Street Services": "Public Works - Street Services"
}

var requestdeptlookupkeys = Object.keys(requestdeptlookup)
function convertEachDeptToShort(longdept) {
  var shortdept = longdept;

  if (deptLookup[longdept]) {
    shortdept = deptLookup[longdept];
  }

  return shortdept;
}

var listOfYears = [
  {
    'year': "2018",
    'file': 'employees2018.json'
  },
  {
    'year': "2019",
    'file': 'employees2019.json'
  },
  {
    'year': "2020",
    'file': 'employees2020.json'
  },
  {
    'year': "2021",
    'file': 'employees2021.json'
  }
]

var employeesByYear = {

}

var lengthOfEmployeesPerYear = {

}

function formatNumber(input) {
  if (input === "" || input === null || input === undefined) {
    return 0;
  }
  if (typeof(input) === 'number') {
    return input;

  } else {
    if (typeof(input) === 'string') {
      return parseFloat(input);
  
    } else {
      return 0;
    }
  }
}

listOfYears.forEach((eachYearObj) => {
  var file = editJsonFile(`${__dirname}/${eachYearObj.file}`)

  console.log(file)

  var employeesListForYear = file.get('employees').map((eachEmployee) => {
    return {
      //shorten key names for networking savings

      //b means base
      b: formatNumber(eachEmployee.base),
      id: eachEmployee.id,
      //map d to department
      d: convertEachDeptToShort(eachEmployee.dept),
      // h means amount in healthcare costs
      h: formatNumber(eachEmployee.healthcare),
      // f means firstname
      f: eachEmployee.first,
      j: eachEmployee.jobtitle,
      l: eachEmployee.last,
      ot: formatNumber(eachEmployee.other),
      ov: formatNumber(eachEmployee.overtime),
      r: formatNumber(eachEmployee.retirement),
    }
  });

  employeesByYear[eachYearObj.year] = employeesListForYear;

  //store length of employees
  lengthOfEmployeesPerYear[eachYearObj.year] = employeesListForYear.length;
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
  var address = socket.handshake.address;

  dogstatsd.increment('payroll.newconnection');

  socket.on("employeereq", async (message) => {
    dogstatsd.increment('payroll.employeereq');
    console.log(message)
    try {
      logger.info({ req: message, type: 'employeereq', ipaddress: address })
    }
    catch (err) {
      console.error(err)
    }

    //   socket.emit("orderprocessing", {success: true})

    const requestedYear = message.requestedYear

    var employeeFilter = employeesByYear[requestedYear];

    if (message.requestedFilters.f.trim().length > 0) {
      employeeFilter = employeeFilter.filter((eachEmployee) => eachEmployee.f.toLowerCase().includes(message.requestedFilters.f.trim().toLowerCase()))
    }

    if (message.requestedFilters.l.trim().length > 0) {
      var lastNameFilter = message.requestedFilters.l.trim().toLowerCase();
      console.log('lastNameFilter', lastNameFilter)
      employeeFilter = employeeFilter.filter((eachEmployee) => eachEmployee.l.toLowerCase().includes(lastNameFilter))
    }

    if (message.requestedFilters.j.trim().length > 0) {
      employeeFilter = employeeFilter.filter((eachEmployee) => eachEmployee.j.trim().toLowerCase().includes(message.requestedFilters.j.toLowerCase()))
    }

    if (message.requestedFilters.d != "all" && message.requestedFilters.d != "none" && Array.isArray(message.requestedFilters.d)) {
      console.log('enabled filter dept')

      var mappedDepts = message.requestedFilters.d.map((eachDept) => {

        eachDept = eachDept.toLowerCase()

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
      });

      employeeFilter = employeeFilter.filter((eachEmployee) => {

        return mappedDepts.includes(eachEmployee.d.replace(/Council District (\d)(\d)?/gi, "Council").replace(/Los Angeles City Tourism Department/gi,"Convention and Tourism Development")
          .replace(/Public Works - /gi, "PW - ").toLowerCase()
        );
      })
      //console.log(employeeFilterDeptTest)

    }

    var totalCount = employeeFilter.length;

    console.log('totalCount', totalCount)

    // if the current loaded filters match the requested features, 

    // starting point = message.loadedEmployeeRowsCount

    //if the current loaded filters are different, 
    //the starting point is 0

    //*implement sort

    /*
    reuqestedSort: {
      sortEnabled: true,
      sortCol: 'b',
      reverse: true
    }

    */

    if (message.requestedSort) {
      if (message.requestedSort.sortEnabled) {

        var sortColumnExists = false;
        var sortcol = message.requestedSort.sortCol;

        if (message.requestedYear === "3021") {
          sortColumnExists = ['b', 'ot', 'ov', 'l', 'f', 'd', 'j', 't'].includes(sortcol)
        } else {
          sortColumnExists = ['b', 'ot', 'ov', 'l', 'f', 'd', 'j', "r", 'h', 't'].includes(sortcol)
        }

        var isNumberSort = ['b', 'ot', 'ov', "r", 'h', 't'].includes(sortcol)

        if (!sortColumnExists) {
          sortcol = 'b'
        }

        if (isNumberSort) {

          if (message.requestedSort.reverse === 'reverse') {
            /*  employeeFilter = employeeFilter.sort((a:any,b:any) => {
                return a[sortcol]-b[sortcol];
              });*/

            if (sortcol === 't') {
              inPlaceSort(employeeFilter).desc((e: any) => addArrayDeleteUndefined([e.b, e.ot, e.ov, e.r, e.h]))
            } else {
              inPlaceSort(employeeFilter).desc(sortcol)
            }
          } else {
            if (sortcol === 't') {
              inPlaceSort(employeeFilter).asc((e: any) => addArrayDeleteUndefined([e.b, e.ot, e.ov, e.r, e.h]))
            } else {
              inPlaceSort(employeeFilter).asc(sortcol)
            }
          }

        } else {

          // Or we can create new sort instance with language sensitive comparer.
          // Recommended if used in multiple places
          const naturalSort = createNewSortInstance({
            comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare,
            inPlaceSorting: true,
          });
          if (message.requestedSort.reverse === 'reverse') {
            naturalSort(employeeFilter).desc(sortcol)

          } else {
            naturalSort(employeeFilter).asc(sortcol)

          }
        }

      }
    }


    var startingpoint = 0;

    if (message.newSeq === false) {
      startingpoint = message.loadedEmployeeRowsCount
    }

    var endpoint = startingpoint + 100

    var croppedEmployees = employeeFilter.slice(startingpoint, endpoint)

    console.log('send back')

    socket.emit("result", {
      employeePortion: croppedEmployees,
      meta: {
        startingpoint,
        endpoint,
        newseq: message.newSeq,
        reqLoadedEmployeeRowsCount: message.loadedEmployeeRowsCount,
        totalFiltered: totalCount,
        f: message.requestedFilters.f,
        l: message.requestedFilters.l,
        j: message.requestedFilters.j,
        d: message.requestedFilters.d,
        sortcol: message.requestedSort.sortCol,
        sortreverse: message.requestedSort.reverse,
        entiresetcount: lengthOfEmployeesPerYear[requestedYear],
        year: requestedYear
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