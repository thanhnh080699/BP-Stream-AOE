import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import Hls from 'hls.js';

const VideoPlayer = ({ url, muted = true, autoPlay = true, poster = '' }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // Initialize Video.js
    const videoElement = document.createElement("video");
    videoElement.className = "video-js vjs-big-play-centered vjs-theme-city";
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    videoElement.setAttribute('x5-playsinline', 'true');
    videoRef.current.appendChild(videoElement);

    const player = playerRef.current = videojs(videoElement, {
      autoplay: autoPlay,
      controls: true,
      responsive: true,
      fluid: true,
      muted: muted,
      poster: poster,
      preload: 'auto',
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      userActions: {
        hotkeys: true
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

    // Handle Source loading
    if (url.endsWith('.m3u8')) {
        player.src({
            src: url,
            type: 'application/x-mpegURL'
        });
    } else {
        player.src({
            src: url,
            type: 'video/mp4'
        });
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.innerHTML = '';
      }
    };
  }, [url]);

  return (
    <div className="w-full h-full bg-black custom-videojs-theme">
      <div data-vjs-player className="w-full h-full">
        <div ref={videoRef} className="w-full h-full" />
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



