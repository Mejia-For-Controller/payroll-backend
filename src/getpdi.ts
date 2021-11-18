function getPdiInfo(tendigitphone) {
    return new Promise((resolve, reject) => {
        var data = qs.stringify({
            'EulaChecked': 'true',
            'FingerPrint': '3931250143',
            'UserName': 'kmejia@mejiaforcontroller.com',
            'Password': 'mejia2022LA',
            'TimeZoneOffset': '0',
            'ReturnUrl': '/Lookup' 
          });
          var config = {
            method: 'post',
            url: 'https://www.onlinecampaigntools.com/PDI',
            headers: { 
              'Connection': 'keep-alive', 
              'Pragma': 'no-cache', 
              'Cache-Control': 'no-cache', 
              'sec-ch-ua-mobile': '?0', 
              'Upgrade-Insecure-Requests': '1', 
              'Origin': 'https://www.onlinecampaigntools.com', 
              'Content-Type': 'application/x-www-form-urlencoded', 
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9', 
              'Sec-Fetch-Site': 'same-origin', 
              'Sec-Fetch-Mode': 'navigate', 
              'Sec-Fetch-User': '?1', 
              'Sec-Fetch-Dest': 'document', 
              'Accept-Language': 'en-US,en;q=0.9', 
            },
            data : data
          };
          
          axios(config)
          .then(function (response) {
            console.log(JSON.stringify(response.data));
          })
          .catch(function (error) {
            console.log(error);
          });
      });
}