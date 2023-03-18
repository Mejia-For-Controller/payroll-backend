/*
    There are 4 files, employees2018.json, employees2019.json, employees2020.json, employees2021.json, and employees2022.json

    they all look like 
    {
        "employees": [
            {
                "first": "John",
                "last": "Smith",
                "jobtitle": "Accountant"
            }
            etc...
        ]
    }

    make an array of all the first names and ensure there are no duplicates, write the array to a file called firstnameindex.csv with the header "First Name"
     make an array of all the last names and ensure there are no duplicates, write the array to a file called lastnameindex.csv with the header "Last Name"
make an array of all the jobtitles and ensure there are no duplicates, write the array to a file called titleindex.csv with the header "Job Title"

*/

const fs = require('fs');

const listofFiles = ['employees2018.json', 'employees2019.json', 'employees2020.json', 'employees2021.json', 'employees2022.json'];

const firstNamesSet = new Set();
const lastNamesSet = new Set();
const jobTitlesSet = new Set();

function save() {
    const firstNamesArray = Array.from(firstNamesSet);
const lastNamesArray = Array.from(lastNamesSet);
const jobTitlesArray = Array.from(jobTitlesSet);

const firstNamesJson = JSON.stringify(firstNamesArray.map((x => {return {"First Name": x}})));
const lastNamesJson = JSON.stringify(lastNamesArray.map((x => {return {"Last Name": x}})));
const jobTitlesJson = JSON.stringify(jobTitlesArray.map((x => {return {"Job Title": x}})));

fs.writeFile("firstnameindex.json", firstNamesJson, (err) => {
    if (err) {
        console.error(err);
        return;
    };
    console.log("First Name File has been created");
})

fs.writeFile("lastnameindex.json", lastNamesJson, (err) => {
    if (err) {
        console.error(err);
        return;
    };
    console.log("Last Name File has been created");
})

fs.writeFile("titleindex.json", jobTitlesJson, (err) => {
    if (err) {
        console.error(err);
        return;
    };
    console.log("Job Title File has been created");
}
)
}

for(let i = 0; i < listofFiles.length; i++) {
    fs.readFile(listofFiles[i], "utf8", (err, jsonString) => {
        if (err) {
          console.log("File read failed:", err);
          return;
        }
        //console.log("File data:", jsonString);

        const jsonObj = JSON.parse(jsonString);

        jsonObj.employees.forEach((eachEmployee) => {
            //console.log(eachEmployee)
            firstNamesSet.add(eachEmployee.first);
            lastNamesSet.add(eachEmployee.last);
            jobTitlesSet.add(eachEmployee.jobtitle);
        })

        if (i === listofFiles.length - 1) {
            save();
        }
      });
}

