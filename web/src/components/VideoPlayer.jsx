import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import Hls from 'hls.js';

const VideoPlayer = ({ url, muted = true, autoPlay = true, poster = '' }) => {
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
            userActions: { hotkeys: true },
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
    }

    const player = playerRef.current;
    if (!player) return;

    // 2. Clear previous HLS instance if any
    if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
    }

    // 3. Load NEW URL
    console.log("VideoPlayer: Loading source:", url);
    
    if (url.endsWith('.m3u8')) {
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (Hls.isSupported() && !isSafari) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
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

  }, [url, autoPlay, muted, poster]);

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
          background-color: rgba(201, 160, 80, 0.8) !important;
          border-color: #C9A050 !important;
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
            background-color: #C9A050 !important;
        }
        .custom-videojs-theme .vjs-play-progress {
          background-color: #C9A050 !important;
        }
        .custom-videojs-theme .vjs-volume-level {
          background-color: #C9A050 !important;
        }
        .custom-videojs-theme .vjs-control-bar {
          background-color: rgba(11, 14, 20, 0.9) !important;
          backdrop-filter: blur(12px);
          height: 3.5em !important;
        }
        .video-js.vjs-fluid {
            padding-top: 56.25% !important; /* 16:9 */
            height: 0 !important;
        }
        .vjs-poster {
            background-size: cover !important;
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
