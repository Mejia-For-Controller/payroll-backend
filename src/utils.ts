// calculate the bucket from the channel timestamp
export function bucketCalc(messageTimestamp, channelTimestamp) {
  var offset = channelTimestamp - (1000 * 60 * 60)
  var timesincechannel = messageTimestamp - channelTimestamp;
  var bucket = Math.floor(timesincechannel / (1000 * 60 * 60 * 24 * 30))
  if (bucket < 0) {bucket = 0}
  return bucket;
}