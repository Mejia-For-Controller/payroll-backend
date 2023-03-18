

const editJsonFile = require("edit-json-file");

// If the file doesn't exist, the content will be an empty object by default.

let oneeightemployees = editJsonFile(`${__dirname}/employees2018.json`);
let onenineemployees = editJsonFile(`${__dirname}/employees2019.json`);
let twozeroemployees = editJsonFile(`${__dirname}/employees2020.json`);
let twooneemployees = editJsonFile(`${__dirname}/employees2021.json`);
let twotwoemployees = editJsonFile(`${__dirname}/employees2022.json`);

const letterCase = require('capitalize-decapitalize')

const capitalizeString = require('capitalize-string')

const {titleCase} = require('title-case')

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
    
    ['./2018.csv',oneeightemployees],
    ['./2019.csv',onenineemployees],
    ['./2020.csv',twozeroemployees],
    ['./2021.csv',twooneemployees],
    //['./payroll-2022-new.csv',twooneemployees],
    ['./employees2022.csv',twotwoemployees],
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
           // console.log(jsonObj);
            const correctedJson = jsonObj.map((eachEmployeeInit) => {

                const eachEmployee = {}

                eachEmployee['first'] = ( eachEmployeeInit['first'] || eachEmployeeInit['First']) ? titleCase(eachEmployeeInit['first'].toLowerCase() || eachEmployeeInit['First'].toLowerCase()) : ""
                eachEmployee['last'] = ( eachEmployeeInit['last'] || eachEmployeeInit['Last']) ? titleCase(eachEmployeeInit['last'].toLowerCase() || eachEmployeeInit['Last'].toLowerCase()) : ""
                eachEmployee['jobtitle'] = replaceJob(titleCase((eachEmployeeInit['jobtitle'] || eachEmployeeInit['Job']).toLowerCase()))
                eachEmployee['dept'] = titleCase(eachEmployeeInit['dept'].toLowerCase() || eachEmployeeInit['Dept'].toLowerCase())
                eachEmployee['base'] = parseFloat(eachEmployeeInit['base'] || eachEmployeeInit['Base Pay'])
                eachEmployee['overtime'] = parseFloat(eachEmployeeInit['overtime'] || eachEmployeeInit['Overtime'])
                eachEmployee['other'] = parseFloat(eachEmployeeInit['other'] || parseFloat(eachEmployeeInit['Other']))
                if (eachEmployeeInit['healthcare'] || eachEmployeeInit['Health']) {
                    eachEmployee['healthcare'] = parseFloat(eachEmployeeInit['healthcare'] || eachEmployeeInit['Health'])
                }
                if (eachEmployeeInit['retirement'] || eachEmployeeInit['Retirement']) {
                    
                eachEmployee['retirement'] = parseFloat(eachEmployeeInit['Retirement'] || eachEmployeeInit['retirement'])
                }

                return eachEmployee
            })
            eachYear[1].set("employees", correctedJson);
            // Save the data to the disk
            eachYear[1].save();
        })
})
