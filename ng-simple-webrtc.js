angular.module('SimpleWebRTC', [])
  .run(function () {
    if (typeof SimpleWebRTC === 'undefined') {
      throw new Error('Cannot find SimpleWebRTC code');
    }
  })
  .directive('watchRoom', function () {
    return {
      template: '<div ng-show="joinedRoom">' +
        '<h3>Remote video</h3>' +
        '<div id="remotes"></div>' +
        '</div>',
      scope: {
        roomName: '=',
        joinedRoom: '='
      },
      link: function (scope, element, attr) {
        scope.muted = attr.muted === 'true';
      },
      controller: function ($scope) {
        var webrtc, watchingVideo;

        $scope.$on('joinRoom', function joinRoom() {
          console.log('joining room', $scope.roomName);
          if (!$scope.roomName) {
            return;
          }

          webrtc = new SimpleWebRTC({
            autoRequestMedia: false,
            debug: false
          });
          webrtc.mute();
          webrtc.on('readyToCall', function () {
            console.log('webrtc ready to call');
          });

          webrtc.on('joinedRoom', function (name) {
            console.log('joined room "%s"', name);
            $scope.$emit('joinedRoom', name);
          });

          webrtc.joinRoom($scope.roomName);

          webrtc.on('videoAdded', function (video, peer) {
            console.log('video added from peer nickname', peer.nick);

            if ($scope.muted) {
              video.setAttribute('muted', true);
            }

            var remotes = document.getElementById('remotes');
            remotes.appendChild(video);
            watchingVideo = video;

            $scope.joinedRoom = true;
            $scope.$apply();
          });

          webrtc.on('iceFailed', function (peer) {
            console.error('ice failed', peer);
            $scope.$emit('iceFailed', peer);
          });

          webrtc.on('connectivityError', function (peer) {
            console.error('connectivity error', peer);
            $scope.$emit('connectivityError', peer);
          });
        });

        $scope.$on('leaveRoom', function leaveRoom() {
          console.log('leaving room', $scope.roomName);
          if (!$scope.roomName) {
            return;
          }

          webrtc.leaveRoom($scope.roomName);

          if (watchingVideo) {
            var remotes = document.getElementById('remotes');
            remotes.removeChild(watchingVideo);
          }
          $scope.joinedRoom = false;
        });
      }
    };
  })
  .directive('broadcaster', function () {
    return {
      template: '<h2>My video</h2>' +
        '<div class="local-video-wrapper" ng-show="hasStream">' +
        '<video height="300" id="localVideo" ng-attr-muted={{ muted }}></video>' +
        '</div>',
      scope: {
        hasStream: '=',
        roomName: '=',
        isBroadcasting: '='
      },
      link: function (scope, element, attr) {
        scope.mirror = attr.mirror === 'true';
        scope.muted = attr.muted === 'true';
      },
      controller: function ($scope) {
        var webrtc;

        $scope.$on('prepare', function prepareToBroadcast() {
          if (webrtc) {
            console.log('already has prepared');
            return;
          }

          webrtc = new SimpleWebRTC({
            // the id/element dom element that will hold "our" video
            localVideoEl: 'localVideo',
            autoRequestMedia: true,
            debug: false,
            nick: 'ng-simple-webrtc'
          });
          webrtc.config.localVideo.mirror = Boolean($scope.mirror);
          if (scope.muted) {
            webrtc.mute();
          }

          webrtc.on('localStream', function (stream) {
            console.log('got video stream from local camera');
            $scope.hasStream = true;
            $scope.$apply();
          });

          webrtc.on('localMediaError', function (err) {
            console.error('local camera error', err);
            $scope.$emit('localMediaError', err);
          });
        });

        $scope.$on('start', function start() {
          console.log('starting room', $scope.roomName);
          if (!$scope.roomName) {
            return;
          }

          webrtc.createRoom($scope.roomName, function (err, name) {
            if (err) {
              $scope.$emit('createRoomError', err);
              throw err;
            }
            console.log('Created room', name);
            $scope.isBroadcasting = true;
            $scope.$apply();
          });
        });
      }
    };
  });
