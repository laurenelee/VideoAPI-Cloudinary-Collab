let stream = null
let archiveID = null
let sessionId = null

fetch(location.pathname, { method: "POST" })
    .then(res => {
        return res.json();
    })
    .then(res => {
        sessionId = res.sessionId;
        const apiKey = res.apiKey;
        const token = res.token;
        const streamName = res.streamName;
        stream = initializeSession(apiKey, sessionId, token, streamName);
    })
    .catch(handleCallback);


function initializeSession(apiKey, sessionId, token, streamName) {
    // Create a session object with the sessionId
    const session = OT.initSession(apiKey, sessionId);

    // Create a publisher
    const publisher = OT.initPublisher(
        "publisher",
        {
            insertMode: "append",
            width: "100%",
            height: "100%",
            name: streamName
        },
        handleCallback
    );

    // Connect to the session
    session.connect(token, error => {
        // If the connection is successful, initialize the publisher and publish to the session
        if (error) {
            handleCallback(error);
        } else {
            session.publish(publisher, handleCallback);
        }
    });

    // Subscribe to a newly created stream
    session.on("streamCreated", event => {
        session.subscribe(
            event.stream,
            "subscriber",
            {
                insertMode: "append",
                width: "100%",
                height: "100%",
                name: event.stream.name
            },
            handleCallback
        );
    });

    // start archive event
    session.on('archiveStarted', function archiveStarted(event) {
        archiveID = event.id;
        console.log('Archive started ' + archiveID);
    });

    // stop archive event
    session.on('archiveStopped', function archiveStopped(event) {
        archiveID = event.id;
        console.log('Archive stopped ' + archiveID);
    });

    return publisher
}

async function startArchive() {
    const body = new FormData()
    body.append('sessionId', sessionId)
    const response = await fetch('/archive/start', {
        method: "POST",
        body: body
    })
    const data = await response.json()
    archiveID = data.id
}

function stopArchive() {
    fetch('/archive/stop/' + archiveID, {
        method: "POST"
    })
}

function saveArchive() {
    fetch('/download/' + archiveID)
}

// Callback handler
function handleCallback(error) {
    if (error) {
        console.log("error: " + error.message);
    } else {
        console.log("callback success");
    }
}