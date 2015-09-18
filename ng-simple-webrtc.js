(function (angular) {
  'use strict';
  if (!angular) {
    throw new Error('Missing Angular library');
  }

  angular.module('SimpleWebRTC', [])
    .run(function () {
      if (typeof SimpleWebRTC === 'undefined') {
        throw new Error('Cannot find SimpleWebRTC code');
      }
    })
    .directive('watchRoom', function () {
      return {
        template: '<div ng-show="joinedRoom">' +
          '<div id="remotes"></div>' +
          '</div>',
        scope: {
          roomName: '=',
          joinedRoom: '=',
          videoList: '=',
          maxNumPeers: '=',
          nick: '='
        },
        link: function (scope, element, attr) {
          scope.muted = attr.muted === 'true';
        },
        controller: function ($scope, $rootScope) {
          var webrtc, watchingVideo;

          $scope.maxNumPeers = typeof $scope.maxNumPeers === 'number' ?
            $scope.maxNumPeers : 10;

          function formRTCOptions() {
            var webrtcOptions = {
                autoRequestMedia: false,
                debug: false,
                nick: $scope.nick,
                receiveMedia: { // FIXME: remove old chrome <= 37 constraints format
                  mandatory: {
                      OfferToReceiveAudio: false,
                      OfferToReceiveVideo: true
                  }
                }
              };
            grabExtraWebRTCOptions(webrtcOptions);
            return webrtcOptions;            
          }

          function postCreationRTCOptions(webrtc) {
          }

          function rtcEventResponses(webrtc) {
            webrtc.on('readyToCall', function () {
              console.log('webrtc ready to call');
            }); 
          
            webrtc.on('joinedRoom', function (name) {
              console.log('joined room "%s"', name);

              var peers = webrtc.getPeers();
              if (peers && Array.isArray(peers) &&
                peers.length > $scope.maxNumPeers) {
                console.error('Too many people in the room, leaving');
                webrtc.leaveRoom();
                $scope.$emit('room-full');
                return;
              }

              $scope.$emit('joinedRoom', name);

              webrtc.on('channelMessage', function (peer, message) {
                console.log('received channel message "%s" from peer "%s"',
                  message, peer.nick || peer.id);
                $scope.$emit('channelMessage', peer, JSON.parse(message));
                $scope.$apply();
              });
            });
            $scope.$on('messageAll', function (event, message) {
              if (message && webrtc) {
                webrtc.sendDirectlyToAll(JSON.stringify(message));
              }
            });
            webrtc.on('videoRemoved', function (video, peer) {
              if (Array.isArray($scope.videoList)) {
                for (var i = 0; i < $scope.videoList.length; i++) {
                  if (video.id === $scope.videoList[i].id) {
                    $scope.videoList.splice(i, 1);
                    $scope.$apply();
                    return;
                  }
                }
              }
            });
            webrtc.on('videoAdded', function (video, peer) {
              console.log('video added from peer nickname', peer.nick);
              if ($scope.muted) {
                video.setAttribute('muted', true);
                video.setAttribute('hidden', true);
              }

              // videoList is an array, it means the user wants to append the video in it
              // so, skip manual addition to dom
              if (Array.isArray($scope.videoList)) {
                video.isRemote = true;
                $scope.videoList.push(video);
                $scope.joinedRoom = true;
                $scope.$apply();
                return;
              }

              var remotes = document.getElementById('remotes');
              remotes.appendChild(video);
              watchingVideo = video;

              $scope.$emit('videoAdded', video);
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

          // emit this event, and we join the room.
          $scope.$on('joinRoom', function joinRoom() {
            console.log('joining room', $scope.roomName);
            if (!$scope.roomName) {
              return;
            }

            var webrtcOptions = formRTCOptions();
            webrtc = new SimpleWebRTC(webrtcOptions);
            postCreationRTCOptions(webrtc);
            $rootScope.webrtc = webrtc;
            rtcEventResponses(webrtc);

            // Post WebRTC Options
            // And, a joinRoom command.

            webrtc.mute();
            webrtc.joinRoom($scope.roomName);
          });
        }
      }
    })

// ====================================================================================================================================

    .directive('broadcaster', function () {
      return {
        template: '<h2>My video</h2>' +
          '<div class="local-video-wrapper" ng-show="hasStream">' +
          '<video id="localVideo" ng-attr-muted="{{ muted }}"></video>' +
          '</div>',
        scope: {
          hasStream: '=',
          roomName: '=',
          isBroadcasting: '=',
          sourceId: '=',
          minWidth: '=',
          minHeight: '=',
          videoList: '=',
          nick: '='
        },
        link: function (scope, element, attr) {
          scope.mirror = attr.mirror === 'true';
          scope.muted = attr.muted === 'true';
        },
        controller: function ($scope, $rootScope) {
          var webrtc;

          function formRTCOptions() {
            var webrtcOptions = {
              // the id/element dom element that will hold "our" video
              localVideoEl: 'localVideo',
              autoRequestMedia: true,
              debug: false,
              nick: $scope.nick,
              media: {
                audio: false,
                video: true
              },
              receiveMedia: { // FIXME: remove old chrome <= 37 constraints format
                mandatory: {
                    OfferToReceiveAudio: false,
                    OfferToReceiveVideo: false
                }
              }
            };
            grabExtraWebRTCOptions(webrtcOptions);

            if ($scope.muted) {
              webrtcOptions.media = {
                audio: false,
                video: true
              };
            }
            // source id returned from navigator.getUserMedia (optional)
            var sourceId = $scope.sourceId;
            if (sourceId) {
              console.log('requesting video camera with id ' + sourceId);
              webrtcOptions.media.video = {
                optional: [{ sourceId: sourceId }]
              };
            }
            if ($scope.minWidth) {
              var minWidth = parseInt($scope.minWidth);
              if (typeof webrtcOptions.media.video !== 'object') {
                webrtcOptions.media.video = {};
              }
              webrtcOptions.media.video.mandatory = {
                minWidth: minWidth,
                maxWidth: minWidth
              };
            }
            return webrtcOptions;
          }

          // options to make after the webrtc object is created.
          function postCreationRTCOptions(webrtc)
          {
            webrtc.config.localVideo.mirror = Boolean($scope.mirror);
            if ($scope.muted) {
              webrtc.mute();
            }
          }

          // event Responses to make after the webrtc object is created.
          function rtcEventResponses(webrtc)
          {
              webrtc.on('localStream', function (stream) {
              console.log('got video stream', stream, 'from the local camera');
              var videoTracks = stream.getVideoTracks();
              console.log('how many video tracks?', videoTracks.length);
              if (videoTracks.length) {
                var first = videoTracks[0];
                console.log('video track label', first.label);
              }
              // videoList is an array, it means the user wants to append the video in it
              if (Array.isArray($scope.videoList)) {
                var video = document.createElement("video");
                video.id = stream.id;
                // TODO use $window service
                video.src = window.URL.createObjectURL(stream);
                video.play();
                video.isRemote = false;
                $scope.videoList.push(video);
              }

              $scope.hasStream = true;
              $scope.$apply();
            });

            webrtc.on('localMediaError', function (err) {
              console.error('local camera error', err,
                'media constraints', webrtc.config.media);
              $scope.$emit('localMediaError', {
                error: err,
                config: webrtc.config.media
              });
            });
          }

          $scope.$on('prepare', function prepareToBroadcast() {
            if (webrtc) {
              console.log('already has prepared');
              return;
            }

            var webrtcOptions = formRTCOptions();
            webrtc = new SimpleWebRTC(webrtcOptions);
            $rootScope.webrtc = webrtc;
            postCreationRTCOptions(webrtc);
            rtcEventResponses(webrtc);

          });

          function isTakenError(err) {
            return err === 'taken';
          }

          function onStartedRoom(name) {
            console.log('joining as broadcaster to room ', name);
            $scope.isBroadcasting = true;
            $scope.$emit('created-room', name);
            $scope.$apply();
          }

          function joinRoomAsBroadcaster() {
            console.log('Trying to join existing room "%s" as broadcaster', $scope.roomName);
            webrtc.joinRoom($scope.roomName);
            $scope.isBroadcasting = true;
            $scope.$emit('created-room', name);
          }

          // 
          $scope.$on('start', function start() {
            console.log('starting room', $scope.roomName);
            if (!$scope.roomName) {
              return;
            }

            webrtc.createRoom($scope.roomName, function (err) {
              if (err) {
                if (isTakenError(err)) {
                  console.log('Room "%s" is taken', $scope.roomName);
                  joinRoomAsBroadcaster();
                } else {
                  $scope.$emit('createRoomError', err);
                  throw new Error(err);
                }
              } else { 
                onStartedRoom($scope.roomName);
              }
            });

            // a peer can send message to everyone in the room using
            // webrtc.sendDirectlyToAll('hi there') or webrtc.sendToAll('hi there')
            webrtc.on('channelMessage', function (peer, message) {
              console.log('received channel message "%s" from peer "%s"',
                message, peer.nick || peer.id);
              var value = JSON.parse(message);
              $scope.$emit('channelMessage', peer, value);
              $scope.$apply();
            });

          });

          $scope.$on('messageAll', function (event, message) {
            if (message && webrtc) {
              var str = JSON.stringify(message);
              webrtc.sendDirectlyToAll(str);
            }
          });
        }
      };
    });

  function grabExtraWebRTCOptions(webrtcOptions) {
    var ngSimpleWebRTC = window.ngSimpleWebRTC || {};
    // This is the turn/stun servers.
    if (typeof ngSimpleWebRTC.peerConnectionConfig !== 'undefined') {
      webrtcOptions.peerConnectionConfig = ngSimpleWebRTC.peerConnectionConfig;
    }
    if (typeof ngSimpleWebRTC.debug !== 'undefined') {
      webrtcOptions.debug = ngSimpleWebRTC.debug;
    }
    if (typeof ngSimpleWebRTC.socketio === 'object') {
      webrtcOptions.socketio = ngSimpleWebRTC.socketio;
    }
  }

}(window.angular));
