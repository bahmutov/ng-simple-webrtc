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
          '<h3>Remote video</h3>' +
          '<div id="remotes"></div>' +
          '</div>',
        scope: {
          roomName: '=',
          joinedRoom: '=',
          videoList: '='
        },
        link: function (scope, element, attr) {
          scope.muted = attr.muted === 'true';
        },
        controller: function ($scope, $rootScope) {
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
            $rootScope.webrtc = webrtc;

            webrtc.mute();
            webrtc.on('readyToCall', function () {
              console.log('webrtc ready to call');
            });

            webrtc.on('joinedRoom', function (name) {
              console.log('joined room "%s"', name);
              $scope.$emit('joinedRoom', name);

              webrtc.on('channelMessage', function (peer, message) {
                console.log('received channel message "%s" from peer "%s"',
                  message, peer.nick || peer.id);
                $scope.$emit('channelMessage', peer, message);
                $scope.$apply();
              });
            });

            $scope.$on('messageAll', function (event, message) {
              if (message) {
                webrtc.sendDirectlyToAll(message);
              }
            });

            webrtc.joinRoom($scope.roomName);

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
          '<video id="localVideo" ng-attr-muted="{{ muted }}"></video>' +
          '</div>',
        scope: {
          hasStream: '=',
          roomName: '=',
          isBroadcasting: '=',
          sourceId: '=',
          minWidth: '=',
          minHeight: '=',
          videoList: '='
        },
        link: function (scope, element, attr) {
          scope.mirror = attr.mirror === 'true';
          scope.muted = attr.muted === 'true';
        },
        controller: function ($scope, $timeout, $rootScope) {
          var webrtc;

          $scope.$on('prepare', function prepareToBroadcast() {
            if (webrtc) {
              console.log('already has prepared');
              return;
            }

            var webrtcOptions = {
              // the id/element dom element that will hold "our" video
              localVideoEl: 'localVideo',
              autoRequestMedia: true,
              debug: false,
              nick: 'ng-simple-webrtc',
              media: {
                audio: true,
                video: true
              }
            };
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

            function displayVideoResolution() {
              var resolution = {
                width: localVideo.videoWidth,
                height: localVideo.videoHeight
              };
              $scope.$emit('video-resolution', resolution);
              console.log('local video resolution', resolution.width, resolution.height);
            }

            var localVideo = document.getElementById('localVideo');
            if (localVideo) {
              localVideo.addEventListener('play', function localVideoPlay() {
                $timeout(displayVideoResolution, 500);
              });
            }

            webrtc = new SimpleWebRTC(webrtcOptions);
            $rootScope.webrtc = webrtc;

            webrtc.config.localVideo.mirror = Boolean($scope.mirror);
            if ($scope.muted) {
              webrtc.mute();
            }

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
              $scope.$emit('created-room', name);
              $scope.$apply();
            });

            // a peer can send message to everyone in the room using
            // webrtc.sendDirectlyToAll('hi there')
            webrtc.on('channelMessage', function (peer, message) {
              console.log('received channel message "%s" from peer "%s"',
                message, peer.nick || peer.id);
              $scope.$emit('channelMessage', peer, message);
              $scope.$apply();
            });

          });

          $scope.$on('messageAll', function (event, message) {
            if (message) {
              webrtc.sendDirectlyToAll(message);
            }
          });
        }
      };
    });
}(window.angular));
