import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Calendar, CalendarDays } from 'lucide-react';
import { cn } from '../../utils/cn';

interface CustomCalendarProps {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CustomCalendar({ 
  value, 
  onChange, 
  placeholder = "Select date", 
  disabled = false,
  className = ""
}: CustomCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(value ? new Date(value) : null);

  // English month names
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // English day names (short) - fixed spacing
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  useEffect(() => {
    if (value) {
      // Handle both YYYY-MM-DD and DD/MM/YYYY formats
      let date: Date;
      if (value.includes('-')) {
        // YYYY-MM-DD format
        date = new Date(value + 'T00:00:00');
      } else {
        // DD/MM/YYYY format
        const parts = value.split('/');
        if (parts.length === 3) {
          date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else {
          date = new Date(value);
        }
      }
      
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
        setCurrentDate(date);
      }
    }
  }, [value]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Get the first day of the month
    const firstDay = new Date(year, month, 1);
    // Get the last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, month, i);
      days.push(dayDate);
    }

    // Fill remaining cells to complete the grid (6 rows × 7 columns = 42 cells)
    const totalCells = 42;
    while (days.length < totalCells) {
      days.push(null);
    }

    return days;
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    // Fix timezone issue by using local date string
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    onChange(dateString);
    setIsOpen(false);
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
    const dateString = today.toISOString().split('T')[0];
    onChange(dateString);
    setIsOpen(false);
  };

  const formatDisplayDate = (date: Date | null) => {
    if (!date) return placeholder;
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };

  const isSameMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth() && 
           date.getFullYear() === currentDate.getFullYear();
  };

  const days = getDaysInMonth(currentDate);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal bg-input border-border",
            !selectedDate && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          type="button"
        >
          <Calendar className="mr-2 h-4 w-4" />
          {formatDisplayDate(selectedDate)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-card border-border shadow-lg custom-calendar" align="start" side="bottom">
        <div className="p-3 w-[280px] max-h-[350px] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                goToPreviousMonth();
              }}
              className="h-7 w-7 p-0 hover:bg-accent"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <div className="text-center">
              <div className="text-sm font-medium text-foreground">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                goToNextMonth();
              }}
              className="h-7 w-7 p-0 hover:bg-accent"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          {/* Day headers */}
          <div className="calendar-grid mb-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {dayNames.map((day) => (
              <div
                key={day}
                className="calendar-day text-xs font-medium text-muted-foreground"
                style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {days.map((day, index) => (
              <div
                key={index}
                className={cn(
                  "calendar-day",
                  !day && "invisible",
                  day && isToday(day) && "today",
                  day && isSelected(day) && !isToday(day) && "selected",
                  day && !isSameMonth(day) && "other-month"
                )}
                style={{ 
                  width: '28px', 
                  height: '28px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  cursor: day ? 'pointer' : 'default'
                }}
                onClick={(e) => {
                  e.preventDefault();
                  day && handleDateSelect(day);
                }}
              >
                {day ? day.getDate() : ''}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setSelectedDate(null);
                onChange('');
                setIsOpen(false);
              }}
              className="hover:bg-accent text-xs px-2 py-1"
            >
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                goToToday();
              }}
              className="hover:bg-accent text-xs px-2 py-1"
            >
              Today
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
} 