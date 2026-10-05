"use client";

import { criarDataDoEvento, dataDoEvento } from "@/lib/datas-calendario";
import { formatarDataISO } from "@essencia/shared/formatar-data";
import type {
  CalendarEvent,
  CalendarEventType,
} from "@essencia/shared/schemas/calendar";
import { eventTypeConfig } from "@essencia/shared/types/calendar";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@essencia/ui/components/button";
import { Checkbox } from "@essencia/ui/components/checkbox";
import { Input } from "@essencia/ui/components/input";
import { Label } from "@essencia/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import { Sheet } from "@essencia/ui/components/sheet";
import { Textarea } from "@essencia/ui/components/textarea";

// Form schema
const formSchema = z.object({
  title: z
    .string()
    .min(2, "Título deve ter pelo menos 2 caracteres")
    .max(200, "Título deve ter no máximo 200 caracteres"),
  description: z.string().max(1000).optional(),
  eventType: z.enum([
    "INICIO_SEMESTRE",
    "TERMINO_SEMESTRE",
    "FERIADO",
    "RECESSO",
    "FERIAS_PROFESSORES",
    "SABADO_LETIVO",
    "SEMANA_PROVAS",
    "DIA_LETIVO",
    "REUNIAO_PEDAGOGICA",
    "EVENTO_ESPECIAL",
  ]),
  startDate: z.string().min(1, "Data inicial é obrigatória"),
  endDate: z.string().min(1, "Data final é obrigatória"),
  isSchoolDay: z.boolean(),
  isRecurringAnnually: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultDate?: Date;
  unitId: string;
  onSubmit: (data: {
    unitId: string;
    title: string;
    description?: string;
    eventType: CalendarEventType;
    startDate: Date;
    endDate: Date;
    isSchoolDay: boolean;
    isRecurringAnnually: boolean;
  }) => Promise<boolean>;
  isLoading?: boolean;
}

const eventTypes: CalendarEventType[] = [
  "DIA_LETIVO",
  "FERIADO",
  "RECESSO",
  "FERIAS_PROFESSORES",
  "SABADO_LETIVO",
  "SEMANA_PROVAS",
  "REUNIAO_PEDAGOGICA",
  "EVENTO_ESPECIAL",
  "INICIO_SEMESTRE",
  "TERMINO_SEMESTRE",
];

export function EventForm({
  open,
  onOpenChange,
  event,
  defaultDate,
  unitId,
  onSubmit,
  isLoading = false,
}: EventFormProps) {
  const isEditing = !!event;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: valoresIniciais(),
  });

  function valoresIniciais(): FormData {
    return {
      title: event?.title ?? "",
      description: event?.description ?? "",
      eventType: event?.eventType ?? "DIA_LETIVO",
      startDate: event
        ? dataDoEvento(event.startDate)
        : defaultDate
          ? formatarDataISO(defaultDate)
          : formatarDataISO(new Date()),
      endDate: event
        ? dataDoEvento(event.endDate)
        : defaultDate
          ? formatarDataISO(defaultDate)
          : formatarDataISO(new Date()),
      isSchoolDay: event?.isSchoolDay ?? true,
      isRecurringAnnually: event?.isRecurringAnnually ?? false,
    };
  }

  const { reset } = form;
  useEffect(() => {
    if (open) reset(valoresIniciais());
    // O formulário deve acompanhar a seleção somente ao abrir/trocar evento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event, defaultDate, reset]);

  const handleSubmit = async (data: FormData) => {
    // Validate dates
    const startDate = criarDataDoEvento(data.startDate);
    const endDate = criarDataDoEvento(data.endDate);

    if (endDate < startDate) {
      form.setError("endDate", {
        message: "Data final deve ser maior ou igual à data inicial",
      });
      return false;
    }

    const salvo = await onSubmit({
      unitId,
      title: data.title,
      description: data.description,
      eventType: data.eventType,
      startDate,
      endDate,
      isSchoolDay: data.isSchoolDay,
      isRecurringAnnually: data.isRecurringAnnually,
    });

    if (!salvo) return false;
    form.reset();
    onOpenChange(false);
  };

  return (
    <Sheet
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={isEditing ? "Editar Evento" : "Novo Evento"}
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Título *</Label>
          <Input
            id="title"
            placeholder="Ex: Feriado de Carnaval"
            {...form.register("title")}
          />
          {form.formState.errors.title && (
            <p className="text-xs text-red-500">
              {form.formState.errors.title.message}
            </p>
          )}
        </div>

        {/* Event Type */}
        <div className="space-y-2">
          <Label htmlFor="eventType">Tipo de Evento *</Label>
          <Select
            value={form.watch("eventType")}
            onValueChange={(value) =>
              form.setValue("eventType", value as CalendarEventType)
            }
          >
            <SelectTrigger id="eventType">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-sm ${eventTypeConfig[type].bgColor} ${eventTypeConfig[type].borderColor} border`}
                    />
                    {eventTypeConfig[type].label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Data Inicial *</Label>
            <Input id="startDate" type="date" {...form.register("startDate")} />
            {form.formState.errors.startDate && (
              <p className="text-xs text-red-500">
                {form.formState.errors.startDate.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">Data Final *</Label>
            <Input id="endDate" type="date" {...form.register("endDate")} />
            {form.formState.errors.endDate && (
              <p className="text-xs text-red-500">
                {form.formState.errors.endDate.message}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            placeholder="Descrição opcional do evento..."
            rows={3}
            {...form.register("description")}
          />
        </div>

        {form.formState.errors.description && (
          <p role="alert" className="text-xs text-red-500">
            Descrição deve ter no máximo 1000 caracteres.
          </p>
        )}
        {/* Checkboxes */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isSchoolDay"
              checked={form.watch("isSchoolDay")}
              onCheckedChange={(checked) =>
                form.setValue("isSchoolDay", !!checked)
              }
            />
            <Label htmlFor="isSchoolDay" className="text-sm font-normal">
              É dia letivo
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isRecurringAnnually"
              checked={form.watch("isRecurringAnnually")}
              onCheckedChange={(checked) =>
                form.setValue("isRecurringAnnually", !!checked)
              }
            />
            <Label
              htmlFor="isRecurringAnnually"
              className="text-sm font-normal"
            >
              Repete anualmente
            </Label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={isLoading}>
            {isLoading ? "Salvando..." : isEditing ? "Salvar" : "Criar"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
