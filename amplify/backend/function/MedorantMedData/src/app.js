const AWS = require('aws-sdk')
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const bodyParser = require('body-parser')
const express = require('express');
const fetch = require('node-fetch');

AWS.config.update({ region: process.env.TABLE_REGION });

const dynamodb = new AWS.DynamoDB.DocumentClient();

let tableName = "medicineData";
if (process.env.ENV && process.env.ENV !== "NONE") {
  tableName = tableName + '-' + process.env.ENV;
}

const userIdPresent = false; // TODO: update in case is required to use that definition
const partitionKeyName = "medicine_name";
const partitionKeyType = "S";
const sortKeyName = "";
const sortKeyType = "";
const hasSortKey = sortKeyName !== "";
const path = "/med";
const UNAUTH = 'UNAUTH';
const hashKeyPath = '/:' + partitionKeyName;
const sortKeyPath = hasSortKey ? '/:' + sortKeyName : '';

// declare a new express app
const app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
});

// convert url string param to expected Type
const convertUrlType = (param, type) => {
  switch(type) {
    case "N":
      return Number.parseInt(param);
    default:
      return param;
  }
}

//Get Best Buy Link Scrapper

const getBestBuyLink = async (medicine_name) => {
  const res = await fetch(`https://8g34ra4qq2.execute-api.ap-south-1.amazonaws.com/dev/link?medName=${medicine_name}`);
  const link = await res.json()
  return link
}

//Fetch user Data
const getUserData = async(user_id) => {
  const res = await fetch(`https://8g34ra4qq2.execute-api.ap-south-1.amazonaws.com/dev/user/${user_id}`);
  const user_data =  await res.json();
  return user_data
}

//Checking if two array is equal or not

function checkCounterfeit(user_diseases, side_effects) {
  let matches = [];  // Array to contain match elements
  for(let i=0 ; i<user_diseases.length ; ++i) {
    for(let j=0 ; j<side_effects.length ; ++j) {
      if(user_diseases[i] == side_effects[j]) {    // If element is in both the arrays
        matches.push(user_diseases[i]);        // Push to arr array
      }
    }
  }
   
  return matches;  // Return the arr elements
}

/********************************
 * HTTP Get method for list objects *
 ********************************/

app.get(path + hashKeyPath, function(req, res) {
  const condition = {}
  condition[partitionKeyName] = {
    ComparisonOperator: 'EQ'
  }

  if (userIdPresent && req.apiGateway) {
    condition[partitionKeyName]['AttributeValueList'] = [req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH ];
  } else {
    try {
      condition[partitionKeyName]['AttributeValueList'] = [ convertUrlType(req.params[partitionKeyName], partitionKeyType) ];
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }

  let queryParams = {
    TableName: tableName,
    KeyConditions: condition
  }

  dynamodb.query(queryParams, async(err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({error: 'Could not load items: ' + err});
    } else {

      //Filtering the unorganized data
      const buy_link = await getBestBuyLink(data.Items[0].medicine_name)
      
      const alternative_medicines_array = data.Items[0].alternative_medicines.split(",");
      alternative_medicines_array.pop();
      
      const side_effects_array = data.Items[0].side_effects.split(",");
      side_effects_array.pop();
      
      const uses_array = data.Items[0].uses.split(",");
      uses_array.pop();
      
      // CounterFeit Variables
      let counterFeit = null;
      let  overallSeverity = null;
      let highSeverity = null;
      let lowSeverity = null;
      let mediumSeverity = null;
      let checkSeverityHigh = null;
      let checkSeverityMedium = null;
      let checkSeverityLow = null
      
      //Running Functions to get the user data
      const user_id = req.query.user_id;
      const user_data = await getUserData(user_id);
      const user_diseses = user_data[0].disease;

      // Diseses data
      const  high = ["Diabetes", "Thyroid", "Coeliac", "Tuberculosis",  "Diarrhea", "Aids", "Piles", "Sugar","Constipation"];
      const medium = ["Fever", "Abdominal pain", "Acne", "Stomach pain", "Infection"];
      const  low =  ["Vomiting", "Nausea", "Cough", "Headache" , "Erythema", "Rash" , "hives", "Skin peeling"]


      //Checking of counterFeit and Severity
      let  matches_result = checkCounterfeit(user_diseses, side_effects_array);
      if(matches_result.length == 0 ){
          counterFeit = true;
          matches_result = null;
      }else{
        counterFeit = false;
        checkSeverityLow = checkCounterfeit(low, matches_result)
        if(checkSeverityLow.length !== 0){
          lowSeverity = checkSeverityLow.length;
          overallSeverity = "low"
        }
        checkSeverityMedium = checkCounterfeit(medium, matches_result)
        if(checkSeverityMedium.length !== 0){
          mediumSeverity = checkSeverityMedium.length;
          overallSeverity = "medium"
        }
        checkSeverityHigh = checkCounterfeit(high, matches_result)
        if(checkSeverityHigh.length !== 0){
          highSeverity = checkSeverityHigh.length;
          overallSeverity = "high"
        }
      }


      //Severity Sata Schema
      const severity = {
        "overallSeverity" : overallSeverity,
        "highSeverity" : {
          "count" : highSeverity,
          "names" : checkSeverityHigh
        },
        "mediumSeverity" : {
          "count" :  mediumSeverity,
          "names" : checkSeverityMedium
        },
        "lowSeverity" : {
          "count" : lowSeverity,
          "names" : checkSeverityLow
        }
      }

      //FInal Filtered Data
      const filtered_data = {
        "medicine_name" : data.Items[0].medicine_name,
        "mrp": data.Items[0].mrp,
        "best_buy" : buy_link,
        "alternative_medicines" : alternative_medicines_array,
        "uses" : uses_array,
        "prescription" : data.Items[0].prescription,
        "type_of_sell" : data.Items[0].type_of_sell,
        "how_to_use": data.Items[0].how_to_use,
        "chemical_class" : data.Items[0].chemical_class,
        "manufacturer": data.Items[0].manufacturer,
        "salt": data.Items[0].salt,
        "therapeutic_class": data.Items[0].therapeutic_class,
        "side_effects": side_effects_array,
        "habit_forming": data.Items[0].habit_forming,
        "action_class": data.Items[0].action_class,
        "counterFeit" : counterFeit,
        "Problems" : matches_result,
        "severity" : severity
      }
      res.json(filtered_data);
    }
  });
});

