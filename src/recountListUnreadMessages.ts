import { cassandraclient } from "./cassandra";
import { logger } from './logger'

export async function recountunreadmessages(campaignid:string) {
    console.log('recount unread msgs for ', campaignid)
   await cassandraclient.execute("SELECT * FROM texter.campaigns WHERE campaignid = ?", [campaignid])
    .then(async (resultOfCampaignLookup) => {
        if (resultOfCampaignLookup.rows.length > 0) {
            console.log('campaign found')
            
            await cassandraclient.execute('SELECT * FROM texter.listindex WHERE campaignid = ?', [campaignid])
            .then((listindexresults) => {
                listindexresults.rows.forEach(async(listeach) => {
                    console.log('working on list', listeach.name)

                    await cassandraclient.execute('SELECT * FROM texter.phonenumberslist WHERE listid = ?', [listeach.listid])
                    .then(async(resultOfNumbers) => {
                        var numberOfUnreadChannels = 0;

                        var arrayOfPromises = resultOfNumbers.rows.map((eachRow) => {
                            return cassandraclient.execute("SELECT * FROM texter.readmsgs WHERE twilionumber = ?", [eachRow.phonenumber])
                        })

                    await Promise.all(arrayOfPromises)
                    .then(async(resultOfThePromises) => {
                        resultOfThePromises.forEach((eachPhoneNumber:any) => {
                            var filteredRows = eachPhoneNumber.rows.filter(eachrow => eachrow.read === false)
                            if (filteredRows.length > 0) {
                                numberOfUnreadChannels = numberOfUnreadChannels  + 1;

                                            
                            }

                        })

                        await cassandraclient.execute(
                            "INSERT INTO texter.numberofunreadchannelsineachlist (listid, campaignid, unreadcount, name, fileoriginid, rowcount) VALUES (?,?,?,?,?,?)",
                         [listeach.listid,
                             campaignid,
                              numberOfUnreadChannels,
                              listeach.name,
                              listeach.fileoriginid,
                              listeach.rowcount
                            ], {prepare: true})
                    })
                    .catch((promisefail) => {
                        console.error(promisefail)
                        logger.error({type: 'recountListUnreadMesssageCensusErrorInPromise', error: promisefail})
                    })
                    })
                })
            })

        }
    })
    .catch((errorOfCampaignLookup) => {
        console.error(errorOfCampaignLookup)
    })
}