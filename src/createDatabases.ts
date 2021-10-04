import {cassandraclient} from './cassandra'


export async function createDatabases() {
  //This Function will automatically create the adorastats keyspace if it doesn't exist, otherwise, carry on
  await cassandraclient.execute("CREATE KEYSPACE IF NOT EXISTS texter WITH REPLICATION = { 'class' : 'NetworkTopologyStrategy',  'datacenter1': 1  };")
      .then(async result => {
         // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
          console.log(result)
      }).catch(error => console.error(error));

  //Goes inside adora moderation keyspace, makes the table "trackedytvideoids"
  await cassandraclient.execute("CREATE TABLE IF NOT EXISTS texter.campaigns (campaignid text PRIMARY KEY, name text, ownerid text, iconURL text, bannerURL text, creationtime timeuuid);")
      .then(async result => {
         // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
          console.log(result)
      }).catch(error => console.error(error));
  
      await cassandraclient.execute("CREATE TABLE IF NOT EXISTS texter.memberships (campaignid text PRIMARY KEY, userid text, joinedtime timeuuid);")
      .then(async result => {
         // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
          console.log(result)
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