/*****************************************
 * HTTP Get method for get single object *
 *****************************************/

app.get(path + '/object' + hashKeyPath + sortKeyPath, function(req, res) {
  const params = {};
  if (userIdPresent && req.apiGateway) {
    params[partitionKeyName] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  } else {
    params[partitionKeyName] = req.params[partitionKeyName];
    try {
      params[partitionKeyName] = convertUrlType(req.params[partitionKeyName], partitionKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }
  if (hasSortKey) {
    try {
      params[sortKeyName] = convertUrlType(req.params[sortKeyName], sortKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }

  let getItemParams = {
    TableName: tableName,
    Key: params
  }

  dynamodb.get(getItemParams,(err, data) => {
    if(err) {
      res.statusCode = 500;
      res.json({error: 'Could not load items: ' + err.message});
    } else {
      if (data.Item) {
        res.json(data.Item);
      } else {
        res.json(data) ;
      }
    }
  });
});


/************************************
* HTTP put method for insert object *
*************************************/

app.put(path, function(req, res) {

  if (userIdPresent) {
    req.body['userId'] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  }

  let putItemParams = {
    TableName: tableName,
    Item: req.body
  }
  dynamodb.put(putItemParams, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({ error: err, url: req.url, body: req.body });
    } else{
      res.json({ success: 'put call succeed!', url: req.url, data: data })
    }
  });
});

/************************************
* HTTP post method for insert object *
*************************************/

app.post(path, function(req, res) {

  if (userIdPresent) {
    req.body['userId'] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  }

  let putItemParams = {
    TableName: tableName,
    Item: req.body
  }
  dynamodb.put(putItemParams, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.json({error: err, url: req.url, body: req.body});
    } else {
      res.json({success: 'post call succeed!', url: req.url, data: data})
    }
  });
});

/**************************************
* HTTP remove method to delete object *
***************************************/

app.delete(path + '/object' + hashKeyPath + sortKeyPath, function(req, res) {
  const params = {};
  if (userIdPresent && req.apiGateway) {
    params[partitionKeyName] = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  } else {
    params[partitionKeyName] = req.params[partitionKeyName];
     try {
      params[partitionKeyName] = convertUrlType(req.params[partitionKeyName], partitionKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }
  if (hasSortKey) {
    try {
      params[sortKeyName] = convertUrlType(req.params[sortKeyName], sortKeyType);
    } catch(err) {
      res.statusCode = 500;
      res.json({error: 'Wrong column type ' + err});
    }
  }

  let removeItemParams = {
    TableName: tableName,
    Key: params
  }
  dynamodb.delete(removeItemParams, (err, data)=> {
    if (err) {
      res.statusCode = 500;
      res.json({error: err, url: req.url});
    } else {
      res.json({url: req.url, data: data});
    }
  });
});

app.listen(3000, function() {
  console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
