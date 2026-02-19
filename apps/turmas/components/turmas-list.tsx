"use client";

import type { TurmaWithProfessora } from "@essencia/shared/types";
import { Button } from "@essencia/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@essencia/ui/components/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@essencia/ui/components/table";
import {
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useState } from "react";

interface TurmasListProps {
  turmas: TurmaWithProfessora[];
  isLoading: boolean;
  onRefresh: () => void;
  onCreateClick: () => void;
  onEditClick: (turma: TurmaWithProfessora) => void;
  onGerenciarProfessoraClick: (turma: TurmaWithProfessora) => void;
  onDeleteClick: (turma: TurmaWithProfessora) => void;
}

export function TurmasList({
  turmas,
  isLoading,
  onRefresh: _onRefresh,
  onCreateClick,
  onEditClick,
  onGerenciarProfessoraClick,
  onDeleteClick,
}: TurmasListProps) {
  const [filter, setFilter] = useState("");

  const filteredTurmas = turmas.filter(
    (turma) =>
      turma.name.toLowerCase().includes(filter.toLowerCase()) ||
      turma.code.toLowerCase().includes(filter.toLowerCase())
  );

  const shifts: Record<string, string> = {
    matutino: "Matutino",
    vespertino: "Vespertino",
    integral: "Integral",
  };

  const getShiftLabel = (shift?: string | null) => {
    if (!shift) return "-";
    return shifts[shift.toLowerCase()] || shift;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800">
          Listagem de Turmas
        </h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9 pr-4 h-10 w-full sm:w-64 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-[#A3D154]/20 focus:border-[#A3D154] outline-none transition-all text-sm"
            />
          </div>
          <Button variant="outline" size="icon" className="shrink-0 rounded-xl">
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
          </Button>
          <Button
            className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold rounded-xl shadow-lg shadow-[#A3D154]/20 gap-2 shrink-0"
            onClick={onCreateClick}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Turma</span>
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[250px] pl-6">Turma</TableHead>
              <TableHead className="w-[150px]">Professora</TableHead>
              <TableHead>Ano Letivo</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead>Capacidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTurmas.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-slate-500"
                >
                  Nenhuma turma encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredTurmas.map((turma) => (
                <TableRow
                  key={turma.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <TableCell className="pl-6 py-4">
                    <div>
                      <p className="font-semibold text-slate-900 leading-none mb-1">
                        {turma.name}
                      </p>
                      <p className="text-xs text-slate-500">{turma.code}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {turma.professora ? (
                      <div>
                        <p className="font-medium text-slate-900">{turma.professora.name}</p>
                        <p className="text-xs text-slate-500">{turma.professora.email}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Não atribuída</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {turma.year}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {getShiftLabel(turma.shift)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {turma.capacity ? `${turma.capacity} alunos` : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          turma.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                         <span className={`w-1.5 h-1.5 rounded-full ${turma.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {turma.isActive ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 rounded-xl"
                      >
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => onEditClick(turma)}
                        >
                          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                          Editar Dados
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => onGerenciarProfessoraClick(turma)}
                        >
                          <UserCheck className="w-4 h-4 text-slate-500" />
                          Gerenciar Professora
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-red-600 focus:text-red-700 bg-red-50/50 hover:bg-red-50"
                          onClick={() => onDeleteClick(turma)}
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
