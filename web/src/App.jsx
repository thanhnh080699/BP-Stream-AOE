import React, { useState, useEffect } from 'react';
import LiveView from './components/LiveView';
import PlaybackView from './components/PlaybackView';
import { Video, History, Trophy, Sun, Moon, Menu, X } from 'lucide-react';

function App() {
  const [tab, setTab] = useState('live');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('srs-theme');
    return savedMode ? savedMode === 'dark' : true;
  });

  // Sync theme with document class
  useEffect(() => {
    // Update Theme Class
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('srs-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('srs-theme', 'light');
    }

    // Update Document Title for SEO/UX
    const title = tab === 'live' ? 'Trực Tiếp - BP AOE Streaming' : 'Xem Lại - BP AOE Streaming';
    document.title = `${title} | BPGROUP Tournament Dashboard`;
  }, [darkMode, tab]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] font-sans selection:bg-blue-500/30 overflow-hidden transition-colors duration-300">
      
      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] flex items-center justify-between px-6 z-30 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2">
          <Trophy className="text-[#C9A050]" size={20} />
          <span className="font-black font-outfit text-sm tracking-tight text-[var(--accent-secondary)] uppercase">BP AOE</span>
        </div>
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-secondary)] cursor-pointer hover:text-[#C9A050] transition-colors"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Backdrop */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 w-64 flex-shrink-0 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col z-50 shadow-xl transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-8 hidden md:block">
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

        {/* Brand for Mobile Sidebar */}
        <div className="p-6 md:hidden border-b border-[var(--border-color)] mb-4">
          <div className="flex items-center gap-3">
             <Trophy className="text-[#C9A050]" size={24} />
             <span className="text-xl font-black font-outfit text-[var(--accent-secondary)] uppercase">BP AOE Dashboard</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 md:mt-0">
          <button
            onClick={() => { setTab('live'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
              tab === 'live'
                ? 'bg-[var(--bg-main)] text-[#C9A050] shadow-md border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[#C9A050] hover:bg-[var(--bg-main)]'
            }`}
          >
            <Video size={18} />
            Xem trực tiếp
          </button>
          
          <button
            onClick={() => { setTab('playback'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
              tab === 'playback'
                ? 'bg-[var(--bg-main)] text-[#C9A050] shadow-md border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[#C9A050] hover:bg-[var(--bg-main)]'
            }`}
          >
            <History size={18} />
            Xem lại theo ngày
          </button>
        </nav>

        <div className="p-4 space-y-4 mb-4 md:mb-0">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-main)] hover:text-[#C9A050] transition-all"
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
      <main className="flex-1 h-screen overflow-y-auto relative bg-[var(--bg-main)] transition-colors duration-300 pt-16 md:pt-0">
        <div className="min-h-full p-6 md:p-12">
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
