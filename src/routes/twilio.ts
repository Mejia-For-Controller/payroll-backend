import express from 'express'
import twilio from 'twilio'
export let twiliorouter = express.Router();
twiliorouter.all('/', [express.urlencoded(), twilio.webhook()], function(req, res, next) {
    console.log(req)
    res.end('Success');
});