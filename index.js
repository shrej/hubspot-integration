require('dotenv').config()
const jsforce = require('jsforce');
const username = process.env.SF_USERNAME;
const password = process.env.SF_PASSWORD;
const conn = new jsforce.Connection({});
const hubspot = require('@hubspot/api-client');
const hubspotClient = new hubspot.Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN});
const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const server = app.listen(port, () => console.log(`Hubspot Integration app running on PORT:${port}!`));
const bodyParser = require("body-parser")

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

conn.login(username, password, function(err, userInfo) {
  if (err) { return console.error(err); }
  conn.streaming.topic("/event/partnerdemo__PartnerEvent__e").subscribe(function(message) {
    const {payload } = message;
    const firstname = payload.partnerdemo__FirstName__c;
    const lastname = payload.partnerdemo__LastName__c;
    const email = payload.partnerdemo__Email__c;
    const company = payload.partnerdemo__Company__c;
    const hs_lead_status = leadStatusMap[payload.partnerdemo__LeadStatus__c];
    const city = payload.partnerdemo__SourceRecordId__c;
    const hubspotContact = {
        properties: {firstname, lastname, email,company, hs_lead_status, city}
    };
    (async()=> {
        const createContactResponse = await hubspotClient.crm.contacts.basicApi.create(hubspotContact);
        console.log(createContactResponse);
    })();
  });
});

const leadStatusMap = {
    "Open - Not Contacted": "NEW",
    "Working - Contacted": "IN_PROGRESS",
};

app.use(bodyParser.json())
app.post("/recordupdate", (req, res) => {
  console.log(req.body) 
  const changeBody = req.body[0];
  console.log(changeBody);
  const statusUpdate = changeBody.propertyValue;
  console.log(statusUpdate);
  res.status(200).end() 
})
