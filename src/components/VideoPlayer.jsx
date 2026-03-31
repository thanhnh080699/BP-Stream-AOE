import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export const VideoPlayer = ({ src }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add('vjs-big-play-centered', 'vjs-theme-city');
      videoRef.current.appendChild(videoElement);
      
      const detectedType = src.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';

      const player = playerRef.current = videojs(videoElement, {
        autoplay: true,
        controls: true,
        responsive: true,
        fluid: true,
        sources: [{ src, type: detectedType }]
      }, () => {
        videojs.log('player is ready');
      });
    } else {
      const player = playerRef.current;
      const detectedType = src.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
      player.src({ src, type: detectedType });
    }
  }, [src, videoRef]);

  // Dispose the player on unmount
  useEffect(() => {
    const player = playerRef.current;
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);

  return (
    <div data-vjs-player style={{ width: '100%', height: '100%', borderRadius: '24px', overflow: 'hidden' }}>
      <div ref={videoRef} />
    </div>
  );
};
