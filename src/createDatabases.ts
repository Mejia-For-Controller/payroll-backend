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

    await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.blastindex (campaignid text, blastid timeuuid, name text, senderuid text, smscontent text, PRIMARY KEY (campaignid, blastid))"
    )

  //Goes inside adora moderation keyspace, makes the table "trackedytvideoids"
  await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.campaigns (campaignid text PRIMARY KEY, about text, website text, name text, ownerid text, iconurl text, bannerurl text, creationtime timeuuid, accountsid text, authtoken text, messagingservicesid text, pdiusername text, pdipassword text);"
    )
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //      console.log(result)
    })
    .catch((error) => console.error(error));

    await cassandraclient.execute('CREATE TABLE IF NOT EXISTS texter.phonenumberslist (listid timeuuid, phonenumber text, firstname text, PRIMARY KEY (listid, phonenumber))')
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //      console.log(result)
    })
    .catch((error) => console.error(error));

    await cassandraclient.execute('CREATE TABLE IF NOT EXISTS texter.userpref (userid text PRIMARY KEY, seperatesides boolean, lexend boolean, profilepic boolean)')
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //      console.log(result)
    })
    .catch((error) => console.error(error));

    await cassandraclient.execute('CREATE TABLE IF NOT EXISTS texter.listindex (campaignid text, listid timeuuid, name text, fileoriginid timeuuid, rowcount bigint, PRIMARY KEY (campaignid, listid))')
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //      console.log(result)
    })
    .catch((error) => console.error(error));

    await cassandraclient.execute('CREATE TABLE IF NOT EXISTS texter.numberofunreadchannelsineachlist (listid timeuuid PRIMARY KEY, campaignid text, name text, fileoriginid timeuuid, rowcount bigint, unreadcount int)');

    await cassandraclient
    .execute("CREATE INDEX IF NOT EXISTS ON texter.numberofunreadchannelsineachlist (campaignid);")
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //    console.log(result)
    })
    .catch((error) => console.error(error));


    await cassandraclient.execute('CREATE TABLE IF NOT EXISTS texter.stopmessage (campaignid text, twilionumber text, stopid timeuuid, incomingstopmsgcontent text, incomingstopmsgsid text, incomingstopmsgtime timeuuid, PRIMARY KEY (campaignid, twilionumber))')
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //      console.log(result)
    })
    .catch((error) => console.error(error));

    await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.filesuploaded (campaignid text, filename text, genfilename timeuuid, encoding text, mimetype text, PRIMARY KEY (campaignid, genfilename));"
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
  .execute(
    "CREATE TABLE IF NOT EXISTS texter.queue (campaignid text, queueid timeuuid, smscontent text, mediastring text, mediamime text, sentbyuid text, listname text, listid timeuuid, rowcount int, PRIMARY KEY (campaignid, queueid))"
  )
  .then(async (result) => {
    // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
    // console.log(result)
  })
  .catch((error) => console.error(error));

  await cassandraclient
  .execute(
    "CREATE TABLE IF NOT EXISTS texter.phonenumberqueuelist (queueid timeuuid, sent boolean, firstname text, clientidempotency text, twilionumber text, senttime timeuuid, PRIMARY KEY (queueid, twilionumber))"
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
    .execute("CREATE INDEX IF NOT EXISTS ON texter.channelevents (twilionumber);")
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
      "CREATE TABLE IF NOT EXISTS texter.readmsgs (snowflake timeuuid, campaignid text, read boolean, channelid timeuuid, twilionumber text, msid text, PRIMARY KEY ((campaignid, channelid), snowflake))"
    )
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //    console.log(result)
    })
    .catch((error) => console.error(error));

    await cassandraclient
    .execute("CREATE INDEX IF NOT EXISTS ON texter.readmsgs (twilionumber);")
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //    console.log(result)
    })
    .catch((error) => console.error(error));

    await cassandraclient
    .execute("CREATE INDEX IF NOT EXISTS ON texter.readmsgs (read);")
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //    console.log(result)
    })
    .catch((error) => console.error(error));

    await cassandraclient
    .execute("CREATE INDEX IF NOT EXISTS ON texter.readmsgs (msid);")
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //    console.log(result)
    })
    .catch((error) => console.error(error));

    await cassandraclient
    .execute("CREATE INDEX IF NOT EXISTS ON texter.readmsgs (campaignid);")
    .then(async (result) => {
      // await logger.discordDebugLogger.debug({ type: "cassandraclient", result: result })
      //    console.log(result)
    })
    .catch((error) => console.error(error));

        await cassandraclient
    .execute(
      "CREATE TABLE IF NOT EXISTS texter.voterfile " +
      "(campaignid text, firstfour text, voterid text, firstname text, middlename text, lastname text, precinct text, party text, regdate text, phonenumber text, pav boolean, birthplace text, birthdate text, mailstreet text, mailcity text, mailstate text, mailzip text, mailcountry text, ltd text, language text, email text, regdateoriginal text, ethnicity text, " +
      "PRIMARY KEY ((campaignid, firstfour), phonenumber))"
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
