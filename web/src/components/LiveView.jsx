import React, { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import { Tv, ChevronRight, Monitor, Edit2, Check, X } from 'lucide-react';

const LiveView = () => {
  const [playerNames, setPlayerNames] = useState({});
  const [dbPlayers, setDbPlayers] = useState([]);
  const [activeStreams, setActiveStreams] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [selectedStreamId, setSelectedStreamId] = useState(null);

  const streams = [
    { id: 'team1-1', label: 'TEAM1-1', team: 'TEAM 1', teamColor: 'text-red-500 bg-red-500/10 border-red-500/20', machine: 'Máy 1' },
    { id: 'team1-2', label: 'TEAM1-2', team: 'TEAM 1', teamColor: 'text-red-500 bg-red-500/10 border-red-500/20', machine: 'Máy 2' },
    { id: 'team1-3', label: 'TEAM1-3', team: 'TEAM 1', teamColor: 'text-red-500 bg-red-500/10 border-red-500/20', machine: 'Máy 3' },
    { id: 'team1-4', label: 'TEAM1-4', team: 'TEAM 1', teamColor: 'text-red-500 bg-red-500/10 border-red-500/20', machine: 'Máy 4' },
    { id: 'team2-1', label: 'TEAM2-1', team: 'TEAM 2', teamColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20', machine: 'Máy 1' },
    { id: 'team2-2', label: 'TEAM2-2', team: 'TEAM 2', teamColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20', machine: 'Máy 2' },
    { id: 'team2-3', label: 'TEAM2-3', team: 'TEAM 2', teamColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20', machine: 'Máy 3' },
    { id: 'team2-4', label: 'TEAM2-4', team: 'TEAM 2', teamColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20', machine: 'Máy 4' },
  ];

  const fetchDbPlayers = async () => {
    try {
      const res = await fetch('/api/v1/players-db');
      const data = await res.json();
      setDbPlayers(data || []);
    } catch (err) {
      console.error('Error fetching DB players:', err);
    }
  };

  useEffect(() => {
    fetch('/api/v1/players')
      .then(res => res.json())
      .then(data => setPlayerNames(data))
      .catch(err => console.error('Error fetching player names:', err));

    fetchDbPlayers();

    const checkStatus = () => {
      fetch('/srs/api/v1/streams/')
        .then(res => res.json())
        .then(data => {
          if (data && data.code === 0 && data.streams) {
            const streamMap = {};
            data.streams.forEach(s => {
              if (s.publish && s.publish.active) {
                streamMap[s.name] = s.app;
              }
            });
            setActiveStreams(streamMap);
          } else {
            setActiveStreams({});
          }
        })
        .catch(err => console.error('SRS API check failed:', err));
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const saveName = (id, value) => {
    const nameToSave = value || editValue;
    const newNames = { ...playerNames, [id]: nameToSave };
    setPlayerNames(newNames);
    fetch('/api/v1/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNames),
    });
    setEditingId(null);
  };

  const onlineCount = Object.keys(activeStreams).length;

  if (selectedStreamId) {
    const stream = streams.find(s => s.id === selectedStreamId);
    const isOnline = !!activeStreams[stream.id];
    const playerName = playerNames[stream.id] || stream.label;
    const appName = activeStreams[stream.id] || 'live';

    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <button
          onClick={() => setSelectedStreamId(null)}
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[#f1812e] transition-colors cursor-pointer group mb-4"
        >
          <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
          <span className="text-sm font-bold uppercase tracking-widest">Quay lại danh sách</span>
        </button>

        <div className="flex flex-col xl:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <div className="aspect-video relative bg-black rounded-3xl border border-[var(--border-color)] overflow-hidden shadow-2xl shadow-black/50">
              {isOnline ? (
                <VideoPlayer url={`/${appName}/${stream.id}.m3u8`} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-6 text-[var(--text-secondary)] bg-[var(--bg-card)]">
                  <Tv size={80} strokeWidth={1} className="opacity-10" />
                  <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase opacity-40">
                    <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)]" />
                    OFFLINE
                  </div>
                </div>
              )}
              {isOnline && (
                <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-lg shadow-xl">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">LIVE NOW</span>
                </div>
              )}
            </div>

            <div className="p-8 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] shadow-xl">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-5">
                  <div className="p-4 rounded-2xl bg-[#f1812e]/10 border border-[#f1812e]/20">
                    <Monitor size={32} className="text-[#f1812e]" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      {editingId === stream.id ? (
                        <select
                          autoFocus
                          className="text-lg font-black bg-[var(--bg-main)] text-[#f1812e] border border-[#f1812e]/30 rounded-lg px-3 py-1 outline-none appearance-none cursor-pointer"
                          value={editValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditValue(val);
                            saveName(stream.id, val);
                          }}
                          onBlur={() => setEditingId(null)}
                        >
                          <option value="">-- Chọn --</option>
                          {dbPlayers.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-3 group/detail">
                          <h3 className="text-3xl font-black font-outfit text-[var(--accent-secondary)] uppercase tracking-tight">
                            {playerName}
                          </h3>
                          <button
                            onClick={() => { setEditingId(stream.id); setEditValue(playerName); }}
                            className="opacity-0 group-hover/detail:opacity-100 p-2 text-[var(--text-secondary)] hover:text-[#f1812e] transition-all cursor-pointer bg-[var(--bg-main)] rounded-lg border border-[var(--border-color)]"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      )}
                      <div className={`px-3 py-1 text-[10px] font-black rounded-full border ${stream.teamColor} uppercase tracking-widest`}>
                        {stream.team}
                      </div>
                    </div>
                    <p className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-60">
                      {stream.machine} • Đang trực tiếp tại tổng hành dinh
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full xl:w-80 space-y-6">
            <div className="p-6 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)]">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-6 opacity-50 flex items-center gap-2">
                <Monitor size={14} /> Danh sách máy khác
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {streams.filter(s => s.id !== selectedStreamId).map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStreamId(s.id)}
                    className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-main)]/50 border border-[var(--border-color)] hover:border-[#f1812e]/30 hover:bg-[var(--bg-card-hover)] transition-all cursor-pointer group"
                  >
                    <div className="flex flex-col items-start translate-y-[1px]">
                      <span className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[#f1812e] transition-colors">{playerNames[s.id] || s.label}</span>
                      <span className="text-[10px] font-medium text-[var(--text-secondary)] uppercase opacity-50">{s.machine}</span>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full ${activeStreams[s.id] ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-[var(--text-secondary)] opacity-20'}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 overflow-hidden">
        <div className="lg:w-2/3 space-y-3">
          <h2 className="text-3xl md:text-4xl font-black font-outfit text-[var(--accent-secondary)] leading-tight">
            <span className="text-[#f1812e]">BPGROUP</span> AOE Tournament
          </h2>

          <p className="text-[var(--text-secondary)] font-medium leading-relaxed max-w-2xl">
            Nền tảng livestream và xem lại trận đấu giải AOE nội bộ BestPrice, nơi lưu giữ mọi khoảnh khắc kịch tính,
            chiến thuật đỉnh cao và tinh thần thi đấu máu lửa của các chiến binh.
            Theo dõi trực tiếp, xem lại bất cứ lúc nào và cùng cổ vũ cho những trận chiến huyền thoại!
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-color)] px-4 py-2 rounded-full shadow-lg self-start lg:self-end">
          <div className={`w-2 h-2 rounded-full ${onlineCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--text-secondary)] opacity-30'}`}></div>
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            {onlineCount} / 8 Đang Trực Tiếp
          </span>
        </div>
      </div>

      {/* Streams Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {streams.map((stream) => {
          const isOnline = !!activeStreams[stream.id];
          const playerName = playerNames[stream.id] || stream.label;
          const appName = activeStreams[stream.id] || 'live';

          return (
            <div key={stream.id} className="flex flex-col bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] overflow-hidden transition-all duration-300 hover:shadow-2xl hover:border-[#f1812e]/20 group shadow-[var(--card-shadow)]">

              {/* Card Header */}
              <div className="p-4 flex items-center justify-between bg-[var(--bg-card-hover)]/30">
                <div className="flex items-center gap-3">
                  <Monitor size={18} className="text-[var(--text-secondary)] opacity-70" />

                  {editingId === stream.id ? (
                    <div className="flex items-center gap-1.5 animate-in slide-in-from-left-2 duration-200">
                      <select
                        autoFocus
                        className="text-xs font-black bg-[var(--bg-main)] text-[#f1812e] border border-[#f1812e]/30 rounded-lg px-2 py-1 outline-none w-32 appearance-none cursor-pointer"
                        value={editValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditValue(val);
                          saveName(stream.id, val);
                        }}
                        onBlur={() => setEditingId(null)}
                      >
                        <option value="">-- Chọn --</option>
                        {dbPlayers.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-red-500 hover:text-red-400 cursor-pointer p-1 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group/player">
                      <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                        {playerName}
                      </span>
                      <button
                        onClick={() => { setEditingId(stream.id); setEditValue(playerName); }}
                        className="opacity-0 group-hover/player:opacity-100 p-1 text-[var(--text-secondary)] hover:text-[#f1812e] transition-opacity cursor-pointer"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <div className={`text-[9px] font-black px-2.5 py-1 rounded-md border ${stream.teamColor} uppercase tracking-widest`}>
                  {stream.team}
                </div>
              </div>

              {/* Video Area */}
              <div className="aspect-video relative bg-black/5 border-y border-[var(--border-color)] flex items-center justify-center overflow-hidden">
                {isOnline ? (
                  <VideoPlayer url={`/${appName}/${stream.id}.m3u8`} />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-[var(--text-secondary)]">
                    <Tv size={64} strokeWidth={1} className="opacity-10" />
                    <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase opacity-40">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)]" />
                      OFFLINE
                    </div>
                  </div>
                )}

                {isOnline && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-red-600 rounded-md shadow-lg">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">LIVE</span>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div
                onClick={() => setSelectedStreamId(stream.id)}
                className="p-4 flex items-center justify-between text-[var(--text-secondary)] hover:bg-[#f1812e]/10 group-hover:text-[#f1812e] transition-all bg-[var(--bg-card-hover)]/20 cursor-pointer"
              >
                <span className="text-xs font-medium uppercase tracking-wider opacity-70">{stream.machine}</span>
                <ChevronRight size={16} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveView;
