import express from 'express';
import cors from 'cors'
const app = express();
const port = 3000; // default port to listen
import {twiliorouter} from "./routes/twilio";

app.use(cors())
app.use('/twilio', twiliorouter);
app.use(express.urlencoded())

// define a route handler for the default home page
app.all("/", (req, res) => {
    console.log(req)
    res.send( "Hello world!" );
} );

// start the Express server
app.listen( port, () => {
    console.log( `server started at http://localhost:${port}` );
} );