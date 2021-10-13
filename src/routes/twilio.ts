import express from 'express'
import { cassandraclient } from '../cassandra';
import twilio from 'twilio'
import tracer from '../tracer';
import { urlencoded } from 'body-parser';
const { config } = require('./../../config.json');
import {logger} from '../logger'
export let twiliorouter = express.Router();
var twilioFormat = function (req, res, next) {
    if (!req.header('X-Twilio-Signature')) {
        return res.type('text/plain')
          .status(400)
          .send('No signature header error - X-Twilio-Signature header does not exist, maybe this request is not coming from Twilio.');
    }
    console.log("middleware didn't stop x-twilio-sig, move to regular flow")
    next()
}

twiliorouter.post('/voice', [twilioFormat], (req, res) => {
    // Twilio Voice URL - receives incoming calls from Twilio
    const response = new twilio.twiml.VoiceResponse();
  
    response.say(
      `Thanks for calling Mejia For Controller! Our volunteers are currently busy and will return your call shortly. Goodbye!`
    );
  
    res.set('Content-Type', 'text/xml');
    res.send(response.toString());
});

twiliorouter.all('/incomingmsg/:campaignid', [twilioFormat,urlencoded({ extended: false })], function (req, res, next) {
    console.log(req)
    tracer.trace('incomingmsg', async () => {
    console.log(req.body)
    //do a lookup of the campaign, see if it exists, and validate the accound sid and twilio origin
    cassandraclient.execute("SELECT * FROM texter.campaigns WHERE campaignid = ?", [req.params.campaignid]).then((result) => {
              // if it exists, add the text message to the text database
        if (result.rows.length > 0) {
            // Your Auth Token from twilio.com/console
        const authToken = result.rows[0].authtoken;

        // The Twilio request URL
        const url = `https://api.text.mejiaforcontroller.com/twilio/incomingmsg/${req.params.campaignid}`;

// The post variables in Twilio's request
const params = {
  CallSid: req.body.CallSid,
  Caller: req.body.Caller,
  Digits: req.body.Digits,
  From: req.body.From,
  To: req.body.To,
};

            logger.info({
                "type": "ingestmessage",
                "params": req.body
            })
            
// The X-Twilio-Signature header attached to the request
            const twilioSignature = req.header('X-Twilio-Signature');
            console.log('twilioSignature',twilioSignature)
            
            res.send("success")

       
         
            console.log('validate response')
            console.log(twilio.validateRequest(authToken, twilioSignature, url, params));
            console.log('validate done')
        } else {
            res.status(404).send("This campaign doesn't exist!")
    }
    }).catch((error) => {
          // if it exists, add the text message to the text database
    res.status(404).send("This campaign doesn't exist!")
    })
})
});

twiliorouter.all('/statuscallback/:campaignid', [twilioFormat], function(req, res, next) {
    console.log(req.body)

   //do a lookup of the campaign, see if it exists, and validate the accound sid and twilio origin

        // if it exists, update the status of that specific message
        res.send("Success")
});