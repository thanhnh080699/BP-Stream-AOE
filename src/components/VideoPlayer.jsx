import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export const VideoPlayer = ({ src, playlist = [], controls = true, autoplay = true, muted = false }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const playIndexRef = useRef(0);
  const lastSrcRef = useRef(null);

  useEffect(() => {
    // If src hasn't changed, don't do anything to the player
    if (lastSrcRef.current === src) return;
    lastSrcRef.current = src;

    // Reset play index when a new recording/playlist is selected
    playIndexRef.current = 0;

    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add('vjs-big-play-centered', 'vjs-theme-city');
      videoRef.current.appendChild(videoElement);
      
      const detectedType = src.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';

      const player = playerRef.current = videojs(videoElement, {
        autoplay,
        controls,
        muted,
        responsive: true,
        fluid: true,
        sources: [{ src, type: detectedType }]
      });

      // Handle sequential playback if playlist is provided
      player.on('ended', () => {
        if (playlist && playlist.length > 0 && playIndexRef.current < playlist.length - 1) {
          playIndexRef.current += 1;
          const nextSrc = playlist[playIndexRef.current];
          lastSrcRef.current = nextSrc; // Prevent re-triggering from EFFECT
          const nextType = nextSrc.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
          
          player.src({ src: nextSrc, type: nextType });
          player.play().catch(err => console.warn('Autoplay prevented on segment transition', err));
        }
      });

    } else {
      const player = playerRef.current;
      const detectedType = src.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
      player.src({ src, type: detectedType });
      if (autoplay) {
        player.play().catch(e => console.warn('Could not auto-play', e));
      }
    }
  }, [src, playlist, controls, autoplay, muted]);

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
