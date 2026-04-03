import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

const VideoPlayer = ({ url, muted = true, autoPlay = true, poster = '', showProgress = false }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [isInView, setIsInView] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

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
    if (containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen();
    } else if (containerRef.current.webkitRequestFullscreen) {
      containerRef.current.webkitRequestFullscreen();
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setProgress((current / total) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedProgress = x / rect.width;
    videoRef.current.currentTime = clickedProgress * videoRef.current.duration;
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '00:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden group">
      <video
        ref={videoRef}
        muted={isMuted}
        autoPlay={autoPlay}
        playsInline
        poster={poster}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        className="w-full h-full object-contain cursor-default"
        onClick={togglePlay}
      />
      
      {/* Custom Sleek Controls */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <button onClick={togglePlay} className="p-4 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full pointer-events-auto transition-transform active:scale-95">
          {isPlaying ? <Pause size={24} className="text-white fill-white" /> : <Play size={24} className="text-white fill-white ml-0.5" />}
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 flex flex-col gap-2 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {/* Progress Bar */}
        {showProgress && (
           <div className="flex flex-col gap-1 w-full pointer-events-auto">
              <div 
                className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden cursor-pointer group/bar relative"
                onClick={handleSeek}
              >
                  <div 
                    className="h-full bg-[#C9A050] transition-all duration-100 shadow-[0_0_8px_rgba(201,160,80,0.6)]" 
                    style={{ width: `${progress}%` }}
                  />
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-[#C9A050] rounded-full scale-0 group-hover/bar:scale-100 transition-transform shadow-lg border border-white/20"
                    style={{ left: `calc(${progress}% - 6px)` }}
                  />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-white/60 font-mono">
                  <span>{formatTime(videoRef.current?.currentTime)}</span>
                  <span>{formatTime(duration)}</span>
              </div>
           </div>
        )}

        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
               <button onClick={toggleMute} className="text-white hover:text-[#C9A050] transition-colors pointer-events-auto cursor-pointer">
                 {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
               </button>
            </div>
            <button onClick={handleFullScreen} className="text-white hover:text-[#C9A050] transition-colors pointer-events-auto cursor-pointer">
              <Maximize2 size={18} />
            </button>
        </div>
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
