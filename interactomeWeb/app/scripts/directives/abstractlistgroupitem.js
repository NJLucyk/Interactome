'use strict';
/**
  Represents a single abstract. This uses a list-group-item as the tag.
**/

angular.module('interactomeApp')
  .directive('abstractListGroupItem', function () {
  	var urlBase = "https://s3-us-west-2.amazonaws.com/sagebionetworks-interactome-abstracts/";
    return {	
      	restrict: 'E',
      	scope: {
      		abstractId: '@'
      	},
		    controller: ['$scope', '$http', 'AwsService', function($scope, $http, AwsService) {
      		$scope.getS3Data = function() {
      			$http.get(urlBase + $scope.abstractId).success(function(data){
      				$scope.s3Data = data;
      			})
      		};

          $scope.likeClick = function() {
            console.log("liked " + $scope.abstractId);
            AwsService.postMessageToSNS('arn:aws:sns:us-west-2:005837367462:abstracts_liked', $scope.abstractId);
          };

          $scope.dislikeClick = function() {
            console.log("disliked " + $scope.abstractId);
            AwsService.postMessageToSNS('arn:aws:sns:us-west-2:005837367462:abstracts_disliked', $scope.abstractId);
          };

    	}],
    	template: '<li class="list-group-item">' +
                  '<div class="btn-group" data-toggle="buttons">' +
        					 '<button type="radio" class="btn btn-xs btn-primary" ng-click="likeClick()"><span class="glyphicon glyphicon-thumbs-up"></span></button>' +
                   '<button type="radio" class="btn btn-xs btn-primary" ng-click="dislikeClick()"><span class="glyphicon glyphicon-thumbs-down"></span></button>' +
                  '</div>' +
        	        '<h4 class="list-group-item-heading"> {{s3Data.AbstractTitle}} </h4>' +
            	    '<input type="checkbox" class="pull-right abstractChck" value="{{abstractId}}">' +
                	'<p class="list-group-item-text"> Author: {{s3Data.FirstName[0] + ". " + s3Data.LastName}} </p>' +
              	'</li>',
      link: function (scope, element, attrs) {
      	scope.abstractId = attrs.abstractId;
        scope.getS3Data();
      }
    };
  });
