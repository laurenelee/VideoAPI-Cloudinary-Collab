require("dotenv").config();
const express = require('express');
const app = express();
const port = 3000;
const OpenTok = require("opentok");
const formidable = require("express-formidable");
const OT = new OpenTok(process.env.API_KEY, process.env.API_SECRET);
var cloudinary = require("cloudinary").v2;

let sessions = {};

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

app.use(express.static("public"));
app.use(express.json());
app.use(formidable());

app.get("/", (request, response) => {
    response.sendFile(__dirname + "/views/landing.html");
});

app.get("/session/participant/:room", (request, response) => {
    response.sendFile(__dirname + "/views/index.html");
});

app.post("/session/participant/:room", (request, response) => {
    const roomName = request.params.room;
    const streamName = request.body.username;
    // Check if the session already exists
    if (sessions[roomName]) {
        // Generate the token
        generatePublisherToken(roomName, streamName, response);
    } else {
        // If the session does not exist, create one
        OT.createSession({ mediaMode: "routed" }, (error, session) => {
            if (error) {
                console.log("Error creating session:", error);
            } else {
                // Store the session in the sessions object
                sessions[roomName] = session.sessionId;
                // Generate the token
                generatePublisherToken(roomName, streamName, response);
            }
        });
    }
});

app.post("/screenshot", (req, res) => {
    const base64imagedata = req.fields.image;
    console.log("uploading!")
    cloudinary.uploader.upload(
        "data:image/png;base64," + base64imagedata,
        function (error, result) {
            console.log(result, error);
        }
    );
    res.send();
});

// start archiving 
app.post('/archive/start', (req, res) => {
    let archiveName = "Vonage + Cloudinary Video Archive"

    for (const roomName in sessions) {
        if (sessions[roomName] == req.fields.sessionId) {
            archiveName = "Vonage + Cloudinary Video Archive for " + roomName
        }
    }
    const archiveOptions = {
        name: archiveName
    };

    OT.startArchive(req.fields.sessionId, archiveOptions, (err, archive) => {
        if (err) {
            return res.status(500).send('Could not start archive for session ' + req.fields.sessionId + '. error=' + err.message);
        }
        return res.send(archive);
    });

});

//  stop archiving 
app.post('/archive/stop/:archiveId', (req, res) => {
    var archiveId = req.params['archiveId'];
    OT.stopArchive(archiveId, function (err, archive) {
        if (err) return res.status(500).send('Could not stop archive ' + archiveId + '. error=' + err.message);
        return res.json(archive);
    });
});

// download archive 
app.get('/download/:archiveId', (req, res) => {
    var archiveId = req.params['archiveId'];
    OT.getArchive(archiveId, (err, archive) => {
        if (err) return res.status(500).send('Could not get archive ' + archiveId + '. error=' + err.message);
        return res.send(archive.url);
        // NOTE TO FUTURE SELF 
        // send other metadata in archive 
        // send to cloudinary now and return cloudinary url
    });
});

function generatePublisherToken(roomName, streamName, response) {
    // Configure token options
    const tokenOptions = {
        role: "publisher",
        data: `roomname=${roomName}?streamname=${streamName}`
    };
    // Generate token with the OpenTok SDK
    let token = OT.generateToken(
        sessions[roomName],
        tokenOptions
    );
    // Send the required credentials back to to the client
    // as a response from the fetch request
    response.status(200);
    response.send({
        sessionId: sessions[roomName],
        token: token,
        apiKey: process.env.API_KEY,
        streamName: streamName
    });
}


function generateSubscriberToken(roomName, response) {
    // Configure token options
    const tokenOptions = {
        role: "subscriber",
        data: `roomname=${roomName}`
    };
    // Generate token with the OpenTok SDK
    let token = OT.generateToken(
        sessions[roomName],
        tokenOptions
    );
    // Send the required credentials back to to the client
    // as a response from the fetch request
    response.status(200);
    response.send({
        sessionId: sessions[roomName],
        token: token,
        apiKey: process.env.API_KEY
    });
}

const listener = app.listen(port, () => {
    console.log("Your app is listening on port " + listener.address().port);
});