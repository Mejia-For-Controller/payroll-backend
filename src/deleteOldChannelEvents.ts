const TimeUuid = require('cassandra-driver').types.TimeUuid;
import { cassandraclient } from './cassandra'
import { logger } from './logger'

interface listOfLatestInterface {
  [key: string]: any;
}

export async function deleteOldReadMessages() {
  await cassandraclient.execute('SELECT * FROM texter.readmsgs WHERE read = ?', [true])
  .then((results) => {
    results.rows.forEach(async(eachRow) => {
      await cassandraclient.execute("DELETE FROM texter.readmsgs WHERE campaignid = ? AND channelid = ? AND snowflake = ? IF EXISTS", 
      [
        eachRow.campaignid, eachRow.channelid, eachRow.snowflake
      ])
    })
  }).catch((error) => {
    logger.error(error)
  })
}

export async function deleteOldEventsForCampaign(campaignid) {
  var latest: listOfLatestInterface = {
    
  }

  await cassandraclient.execute('SELECT * FROM texter.channelevents WHERE campaignid = ?', [campaignid])
    .then((resultOfChannelEvents) => {
      resultOfChannelEvents.rows.forEach((eachRow) => {
        if (latest[eachRow.channelid]) {
          //compare timestamps
          if (eachRow.timestamp.getDate().getTime() < latest[eachRow.channelid].getDate().getTime()) {
            //the ingested time is before the latest cache

            //delete the incoming ingest time
            cassandraclient.execute('DELETE FROM texter.channelevents WHERE campaignid = ? AND timestamp = ?', [campaignid, eachRow.timestamp])
              .then((resultOfDeletion) => {
                return undefined;
              })
              .catch((error) => {
                console.log(error)
                logger.errror(error)
            })
          }
          
          //the ingested time is greater than the latest time
          if (eachRow.timestamp.getDate().getTime() > latest[eachRow.channelid].getDate().getTime()) {
              //delete the previous latest time
              cassandraclient.execute('DELETE FROM texter.channelevents WHERE campaignid = ? AND timestamp = ?', [campaignid, latest[eachRow.channelid]])
              .then((resultOfDeletion) => {
                return undefined;
              })
              .catch((error) => {
                console.log(error)
                logger.errror(error)
              })
            
              latest[eachRow.channelid] = eachRow.timestamp;
          }
        } else {
          //set as the latest timestamp in cache
          latest[eachRow.channelid] = eachRow.timestamp;
      }
    })
  })
}