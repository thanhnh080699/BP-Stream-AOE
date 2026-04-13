import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import Hls from 'hls.js';

// Import plugins
import 'videojs-mobile-ui';
import 'videojs-mobile-ui/dist/videojs-mobile-ui.css';

const VideoPlayer = ({ url, muted = true, autoPlay = true, poster = '', isPlayback = false }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    // 1. Initialize player only once
    if (!playerRef.current && videoRef.current) {
      const player = playerRef.current = videojs(videoRef.current, {
        autoplay: autoPlay,
        controls: true,
        responsive: true,
        fluid: true,
        muted: muted,
        poster: poster,
        preload: 'auto',
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        seekButtons: isPlayback ? {
          forward: 10,
          back: 10
        } : false,
        userActions: { 
          hotkeys: function(event) {
            // Add custom hotkey support for Left/Right arrows
            // Arrow Left = 37, Arrow Right = 39
            if (event.which === 37) {
              this.currentTime(this.currentTime() - 10);
            } else if (event.which === 39) {
              this.currentTime(this.currentTime() + 10);
            } else if (event.which === 32) { // Space
              if (this.paused()) this.play();
              else this.pause();
            }
          }
        },
        controlBar: {
          children: [
            'playToggle',
            'volumePanel',
            'currentTimeDisplay',
            'timeDivider',
            'durationDisplay',
            'progressControl',
            'liveDisplay',
            'playbackRateMenuButton',
            'fullscreenToggle',
          ],
        },
      });

      // 2. Initialize Plugins
      if (isPlayback) {
        // Mobile UI for double tap to seek
        if (typeof player.mobileUi === 'function') {
          player.mobileUi({
            forceForDesktop: false,
            touchControls: {
              seekSeconds: 10,
              tapTimeout: 300,
              disableOnEnd: false
            }
          });
        }
      }

      // 3. Handle Fullscreen Orientation
      player.on('fullscreenchange', () => {
        if (player.isFullscreen()) {
          // Try to lock landscape on mobile
          if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
            window.screen.orientation.lock('landscape').catch(e => {
              console.log("Could not lock orientation:", e);
            });
          }
        } else {
          // Unlock on exit
          if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
            window.screen.orientation.unlock();
          }
        }
      });
    }

    const player = playerRef.current;
    if (!player) return;

    // 4. Clear previous HLS instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // 5. Load NEW URL
    console.log("VideoPlayer: Loading source:", url, "isPlayback:", isPlayback);

    if (url.endsWith('.m3u8')) {
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      if (Hls.isSupported() && !isSafari) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: !isPlayback, // Low latency only for live
          backBufferLength: 30,
          manifestLoadingMaxRetry: 10,
          levelLoadingMaxRetry: 10,
        });

        hls.loadSource(url);
        hls.attachMedia(videoRef.current);
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
              case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
              default: hls.destroy(); break;
            }
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoPlay) {
            player.play().catch(e => console.log("HLS Autoplay blocked", e));
          }
        });
      } else {
        player.src({ src: url, type: 'application/x-mpegURL' });
        if (autoPlay) player.play().catch(e => console.log("Native HLS Autoplay blocked", e));
      }
    } else {
      player.src({ src: url, type: 'video/mp4' });
      if (autoPlay) player.play().catch(e => console.log("MP4 Autoplay blocked", e));
    }

    // Update settings if they changed
    player.muted(muted);
    if (poster) player.poster(poster);

  }, [url, autoPlay, muted, poster, isPlayback]);

  // Handle disposal only on UNMOUNT
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  // 6. Handle iOS orientation change / resize issues in fullscreen
  useEffect(() => {
    const handleResize = () => {
      if (playerRef.current) {
        setTimeout(() => {
          if (playerRef.current) {
            playerRef.current.trigger('resize');
          }
        }, 200);
      }
    };

    window.addEventListener('orientationchange', handleResize);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="w-full h-full bg-black custom-videojs-theme">
      <div data-vjs-player className="w-full h-full">
        <video
          ref={videoRef}
          className="video-js vjs-big-play-centered vjs-theme-city"
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
        />
      </div>

      <style>{`
        .custom-videojs-theme .video-js {
          background-color: #000;
          font-family: 'Roboto', sans-serif;
        }
        .custom-videojs-theme .vjs-big-play-button {
          background-color: rgba(241, 129, 46, 0.8) !important;
          border-color: #f1812e !important;
          border-radius: 50% !important;
          width: 2.2em !important;
          height: 2.2em !important;
          line-height: 2.2em !important;
          margin-top: -1.1em !important;
          margin-left: -1.1em !important;
          border-width: 2px !important;
          transition: transform 0.2s ease;
        }
        .custom-videojs-theme .vjs-big-play-button:hover {
            transform: scale(1.1);
            background-color: #f1812e !important;
        }
        .custom-videojs-theme .vjs-play-progress {
          background-color: #f1812e !important;
        }
        .custom-videojs-theme .vjs-volume-level {
          background-color: #f1812e !important;
        }
        .custom-videojs-theme .vjs-control-bar {
          background-color: rgba(11, 14, 20, 0.9) !important;
          backdrop-filter: blur(12px);
          height: 3.5em !important;
        }
        /* Custom stylings for seek buttons */
        .vjs-seek-button {
            width: 2.5em !important;
            cursor: pointer;
            transition: color 0.2s;
        }
        .vjs-seek-button:hover {
            color: #f1812e !important;
        }
        .vjs-seek-button.skip-back {
            background-image: none !important;
        }
        .vjs-seek-button.skip-forward {
            background-image: none !important;
        }
        
        .video-js.vjs-fluid {
            padding-top: 56.25% !important; /* 16:9 */
            height: 0 !important;
        }
        /* Fix iOS black screen on fullscreen rotation */
        .video-js.vjs-fullscreen {
            padding-top: 0 !important;
            height: 100% !important;
            width: 100% !important;
        }
        .vjs-fullscreen .vjs-tech {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain;
        }
        .vjs-poster {
            background-size: cover !important;
        }
        /* Show time displays always */
        .vjs-current-time, .vjs-duration, .vjs-time-divider {
            display: flex !important;
            align-items: center;
        }
        .vjs-current-time-display, .vjs-duration-display {
            font-weight: 700 !important;
            color: #fff !important;
        }
        .vjs-live-display {
            font-weight: 900 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.1em !important;
            color: #ef4444 !important;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;
