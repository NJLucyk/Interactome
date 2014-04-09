'use strict';
/**
    This service handles the AWS resources. Setting or getting, should be through this API.


var app = angular.module('interactomeApp.Awsservice', []);


// creating service type provider. Provider used to configure service before app runs. 
app.provider('AwsService', function() {

    I decided to use an observer pattern for notifying subscribers instead of $watch and $digest. I couldn't seem to get them to bind correctly
    when trying to use the mainCtrl. The observer pattern is slightly more wordy
**/
var app = angular.module('interactomeApp.AwsService', [])


// creating service type provider. Provider used to configure service before app runs.
app.provider('AwsService', function() {
    var self = this;
    AWS.config.region = 'us-west-2';
    self.arn = null;

    self.setArn = function(arn) {
        if (arn) self.arn = arn;
    }

    self.setRegion = function(region) {
        if (region) AWS.config.region = region;
    }

    self.$get = function($q, $cacheFactory, $http, $rootScope) {
        var _TOKENBROADCAST = 'tokenSet@AwsService';
        var credentialsDefer = $q.defer();
        var credentialsPromise = credentialsDefer.promise;
        var DynamoTopics = [];
        var _SNSTopics = {};
        return {

            // Simple getters / constants
            credentials: function() {
                return credentialsPromise;
            },
            tokenSetBroadcast: _TOKENBROADCAST,

            setToken: function(token) {
                var config = {
                    RoleArn: self.arn,
                    WebIdentityToken: token,
                    RoleSessionName: 'sage-app'

                }

                self.config = config;
                AWS.config.credentials =
                    new AWS.WebIdentityCredentials(config);
                credentialsDefer
                    .resolve(AWS.config.credentials);


                // Let anyone listening that AWS resources can now be used
                self._lastEvalKey = null;
                $rootScope.$broadcast(_TOKENBROADCAST);
            }, // end of setToken func 

            /*getSequence: function() {
                var sequenceDefer = $q.defer();
                var dynamodb = new AWS.DynamoDB();
                var params = {
                    TableName: 'Sequencer',
                    AttributesToGet: [
                        'Sequence',
                    ],
                    ConsistentRead: true,
                    Key: {
                        Id: {
                            'N': 1,
                        }
                    },
                };
                dynamodb.getItem(params, function(err, data) {
                    if (err) console.log(err. err.stack);
                    else {
                        console.log("sequence",data.Item['Sequence']['N']);
                        sequenceDefer.resolve(data.Item['Sequence']['N']);
                    }
                })
                return sequenceDefer.promise;

            }*/

            // Gets topics from dynamo table, currently paper Id's
            // Should eventually return paper Names and/or links
            getTopics: function() {
                var topicDefer = $q.defer();
                var dynamodb = new AWS.DynamoDB(); // should we catch error for this too?
                var params = {
                    TableName: 'Topic',
                    Select: 'ALL_ATTRIBUTES',
                };
                var topicsArray = []; // list of dictionaries
                dynamodb.scan(params, function(err, data) {
                    if (err) console.log(err, err.stack);
                    else {
                        for(var i = 0; i < data.Count; i++) { // loop through all Topic entrees
                            if('List' in data.Items[i]) { // add paper array to topics array if exists
                                var papersArray = data.Items[i]['List']['SS'];
                                topicsArray.push({
                                    Name: data.Items[i]['Name']['S'],
                                    PapersList: papersArray
                                });
                            }
                            else {
                                topicsArray.push({
                                    Name: data.Items[i]['Name']['S'] 
                                });
                            }
                        }
                        topicDefer.resolve(topicsArray);
                    }
                });
                return topicDefer.promise;
            },

            // puts new Topic item into Dynamo
            _putNewTopic: function(username, topicname) { // private
                var defer = $q.defer();
                var dynamodb = new AWS.DynamoDB();

                // params to update & get new Sequence from Sequencer table
                var sequenceParams = {
                    TableName: 'Sequencer',
                    AttributeUpdates: {
                        Sequence: {
                            Action: 'ADD',
                            Value: {
                                N: '1',
                            },
                        },
                    },
                    Key: {
                        Id: {
                            N: '1',
                        }
                    },
                    ReturnValues: 'UPDATED_NEW',
                };
                var seq = "";

                // call update to Sequencer
                dynamodb.updateItem(sequenceParams, function(err, data) {
                    if (err) {
                        console.log(err, err.stack);
                        defer.reject();
                    }
                    else {
                        seq = data.Attributes['Sequence']['N'];

                        // params to put new item into Topics
                        var putParams = {
                            Item: {
                                Id: {
                                    S: 'Topic' + seq
                                },
                                Name: {
                                    S: topicname
                                },
                                User: {
                                    S: username
                                }
                            },
                            TableName: 'Topic'
                        };

                        // call udpate to Topic
                        dynamodb.putItem(putParams, function(err, data) {
                            if (err) {
                                console.log(err, err.stack);
                                defer.reject();
                            }
                            else {
                                defer.resolve();
                            }
                        });
                    }
                });
                return defer.promise;
            },

            // Adds topic to Dynamo Topic table
            addTopic: function(username, topicName) {
                var topicDefer = $q.defer();
                var dynamodb = new AWS.DynamoDB();
                var self = this;
                var params = {
                    TableName: 'Topic',
                    IndexName: 'User-index',
                    Select: 'COUNT',
                    KeyConditions: {
                        User: {
                            ComparisonOperator: 'EQ',
                            AttributeValueList: [
                                {
                                    'S': username,
                                }
                            ],
                        },
                        Name: {
                            ComparisonOperator: 'EQ',
                            AttributeValueList: [
                                {
                                    'S': topicName,
                                },
                            ],
                        }
                    },
                };

                dynamodb.query(params, function(err, data) {
                    if (err) {
                        console.log(err, err.stack); // call error
                        topicDefer.reject();
                    }
                    else if (data.Count == 0) { // if topic doesn't exist, add it
                        self._putNewTopic(username,topicName).then(function() {
                            topicDefer.resolve();
                        }, function() {
                            topicDefer.reject();
                        });
                        
                    }
                    else { // if exists, don't add
                        topicDefer.reject("Topic already exists");
                    }
                });

                return topicDefer.promise;
            },

            // Gets the next limit number of papers from dynamo
            // This will eventually be done using the rec service (instead of scanning)
            getPapers: function(limit) {
                var paperDefer = $q.defer();
                var papers = [];
                var paperTable = new AWS.DynamoDB({
                    params: {
                        TableName: "Paper"
                    }
                });
                var scanParams = {
                    Limit: limit
                };
                if (self._lastEvalKey != null)
                    scanParams.ExclusiveStartKey = self._lastEvalKey;

                paperTable.scan(scanParams, function(err, data) {
                    if (err)
                        console.log(err);

                    else {
                        for (var i = 0; i < data.Items.length; i++) {
                            papers.push({
                                Id: data.Items[i].Id.S,
                                Link: data.Items[i].Link.S
                            });

                        }
                        self._lastEvalKey = data.LastEvaluatedKey;
                        paperDefer.resolve(papers);
                    }
                });

                return paperDefer.promise;
            },

            // General way to post a msg to a topic.
            // Topics are stored inside of a hash for optimization.
            postMessageToSNS: function(topicArn, msg) {
                if (!topicArn || !msg) {
                    console.log("postMessageToSNS param error. topicArn: " + topicArn + " msg: " + msg);
                    return;
                }

                // We store the SNS on first topic usage to avoid multiple instantiations
                var sns = _SNSTopics[topicArn];
                if (sns == undefined) {
                    sns = new AWS.SNS({
                        params: {
                            TopicArn: topicArn
                        }
                    });
                    _SNSTopics[topicArn] = sns;
                }

                sns.publish({
                    Message: msg
                }, function(err, data) {
                    // if (!err) console.log(publishedmsg);
                });
            },

            // Adds the abstractId into either the "Likes" or "Dislikes" attribute in "Interactions."
            // Was unsure about naming conventions with get, set, post etc.
            updateDynamoPref: function(absId, liked, username) {
                var recLikesTable = new AWS.DynamoDB({
                    params: {
                        TableName: 'Recommendation_Likes'
                    }
                });

                if (liked) {
                    var params = {
                        AttributesToGet: [
                            'Dislikes'
                        ],
                        Key: {
                            "User": {
                                "S": username
                            },
                            "Context": {
                                "S": 'GeneralThread'
                            }
                        }
                    };

                    // Unfinished - once done this will check to see if the abstract exists in the dislikes
                    // attribute, if so it will remove it. 
                    recLikesTable.getItem(params, function(err, data) {
                        if (err)
                            console.log("Error: " + err);
                        else {
                            // Check if abstract in Dislikes then remove and place in likes
                        }
                    });

                    // To store the absId
                    var likesArr = [absId];

                    var updateParams = {
                        Key: {
                            "User": {
                                "S": username
                            },
                            "Context": {
                                "S": 'GeneralThread'
                            }
                        },
                        AttributeUpdates: {
                            "Likes": {
                                "Action": "ADD",
                                "Value": {
                                    "SS": likesArr
                                }
                            }
                        }
                    }

                    // Update our table to include the new abstract
                    recLikesTable.updateItem(updateParams, function(err, data) {
                        if (err)
                            console.log("Error: " + err);
                        else {
                            console.log("Success!" + data)
                        }
                    });

                } else {
                    // almost identical to likes
                    var params = {
                        AttributesToGet: [
                            'Likes'
                        ],
                        Key: {
                            "User": {
                                "S": username
                            },
                            "Context": {
                                "S": 'GeneralThread'
                            }
                        }
                    };

                    recLikesTable.getItem(params, function(err, data) {
                        if (err)
                            console.log("Error: " + err);
                        else {
                            // Check if abstract in Likes then remove and place in likes
                        }
                    });


                    var dislikesArr = [absId];

                    var updateParams = {
                        Key: {
                            "User": {
                                "S": username
                            },
                            "Context": {
                                "S": 'GeneralThread'
                            }
                        },
                        AttributeUpdates: {
                            "Dislikes": {
                                "Action": "ADD",
                                "Value": {
                                    "SS": dislikesArr
                                }
                            }
                        }
                    }

                    // Update our table to include the new abstract
                    recLikesTable.updateItem(updateParams, function(err, data) {
                        if (err)
                            console.log("Error: " + err);
                        else {
                            console.log("Success!" + data)
                        }
                    });
                }

            }


        } // end of return 
    }
});

app.factory('SearchService', function($q) {

    // factory returns entire service as object 
    return {
        showResults: function(institution) {
            var results = institution;
            var defered = $q.defer(); // set up defered for asyncronous calls to Dynamo 

            var userTable = new AWS.DynamoDB();
            // Set params for query 
            var params = {
                TableName: 'User',
                IndexName: 'InstitutionName-index',
                KeyConditions: {
                    "InstitutionName": {
                        "AttributeValueList": [{


                            "S": results

                        }],

                        ComparisonOperator: "EQ"
                    }
                }
            };

            var userData = [];
            // run query 
            userTable.query(params, function(err, data) {
                if (err) {

                    console.log(err);
                } else {

                    for (var i = 0; i < data.Items.length; i++) {

                        userData.push(data.Items[i]);
                    }

                    // resolve defered 
                    defered.resolve(userData);

                }
            });
            // return promise 
            return defered.promise;
        },
    };
});








/* Yo build came with this, commented it out. 
.service('Awsservice', function Awsservice() {
    // AngularJS will instantiate a singleton by calling "new" on this function
});
*/