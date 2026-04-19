import React, { useEffect, useRef, useCallback } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import Hls from 'hls.js';

// Import plugins
import 'videojs-mobile-ui';
import 'videojs-mobile-ui/dist/videojs-mobile-ui.css';

// --- Platform Detection (computed once) ---
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = isIOS || /Android/i.test(navigator.userAgent);
// On iOS, ALL browsers use WebKit engine - so always use native HLS
const useNativeHLS = isIOS;

const VideoPlayer = ({ url, muted = true, autoPlay = true, poster = '', isPlayback = false }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hlsRef = useRef(null);
  const resizeTimerRef = useRef(null);

  useEffect(() => {
    // 1. Initialize player only once
    if (!playerRef.current && videoRef.current) {
      const player = playerRef.current = videojs(videoRef.current, {
        autoplay: autoPlay,
        controls: true,
        responsive: true,
        fill: true,
        fluid: false,
        muted: muted,
        poster: poster,
        // On mobile use 'metadata' to avoid heavy preloading that causes CPU spikes on resize
        preload: isMobile ? 'metadata' : 'auto',
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        seekButtons: isPlayback ? {
          forward: 10,
          back: 10
        } : false,
        // Allow mobile browsers to use their native fullscreen implementation 
        // (this allows iOS to enter the native video player on fullscreen)
        preferFullWindow: false,
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

      // 3. Handle Fullscreen Orientation (non-iOS only, iOS uses preferFullWindow)
      if (!isIOS) {
        player.on('fullscreenchange', () => {
          if (player.isFullscreen()) {
            if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
              window.screen.orientation.lock('landscape').catch(e => {
                console.log("Could not lock orientation:", e);
              });
            }
          } else {
            if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
              window.screen.orientation.unlock();
            }
          }
        });
      }
    }

    const player = playerRef.current;
    if (!player) return;

    // 4. Clear previous HLS instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // 5. Load NEW URL
    console.log("VideoPlayer: Loading source:", url, "isPlayback:", isPlayback, "useNativeHLS:", useNativeHLS);

    if (url.endsWith('.m3u8')) {
      if (!useNativeHLS && Hls.isSupported()) {
        // Non-iOS: use hls.js (desktop Chrome, Firefox, Android, etc.)
        const hls = new Hls({
          // Disable worker on mobile to reduce memory pressure during orientation changes
          enableWorker: !isMobile,
          lowLatencyMode: !isPlayback,
          backBufferLength: isMobile ? 15 : 30,
          maxBufferLength: isMobile ? 20 : 30,
          maxMaxBufferLength: isMobile ? 30 : 600,
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
        // iOS (all browsers) or Safari: use native HLS which WebKit handles natively
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
      // Clear any pending resize timer
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
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

  // 6. Handle orientation change / resize with DEBOUNCE to prevent CPU spike
  useEffect(() => {
    // Debounced resize handler - prevents rapid-fire resize events on iOS
    // from causing layout thrashing and CPU spikes
    const handleResize = () => {
      // Clear any existing timer to debounce
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }

      resizeTimerRef.current = setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.trigger('resize');
        }
        resizeTimerRef.current = null;
      }, 500); // 500ms debounce - iOS fires many events during rotation animation
    };

    // Use 'orientationchange' for legacy iOS, 'resize' as fallback
    // Only listen to orientationchange on mobile to avoid unnecessary desktop events
    if (isMobile) {
      window.addEventListener('orientationchange', handleResize);
    }
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (isMobile) {
        window.removeEventListener('orientationchange', handleResize);
      }
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }
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
          x5-video-player-type="h5"
          x5-video-player-fullscreen="true"
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
        


        /* Prevent iOS rubber-banding / overscroll during video interaction */
        .custom-videojs-theme .video-js {
          -webkit-overflow-scrolling: auto;
          touch-action: manipulation;
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
