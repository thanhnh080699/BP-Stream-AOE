import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

const NativeVideoPlayer = ({ url, poster = '', autoPlay = true }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (url.endsWith('.m3u8')) {
      if (!isIOS && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoPlay) video.play().catch(e => console.log("HLS autoplay prevented", e));
        });
      } else {
        video.src = url;
        if (autoPlay) {
          // Add a slight delay for Safari to parse the M3U8 manifest natively before playing
          setTimeout(() => {
            video.play().catch(e => console.log("Native HLS autoplay prevented", e));
          }, 100);
        }
      }
    } else {
      video.src = url;
      if (autoPlay) video.play().catch(e => console.log("MP4 autoplay prevented", e));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [url, autoPlay]);

  return (
    <div className="w-full h-full bg-black flex items-center justify-center relative shadow-inner">
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        x5-video-player-type="h5"
        poster={poster}
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
};

export default NativeVideoPlayer;
