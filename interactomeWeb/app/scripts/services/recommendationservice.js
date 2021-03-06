'use strict';
/*
  This service takes care of contacting the reccomendation system.

  Not enough error handling to make this service robust. However, due to the looming eventuallity of a complete rewrite, I don't see the point
  in making it robust.
*/
angular.module('interactomeApp.RecommendationService', [])
  .factory('RecommendationService', function RecommendationService($q) {
    var service = {
      // getRecs:
      //   @abstractList: should be a list of the dynamo Id's
      //   Returns: a promise which will resolve to an array of hashes that have paper data from dynamo.
      getRecs: function(papers) {
          var defered = $q.defer();
          var paperLength = papers.length;
          // Scan table for limit number of papers
          if(paperLength > 0) {

            var abstractList = [];
            for(var i = 0; i < paperLength; i++) {
              abstractList[i] = papers[i].Id;
            }
            
            var limit = 100 + paperLength; // min of abstracts needed to make sure no duplicates returned

            var paperTable = new AWS.DynamoDB({params: {TableName: "Paper"}});
            var returnedPapers  = [];
            paperTable.scan({Limit: limit}, function(err, data) {
              if(err)
                console.log(err);
              else { 
                var paperId = "";
                for(var i = 0; i < limit; i++) {
                  paperId = data.Items[i].Id.S;
                  if (abstractList.indexOf(paperId) == -1 )// not in list sent in
                    returnedPapers.push({
                      Id: paperId, 
                      Link: data.Items[i].Link.S,
                      Title: data.Items[i].Title.S.replace(/<[b\sB]+>/g, ''),
                      Authors: (data.Items[i].Authors.S).split(',')
                    })
                }
                defered.resolve(returnedPapers);
              }
            });
          }
          return defered.promise;
        },
    };
    return service;
  });
