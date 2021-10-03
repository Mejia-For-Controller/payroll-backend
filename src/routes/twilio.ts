import express from 'express'
import twilio from 'twilio'
export let twiliorouter = express.Router();
twiliorouter.all('/', twilio.webhook(), function(req, res, next) {
    console.log(req)
      // Create a TwiML response
      var twiml = new twilio.twiml.MessagingResponse()
      twiml.message('Hello from node.js!');
  
      // Render the TwiML response as XML
      res.type('text/xml');
      res.send(twiml.toString());
});

twiliorouter.all('/incomingmsg/:campaignid', twilio.webhook(), function(req, res, next) {
    console.log(req.body)
    //do a lookup of the campaign, see if it exists

        // if it exists, add the text message to the text database
});

twiliorouter.all('/statuscallback/:campaignid', twilio.webhook(), function(req, res, next) {
    console.log(req.body)

    //do a lookup of the campaign, see if it exists

        // if it exists, update the status of that specific message
});