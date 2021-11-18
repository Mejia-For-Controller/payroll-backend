var r = require('rethinkdbdash')({
//    cursor: true
  });
r.dbDrop('texterpresence').run(function (result) {
    console.log(result)
});