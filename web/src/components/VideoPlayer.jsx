import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

const VideoPlayer = ({ url, muted = true, autoPlay = true, poster = '' }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [isInView, setIsInView] = useState(false);

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
    if (!isInView || !url) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    if (url.endsWith('.mp4')) {
      videoRef.current.src = url;
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
        maxBufferSize: 0, 
        maxBufferLength: 2,
        lowLatencyMode: true,
        enableWorker: true,
      });
      hls.loadSource(url);
      hls.attachMedia(videoRef.current);
      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = url;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [url, isInView]);

  const togglePlay = () => {
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleFullScreen = () => {
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    } else if (videoRef.current.webkitRequestFullscreen) {
      videoRef.current.webkitRequestFullscreen();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden group">
      <video
        ref={videoRef}
        muted={isMuted}
        autoPlay={autoPlay}
        playsInline
        poster={poster}
        className="w-full h-full object-contain cursor-default"
        onClick={togglePlay}
      />
      
      {/* Custom Sleek Controls */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <button onClick={togglePlay} className="p-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full pointer-events-auto transition-transform active:scale-95">
          {isPlaying ? <Pause size={24} className="text-white fill-white" /> : <Play size={24} className="text-white fill-white ml-0.5" />}
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="flex items-center gap-4">
           <button onClick={toggleMute} className="text-white hover:text-[#C9A050] transition-colors pointer-events-auto">
             {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
           </button>
        </div>
        <button onClick={handleFullScreen} className="text-white hover:text-[#C9A050] transition-colors pointer-events-auto">
          <Maximize2 size={18} />
        </button>
      </div>

      {!isInView && (
        <div className="absolute inset-0 bg-[#0B0E14] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#C9A050]/20 border-t-[#C9A050] animate-spin" />
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
