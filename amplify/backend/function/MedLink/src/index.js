const fetch = require('node-fetch');

exports.handler = async (event) => {
    const medName = event["queryStringParameters"]['medName']
    if(!event["queryStringParameters"]['medName']){
        return {"error" : "No data passed"}
    }

    const res = await fetch(`https://serpapi.com/search.json?q=${medName}+buy&hl=en&gl=us&google_domain=google.com&api_key=e77c1897d9e49d98ff3150a06f6031f4ba0cab48ee3c52fc776e236c9d16ed64`);
    const data = await res.json();
    //Getting the Webiste Names
    let firstLink = "Medicine Store";
    let secondLink = "Medicine Store";
    let thirdLink = "Medicine Store";
    
    
        //Search First Link

        if(data.organic_results[0].link.search('1mg.com') !== -1){
            firstLink = "1mg"
        };
        if(data.organic_results[0].link.search('practo.com') !== -1){
            firstLink = "Practo"
        };
        if(data.organic_results[0].link.search('apollopharmacy.in') !== -1){
            firstLink = "Apollo Pharmacy"
        };
        if(data.organic_results[0].link.search('pharmeasy.in') !== -1){
            firstLink = "Pharmeasy"
        };
        if(data.organic_results[0].link.search('netmeds.com') !== -1){
            firstLink = "Net Meds"
        };
        if(data.organic_results[0].link.search('indiamart.com') !== -1){
            firstLink = "India Mart"
        }

        //Search Second Link

        if(data.organic_results[1].link.search('1mg.com') !== -1){
            secondLink = "1mg"
        };
        if(data.organic_results[1].link.search('practo.com') !== -1){
            secondLink = "Practo"
        };
        if(data.organic_results[1].link.search('apollopharmacy.in') !== -1){
            secondLink = "Apollo Pharmacy"
        };
        if(data.organic_results[1].link.search('pharmeasy.in') !== -1){
            secondLink = "Pharmeasy"
        };
        if(data.organic_results[1].link.search('netmeds.com') !== -1){
            secondLink = "Net Meds"
        };
        if(data.organic_results[1].link.search('indiamart.com') !== -1){
            secondLink = "India Mart"
        };

        //Search third Link

        if(data.organic_results[2].link.search('1mg.com') !== -1){
            thirdLink = "1mg"
        }
        if(data.organic_results[2].link.search('practo.com') !== -1){
            thirdLink = "Practo"
        }
        if(data.organic_results[2].link.search('apollopharmacy.in') !== -1){
            thirdLink = "Apollo Pharmacy"
        }
        if(data.organic_results[2].link.search('pharmeasy.in') !== -1){
            thirdLink = "Pharmeasy"
        }
        if(data.organic_results[2].link.search('netmeds.com') !== -1){
            thirdLink = "Net Meds"
        }
        if(data.organic_results[2].link.search('indiamart.com') !== -1){
            thirdLink = "India Mart"
        }

        const bestBuyLinkData =         [
            {
                "store": firstLink,
                "link" : data.organic_results[0].link
            },
            {
                "store": secondLink,
                "link" : data.organic_results[1].link
            },
            {
                "store": thirdLink,
                "link" : data.organic_results[2].link
            },
        ]

    console.log(bestBuyLinkData)

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
          },
        "body": JSON.stringify(bestBuyLinkData),
        "isBase64Encoded": false,  
    };
};
