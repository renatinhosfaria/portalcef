"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import type { Tarefa } from "@essencia/shared/types";

type EventoTarefa = "tarefa:criada" | "tarefa:atualizada" | "tarefa:concluida" | "tarefa:cancelada";

interface UseTarefasSocketParams {
  onEvento: (evento: EventoTarefa, tarefa: Tarefa) => void;
}

export function useTarefasSocket({ onEvento }: UseTarefasSocketParams) {
  const socketRef = useRef<Socket | null>(null);
  const onEventoRef = useRef(onEvento);
  onEventoRef.current = onEvento;

  const conectar = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io("/tarefas", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("[WS Tarefas] Conectado");
    });

    socket.on("disconnect", (reason) => {
      console.log("[WS Tarefas] Desconectado:", reason);
    });

    const eventos: EventoTarefa[] = [
      "tarefa:criada",
      "tarefa:atualizada",
      "tarefa:concluida",
      "tarefa:cancelada",
    ];

    for (const evento of eventos) {
      socket.on(evento, (tarefa: Tarefa) => {
        onEventoRef.current(evento, tarefa);
      });
    }

    socketRef.current = socket;
  }, []);

  useEffect(() => {
    conectar();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [conectar]);
}
