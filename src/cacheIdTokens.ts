import * as admin from 'firebase-admin';
import { cassandraclient } from './cassandra'


const serviceAccount = require("./../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


export var cacheOfSecureTokens = {
}

export function uploadUserDetailsFromDecodedIdToken(decodedIdToken) {
    cassandraclient.execute("INSERT INTO texter.userinfo (uid, email, name, picture) VALUES (?,?,?,?)",
    [decodedIdToken.uid, decodedIdToken.email, decodedIdToken.name, decodedIdToken.picture],
  {prepare: true})
    .then((resultofuserupdate) => console.log(resultofuserupdate))
  .catch((error) => {console.log(error)})
  }

export function withCacheVerifyIdToken(firebaseToken) {
    return new Promise<admin.auth.DecodedIdToken>((resolve, reject) => {
      if (cacheOfSecureTokens[firebaseToken]) {
        resolve(cacheOfSecureTokens[firebaseToken])
     // uploadUserDetailsFromDecodedIdToken(cacheOfSecureTokens[firebaseToken])
      } else {
        admin
          .auth()
          .verifyIdToken(firebaseToken)
          .then(async (decodedIdToken) => {
            resolve(decodedIdToken)
            cacheOfSecureTokens[firebaseToken] = decodedIdToken;
            uploadUserDetailsFromDecodedIdToken(decodedIdToken)
          })
          .catch((error) => {
            reject(error)
          })
      }
    })
  }