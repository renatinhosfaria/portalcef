"use client";

import { Badge } from "@essencia/ui/components/badge";
import { Button } from "@essencia/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  AlertCircle,
  ArrowRight,
  Building2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Mock Data
export type SchoolStatus = "active" | "pending";

export interface SchoolListItem {
  id: string;
  name: string;
  code: string;
  unitsCount: number;
  activeStudents: number;
  status: SchoolStatus;
}

export const MOCK_SCHOOLS: SchoolListItem[] = [
  {
    id: "1",
    name: "Colégio Essência - Matriz",
    code: "essencia-sp-matriz",
    unitsCount: 12,
    activeStudents: 4500,
    status: "active",
  },
  {
    id: "2",
    name: "Colégio Essência - Rio de Janeiro",
    code: "essencia-rj-sul",
    unitsCount: 4,
    activeStudents: 1200,
    status: "active",
  },
  {
    id: "3",
    name: "Rede Santa Maria (Parceira)",
    code: "santa-maria-mg",
    unitsCount: 2,
    activeStudents: 800,
    status: "pending",
  },
];

interface SchoolListProps {
  schools: SchoolListItem[];
  isLoading?: boolean;
  error?: string | null;
  deleteError?: string | null;
  deletingId?: string | null;
  onCreateClick: () => void;
  onEditClick: (school: SchoolListItem) => void;
  onManageDirectorClick: (school: SchoolListItem) => void;
  onDeleteClick: (school: SchoolListItem) => void | Promise<void>;
}

export function SchoolList({
  schools,
  isLoading = false,
  error,
  deleteError,
  deletingId,
  onCreateClick,
  onEditClick,
  onManageDirectorClick,
  onDeleteClick,
}: SchoolListProps) {
  const [filter, setFilter] = useState("");
  const normalizedFilter = filter.trim().toLowerCase();
  const filteredSchools = normalizedFilter
    ? schools.filter((school) => {
        const haystack =
          `${school.name} ${school.code} ${school.id}`.toLowerCase();
        return haystack.includes(normalizedFilter);
      })
    : schools;

  const handleDeleteClick = async (school: SchoolListItem) => {
    const shouldDelete = window.confirm(
      `Deseja excluir a escola "${school.name}"? Esta acao nao pode ser desfeita.`,
    );

    if (!shouldDelete) {
      return;
    }

    await onDeleteClick(school);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-slate-400" />
          Instituições
        </h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar escolas..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9 pr-4 h-10 w-full sm:w-64 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none transition-all text-sm"
            />
          </div>
          <Button
            onClick={onCreateClick}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-900/20 gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Escola</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {deleteError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {deleteError}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[400px] pl-6">Nome da Escola</TableHead>
              <TableHead>Código Interno</TableHead>
              <TableHead>Unidades</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="pl-6 py-8 text-center text-sm text-slate-500"
                >
                  Carregando escolas...
                </TableCell>
              </TableRow>
            ) : filteredSchools.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="pl-6 py-8 text-center text-sm text-slate-500"
                >
                  Nenhuma escola encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredSchools.map((school) => (
                <TableRow
                  key={school.id}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  <TableCell className="pl-6 py-5">
                    <Link href={`/schools/${school.id}`} className="block">
                      <div className="font-bold text-slate-900 text-lg">
                        {school.name}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        ID: {school.id}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-slate-600 font-mono text-sm">
                    {school.code}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        {school.unitsCount} Unidades
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          school.status === "active"
                            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                            : "bg-amber-400"
                        }`}
                      />
                      <span className="text-sm font-medium text-slate-600 capitalize">
                        {school.status === "active" ? "Ativa" : "Pendente"}
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
                        <DropdownMenuItem
                          asChild
                          className="gap-2 cursor-pointer h-9"
                        >
                          <Link href={`/schools/${school.id}`}>
                            <ArrowRight className="w-4 h-4 text-slate-500" />
                            Gerenciar Unidades
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer h-9"
                          onClick={() => onManageDirectorClick(school)}
                        >
                          <User className="w-4 h-4 text-slate-500" />
                          Gerenciar Diretora
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer h-9"
                          onClick={() => onEditClick(school)}
                        >
                          <Pencil className="w-4 h-4 text-slate-500" />
                          Editar Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer h-9 text-red-600 focus:text-red-700 focus:bg-red-50"
                          onClick={() => handleDeleteClick(school)}
                          disabled={deletingId === school.id}
                        >
                          {deletingId === school.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          {deletingId === school.id
                            ? "Excluindo..."
                            : "Excluir Escola"}
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
