const csvFilePath = './employeesv8.csv'

const editJsonFile = require("edit-json-file");

// If the file doesn't exist, the content will be an empty object by default.

let oneeightemployees = editJsonFile(`${__dirname}/employees2018.json`);
let onenineemployees = editJsonFile(`${__dirname}/employees2019.json`);
let twozeroemployees = editJsonFile(`${__dirname}/employees2020.json`);
let twooneemployees = editJsonFile(`${__dirname}/employees2021.json`);

var pathsToProcess = [
    ['./2018.csv',oneeightemployees],
    ['./2019.csv',onenineemployees],
    ['./2020.csv',twozeroemployees],
    ['./2021.csv',twooneemployees],
]

const csv = require('csvtojson')

pathsToProcess.forEach((eachYear) => {
    csv(
        {
            noheader:false,
            //output:"line",
            downstreamFormat: "array",
            delimiter: ","
        }
    )
        .fromFile(eachYear[0])
        .then((jsonObj) => {
            console.log(jsonObj);
            var correctedJson = jsonObj.map((eachEmployee) => {
                eachEmployee['base'] = parseFloat(eachEmployee['base'])
                eachEmployee['overtime'] = parseFloat(eachEmployee['overtime'])
                eachEmployee['other'] = parseFloat(eachEmployee['other'])
                if (eachEmployee['healthcare']) {
                    eachEmployee['healthcare'] = parseFloat(eachEmployee['healthcare'])
                }
                if (eachEmployee['retirement']) {
                    
                eachEmployee['retirement'] = parseFloat(eachEmployee['retirement'])
                }
    
                return eachEmployee
            })
            eachYear[1].set("employees", correctedJson);
            // Save the data to the disk
            eachYear[1].save();
        })
})
