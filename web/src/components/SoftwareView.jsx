import React from 'react';
import { Download, Monitor, LayoutTemplate, Zap, Shield, CheckCircle2, ArrowRight } from 'lucide-react';

const SoftwareView = () => {
  const tools = [
    {
      id: 'obs',
      name: 'OBS Studio',
      version: 'v30.0.0',
      description: 'Phần mềm mã nguồn mở mạnh mẽ nhất để quay video và livestream. Được cấu hình tối ưu cho các máy thi đấu tại BPGROUP.',
      features: [
        'Hỗ trợ streaming độ phân giải cao',
        'Tích hợp sẵn các scene AOE',
        'Tối ưu hóa tài nguyên hệ thống',
        'Dễ dàng tùy chỉnh overlay'
      ],
      downloadUrl: '/downloads/OBS-Studio-32.1.2-Windows-x64.zip',
      icon: <img src="/images/obs_logo.svg" alt="OBS Logo" className="h-full w-auto object-contain" />,
      color: 'blue'
    },
    {
      id: 'aoe1',
      name: 'AOE 1 (R0 version)',
      version: 'Standard Edition',
      description: 'Phiên bản AOE 1 chuẩn thi đấu, tích hợp các bản vá lỗi và tối ưu hóa kết nối mạng cho giải đấu nội bộ.',
      features: [
        'Bản chuẩn R0 ổn định',
        'Fix lỗi lag/delay mạng',
        'Tích hợp sẵn các bản đồ thi đấu',
        'Dễ dàng cài đặt và chạy ngay'
      ],
      downloadUrl: '/downloads/AOE-HD2.zip',
      icon: <img src="/images/aoe_logo.png" alt="AOE Logo" className="h-full w-auto object-contain" />,
      color: 'amber'
    }
  ];

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-[2.5rem] border border-[var(--border-color)] min-h-[400px] flex items-center shadow-2xl">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/aoe_branding.png"
            alt="AOE Branding"
            className="w-full h-full object-cover object-center opacity-20 dark:opacity-40 grayscale-[20%] dark:grayscale-0 scale-105 group-hover:scale-100 transition-all duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-main)] via-[var(--bg-main)]/80 to-transparent z-1" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-main)] via-transparent to-transparent z-1" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-6 p-8 md:p-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f1812e]/10 border border-[#f1812e]/20 text-[#f1812e] text-xs font-black uppercase tracking-widest">
            <Shield size={14} />
            Hệ thống công cụ chuẩn
          </div>
          <h1 className="text-4xl md:text-6xl font-black font-outfit text-[var(--accent-secondary)] leading-tight tracking-tight">
            Trang bị tận răng cho <span className="text-[#f1812e]">Chiến binh</span>
          </h1>
          <p className="text-lg text-[var(--text-secondary)] font-medium leading-relaxed">
            Để đảm bảo tính công bằng và ổn định nhất cho giải đấu, tất cả các máy thi đấu
            cần được cài đặt bộ công cụ tiêu chuẩn dưới đây. Tải về ngay để bắt đầu cuộc chinh phục!
          </p>
        </div>
      </div>

      {/* Software Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="group relative bg-[var(--bg-card)] rounded-[2rem] border border-[var(--border-color)] overflow-hidden transition-all duration-500 hover:shadow-2xl hover:border-[#f1812e]/30 hover:-translate-y-2"
          >
            <div className="p-8 md:p-10 space-y-8">
              <div className="flex justify-between items-start">
                <div className="h-24 w-full flex items-start">
                  {tool.icon}
                </div>
                <div className="text-[10px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-[0.2em] pt-2 whitespace-nowrap">
                  {tool.version}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-3xl font-black font-outfit text-[var(--accent-secondary)] group-hover:text-[#f1812e] transition-colors">
                  {tool.name}
                </h3>
                <p className="text-[var(--text-secondary)] font-medium leading-relaxed opacity-80">
                  {tool.description}
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50">
                  Tính năng nổi bật
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tool.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)]">
                      <CheckCircle2 size={16} className="text-[#f1812e]" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <a
                  href={tool.downloadUrl}
                  download
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] text-[#f1812e] font-black uppercase tracking-widest text-sm hover:bg-[#f1812e] hover:text-white hover:border-[#f1812e] hover:shadow-[0_10px_30px_-10px_#f1812e] transition-all duration-300 group/btn shadow-lg"
                >
                  <Download size={20} className="group-hover/btn:animate-bounce" />
                  <span>Tải xuống ngay</span>
                  <ArrowRight size={18} className="opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-300" />
                </a>
              </div>
            </div>

            {/* Decorative Card Background */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${tool.color}-500/10 dark:bg-${tool.color}-500/5 blur-[60px] rounded-full pointer-events-none`} />
          </div>
        ))}
      </div>

      {/* Footer Support Info */}
      <div className="p-8 bg-[var(--bg-card)]/50 rounded-3xl border border-[var(--border-color)] border-dashed text-center space-y-4">
        <p className="text-sm font-bold text-[var(--text-secondary)] opacity-60">
          Gặp sự cố khi cài đặt? Liên hệ ngay với đội ngũ kỹ thuật IT TEAM tại tổng hành dinh.
        </p>
        <div className="flex justify-center items-center gap-6 opacity-30">
          <Monitor size={24} />
          <div className="w-12 h-px bg-[var(--border-color)]" />
          <Zap size={24} />
          <div className="w-12 h-px bg-[var(--border-color)]" />
          <LayoutTemplate size={24} />
        </div>
      </div>
    </div>
  );
};

export default SoftwareView;
