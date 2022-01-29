import { Server } from "socket.io";

const editJsonFile = require("edit-json-file");

// If the file doesn't exist, the content will be an empty object by default.
let file = editJsonFile(`${__dirname}/employees8.json`);

function processStringToFloat(stringin) {
    if (stringin === "" || stringin === null || stringin === NaN) {
        return 0
    }  else {
        return parseFloat(stringin)
    }
}

var employees = file.get('employees').map((eachEmployee) => {
    //console.log(eachEmployee)
    eachEmployee.base = processStringToFloat(eachEmployee.base)
    eachEmployee.other = processStringToFloat(eachEmployee.other)
    eachEmployee.overtime = processStringToFloat(eachEmployee.overtime)    
    eachEmployee.healthcare = processStringToFloat(eachEmployee.healthcare)
    eachEmployee.retirement = processStringToFloat(eachEmployee.retirement)

    return eachEmployee
})

const io = new Server({
  // options
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