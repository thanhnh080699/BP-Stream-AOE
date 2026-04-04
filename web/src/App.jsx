import React, { useState, useEffect } from 'react';
import LiveView from './components/LiveView';
import PlaybackView from './components/PlaybackView';
import AboutUs from './components/AboutUs';
import { Video, History, Trophy, Sun, Moon, Menu, X, Monitor, Info } from 'lucide-react';

function App() {
  const [tab, setTab] = useState('live');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > 1024;
    }
    return true;
  });
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('srs-theme');
    return savedMode ? savedMode === 'dark' : true;
  });

  // Handle window resize to auto-close sidebar if needed
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    let title = 'BP AOE Streaming';
    if (tab === 'live') title = 'Trực Tiếp - BP AOE Streaming';
    if (tab === 'playback') title = 'Xem Lại - BP AOE Streaming';
    if (tab === 'about') title = 'Về Chúng Tôi - BP AOE Streaming';
    
    document.title = `${title} | BPGROUP Tournament Dashboard`;
  }, [darkMode, tab]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleTabChange = (newTab) => {
    setTab(newTab);
    // Only auto-close sidebar on mobile/tablet (less than 1024px)
    if (window.innerWidth <= 1024) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen md:h-screen bg-[var(--bg-main)] text-[var(--text-primary)] font-sans selection:bg-blue-500/30 md:overflow-hidden transition-colors duration-300">
      
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
      <div 
        className={`fixed md:hidden inset-0 bg-black/60 backdrop-blur-sm z-40 transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 flex-shrink-0 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col z-50 shadow-2xl transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)
        ${isSidebarOpen ? 'w-[280px] md:w-80 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 md:w-0 overflow-hidden border-none pointer-events-none'}
      `}>
        <div className={`p-8 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'} whitespace-nowrap overflow-hidden`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <Trophy className="text-[#C9A050]" size={28} />
              <h1 className="text-2xl font-black font-outfit tracking-tight text-[var(--accent-secondary)] leading-none uppercase">
                BP AOE
              </h1>
            </div>
            
            <button 
              onClick={toggleSidebar}
              className="hidden md:flex p-2 rounded-xl bg-[var(--bg-main)]/50 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[#C9A050] hover:border-[#C9A050]/30 transition-all cursor-pointer group"
            >
              <Menu size={18} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest pl-10 opacity-70">
            BPGROUP AOE Tournament
          </p>
        </div>

        {/* Brand for Mobile Sidebar */}
        <div className={`p-6 md:hidden border-b border-[var(--border-color)] mb-4 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center gap-3">
             <Trophy className="text-[#C9A050]" size={24} />
             <span className="text-xl font-black font-outfit text-[var(--accent-secondary)] uppercase">BP AOE Dashboard</span>
          </div>
        </div>

        <nav className={`flex-1 px-4 space-y-2 mt-4 md:mt-0 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={() => handleTabChange('live')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
              tab === 'live'
                ? 'bg-[var(--bg-main)] text-[#C9A050] shadow-md border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[#C9A050] hover:bg-[var(--bg-main)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Video size={18} />
              <span>Xem trực tiếp</span>
            </div>
            {tab === 'live' && <div className="w-1.5 h-1.5 rounded-full bg-[#C9A050] shadow-[0_0_8px_#C9A050]" />}
          </button>
          
          <button
            onClick={() => handleTabChange('playback')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
              tab === 'playback'
                ? 'bg-[var(--bg-main)] text-[#C9A050] shadow-md border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[#C9A050] hover:bg-[var(--bg-main)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <History size={18} />
              <span>Xem lại theo ngày</span>
            </div>
             {tab === 'playback' && <div className="w-1.5 h-1.5 rounded-full bg-[#C9A050] shadow-[0_0_8px_#C9A050]" />}
          </button>

          <button
            onClick={() => handleTabChange('about')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
              tab === 'about'
                ? 'bg-[var(--bg-main)] text-[#C9A050] shadow-md border border-[var(--border-color)]'
                : 'text-[var(--text-secondary)] hover:text-[#C9A050] hover:bg-[var(--bg-main)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Info size={18} />
              <span>Về chúng tôi</span>
            </div>
             {tab === 'about' && <div className="w-1.5 h-1.5 rounded-full bg-[#C9A050] shadow-[0_0_8px_#C9A050]" />}
          </button>

          <div className="pt-4 pb-2 px-4">
            <div className="h-px bg-[var(--border-color)] opacity-50 mb-4" />
            <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40">Phân tích & Thống kê</p>
          </div>

          <button
            disabled
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold text-[var(--text-secondary)] opacity-50 cursor-not-allowed group"
          >
            <div className="flex items-center gap-3">
              <Trophy size={18} />
              <span>Thống kê trận đấu</span>
            </div>
            <span className="text-[8px] font-black bg-[var(--bg-main)] px-1.5 py-0.5 rounded border border-[var(--border-color)] group-hover:text-[#C9A050] transition-colors">SOON</span>
          </button>

          <button
            disabled
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold text-[var(--text-secondary)] opacity-50 cursor-not-allowed group"
          >
            <div className="flex items-center gap-3">
              <Monitor size={18} />
              <span>Thống kê tỷ số</span>
            </div>
            <span className="text-[8px] font-black bg-[var(--bg-main)] px-1.5 py-0.5 rounded border border-[var(--border-color)] group-hover:text-[#C9A050] transition-colors">SOON</span>
          </button>
        </nav>

        <div className={`p-4 space-y-4 mb-4 md:mb-0 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>
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
      <main className="flex-1 min-h-screen md:h-screen md:overflow-y-auto relative bg-[var(--bg-main)] transition-colors duration-300 pt-16 md:pt-0">
        {!isSidebarOpen && (
          <button 
            onClick={toggleSidebar}
            className="hidden md:flex fixed top-6 left-6 z-[60] p-3 rounded-2xl bg-[var(--bg-sidebar)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[#C9A050] hover:border-[#C9A050]/30 shadow-xl transition-all duration-300 cursor-pointer group"
          >
            <Menu size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        )}
        <div className="min-h-full p-6 md:p-12 pb-24 md:pb-12">
          {tab === 'live' && <LiveView />}
          {tab === 'playback' && <PlaybackView />}
          {tab === 'about' && <AboutUs />}
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
