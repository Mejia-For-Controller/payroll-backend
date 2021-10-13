import { createDatabases } from './createDatabases'

import { cassandraclient } from './cassandra'

interface channelInterface {
  channelid: string;
  twilionumber: string;
}

export function createNewChannelIfNotExists(channelParams: channelInterface) {
  
}