import React, { useEffect, useRef } from 'react';
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
        // iOS: để false - fullscreen sẽ được xử lý thủ công qua webkitEnterFullscreen()
        // giống YouTube (xem phần "iOS Fullscreen Override" bên dưới)
        preferFullWindow: false,
        userActions: {
          hotkeys: function(event) {
            if (event.which === 37) {
              this.currentTime(this.currentTime() - 10);
            } else if (event.which === 39) {
              this.currentTime(this.currentTime() + 10);
            } else if (event.which === 32) {
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

      // 3. iOS Fullscreen Override - YouTube approach
      // -----------------------------------------------
      // Vấn đề gốc: video.js gọi webkitEnterFullscreen() nhưng đồng thời vẫn
      // cố quản lý fullscreen state (trigger resize, update UI...) → conflict với
      // native iOS player → shrink/expand, đơ, không tua được.
      //
      // Giải pháp: giống YouTube - bypass hoàn toàn video.js fullscreen logic,
      // chỉ gọi thẳng webkitEnterFullscreen() trên thẻ <video> gốc.
      // Native iOS player sẽ tự quản lý mọi thứ (controls, seek, exit...).
      if (isIOS) {
        player.ready(() => {
          const fullscreenToggle = player.controlBar?.fullscreenToggle;
          if (fullscreenToggle) {
            // Xóa handler mặc định của video.js
            fullscreenToggle.off('tap');
            fullscreenToggle.off('click');

            // Gắn handler mới: gọi thẳng native API như YouTube
            fullscreenToggle.on(['tap', 'click'], () => {
              // Lấy thẻ <video> gốc qua video.js tech layer
              const techEl = player.tech(true)?.el();
              if (!techEl) return;

              if (techEl.webkitDisplayingFullscreen) {
                // Đang fullscreen → thoát
                techEl.webkitExitFullscreen?.();
              } else if (techEl.webkitEnterFullscreen) {
                // Vào fullscreen native - iOS sẽ handle toàn bộ
                // (controls, seeking, exit button) giống YouTube
                techEl.webkitEnterFullscreen();
              }
            });
          }

          // Sync class vjs-fullscreen để icon button đúng trạng thái
          const techEl = player.tech(true)?.el();
          if (techEl) {
            techEl.addEventListener('webkitbeginfullscreen', () => {
              player.addClass('vjs-fullscreen');
            });
            techEl.addEventListener('webkitendfullscreen', () => {
              player.removeClass('vjs-fullscreen');
            });
          }
        });
      }

      // 4. Android: Lock orientation khi fullscreen
      if (!isIOS) {
        player.on('fullscreenchange', () => {
          if (player.isFullscreen()) {
            window.screen?.orientation?.lock?.('landscape').catch(e => {
              console.log("Could not lock orientation:", e);
            });
          } else {
            window.screen?.orientation?.unlock?.();
          }
        });
      }
    }

    const player = playerRef.current;
    if (!player) return;

    // 5. Clear previous HLS instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // 6. Load NEW URL
    console.log("VideoPlayer: Loading source:", url, "isPlayback:", isPlayback, "useNativeHLS:", useNativeHLS);

    if (url.endsWith('.m3u8')) {
      if (!useNativeHLS && Hls.isSupported()) {
        // Non-iOS: use hls.js (desktop Chrome, Firefox, Android, etc.)
        const hls = new Hls({
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
        // iOS: use native HLS
        player.src({ src: url, type: 'application/x-mpegURL' });
        if (autoPlay) player.play().catch(e => console.log("Native HLS Autoplay blocked", e));
      }
    } else {
      player.src({ src: url, type: 'video/mp4' });
      if (autoPlay) player.play().catch(e => console.log("MP4 Autoplay blocked", e));
    }

    player.muted(muted);
    if (poster) player.poster(poster);

  }, [url, autoPlay, muted, poster, isPlayback]);

  // Handle disposal only on UNMOUNT
  useEffect(() => {
    return () => {
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

  // 7. Handle orientation change / resize with DEBOUNCE
  useEffect(() => {
    const handleResize = () => {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }

      resizeTimerRef.current = setTimeout(() => {
        const player = playerRef.current;
        if (!player) return;

        // Không trigger resize khi iOS đang trong native fullscreen
        const techEl = player.tech(true)?.el();
        const isNativeFullscreen = isIOS && techEl?.webkitDisplayingFullscreen;

        if (!player.isFullscreen() && !player.isFullWindow() && !isNativeFullscreen) {
          player.trigger('resize');
        }

        resizeTimerRef.current = null;
      }, 500);
    };

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
        .custom-videojs-theme .video-js {
          -webkit-overflow-scrolling: auto;
          touch-action: manipulation;
        }
        .vjs-poster {
            background-size: cover !important;
        }
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
