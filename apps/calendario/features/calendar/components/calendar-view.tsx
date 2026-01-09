"use client";

import type {
  CalendarEvent,
  CalendarEventType,
} from "@essencia/shared/schemas/calendar";
import { toast } from "sonner";
import { useState } from "react";

import {
  useCalendarEvents,
  useCalendarNavigation,
  useEventMutations,
} from "../hooks";
import { CalendarGrid } from "./calendar-grid";
import { CalendarHeader } from "./calendar-header";
import { EventCard } from "./event-card";
import { EventForm } from "./event-form";
import { Legend } from "./legend";
import { MonthStats } from "./month-stats";
import { YearSummary } from "./year-summary";

interface CalendarViewProps {
  unitId?: string | null;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function CalendarView({
  unitId,
  canEdit = false,
  canDelete = false,
}: CalendarViewProps) {
  const { currentDate, currentYear, goToNextMonth, goToPrevMonth, goToToday } =
    useCalendarNavigation();

  const { events, isLoading, error, refetch } = useCalendarEvents({
    unitId,
    year: currentYear,
  });

  // Debug: Log events
  console.log(
    "[CalendarView] Events loaded:",
    events.length,
    "unitId:",
    unitId,
    "year:",
    currentYear,
  );
  if (events.length > 0) {
    console.log("[CalendarView] First 3 events:", events.slice(0, 3));
  }

  const mutations = useEventMutations({
    onSuccess: () => {
      refetch();
      toast.success("Operação realizada com sucesso");
    },
    onError: (message) => {
      toast.error(message);
    },
  });

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Event detail panel state
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

  const handleNewEvent = () => {
    setSelectedEvent(null);
    setSelectedDate(new Date());
    setIsFormOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsFormOpen(true);
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    if (window.confirm(`Tem certeza que deseja excluir "${event.title}"?`)) {
      await mutations.remove(event.id);
      setDetailEvent(null);
    }
  };

  const handleSelectDate = (date: Date) => {
    if (canEdit) {
      setSelectedEvent(null);
      setSelectedDate(date);
      setIsFormOpen(true);
    }
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    setDetailEvent(event);
  };

  const handleFormSubmit = async (data: {
    unitId: string;
    title: string;
    description?: string;
    eventType: CalendarEventType;
    startDate: Date;
    endDate: Date;
    isSchoolDay: boolean;
    isRecurringAnnually: boolean;
  }) => {
    if (selectedEvent) {
      await mutations.update(selectedEvent.id, {
        title: data.title,
        description: data.description,
        eventType: data.eventType,
        startDate: data.startDate,
        endDate: data.endDate,
        isSchoolDay: data.isSchoolDay,
        isRecurringAnnually: data.isRecurringAnnually,
      });
    } else {
      await mutations.create(data);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-sm text-slate-600">Carregando calendário...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="font-semibold text-red-600 mb-2">
          Erro ao carregar calendário
        </h2>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with navigation */}
      <CalendarHeader
        currentDate={currentDate}
        onPrevMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
        onToday={goToToday}
        onNewEvent={handleNewEvent}
        canCreate={canEdit}
      />

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid - 3 columns on large screens */}
        <div className="lg:col-span-3">
          <CalendarGrid
            currentDate={currentDate}
            events={events}
            onSelectDate={handleSelectDate}
            onSelectEvent={handleSelectEvent}
          />
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-4">
          {/* Selected event detail */}
          {detailEvent && (
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-slate-900">
                  Detalhes do Evento
                </h3>
                <button
                  onClick={() => setDetailEvent(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <EventCard
                event={detailEvent}
                onEdit={handleEditEvent}
                onDelete={handleDeleteEvent}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            </div>
          )}

          {/* Month Stats */}
          <MonthStats currentDate={currentDate} />

          {/* Year Summary */}
          <YearSummary currentDate={currentDate} />

          {/* Legend */}
          <Legend />
        </div>
      </div>

      {/* Event Form Sheet */}
      {unitId && (
        <EventForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          event={selectedEvent}
          defaultDate={selectedDate ?? undefined}
          unitId={unitId}
          onSubmit={handleFormSubmit}
          isLoading={mutations.isCreating || mutations.isUpdating}
        />
      )}
    </div>
  );
}
