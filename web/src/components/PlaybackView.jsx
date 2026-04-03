import React, { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import { Calendar, Play, Clock, Monitor, Archive, Filter, ChevronRight, HardDrive, AlertCircle } from 'lucide-react';

const PlaybackView = () => {
    const [replays, setReplays] = useState({});
    const [playerNames, setPlayerNames] = useState({});
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedStream, setSelectedStream] = useState(null);

    useEffect(() => {
        fetch('/api/v1/metadata')
            .then(res => res.json())
            .then(data => {
                setReplays(data);
                const dates = Object.keys(data).sort((a, b) => b.localeCompare(a));
                if (dates.length > 0) {
                    setSelectedDate(dates[0]);
                    const streams = data[dates[0]].streams || {};
                    const streamIds = Object.keys(streams);
                    if (streamIds.length > 0) setSelectedStream(streamIds[0]);
                }
            })
            .catch(err => console.error("Error fetching replays:", err));

        fetch('/api/v1/players')
            .then(res => res.json())
            .then(data => setPlayerNames(data))
            .catch(err => console.error('Error fetching player names:', err));
    }, []);

    const handleDateChange = (date) => {
        setSelectedDate(date);
        const streams = replays[date].streams || {};
        const streamIds = Object.keys(streams);
        if (streamIds.length > 0) {
            setSelectedStream(streamIds[0]);
        } else {
            setSelectedStream(null);
        }
    };

    const currentVideo = (selectedDate && selectedStream && replays[selectedDate]?.streams?.[selectedStream])
        ? replays[selectedDate].streams[selectedStream]
        : null;

    return (
        <div className="max-w-[1600px] mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden">
                <div className="space-y-2">
                    <h1 className="text-4xl font-black font-outfit text-[var(--accent-secondary)]">
                        <span className="text-[#C9A050]">Lưu trữ</span> Trận đấu
                    </h1>
                    <p className="text-[var(--text-secondary)] font-medium">Xem lại lịch sử thi đấu của các đội</p>
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-8">
                {/* Main Player Area */}
                <div className="flex-1 space-y-6">
                    <div className="relative aspect-video rounded-3xl overflow-hidden bg-black border border-[var(--border-color)] shadow-2xl">
                        {currentVideo ? (
                            <VideoPlayer url={currentVideo.hls ? `/replays/${currentVideo.hls}` : `/replays/${currentVideo.file}`} />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-6 text-[var(--text-secondary)] bg-[var(--bg-card)]">
                                <div className="p-8 rounded-full border border-[var(--border-color)] bg-[var(--bg-card-hover)]/40">
                                    <Monitor size={64} strokeWidth={1} className="opacity-20" />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-40">Đang đợi lựa chọn</p>
                                    <p className="text-[10px] font-medium mt-2">Chọn ngày và máy để bắt đầu phát lại</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {currentVideo && (
                        <div className="p-8 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-color)] shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 rounded-2xl bg-[#C9A050]/10 border border-[#C9A050]/20">
                                        <Monitor size={32} className="text-[#C9A050]" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-2xl font-black font-outfit text-[var(--accent-secondary)] uppercase tracking-tight">
                                                {playerNames[selectedStream] || selectedStream}
                                            </h3>
                                            <span className="px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-tighter bg-[var(--bg-card-hover)] text-[var(--text-secondary)] border border-[var(--border-color)]">{selectedStream}</span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-2">
                                            <p className="text-xs font-bold flex items-center gap-2 text-[var(--text-secondary)] uppercase tracking-widest">
                                                <Calendar size={14} className="text-[#C9A050]/60" /> {selectedDate}
                                            </p>
                                            <div className="w-1 h-1 rounded-full bg-[var(--border-color)]" />
                                            <p className="text-xs font-bold flex items-center gap-2 text-[var(--text-secondary)] uppercase tracking-widest">
                                                <Clock size={14} className="text-[#C9A050]/60" /> {currentVideo.duration_minutes} PHÚT
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Area: Control Panel */}
                <div className="w-full xl:w-96 space-y-8">
                    {/* Date Selection */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-[var(--text-secondary)]">
                                <Archive size={16} className="text-[#C9A050]/50" /> BẢN GHI LƯU TRỮ
                            </h2>
                            <span className="text-[10px] font-bold text-[var(--text-secondary)]">{Object.keys(replays).length} NGÀY</span>
                        </div>
                        <div className="flex flex-col gap-2.5 max-h-[35vh] overflow-y-auto pr-3 scrollbar-thin">
                            {Object.entries(replays).sort((a, b) => b[0].localeCompare(a[0])).map(([date, meta]) => (
                                <div key={date} className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleDateChange(date)}
                                        className={`group relative flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border cursor-pointer ${selectedDate === date
                                                ? 'bg-[#C9A050] text-[#0B0E14] border-transparent shadow-xl scale-[1.02]'
                                                : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-[#C9A050]/30 text-[var(--text-secondary)]'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg transition-colors ${selectedDate === date ? 'bg-[var(--bg-main)]/10' : 'bg-[var(--bg-main)]/5'}`}>
                                                <Calendar size={14} />
                                            </div>
                                            <span className="font-bold text-sm tracking-tight">{date}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {meta.status === 'processing' && (
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded-md border border-yellow-500/20">
                                                    <span className="text-[8px] font-black uppercase tracking-tighter">Đang gộp</span>
                                                    <div className="w-1 h-1 bg-yellow-500 rounded-full animate-pulse" />
                                                </div>
                                            )}
                                            <ChevronRight size={16} className={`transition-transform duration-300 ${selectedDate === date ? 'rotate-90' : 'opacity-20 group-hover:opacity-100'}`} />
                                        </div>
                                    </button>

                                    {selectedDate === date && (
                                        <div className="mx-2 mb-4 space-y-3">
                                            <button
                                                onClick={() => {
                                                    fetch(`/api/v1/merge/${date}`, { method: 'POST' });
                                                    alert('Đã bắt đầu quá trình tổng hợp video (HLS & MP4)...');
                                                    setReplays(prev => ({
                                                        ...prev,
                                                        [date]: { ...prev[date], status: 'processing', progress_percent: 10, progress_text: 'Đang khởi tạo...' }
                                                    }));
                                                }}
                                                disabled={meta.status === 'processing'}
                                                className={`w-full py-3 text-[10px] font-black rounded-xl border transition-all uppercase tracking-widest flex items-center justify-center gap-2 group/btn cursor-pointer ${meta.status === 'processing'
                                                        ? 'bg-slate-500/10 text-slate-500 border-slate-500/20 cursor-not-allowed'
                                                        : 'bg-[#C9A050]/10 hover:bg-[#C9A050]/20 text-[#C9A050] border-[#C9A050]/20'
                                                    }`}
                                            >
                                                <HardDrive size={12} className={`${meta.status === 'processing' ? 'animate-spin' : 'group-hover/btn:scale-110 transition-transform'}`} />
                                                {meta.status === 'completed' ? 'Tổng Hợp Lại Dữ Liệu' : 'Tổng Hợp File Ghi Hình'}
                                            </button>

                                            {meta.status === 'processing' && (
                                                <div className="space-y-2 animate-in fade-in duration-500">
                                                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-tighter text-[#C9A050]">
                                                        <span>{meta.progress_text || 'Đang xử lý...'}</span>
                                                        <span>{meta.progress_percent || 0}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-[var(--bg-main)] rounded-full overflow-hidden border border-[var(--border-color)]">
                                                        <div 
                                                            className="h-full bg-[#C9A050] transition-all duration-500 shadow-[0_0_10px_rgba(201,160,80,0.5)]"
                                                            style={{ width: `${meta.progress_percent || 0}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Machine Selection */}
                    {selectedDate && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-6 duration-500">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-[var(--text-secondary)]">
                                    <Filter size={16} className="text-[#C9A050]/50" /> CÁC MÁY THI ĐẤU
                                </h2>
                                <span className="text-[10px] font-bold text-[var(--text-secondary)]">{Object.keys(replays[selectedDate].streams || {}).length} MÁY</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2.5 max-h-[45vh] overflow-y-auto pr-3 scrollbar-thin">
                                {Object.entries(replays[selectedDate].streams || {}).map(([s_id, meta]) => (
                                    <button
                                        key={s_id}
                                        onClick={() => setSelectedStream(s_id)}
                                        className={`group relative flex flex-col p-4 rounded-2xl transition-all duration-300 border cursor-pointer ${selectedStream === s_id
                                                ? 'bg-[#C9A050] text-[#0B0E14] border-transparent shadow-2xl scale-[1.02]'
                                                : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-[#C9A050]/30 text-[var(--text-secondary)]'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center w-full mb-2">
                                            <span className={`font-black font-outfit uppercase tracking-tight text-sm ${selectedStream === s_id ? 'text-[#0B0E14]' : 'text-[var(--text-primary)]'}`}>
                                                {playerNames[s_id] || s_id}
                                            </span>
                                            <span className={`text-[9px] font-black font-mono uppercase tracking-tighter ${selectedStream === s_id ? 'text-[#0B0E14]/40' : 'text-[var(--text-secondary)] opacity-50'}`}>{s_id}</span>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest ${selectedStream === s_id ? 'text-[#0B0E14]/70' : 'text-[var(--text-secondary)] opacity-70'}`}>
                                                <Clock size={12} className={selectedStream === s_id ? 'text-[#0B0E14]/70' : 'text-[#C9A050]/60'} />
                                                {meta.duration_minutes} PHÚT
                                            </div>
                                            <div className={`w-1 h-1 rounded-full ${selectedStream === s_id ? 'bg-[#0B0E14]/20' : 'bg-[var(--border-color)]'}`} />
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${selectedStream === s_id ? 'text-[#0B0E14]/70' : 'text-[var(--text-secondary)] opacity-40'}`}>Đã lưu</span>
                                        </div>
                                        {selectedStream === s_id && (
                                            <div className="absolute right-4 bottom-4 p-1 bg-[#0B0E14] rounded-full text-[#C9A050] shadow-lg">
                                                <Play size={10} fill="currentColor" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlaybackView;
