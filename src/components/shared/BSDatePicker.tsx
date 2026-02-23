import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type BSDate,
  BS_MONTHS_ENGLISH,
  BS_CALENDAR_DATA,
  BS_MIN_YEAR,
  BS_MAX_YEAR,
  getDaysInBSMonth,
  bsDayOfWeek,
  bsToAD,
  todayBS,
  formatBSShort,
} from '@/lib/bs-calendar';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface BSDatePickerProps {
  value?: BSDate | null;
  onChange: (date: BSDate, adDate: Date) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function BSDatePicker({
  value,
  onChange,
  placeholder = 'Select BS date',
  className,
  disabled = false,
}: BSDatePickerProps) {
  const today = useMemo(() => todayBS(), []);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState(value?.month ?? today.month);

  const daysInMonth = getDaysInBSMonth(viewYear, viewMonth);
  const firstDayOfWeek = bsDayOfWeek({ year: viewYear, month: viewMonth, day: 1 });

  // Generate calendar grid cells
  const calendarDays = useMemo(() => {
    const cells: (number | null)[] = [];
    // Leading empty cells
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }
    // Day numbers
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  }, [daysInMonth, firstDayOfWeek]);

  const goToPrevMonth = useCallback(() => {
    if (viewMonth === 1) {
      if (viewYear > BS_MIN_YEAR) {
        setViewYear(viewYear - 1);
        setViewMonth(12);
      }
    } else {
      setViewMonth(viewMonth - 1);
    }
  }, [viewYear, viewMonth]);

  const goToNextMonth = useCallback(() => {
    if (viewMonth === 12) {
      if (viewYear < BS_MAX_YEAR) {
        setViewYear(viewYear + 1);
        setViewMonth(1);
      }
    } else {
      setViewMonth(viewMonth + 1);
    }
  }, [viewYear, viewMonth]);

  const goToToday = useCallback(() => {
    setViewYear(today.year);
    setViewMonth(today.month);
  }, [today]);

  const handleSelect = useCallback(
    (day: number) => {
      const bsDate: BSDate = { year: viewYear, month: viewMonth, day };
      const adDate = bsToAD(bsDate);
      onChange(bsDate, adDate);
      setOpen(false);
    },
    [viewYear, viewMonth, onChange]
  );

  const isSelected = (day: number) =>
    value?.year === viewYear && value?.month === viewMonth && value?.day === day;

  const isToday = (day: number) =>
    today.year === viewYear && today.month === viewMonth && today.day === day;

  const years = useMemo(
    () => Array.from({ length: BS_MAX_YEAR - BS_MIN_YEAR + 1 }, (_, i) => BS_MIN_YEAR + i),
    []
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start text-left font-normal h-9 text-sm',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
          {value ? formatBSShort(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <div className="p-3 space-y-2">
          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={goToPrevMonth}
              disabled={viewYear === BS_MIN_YEAR && viewMonth === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex gap-1">
              <Select
                value={String(viewMonth)}
                onValueChange={(v) => setViewMonth(Number(v))}
              >
                <SelectTrigger className="h-7 text-xs w-[100px] border-0 shadow-none font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BS_MONTHS_ENGLISH.map((name, idx) => (
                    <SelectItem key={idx} value={String(idx + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(viewYear)}
                onValueChange={(v) => setViewYear(Number(v))}
              >
                <SelectTrigger className="h-7 text-xs w-[72px] border-0 shadow-none font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={goToNextMonth}
              disabled={viewYear === BS_MAX_YEAR && viewMonth === 12}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-0">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className={cn(
                  'text-center text-[10px] font-medium py-1',
                  wd === 'Sa' ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0">
            {calendarDays.map((day, idx) => (
              <div key={idx} className="flex items-center justify-center">
                {day === null ? (
                  <div className="h-8 w-8" />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelect(day)}
                    className={cn(
                      'h-8 w-8 rounded-md text-xs font-medium transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                      isSelected(day) &&
                        'bg-primary text-primary-foreground hover:bg-primary/90',
                      isToday(day) &&
                        !isSelected(day) &&
                        'border border-primary text-primary font-bold',
                      // Saturday (last column) highlight
                      (firstDayOfWeek + day - 1) % 7 === 6 &&
                        !isSelected(day) &&
                        'text-destructive'
                    )}
                  >
                    {day}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Today button */}
          <div className="border-t border-border pt-2 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                goToToday();
                handleSelect(today.day);
              }}
            >
              Today ({formatBSShort(today)})
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
