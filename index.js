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
    const sourceid = payload.partnerdemo__SourceRecordId__c;
    const hubspotContact = {
        properties: {firstname, lastname, email,company, hs_lead_status, sourceid}
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
app.post("/recordupdate", async (req, res) => {
  const recordUpdate = req.body[0];
  const statusUpdate = recordUpdate.propertyValue;
  const salesforceStatusUpdate = getKeyByValue(leadStatusMap,statusUpdate);
  const recordId = await getSalesforceContactIdbyHubspotId(recordUpdate.objectId);
  console.log({salesforceStatusUpdate, recordId});
  publishPlatformEvent({
    partnerdemo__RecordId__c: recordId,
    partnerdemo__FieldValue__c: salesforceStatusUpdate
  });
  res.status(200).end() 
})


async function getSalesforceContactIdbyHubspotId(hubspotId) {
    const response = await hubspotClient.apiRequest({
        method: 'GET',
        path: `/crm/v3/objects/contact/${hubspotId}?properties=sourceid`,
    })
   const responseJson = await response.json();
   const sourceid = await responseJson.properties.sourceid;
   return sourceid;
}

function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
}

function publishPlatformEvent(eventData) {
    const _request = {
        url: '/services/data/v59.0/sobjects/partnerdemo__FieldUpdate__e/',
        method: 'post',
        body: eventData,
        headers : {
                "Content-Type" : "application/json"
            }
    };
    console.log(_request);

    conn.login(username, password, function(err, userInfo) { 
        conn.request(_request, function(err, resp) {
            console.log(resp);
        });
    });
}
