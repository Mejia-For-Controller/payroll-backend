const Excel = require('exceljs');


async function processFile() {
    // read from a file
const workbook = new Excel.Workbook();
console.log('start read file')
await workbook.xlsx.readFile(`${__dirname}/../voterfilephones1.xlsx`);

console.log('file done reading')

workbook.eachSheet(function(worksheet, sheetId) {
  console.log(sheetId)
});
}

processFile()