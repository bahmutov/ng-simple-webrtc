angular.module('SimpleWebRTC', [])
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
        nick: 'room-test'
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
      });
    };
  });
