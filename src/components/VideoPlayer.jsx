import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

/**
 * VideoPlayer component using hls.js for both Live and VOD playback.
 * 
 * Props:
 *   src      - HLS m3u8 URL
 *   mode     - 'live' | 'vod'
 *   controls - show native controls
 *   autoplay - auto start playback
 *   muted    - start muted
 */
export const VideoPlayer = ({ src, mode = 'live', controls = true, autoplay = true, muted = false }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const lastSrcRef = useRef(null);

  useEffect(() => {
    if (lastSrcRef.current === src) return;
    lastSrcRef.current = src;

    // Cleanup previous player
    destroyPlayer();

    if (!containerRef.current) return;

    // Create fresh <video> element each time
    const video = document.createElement('video');
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    video.style.background = '#000';
    video.controls = controls;
    video.autoplay = autoplay;
    video.muted = muted;
    video.playsInline = true;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(video);
    videoRef.current = video;

    const isHLS = src.includes('.m3u8');

    if (isHLS && Hls.isSupported()) {
      const isVOD = mode === 'vod';

      const hlsConfig = isVOD ? {
        // VOD config: allow full seeking, load everything
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        enableWorker: true,
        startPosition: 0,
      } : {
        // Live config: stay near live edge, low latency
        maxBufferLength: 10,
        maxMaxBufferLength: 30,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        liveDurationInfinity: true,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        startPosition: -1,
      };

      const hls = new Hls(hlsConfig);

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoplay) {
          video.play().catch(e => console.warn('HLS autoplay blocked:', e));
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS network error, attempting recovery...');
              setTimeout(() => hls.startLoad(), 1000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.error('HLS fatal error:', data);
              hls.destroy();
              break;
          }
        }
      });

      playerRef.current = { type: 'hls', instance: hls };

    } else if (isHLS && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = src;
      if (autoplay) {
        video.play().catch(e => console.warn('Native HLS autoplay blocked:', e));
      }
      playerRef.current = { type: 'native', instance: null };

    } else {
      // Regular MP4 or other
      video.src = src;
      if (autoplay) {
        video.play().catch(e => console.warn('Autoplay blocked:', e));
      }
      playerRef.current = { type: 'native', instance: null };
    }
  }, [src, mode, controls, autoplay, muted]);

  useEffect(() => {
    return () => destroyPlayer();
  }, []);

  function destroyPlayer() {
    if (playerRef.current) {
      const { type, instance } = playerRef.current;
      try {
        if (type === 'hls' && instance) {
          instance.destroy();
        }
      } catch (e) {
        console.warn('Error destroying player:', e);
      }
      playerRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
      videoRef.current = null;
    }
    lastSrcRef.current = null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#000',
        position: 'relative'
      }}
    />
  );
};
