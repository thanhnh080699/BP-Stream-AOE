import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Plyr } from 'plyr-react';
import 'plyr/dist/plyr.css';

const VideoPlayer = ({ url, downloadUrl, muted = true, autoPlay = true, poster = '' }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef(null);

  // Custom Plyr Options
  const plyrOptions = {
    controls: [
      'play-large', 
      'play', 
      'progress', 
      'current-time', 
      'duration', 
      'mute', 
      'volume', 
      'captions', 
      'settings', 
      'pip', 
      'airplay', 
      'download', 
      'fullscreen'
    ],
    keyboard: { focused: true, global: true },
    tooltips: { controls: true, seek: true },
    urls: {
        download: downloadUrl || url
    }
  };

  // Lazy Load using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView || !url || !videoRef.current) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const videoElement = videoRef.current.plyr.media;
    if (!videoElement) return;

    if (url.endsWith('.mp4')) {
      videoElement.src = url;
    } else if (Hls.isSupported()) {
      if (hlsRef.current) hlsRef.current.destroy();
      const hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
        maxBufferSize: 0,
        maxBufferLength: 2,
        lowLatencyMode: true,
        enableWorker: true,
      });
      hls.loadSource(url);
      hls.attachMedia(videoElement);
      hlsRef.current = hls;
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = url;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [url, isInView, videoRef.current]);

  return (
    <div ref={containerRef} className="w-full h-full bg-black group custom-plyr-theme">
      <div className="w-full h-full relative">
        <Plyr
          ref={videoRef}
          source={{
            type: 'video',
            sources: [
              {
                src: url,
                type: url.endsWith('.mp4') ? 'video/mp4' : 'application/x-mpegURL',
              },
            ],
          }}
          options={plyrOptions}
        />
      </div>

      {!isInView && (
        <div className="absolute inset-0 bg-[#0B0E14] flex items-center justify-center z-10 pointer-events-none">
          <div className="w-8 h-8 rounded-full border-2 border-[#C9A050]/20 border-t-[#C9A050] animate-spin" />
        </div>
      )}

      <style>{`
        .custom-plyr-theme {
          --plyr-color-main: #C9A050;
          --plyr-video-background: #000;
          --plyr-font-family: 'Roboto', sans-serif;
        }
        .plyr--video {
          height: 100%;
          border-radius: 0;
        }
        .plyr__video-wrapper {
            height: 100%;
            display: flex;
            align-items: center;
        }
        .plyr__controls {
            padding-bottom: 24px !important;
            padding-left: 20px !important;
            padding-right: 20px !important;
        }
        .plyr__progress__buffer {
            color: rgba(201, 160, 80, 0.1) !important;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;

