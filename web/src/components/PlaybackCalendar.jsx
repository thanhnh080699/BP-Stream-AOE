import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const PlaybackCalendar = ({ replays = {}, selectedDate, onSelectDate }) => {
    // Current viewed month date (default to selectedDate, or latest replay, or today)
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        if (selectedDate) {
            const dateObj = new Date(selectedDate);
            if (!isNaN(dateObj)) {
                setCurrentMonth(new Date(dateObj.getFullYear(), dateObj.getMonth(), 1));
            }
        } else {
            const dates = Object.keys(replays).sort();
            if (dates.length > 0) {
                const latestObj = new Date(dates[dates.length - 1]);
                if (!isNaN(latestObj)) {
                    setCurrentMonth(new Date(latestObj.getFullYear(), latestObj.getMonth(), 1));
                }
            }
        }
    }, []); // Only run once on mount

    const replayDates = Object.keys(replays);

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year, month) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Map Sunday(0) -> 6, Monday(1) -> 0...
    };

    // Format local date block string to YYYY-MM-DD without time zone shifting issues
    const formatDateKey = (year, month, day) => {
        const y = year;
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const renderCalendarGrid = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        
        const daysInMonth = getDaysInMonth(year, month);
        const firstDayStr = getFirstDayOfMonth(year, month);
        
        const daysInPrevMonth = getDaysInMonth(year, month - 1);
        
        const days = [];
        
        // Prev month remainder
        for (let i = 0; i < firstDayStr; i++) {
            const dayNum = daysInPrevMonth - firstDayStr + i + 1;
            days.push(
                <div key={`prev-${i}`} className="p-2 text-center text-[var(--text-secondary)] opacity-20 text-xs font-bold">
                    {dayNum}
                </div>
            );
        }
        
        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const dateKey = formatDateKey(year, month, i);
            const hasReplay = replayDates.includes(dateKey);
            const isProcessing = hasReplay && replays[dateKey]?.status === 'processing';
            const isSelected = selectedDate === dateKey;
            
            days.push(
                <button
                    key={`curr-${i}`}
                    onClick={() => onSelectDate(dateKey)}
                    disabled={!hasReplay}
                    className={`relative p-2 flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-300
                        ${hasReplay ? 'cursor-pointer hover:border-[#f1812e]/50 hover:bg-[var(--bg-main)]' : 'cursor-not-allowed opacity-30'}
                        ${isSelected ? 'bg-[#f1812e] text-[#fff] shadow-lg shadow-[#f1812e]/30 scale-110 z-10' : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]'}
                    `}
                >
                    <span className={isSelected ? '' : hasReplay ? 'text-[#f1812e]' : ''}>{i}</span>
                    
                    {hasReplay && !isSelected && !isProcessing && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#f1812e] shadow-[0_0_5px_#f1812e]" />
                    )}
                    
                    {isProcessing && !isSelected && (
                         <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                    )}
                </button>
            );
        }
        
        // Next month remainder to complete grid (42 cells max)
        const totalCells = days.length;
        const remainder = 42 - totalCells;
        for (let i = 1; i <= remainder; i++) {
            days.push(
                <div key={`next-${i}`} className="p-2 text-center text-[var(--text-secondary)] opacity-20 text-xs font-bold">
                    {i}
                </div>
            );
        }
        
        return days;
    };

    const monthNames = [
        "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
        "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
    ];

    return (
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-5 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button 
                    onClick={prevMonth}
                    className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[#f1812e] hover:bg-[var(--bg-main)] transition-colors"
                >
                    <ChevronLeft size={16} />
                </button>
                
                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)] flex items-center gap-2">
                    <CalendarIcon size={14} className="text-[#f1812e]" />
                    {monthNames[currentMonth.getMonth()]}, {currentMonth.getFullYear()}
                </h3>

                <button 
                    onClick={nextMonth}
                    className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[#f1812e] hover:bg-[var(--bg-main)] transition-colors"
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
                    <div key={day} className="text-center text-[9px] font-black uppercase tracking-tight text-[var(--text-secondary)] opacity-60">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1.5">
                {renderCalendarGrid()}
            </div>
            
            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-4 text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] border-t border-[var(--border-color)] pt-3">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#f1812e] shadow-[0_0_5px_#f1812e]" />
                    <span>Có bản ghi</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    <span>Đang xử lý</span>
                </div>
            </div>
        </div>
    );
};

export default PlaybackCalendar;
