import React from 'react';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';

const VideoPlayer = ({ url, muted = true, autoPlay = true, poster = '', isPlayback = false }) => {
  return (
    <div className="w-full h-full bg-black flex items-center justify-center custom-vidstack-theme overflow-hidden relative">
      <MediaPlayer 
        title={isPlayback ? "Bản ghi trận đấu" : "Trực tiếp"} 
        src={url} 
        playsInline 
        autoPlay={autoPlay} 
        muted={muted}
        poster={poster}
        load="visible"
        streamType={isPlayback ? "on-demand" : "live"}
        className="w-full h-full"
        aspectRatio="16/9"
      >
        <MediaProvider />
        <DefaultVideoLayout 
          icons={defaultLayoutIcons} 
        />
      </MediaPlayer>
      
      {/* Override theme properties to match BPGROUP Orange brand */}
      <style>{`
        .custom-vidstack-theme vds-media {
          --media-brand: #f1812e;
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;
