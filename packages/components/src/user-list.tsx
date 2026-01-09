"use client";

import { Badge } from "@essencia/ui/components/badge";
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
  UserCog,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { UserSummary } from "@essencia/lib/types";

import { useTenant } from "@essencia/shared/providers/tenant";

const ROLE_LABELS: Record<string, string> = {
  master: "Master",
  diretora_geral: "Diretora Geral",
  gerente_unidade: "Gerente de Unidade",
  gerente_financeiro: "Gerente Financeiro",
  coordenadora_geral: "Coord. Geral",
  coordenadora_bercario: "Coord. Bercario",
  coordenadora_infantil: "Coord. Infantil",
  coordenadora_fundamental_i: "Coord. Fund. I",
  coordenadora_fundamental_ii: "Coord. Fund. II",
  coordenadora_medio: "Coord. Medio",
  analista_pedagogico: "Analista Pedagógico",
  professora: "Professora",
  auxiliar_administrativo: "Aux. Administrativo",
  auxiliar_sala: "Aux. Sala",
};

const ROLE_COLORS: Record<string, string> = {
  master: "bg-purple-100 text-purple-700 hover:bg-purple-200",
  diretora_geral: "bg-rose-100 text-rose-700 hover:bg-rose-200",
  gerente_unidade: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  gerente_financeiro: "bg-teal-100 text-teal-700 hover:bg-teal-200",
  coordenadora_geral: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  coordenadora_bercario: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  coordenadora_infantil: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  coordenadora_fundamental_i: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  coordenadora_fundamental_ii: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  coordenadora_medio: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  professora: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
  // Default fallback for others
};

interface UserListProps {
  users: UserSummary[];
  onCreateClick: () => void;
  onEditClick: (user: UserSummary) => void;
}

export function UserList({ users, onCreateClick, onEditClick }: UserListProps) {
  const { role: currentUserRole } = useTenant();
  const [filter, setFilter] = useState("");

  const canEdit =
    currentUserRole === "master" ||
    currentUserRole === "diretora_geral" ||
    currentUserRole === "gerente_unidade" ||
    currentUserRole === "gerente_financeiro";

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(filter.toLowerCase()) ||
      user.email.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800">
          Listagem de Usuários
        </h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9 pr-4 h-10 w-full sm:w-64 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-[#A3D154]/20 focus:border-[#A3D154] outline-none transition-all text-sm"
            />
          </div>
          <Button variant="outline" size="icon" className="shrink-0 rounded-xl">
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
          </Button>
          {canEdit && (
            <Button
              className="bg-[#A3D154] hover:bg-[#8ec33e] text-slate-900 font-bold rounded-xl shadow-lg shadow-[#A3D154]/20 gap-2 shrink-0"
              onClick={onCreateClick}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Usuário</span>
            </Button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[300px] pl-6">Usuário</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Escola</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último Acesso</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-slate-500"
                >
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow
                  key={user.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 border-2 border-white shadow-sm overflow-hidden relative">
                        <Image
                          src={`https://api.dicebear.com/7.x/notionists/png?seed=${user.name}`}
                          alt={user.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 leading-none mb-1">
                          {user.name}
                        </p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        ROLE_COLORS[user.role] ||
                        "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }
                    >
                      {ROLE_LABELS[user.role] || user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {user.school}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {user.unit}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          user.status === "active"
                            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                            : "bg-slate-300"
                        }`}
                      />
                      <span className="text-sm font-medium text-slate-600 capitalize">
                        {user.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {user.lastActive}
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
                        {canEdit && (
                          <>
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onClick={() => onEditClick(user)}
                            >
                              <UserCog className="w-4 h-4 text-slate-500" />
                              Editar Dados
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 cursor-pointer text-red-600 focus:text-red-700 bg-red-50/50 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                              Desativar Acesso
                            </DropdownMenuItem>
                          </>
                        )}
                        {!canEdit && (
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Search className="w-4 h-4 text-slate-500" />
                            Ver Detalhes
                          </DropdownMenuItem>
                        )}
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
