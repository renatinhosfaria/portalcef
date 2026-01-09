"use client";

import { addMonths, getMonth, getYear, subMonths } from "date-fns";
import { useCallback, useState } from "react";

interface UseCalendarNavigationReturn {
  currentDate: Date;
  currentMonth: number;
  currentYear: number;
  goToNextMonth: () => void;
  goToPrevMonth: () => void;
  goToToday: () => void;
  goToDate: (date: Date) => void;
}

export function useCalendarNavigation(
  initialDate: Date = new Date(),
): UseCalendarNavigationReturn {
  const [currentDate, setCurrentDate] = useState(initialDate);

  const goToNextMonth = useCallback(() => {
    setCurrentDate((prev) => addMonths(prev, 1));
  }, []);

  const goToPrevMonth = useCallback(() => {
    setCurrentDate((prev) => subMonths(prev, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goToDate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  return {
    currentDate,
    currentMonth: getMonth(currentDate) + 1, // 1-indexed
    currentYear: getYear(currentDate),
    goToNextMonth,
    goToPrevMonth,
    goToToday,
    goToDate,
  };
}
