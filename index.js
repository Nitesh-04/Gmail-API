import express from "express";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import ejs from "ejs";

const app = express();
const port = 3000;

app.set("view engine", "ejs");

const CLIENT_ID = "YOUR_ID";                 // mention your credentials here
const CLIENT_SECRET = "YOUR_SECRET";         //  ''
const REDIRECT_URI = "YOUR_REDIRECT_URI";    //  ''

const oAuth2Client = new OAuth2Client({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
});

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

app.get("/", (req, res) => {
  const initialAuthorizationUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  res.render("index", { authorizationUrl: null, initialAuthorizationUrl: initialAuthorizationUrl });
});

app.get("/authorize", (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.render("index", { authorizationUrl: authUrl });
});

app.get("YOUR_REDIRECT_ROUTE", async (req, res) => {     // replace redirect route with your redirect route
  const { code } = req.query;
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    res.redirect("/emails");
  } catch (error) {
    console.error('Error retrieving access token:', error.message);
    res.status(500).send('Error retrieving access token');
  }
});


app.get("/emails", async (req, res) => {
try {
  console.log("Entering emails route :")
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: 'label:inbox AND category:primary', 
  });
  const messages = response.data.messages;
  const emailPromises = messages.map(async (message) => {
    const email = await gmail.users.messages.get({
      userId: 'me',
      id: message.id,
    });
    const dateHeader = getEmailHeader(email, 'Date');
    return {
      timestamp: formatEmailDate(dateHeader),
      sender: extractEmailFromHeader(getEmailHeader(email, 'From')),
      subject: getEmailHeader(email, 'Subject'),
      body: getEmailBody(email),
    };
  });

  const emails = await Promise.all(emailPromises);
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.render("index", { authorizationUrl: authUrl, emails }); 
} catch (error) {
  console.error('Error fetching emails:', error.message);
  res.status(500).send('Error fetching emails');
}
});


function getEmailHeader(email, headerName) {
  const payload = email.data.payload;

  if (!payload || !payload.headers || !Array.isArray(payload.headers)) {
    console.error('Payload, headers, or headers array is undefined or not an array:', email);
    return '';
  }

  const header = payload.headers.find((h) => h.name === headerName);

  if (!header) {
    console.error(`Header ${headerName} not found:`, email);
    return '';
  }

  return header.value || '';
}

function formatEmailDate(dateHeader) {
  const date = new Date(dateHeader);
  return date.toLocaleString();
}


function getEmailBody(email) {
  const payload = email.data.payload;

  if (!payload || !payload.parts || !Array.isArray(payload.parts)) {
    console.error('Payload, parts, or parts array is undefined or not an array:', email);
    return '';
  }

  const body = payload.parts.find((part) => part.mimeType === 'text/plain');

  return body ? Buffer.from(body.body.data, 'base64').toString() : '';
}


function extractEmailFromHeader(fromHeader) {
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader;
}

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
