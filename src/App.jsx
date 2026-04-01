import React, { useState, useEffect } from 'react';
import {
  Tv,
  Monitor,
  History,
  LayoutDashboard,
  Play,
  Settings,
  Calendar,
  Clock,
  ArrowLeft,
  Users,
  Trophy,
  ChevronRight,
  User,
  Video
} from 'lucide-react';
import { VideoPlayer } from './components/VideoPlayer';

const SRS_BASE_URL = 'http://192.168.9.214:8080';
const SRS_API_URL = 'http://192.168.9.214:1985/api/v1/streams';

const INITIAL_MACHINES = [
  ...Array.from({ length: 4 }).map((_, i) => ({ id: `team1-${i + 1}`, team: 'team1', name: `Máy ${i + 1}` })),
  ...Array.from({ length: 4 }).map((_, i) => ({ id: `team2-${i + 1}`, team: 'team2', name: `Máy ${i + 1}` }))
];

const API_BASE = window.location.origin;

function App() {
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [currentView, setCurrentView] = useState('live'); // 'live' or 'recording'
  const [mainTab, setMainTab] = useState('live'); // 'live' or 'archives'
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [onlineStreams, setOnlineStreams] = useState([]);

  // Poll SRS API for online/offline status
  useEffect(() => {
    const checkStatus = () => {
      fetch(SRS_API_URL)
        .then(res => res.json())
        .then(data => {
          if (data && data.streams) {
            setOnlineStreams(data.streams.map(s => s.name));
          }
        })
        .catch(err => {
          console.warn('SRS API not reachable, using mock online status for demo');
          // Fallback demo: team1-1 and team2-3 are online
          setOnlineStreams(['team1-1', 'team2-3']);
        });
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedMachine && mainTab === 'archives') {
      setActiveVideoUrl(null); // Wait for recording selection
      setCurrentView('recording');
      
      fetch(`${API_BASE}/api/recordings/${selectedMachine.id}`)
        .then(async res => {
          const contentType = res.headers.get("content-type");
          if (res.ok && contentType && contentType.indexOf("application/json") !== -1) {
            return res.json();
          } else {
            throw new Error('API request failed or returned non-JSON data');
          }
        })
        .then(data => {
          setRecordings(data);
          // Auto-select the latest recording if available
          if (data.length > 0 && data[0].items.length > 0) {
            handleRecordingClick(data[0].items[0]);
          }
        })
        .catch(err => console.error('Error fetching recordings:', err));
    }
  }, [selectedMachine, mainTab]);

  const handleRecordingClick = (video) => {
    setCurrentView('recording');
    setActiveVideoUrl(video.url);
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand-logo">
            <Trophy />
            <span>BP AOE</span>
          </div>
          <div className="brand-subtitle" style={{ fontSize: '0.8rem' }}>BPGROUP AOE Tournament</div>
        </div>

        <nav className="nav-section">
          <div className={`nav-item ${mainTab === 'live' ? 'active' : ''}`} onClick={() => { setMainTab('live'); setSelectedMachine(null); }}>
            <Video size={20} />
            <span>Xem trực tiếp</span>
          </div>
          <div className={`nav-item ${mainTab === 'archives' ? 'active' : ''}`} onClick={() => { setMainTab('archives'); setSelectedMachine(null); }}>
            <Calendar size={20} />
            <span>Xem lại theo ngày</span>
          </div>
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(205, 162, 78, 0.05)', borderRadius: '12px', border: '1px solid rgba(205, 162, 78, 0.1)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 600, marginBottom: '0.5rem' }}>SPONSORED BY</p>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>IT TEAM</div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>Bestprice.vn</div>
        </div>
      </aside>

      <main className="main-content">
        {mainTab === 'live' ? (
          /* ===== LIVE DASHBOARD: 4x2 Grid with live players ===== */
          <div className="fade-in">
            <header className="header">
              <div className="title-group">
                <h1>BPGROUP AOE Tournament</h1>
                <p>Hệ thống giám sát trực tiếp giải đấu nội bộ Bestprice</p>
              </div>
              <div className="stats-bar">
                <div className="stat-chip">
                  <span className="stat-dot"></span>
                  <span>{onlineStreams.length} / 8 Đang Trực Tiếp</span>
                </div>
              </div>
            </header>

            <div className="live-grid">
              {INITIAL_MACHINES.map((machine) => {
                const isOnline = onlineStreams.includes(machine.id);
                return (
                  <div key={machine.id} className="live-cell">
                    <div className="live-cell-header">
                      <div className="machine-name">
                        <Monitor size={14} />
                        <span>{machine.id.toUpperCase()}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`team-badge ${machine.team}`}>
                          {machine.team === 'team1' ? 'Team 1' : 'Team 2'}
                        </span>
                        <span className="stat-dot" style={{ backgroundColor: isOnline ? '#ef4444' : '#94a3b8', width: 6, height: 6 }}></span>
                      </div>
                    </div>
                    <div className="live-cell-video">
                      {isOnline ? (
                        <VideoPlayer
                          key={`live-${machine.id}`}
                          src={`${SRS_BASE_URL}/live/${machine.id}.m3u8`}
                          muted={true}
                          controls={true}
                          autoplay={true}
                        />
                      ) : (
                        <div className="live-cell-offline">
                          <Tv size={36} opacity={0.2} strokeWidth={1} />
                          <span>OFFLINE</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : !selectedMachine ? (
          /* ===== ARCHIVES: Machine selection grid ===== */
          <div className="fade-in">
            <header className="header">
              <div className="title-group">
                <h1>Xem lại theo ngày</h1>
                <p>Chọn máy để xem danh sách bản ghi hình</p>
              </div>
            </header>

            <div className="machine-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {INITIAL_MACHINES.map((machine) => {
                const isOnline = onlineStreams.includes(machine.id);
                return (
                  <div
                    key={machine.id}
                    className="machine-card"
                    onClick={() => setSelectedMachine(machine)}
                  >
                    <div className="card-header">
                      <div className="machine-name">
                        <Monitor size={18} />
                        <span>{machine.id.toUpperCase()}</span>
                      </div>
                      <span className={`team-badge ${machine.team}`}>
                        {machine.team === 'team1' ? 'Team 1' : 'Team 2'}
                      </span>
                    </div>
                    <div className="card-preview">
                      <div style={{ textAlign: 'center', color: isOnline ? 'var(--accent-color)' : '#475569' }}>
                        <History size={48} strokeWidth={1} style={{ opacity: 0.5 }} />
                        <div style={{ fontSize: '0.8rem', marginTop: '0.75rem', fontWeight: 600, letterSpacing: '1px' }}>
                          XEM LẠI
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{machine.name}</span>
                      <ChevronRight size={16} color="#94a3b8" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ===== ARCHIVES: Player view with recording list ===== */
          <div className="fade-in">
            <button
              onClick={() => setSelectedMachine(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', cursor: 'pointer' }}
            >
              <ArrowLeft size={18} /> Quay lại danh sách máy
            </button>

            <div className="player-view" style={{ gridTemplateColumns: '1fr 350px' }}>
              <div className="video-section">
                <div className="video-container" style={{ position: 'relative', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                  {activeVideoUrl ? (
                    <VideoPlayer key={activeVideoUrl} src={activeVideoUrl} />
                  ) : (
                    <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                      <Monitor size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                      <p>Hãy chọn một bản ghi từ danh sách bên phải</p>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '1.5rem', background: 'var(--panel-bg)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--panel-border)' }}>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                    {activeVideoUrl ? `Đang xem lại: ${selectedMachine.id}` : `Bản ghi: ${selectedMachine.id}`}
                  </h2>
                  <div style={{ display: 'flex', gap: '1.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <User size={16} /> Bestprice IT Tournament
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Trophy size={16} /> BPGROUP Series
                    </span>
                  </div>
                </div>
              </div>

              <div className="history-panel">
                <div className="history-header">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <History size={20} color="var(--accent-color)" />
                    Danh sách ghi hình
                  </h3>
                </div>
                <div className="history-list">
                  {recordings.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                      <History size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                      <p>Chưa có bản ghi nào</p>
                    </div>
                  )}

                  {recordings.map((group) => (
                    <div key={group.date} className="date-group">
                      <div className="date-label">
                        <Calendar size={14} /> {group.date}
                      </div>
                      {group.items.map((video) => (
                        <div
                          key={video.id}
                          className="video-item"
                          onClick={() => handleRecordingClick(video)}
                          style={{ borderLeft: activeVideoUrl === video.url ? '3px solid var(--accent-color)' : 'none' }}
                        >
                          <div className="video-thumb">
                            <Play size={16} />
                          </div>
                          <div className="video-info">
                            <h4>{video.title}</h4>
                            <span style={{ display: 'flex', gap: '0.8rem' }}>
                              <Clock size={12} style={{ marginTop: '2px' }} /> {video.time}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
