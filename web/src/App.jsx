import React, { useState, useEffect } from 'react';
import LiveView from './components/LiveView';
import PlaybackView from './components/PlaybackView';
import { Video, History, Trophy, Sun, Moon } from 'lucide-react';

function App() {
  const [tab, setTab] = useState('live');
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('srs-theme');
    return savedMode ? savedMode === 'dark' : true;
  });

  // Sync theme with document class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('srs-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('srs-theme', 'light');
    }
  }, [darkMode]);

  return (
    <div className="flex min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] font-sans selection:bg-blue-500/30 overflow-hidden transition-colors duration-300">
      
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col z-20 shadow-xl transition-colors duration-300">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-1">
            <Trophy className="text-[#C9A050]" size={28} />
            <h1 className="text-2xl font-black font-outfit tracking-tight text-[var(--accent-secondary)] leading-none uppercase">
              BP AOE
            </h1>
          </div>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest pl-10 opacity-70">
            BPGROUP AOE Tournament
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <button
            onClick={() => setTab('live')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              tab === 'live'
                ? 'bg-[var(--bg-main)] text-[#C9A050] shadow-md border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[#C9A050] hover:bg-[var(--bg-main)]'
            }`}
          >
            <Video size={18} />
            Xem trực tiếp
          </button>
          
          <button
            onClick={() => setTab('playback')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              tab === 'playback'
                ? 'bg-[var(--bg-main)] text-[#C9A050] shadow-md border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[#C9A050] hover:bg-[var(--bg-main)]'
            }`}
          >
            <History size={18} />
            Xem lại theo ngày
          </button>
        </nav>

        <div className="p-4 space-y-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-main)] hover:text-[#C9A050] transition-all"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span className="text-xs font-bold uppercase tracking-wider">{darkMode ? 'Giao diện sáng' : 'Giao diện tối'}</span>
          </button>

          <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)] shadow-sm">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 opacity-60">Sponsored By</p>
            <h3 className="text-lg font-black font-outfit text-[var(--accent-secondary)] leading-none mb-1">IT TEAM</h3>
            <p className="text-[10px] text-[var(--text-secondary)]">Bestprice.vn</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto relative bg-[var(--bg-main)] transition-colors duration-300">
        <div className="min-h-full p-8 md:p-12">
          {tab === 'live' ? <LiveView /> : <PlaybackView />}
        </div>
      </main>

      {/* Background radial-gradient for depth */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-50">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] rounded-full bg-purple-500/5 blur-[120px]" />
      </div>
    </div>
  );
}

export default App;
