import express from 'express'
import twilio from 'twilio'
export let twiliorouter = express.Router();
twiliorouter.all('/', twilio.webhook(), function(req, res, next) {
    console.log(req.body)
});

twiliorouter.post('/voice', twilio.webhook(), (req, res) => {
    // Twilio Voice URL - receives incoming calls from Twilio
    const response = new twilio.twiml.VoiceResponse();
  
    response.say(
      `Thanks for calling Mejia For Controller! Our volunteers are currently busy and will return your call shortly. Goodbye!`
    );
  
    res.set('Content-Type', 'text/xml');
    res.send(response.toString());
});
  
var twilioFormat = function (req, res, next) {
    if (!req.header('X-Twilio-Signature')) {
        return res.type('text/plain')
          .status(400)
          .send('No signature header error - X-Twilio-Signature header does not exist, maybe this request is not coming from Twilio.');
    }
    next()
}

twiliorouter.all('/incomingmsg/:campaignid', [twilioFormat], function (req, res, next) {
    console.log(req.body)
    //do a lookup of the campaign, see if it exists, and validate the accound sid and twilio origin

        // if it exists, add the text message to the text database
    res.send("Success")
});

twiliorouter.all('/statuscallback/:campaignid', [twilioFormat], function(req, res, next) {
    console.log(req.body)

   //do a lookup of the campaign, see if it exists, and validate the accound sid and twilio origin

        // if it exists, update the status of that specific message
        res.send("Success")
});