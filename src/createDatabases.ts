import { cassandraclient } from "./cassandra";

export async function createDatabases() {
  //This Function will automatically create the adorastats keyspace if it doesn't exist, otherwise, carry on
  await cassandraclient
    .execute(
      "CREATE KEYSPACE IF NOT EXISTS texter WITH REPLICATION = { 'class' : 'NetworkTopologyStrategy',  'datacenter1': 1  };"
    )
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //      console.log(result)
    })
    .catch((error) => console.error(error));

  //Goes inside adora moderation keyspace, makes the table "trackedytvideoids"
  await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.campaigns (campaignid text PRIMARY KEY, about text, website text, name text, ownerid text, iconurl text, bannerurl text, creationtime timeuuid, accountsid text, authtoken text, messagingservicesid text);"
    )
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //      console.log(result)
    })
    .catch((error) => console.error(error));

  await cassandraclient.execute(
    "CREATE TABLE IF NOT EXISTS texter.channelcount ( campaignid text PRIMARY KEY, channelcount counter);"
  );

  await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.memberships (campaignid text, userid text, joinedtime timeuuid, isowner boolean, isadmin boolean, isvolunteer boolean, PRIMARY KEY (campaignid, userid)); "
    )
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //   console.log(result)
    })
    .catch((error) => console.error(error));

  await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.invitations (campaignid text, email text, invitetime timeuuid, isowner boolean, isadmin boolean, accepted boolean, PRIMARY KEY (campaignid, email)); "
    )
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //   console.log(result)
    })
    .catch((error) => console.error(error));

  await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.channels (channelid timeuuid, campaignid text, twilionumber text, targeteverresponded boolean, PRIMARY KEY (campaignid, twilionumber))"
    )
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      // console.log(result)
    })
    .catch((error) => console.error(error));

  await cassandraclient
    .execute("CREATE INDEX IF NOT EXISTS ON texter.channels (twilionumber);")
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //    console.log(result)
    })
    .catch((error) => console.error(error));

  await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.messages (snowflake timeuuid, timeonnetwork bigint, inbound boolean, outbound boolean, idempotence text, bucket int, campaignid text, channelid timeuuid, twilionumber text, messagesid text, fromtwilio text, totwilio text, campaignvolunteeruidsender text, body text, messagestatus text, isautomated boolean, blastid timeuuid, history map<text,bigint>,mediaurl list<text>, mediatype list<text>, PRIMARY KEY((channelid, bucket), snowflake)) WITH CLUSTERING ORDER BY (snowflake DESC); "
    )
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //    console.log(result)
    })
    .catch((error) => console.error(error));

  await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.channelevents (usereversent boolean, campaignid text, channelid timeuuid, timestamp timeuuid, twilionumber text, fromtwilio text, totwilio text, campaignvolunteeruidassigned text, body text, type text, hasmedia boolean, read boolean, PRIMARY KEY(campaignid, timestamp)) WITH CLUSTERING ORDER BY (timestamp DESC) AND gc_grace_seconds = 3600; "
    )
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //    console.log(result)
    })
    .catch((error) => console.error(error));

  await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.messagesid (messagesid text PRIMARY KEY, snowflake timeuuid) "
    )
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //    console.log(result)
    })
    .catch((error) => console.error(error));

  await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.userinfo (uid text PRIMARY KEY, email text, name text, picture text)"
    )
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //    console.log(result)
    })
    .catch((error) => console.error(error));
  
    await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.readmsgs (snowflake timeuuid, read boolean, channelid text)"
    )
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //    console.log(result)
    })
    .catch((error) => console.error(error));

  //Goes inside adorastats keyspace, makes the table "ytvideostats"
  /*
  await cassandraclient.execute("CREATE TABLE IF NOT EXISTS texter.messages (campaignid text PRIMARY KEY, content text, twilionumber text, campaignauthorid text);")
      .then(async result => {
          //await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      }).catch(error => console.error(error));*/

  //add paint the town to the list of default videos
  // await addVideoToTrackList("_EEo-iE5u_A",undefined)
}
