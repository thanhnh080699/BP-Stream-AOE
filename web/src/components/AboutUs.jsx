import React from 'react';
import { Target, Flag, Rocket, CheckCircle2, Users, Shield, Zap, Globe, Award, Camera, Cpu, Terminal, Laptop, HelpCircle, Video, History } from 'lucide-react';
import { Link } from 'react-router-dom';

const AboutUs = () => {
  return (
    <div className="max-w-6xl mx-auto space-y-8 md:space-y-16 pb-24 px-4 font-sans translate-y-0">
      {/* Hero Section */}
      <section className="relative rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl group h-[350px] md:h-[500px]">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10" />
        <img
          src="/aoe_banner_final.png"
          alt="BestPrice AOE Tournament"
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
        />
        <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 right-6 md:right-12 z-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 mb-4 md:mb-6">
            <Shield size={14} className="text-[#f1812e] md:w-4 md:h-4" />
            <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-white">Hệ thống VAR nội bộ</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black font-outfit text-white mb-3 md:mb-5 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] uppercase tracking-tighter leading-none">
            BestPrice <span className="text-[#f1812e]">Tech Hub</span>
          </h2>
          <p className="text-sm md:text-lg lg:text-xl text-white max-w-3xl font-bold leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            Tiên phong ứng dụng công nghệ truyền tải hình ảnh và phân tích dữ liệu thời gian thực cho các hoạt động văn hóa - thể thao nội bộ tại Công ty CP Công nghệ Du lịch Best Price.
          </p>
        </div>
      </section>

      {/* Action Buttons Section - Outline Style and Grid Aligned */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mx-4 md:mx-0">
        <Link
          to="/live"
          className="flex items-center justify-center gap-3 px-8 py-5 md:py-10 rounded-[1.5rem] md:rounded-[2.5rem] bg-transparent border-4 border-[#f1812e] text-[#f1812e] text-lg md:text-3xl font-black font-outfit uppercase tracking-wider hover:bg-[#f1812e] hover:text-white active:scale-95 transition-all animate-blink animate-glow-orange group shadow-lg"
        >
          <div className="relative">
            <Video size={32} className="md:w-12 md:h-12 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-red-500 rounded-full border-2 border-white animate-dot-blink shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>
          </div>
          Xem trực tiếp ngay
        </Link>
        <Link
          to="/playback"
          className="flex items-center justify-center gap-3 px-8 py-5 md:py-10 rounded-[1.5rem] md:rounded-[2.5rem] bg-transparent border-4 border-[var(--text-secondary)] text-[var(--text-secondary)] text-lg md:text-3xl font-black font-outfit uppercase tracking-wider hover:bg-[var(--text-secondary)] hover:text-white active:scale-95 transition-all group shadow-lg"
        >
          <History size={32} className="md:w-12 md:h-12 group-hover:rotate-[-30deg] transition-transform" />
          Xem lại
        </Link>
      </section>

      {/* Main Vision Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-start mt-8 md:mt-16">
        <div className="lg:col-span-7 space-y-8 md:space-y-12">
          <section>
            <h3 className="text-xl md:text-2xl font-black font-outfit text-[var(--accent-secondary)] mb-6 md:mb-8 flex items-center gap-3 md:gap-4">
              <span className="w-10 h-10 md:w-12 md:h-12 bg-[#f1812e]/10 rounded-xl md:rounded-2xl flex items-center justify-center text-[#f1812e] shrink-0">
                <Users size={20} className="md:w-7 md:h-7" />
              </span>
              Sứ mệnh Kết nối & Sáng tạo
            </h3>
            <div className="space-y-4 md:space-y-6 text-[var(--text-secondary)] text-base md:text-lg leading-relaxed">
              <p>
                Tại <strong>Công ty CP Công nghệ Du lịch Best Price (BestPrice Travel)</strong>, chúng tôi không chỉ coi công nghệ là công cụ phục vụ kinh doanh, mà còn là linh hồn của sự gắn kết nội bộ. Nền tảng streaming này được ra đời từ khát khao chuyên nghiệp hóa các giải đấu phong trào, biến mỗi phút thi đấu thành những trải nghiệm số đỉnh cao.
              </p>
              <p>
                Sứ mệnh của chúng tôi là xây dựng một "sân chơi số" minh bạch, nơi mỗi thành viên BestPrice đều có thể tỏa sáng và được ghi nhận qua những thước phim sắc nét nhất.
              </p>
            </div>
          </section>

          {/* INTERNAL VAR TECH SECTION */}
          <section className="bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-main)] p-6 md:p-10 rounded-[1.5rem] md:rounded-[2rem] border border-[var(--border-color)] shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 md:p-8 opacity-5 pointer-events-none">
              <Camera size={150} className="md:w-[200px] md:h-[200px]" />
            </div>
            <h3 className="text-xl md:text-2xl font-black font-outfit text-[var(--accent-secondary)] mb-6 md:mb-8 flex items-center gap-3 md:gap-4">
              <span className="w-10 h-10 md:w-12 md:h-12 bg-red-500/10 rounded-xl md:rounded-2xl flex items-center justify-center text-red-500 shrink-0">
                <Zap size={20} className="md:w-7 md:h-7" />
              </span>
              Công nghệ VAR Nội bộ
            </h3>
            <div className="space-y-4 md:space-y-6 text-[var(--text-secondary)] relative z-10">
              <p className="border-l-4 border-red-500 pl-4 md:pl-6 py-1 md:py-2 italic font-medium text-sm md:text-base">
                "Đưa tính chuyên nghiệp của các giải đấu quốc tế vào trong hoạt động nội bộ công ty."
              </p>
              <p className="text-sm md:text-base">
                Hệ thống hỗ trợ trọng tài bằng video (Video Assistant Referee - VAR) được chúng tôi tùy biến riêng để phục vụ công tác giám sát, phân tích và đưa ra quyết định chính xác tại các giải đấu AOE, bóng đá và sắp tới là Pickleball. Điều này đảm bảo tính công bằng tuyệt đối cho mọi trận đấu phong trào tại BestPrice.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 pt-2 md:pt-4">
                {[
                  { icon: <CheckCircle2 size={16} />, label: 'Xem lại tức thì' },
                  { icon: <CheckCircle2 size={16} />, label: 'Đa góc quay' },
                  { icon: <CheckCircle2 size={16} />, label: 'Độ trễ < 2s' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs md:text-sm font-bold text-[var(--accent-secondary)] bg-[var(--bg-main)]/50 p-2.5 md:p-3 rounded-xl border border-[var(--border-color)]">
                    <span className="text-red-500">{item.icon}</span>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:col-span-5 space-y-6 md:space-y-8">
          <div className="bg-[#1E293B] rounded-[1.5rem] md:rounded-[2rem] p-8 md:p-10 text-white shadow-xl relative overflow-hidden group border border-white/5">
            <div className="absolute -right-6 -bottom-6 opacity-20 transform group-hover:scale-125 transition-transform duration-700 pointer-events-none">
              <Award size={150} className="md:w-[250px] md:h-[250px]" />
            </div>
            <h3 className="text-xl md:text-2xl font-black font-outfit mb-4 md:mb-6">Giá trị cốt lõi</h3>
            <ul className="space-y-4 md:space-y-6 relative z-10">
              {[
                { title: 'Minh bạch', desc: 'Mọi quyết định đều có dữ liệu đối chứng.' },
                { title: 'Tốc độ', desc: 'Truyền tải và xử lý video siêu nhanh.' },
                { title: 'Gắn kết', desc: 'Kết nối các phòng ban qua niềm đam mê.' },
                { title: 'Sáng tạo', desc: 'Liên tục cập nhật công nghệ mới nhất.' }
              ].map((item, idx) => (
                <li key={idx}>
                  <h4 className="font-black text-xs md:text-sm uppercase tracking-wider">{item.title}</h4>
                  <p className="text-white/80 text-xs md:text-sm">{item.desc}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[var(--bg-card)] rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 border border-[var(--border-color)] shadow-sm">
            <div className="w-full h-40 md:h-48 rounded-xl md:rounded-2xl overflow-hidden mb-6 md:mb-8">
              <img src="/aoe_banner_new.png" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-lg md:text-xl font-black font-outfit text-[var(--accent-secondary)] mb-4 md:mb-6">Lược sử phát triển</h3>
            <div className="space-y-4 md:space-y-6">
              {[
                { section: 'Khởi động', event: 'Nghiên cứu và triển khai hệ thống VAR, streaming AOE nội bộ BestPrice (Q1/2026).' },
                { section: 'Nhân rộng', event: 'Mở rộng quy mô sang các bộ môn Pickleball, Game Show và văn hóa doanh nghiệp (Q2/2026+).' }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3 md:gap-4">
                  <span className="font-black text-[#f1812e] text-[9px] md:text-[10px] uppercase tracking-widest py-1 border-r border-[#f1812e]/30 pr-3 md:pr-4 min-w-[75px] md:min-w-[85px] leading-tight shrink-0">{item.section}</span>
                  <p className="text-xs md:text-sm text-[var(--text-secondary)]">{item.event}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Tech Stack & Information */}
      <section className="bg-[var(--bg-card)] rounded-[1.5rem] md:rounded-[2.5rem] border border-[var(--border-color)] overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-8 md:p-12 border-b md:border-b-0 md:border-r border-[var(--border-color)]">
            <h3 className="text-xl md:text-2xl font-black font-outfit text-[var(--accent-secondary)] mb-6 md:mb-8 flex items-center gap-3">
              <Cpu size={20} className="text-[#f1812e] md:w-6 md:h-6" />
              Project Stack
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
              <div>
                <h4 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-3 md:mb-4">Frontend</h4>
                <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm font-bold text-[var(--accent-secondary)]">
                  <li>React 18</li>
                  <li>Tailwind CSS</li>
                  <li>Video.js / HLS.js</li>
                  <li>Lucide Icons</li>
                </ul>
              </div>
              <div>
                <h4 className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-3 md:mb-4">Backend</h4>
                <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm font-bold text-[var(--accent-secondary)]">
                  <li>Node.js (Express)</li>
                  <li>SRS (RTMP/FLV/HLS)</li>
                  <li>FFmpeg Processing</li>
                  <li>Docker Stack</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="p-8 md:p-12 bg-[#0F172A] text-white">
            <h3 className="text-xl md:text-2xl font-black font-outfit mb-6 md:mb-8 flex items-center gap-3">
              <Terminal size={20} className="text-[#f1812e] md:w-6 md:h-6" />
              Infrastructure
            </h3>
            <div className="space-y-4 md:space-y-6">
              <div className="p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/10">
                <p className="text-[10px] md:text-xs text-white/50 mb-1">Architecture</p>
                <p className="text-sm md:text-base font-bold">Microservices based containerization</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/10">
                <p className="text-[10px] md:text-xs text-white/50 mb-1">Services</p>
                <p className="text-sm md:text-base font-bold">Nginx Reverse Proxy, SRS Media Gateway, Worker Processor</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Client Guide */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-[1.5rem] md:rounded-[2.5rem] p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 md:p-12 opacity-10 pointer-events-none">
          <HelpCircle size={100} className="md:w-[150px] md:h-[150px]" />
        </div>
        <div className="relative z-10">
          <h3 className="text-xl md:text-3xl font-black font-outfit mb-6 md:mb-8 flex items-center gap-3 md:gap-4">
            <Laptop size={24} className="md:w-8 md:h-8" />
            Hướng dẫn kết nối Máy Client
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-60 text-white">Bước 1: Cài đặt phần mềm</span>
                <p className="text-base md:text-lg font-medium">Sử dụng OBS Studio (Khuyên dùng) hoặc FFmpeg để stream màn hình.</p>
              </div>
              <div className="space-y-2">
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-60 text-white">Bước 2: Cấu hình Stream</span>
                <ul className="space-y-2 text-xs md:text-sm">
                  <li className="flex flex-col sm:flex-row sm:gap-2">
                    <span className="font-bold text-[#f1812e] min-w-[80px]">Service:</span>
                    <code className="bg-black/20 px-2 py-0.5 rounded break-all">Custom...</code>
                  </li>
                  <li className="flex flex-col sm:flex-row sm:gap-2">
                    <span className="font-bold text-[#f1812e] min-w-[80px]">Server:</span>
                    <code className="bg-black/20 px-2 py-0.5 rounded break-all">rtmp://192.168.9.233/live</code>
                  </li>
                  <li className="flex flex-col sm:flex-row sm:gap-2 pt-2 sm:pt-0">
                    <span className="font-bold text-[#f1812e] min-w-[80px]">Stream Key:</span>
                    <code className="bg-black/20 px-2 py-0.5 rounded">team1-1 ... team2-4</code>
                  </li>
                </ul>
                <p className="text-[11px] md:text-xs text-white/70 leading-relaxed">
                  Khong chon YouTube/Twitch trong OBS. He thong nay dung RTMP server noi bo, neu chon sai service OBS se bao loi
                  &quot;Could not access the Specified Channel or stream key&quot;.
                </p>
              </div>
            </div>
            <div className="bg-black/20 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-white/10 shrink-0">
              <h4 className="font-bold mb-4 flex items-center gap-2 text-sm md:text-base">
                <CheckCircle2 size={16} className="text-[#f1812e] md:w-[18px] md:h-[18px]" />
                Thông số Encoder tối ưu
              </h4>
              <ul className="space-y-3 text-xs md:text-sm opacity-90">
                <li className="flex justify-between border-b border-white/10 pb-2">
                  <span>Encoder</span>
                  <span className="font-bold text-[#f1812e]">x264 / NVENC</span>
                </li>
                <li className="flex justify-between border-b border-white/10 pb-2">
                  <span>Bitrate</span>
                  <span className="font-bold text-[#f1812e]">2500 - 4000 Kbps</span>
                </li>
                <li className="flex justify-between border-b border-white/10 pb-2">
                  <span>Rate Control</span>
                  <span className="font-bold text-[#f1812e]">CBR</span>
                </li>
                <li className="flex justify-between">
                  <span>Keyframe Interval</span>
                  <span className="font-bold text-[#f1812e]">2 seconds</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Banner Footer */}
      <section className="relative h-48 md:h-64 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl">
        <img src="/aoe_banner_wide.png" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-center p-6 md:p-8">
          <div>
            <p className="text-[10px] md:text-[#f1812e] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] mb-2 md:mb-4 text-[#f1812e]">BP AOE Tournament Dashboard</p>
            <h3 className="text-lg md:text-xl lg:text-2xl font-black text-white font-outfit uppercase leading-tight">Build By IT Team, For The BestPrice Culture</h3>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutUs;
