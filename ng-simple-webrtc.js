angular.module('SimpleWebRTC', [])
  .controller('WatchController', function ($scope, $element) {
    var webrtc, watchingVideo;

    $scope.joinRoom = function joinRoom(roomName) {
      console.log('watching room', roomName);

      webrtc = new SimpleWebRTC({
        autoRequestMedia: false,
        debug: false
      });
      webrtc.mute();
      webrtc.on('readyToCall', function () {
        console.log('webrtc ready to call');
      });
      webrtc.joinRoom($scope.roomName);

      webrtc.on('videoAdded', function (video, peer) {
        console.log('video added from peer nickname', peer.nick);

        var remotes = document.getElementById('remotes');
        remotes.appendChild(video);
        watchingVideo = video;

        $scope.joinedRoom = true;
        $scope.$apply();
      });

      webrtc.on('iceFailed', function (peer) {
        console.error('ice failed', peer);
      });

      webrtc.on('connectivityError', function (peer) {
        console.error('connectivity error', peer);
      });
    };

    $scope.leaveRoom = function leaveRoom(roomName) {
      console.log('leaving room', roomName);
      webrtc.leaveRoom(roomName);

      if (watchingVideo) {
        var remotes = document.getElementById('remotes');
        remotes.removeChild(watchingVideo);
      }
      $scope.joinedRoom = false;
    };
  })
  .controller('BroadcastController', function ($scope, $element) {
    if (typeof SimpleWebRTC === 'undefined') {
      throw new Error('Cannot find SimpleWebRTC code');
    }

    var webrtc;

    $scope.prepare = function prepareToBroadcast() {
      // TODO read local video element id from $element attribute
      webrtc = new SimpleWebRTC({
        // the id/element dom element that will hold "our" video
        localVideoEl: 'localVideo',
        autoRequestMedia: true,
        debug: false,
        nick: 'ng-simple-webrtc'
      });
      webrtc.mute();

      webrtc.on('localStream', function (stream) {
        console.log('got video stream from local camera');
        $scope.hasStream = true;
        $scope.$apply();
      });

      webrtc.on('localMediaError', function (err) {
        console.error('local camera error', err);
      });
    };

    $scope.start = function start(roomName) {
      console.log('starting room', roomName);

      webrtc.createRoom(roomName, function (err, name) {
        if (err) {
          throw err;
        }
        console.log('Created room', name);
        $scope.broadcasting = true;
        $scope.$apply();
      });
    };
  });
