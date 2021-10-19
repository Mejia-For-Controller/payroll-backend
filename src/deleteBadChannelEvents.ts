import { cassandraclient } from "./cassandra";

cassandraclient.execute("SELECT * FROM texter.channelevents WHERE campaignid = ? AND twilionumber = ? ALLOW FILTERING", ['mejiaforcontroller', '+13234336897'])
  .then((result) => {
    result.rows.forEach(eachRow => {
      cassandraclient.execute("DELETE FROM texter.channelevents WHERE timestamp = ? AND campaignid = 'mejiaforcontroller' IF EXISTS", [eachRow.timestamp])
        .then((eachresult) => {
        console.log(eachresult)
      })
  })
})