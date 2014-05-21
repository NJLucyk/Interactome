'use strict';

/**
  Lists collapsible panels of user topics
**/

angular.module('interactomeApp')
  .directive('topicPanelItem', function () {
    return {	
      	restrict: 'E',
        replace: true,
      	scope: { 
          localCheckTopic: '&checkTopic',
          localRenameTopic: '&renameTopic',
          localDeleteTopic: '&delete',
          localGetRecs: '&getRecs',
      		topic: '='
      	},

		    controller: ['$scope', 'AwsService', function($scope, AwsService) {    
          $scope.editorEnabled = false;
          $scope.noAbstracts = null;
          $scope.editableValue = $scope.topic.Name;          
          $scope.placeHolder = 'No abstracts added';

          $scope.enableEdit = function() {
            $scope.editorEnabled = true;
          };

          $scope.disableEdit = function() {
            $scope.editableValue = $scope.topic.Name;
            $scope.editorEnabled = false;
          };

          // save a topic's new name
          $scope.save = function() {
            if(!$scope.localCheckTopic({topicName: $scope.editableValue})) { // check if topicname already exists
              AwsService.renameTopic($scope.topic.Id, $scope.editableValue).then(function() { // updateItem
                $scope.topic.Name = $scope.editableValue; // change view
                $scope.localRenameTopic({topicId: $scope.topic.Id, topicName: $scope.editableValue}); // save in parent scope
                $scope.disableEdit();
              }, function(reason) {
                alert(reason);
              });
            }
            else {
              alert('Topic already exists');
            }
            
          };

          // delete a topic
          $scope.delete = function() {
            var scope = $scope;
            $scope.localDeleteTopic({topicId: scope.topic.Id});
            if($scope.topic.PapersList.length > 1 || $scope.topic.PapersList.length == 1 && $scope.topic.PapersList[0] != $scope.placeHolder) { // contains saved papers

              var al = 'There are ' + $scope.topic.PapersList.length + ' abstracts in "' + scope.topic.Name +
              '". Deleting this topic will also delete the abstracts. Confirm deletion.';

              var confirmation = confirm(al);
              if (confirmation == true) {
                AwsService.deleteTopic($scope.topic.Id).then(function() { // delete in dynamo
                  scope.localDeleteTopic({topicId: scope.topic.Id}); // delete in parent scope
                }, function(reason) {
                  alert(reason);
                });
              }
            }
            else { // no papers
              AwsService.deleteTopic($scope.topic.Id).then(function() {// delete in dynamo
                scope.localDeleteTopic({topicId: scope.topic.Id}); // delete in parent scope
              }, function(reason) {
                alert(reason);
              });
            }
          };

          // adding paper to topic
          $scope.addPaper = function(paperid) {
            var scope = $scope;
            var exists = false;

            var curLength = scope.topic.PapersList.length;
            
            for(var i = 0; i < curLength; i++) { // see if paper already exists
              if (scope.topic.PapersList[i] == paperid) {
                exists = true;
                break;
              }
            }
            if(!exists) { // found paper
              AwsService.saveTopicPaper($scope.topic.Id, paperid).then(function() { // call to dynamo
                if(curLength == 0) {
                  scope.topic.PapersList = [paperid];
                }
                else {
                  scope.topic.PapersList.push(paperid);
                }
              }, function(reason) {
                alert(reason);
              });
            }

            $scope.noAbstracts = false;
            $scope.$apply();
          };

          // delete a paper from a topic
          $scope.deletePaper = function(paperid, index) {
            var scope = $scope;
            AwsService.deleteTopicPaper($scope.topic.Id, paperid).then(function() { // call to dynamo
              scope.topic.PapersList.splice(index, 1);
              var curLength = scope.topic.PapersList.length;
              if(curLength == 0) { // this was the only saved paper
                scope.noAbstracts = true;
              }
            }, function(reason) {
              alert(reason);
            });
          };

          $scope.getRecs = function() {
            $scope.localGetRecs({paperslist: $scope.topic.PapersList});
          };
    	}],
      templateUrl: 'scripts/directives/topicpanelitem.html',
      link: function (scope, element, attrs) {
        if('PapersList' in scope.topic) {
          scope.topic.PapersList.sort();
          scope.noAbstracts = false;
        }
        else {
          scope.topic.PapersList = [];
          scope.noAbstracts = true;
        }

        element.droppable(
        {
          drop: function(event, ui) {
            scope.addPaper($(ui.draggable).data("abId"));
          },
          hoverClass: "ui-state-highlight", 

        });// http://codepen.io/m-e-conroy/pen/gwbqG shows that all I really had to add was replace!
      }
    };
  }); 
