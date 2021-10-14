import {cassandraclient} from './cassandra'


export async function createDatabases() {
  //This Function will automatically create the adorastats keyspace if it doesn't exist, otherwise, carry on
  await cassandraclient.execute("CREATE KEYSPACE IF NOT EXISTS texter WITH REPLICATION = { 'class' : 'NetworkTopologyStrategy',  'datacenter1': 1  };")
      .then(async result => {
         // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
    //      console.log(result)
      }).catch(error => console.error(error));

  //Goes inside adora moderation keyspace, makes the table "trackedytvideoids"
  await cassandraclient.execute("CREATE TABLE IF NOT EXISTS texter.campaigns (campaignid text PRIMARY KEY, about text, website text, name text, ownerid text, iconurl text, bannerurl text, creationtime timeuuid, accountsid text, authtoken text, messagingservicesid text);")
      .then(async result => {
         // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
    //      console.log(result)
      }).catch(error => console.error(error));
  
      await cassandraclient.execute("CREATE TABLE IF NOT EXISTS texter.channelcount ( campaignid text PRIMARY KEY, channelcount counter);")
    
    await cassandraclient.execute("CREATE TABLE IF NOT EXISTS texter.memberships (campaignid text, userid text, joinedtime timeuuid, isowner boolean, isadmin boolean, isvolunteer boolean, PRIMARY KEY (campaignid, userid)); ")
      .then(async result => {
         // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
       //   console.log(result)
      }).catch(error => console.error(error));
    
    await cassandraclient.execute("CREATE TABLE  IF NOT EXISTS texter.channels (channelid timeuuid, campaignid text, twilionumber text, targeteverresponded boolean, PRIMARY KEY (campaignid, twilionumber))")
        .then(async result => {
    // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
    // console.log(result)
        }).catch(error => console.error(error));
    
    await cassandraclient.execute("CREATE INDEX IF NOT EXISTS ON texter.channels (twilionumber);")
    .then(async result => {
        // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
     //    console.log(result)
    }).catch(error => console.error(error));
    
    await cassandraclient.execute("CREATE TABLE  IF NOT EXISTS texter.messages (snowflake timeuuid, timeonnetwork bigint, inbound boolean, outbound boolean, idempotence text, bucket int, campaignid text, channelid timeuuid, twilionumber text, messagesid text, fromtwilio text, totwilio text, campaignvolunteeruidsender text, body text, messagestatus text, PRIMARY KEY((channelid, bucket), snowflake)) WITH CLUSTERING ORDER BY (snowflake DESC); ")
    .then(async result => {
        // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
     //    console.log(result)
            }).catch(error => console.error(error));

  //Goes inside adorastats keyspace, makes the table "ytvideostats"
  /*
  await cassandraclient.execute("CREATE TABLE IF NOT EXISTS texter.messages (campaignid text PRIMARY KEY, content text, twilionumber text, campaignauthorid text);")
      .then(async result => {
          //await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      }).catch(error => console.error(error));*/

      //add paint the town to the list of default videos
 // await addVideoToTrackList("_EEo-iE5u_A",undefined)
}