import { cassandraclient } from "./cassandra";

cassandraclient.execute("SELECT * FROM texter.channelevents WHERE campaignid = ? AND twilionumber = ? ALLOW FILTERING", ['mejiaforcontroller', '+19494699476'])
  .then((result) => {
    result.rows.forEach(eachRow => {
      cassandraclient.execute("DELETE FROM texter.channelevents WHERE timestamp = ? AND campaignid = 'mejiaforcontroller' IF EXISTS", [eachRow.timestamp])
        .then((eachresult) => {
        console.log(eachresult)
      })
  })
  })

  cassandraclient.execute("SELECT * FROM texter.messages WHERE campaignid = ? AND twilionumber = ? ALLOW FILTERING", ['mejiaforcontroller', '+19494699476'])
  .then((result) => {
    result.rows.forEach(eachRow => {
      cassandraclient.execute("DELETE FROM texter.messages WHERE channelid = ? AND bucket = ? AND snowflake = ? IF EXISTS", [eachRow.channelid,eachRow.bucket,eachRow.snowflake], {prepare: true})
        .then((eachresult) => {
        console.log(eachresult)
      })
  })
  })

  cassandraclient.execute("SELECT * FROM texter.channels WHERE campaignid = ? AND twilionumber = ? ALLOW FILTERING", ['mejiaforcontroller', '+19494699476'])
  .then((result) => {
    result.rows.forEach(eachRow => {
      cassandraclient.execute("DELETE FROM texter.channels WHERE campaignid = ? AND twilionumber = ? IF EXISTS", ['mejiaforcontroller', '+19494699476'])
        .then((eachresult) => {
        console.log(eachresult)
      })
  })
})