const csvFilePath = './employeesv8.csv'

const editJsonFile = require("edit-json-file");

// If the file doesn't exist, the content will be an empty object by default.

let oneeightemployees = editJsonFile(`${__dirname}/employees2018.json`);
let onenineemployees = editJsonFile(`${__dirname}/employees2019.json`);
let twozeroemployees = editJsonFile(`${__dirname}/employees2020.json`);
let twooneemployees = editJsonFile(`${__dirname}/employees2021.json`);

const letterCase = require('capitalize-decapitalize')

const capitalizeString = require('capitalize-string')

function replaceJob(stringjob) {
    if (stringjob) {
        if (stringjob.match(/ (i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i)) {
            return stringjob.replace(/ (i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i,stringjob.match(/ (i|ii|iii|iv|v|vi|vii|viii|ix|x|xi)$/i)[0])
         } else {
             return stringjob;
         }
    } else {
        console.log('wtf is this', stringjob)
        return stringjob;
    }
   
}

var pathsToProcess = [
    /*
    ['./2018.csv',oneeightemployees],
    ['./2019.csv',onenineemployees],
    ['./2020.csv',twozeroemployees],*/
    ['./payroll-2022-new.csv',twooneemployees],
]

const csv = require('csvtojson');

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
                eachEmployee['first'] = eachEmployee['first'] || eachEmployee['First']
                eachEmployee['last'] = eachEmployee['last'] || eachEmployee['Last']
                eachEmployee['jobtitle'] = replaceJob(eachEmployee['jobtitle'] || eachEmployee['Job'])
                eachEmployee['dept'] = eachEmployee['dept'] || eachEmployee['Dept']
                eachEmployee['base'] = parseFloat(eachEmployee['base'] || eachEmployee['Base Pay'])
                eachEmployee['overtime'] = parseFloat(eachEmployee['overtime'] || eachEmployee['Overtime'])
                eachEmployee['other'] = parseFloat(eachEmployee['other'] || parseFloat(eachEmployee['Other']))
                if (eachEmployee['healthcare'] || eachEmployee['Health']) {
                    eachEmployee['healthcare'] = parseFloat(eachEmployee['healthcare'] || eachEmployee['Health'])
                }
                if (eachEmployee['retirement'] || eachEmployee['Retirement']) {
                    
                eachEmployee['retirement'] = parseFloat(eachEmployee['Retirement'] || eachEmployee['retirement'])
                }
    
                delete eachEmployee['First']
                delete eachEmployee['Last']
                delete eachEmployee['Job']
                delete eachEmployee['Health']

                return eachEmployee
            })
            eachYear[1].set("employees", correctedJson);
            // Save the data to the disk
            eachYear[1].save();
        })
})
