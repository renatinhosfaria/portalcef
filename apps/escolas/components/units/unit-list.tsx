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
  BookOpen,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  UserPlus,
} from "lucide-react";

// Mock Data
export interface UnitListItem {
  id: string;
  name: string;
  code: string;
  address: string;
  directorGeneral: string | null;
  unitManager: string | null;
  students: number;
}

interface UnitListProps {
  units: UnitListItem[];
  isLoading?: boolean;
  error?: string | null;
  onCreateClick: () => void;
  onEditClick: (unit: UnitListItem) => void;
  onAddDirectorClick: (unit: UnitListItem) => void;
  onManageStagesClick?: (unit: UnitListItem) => void;
}

export function UnitList({
  units,
  isLoading = false,
  error,
  onCreateClick,
  onEditClick,
  onAddDirectorClick,
  onManageStagesClick,
}: UnitListProps) {
  const unitsCount = isLoading ? "..." : units.length;
  const renderPerson = (name: string | null) => {
    const displayName = name?.trim();
    if (!displayName) {
      return (
        <Badge
          variant="outline"
          className="text-amber-600 border-amber-200 bg-amber-50"
        >
          Pendente
        </Badge>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
          {displayName.charAt(0)}
        </div>
        <span className="text-sm font-medium text-slate-700">
          {displayName}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          Unidades Cadastradas
          <Badge
            variant="secondary"
            className="bg-slate-100 text-slate-600 border-slate-200"
          >
            {unitsCount}
          </Badge>
        </h3>
        <Button
          onClick={onCreateClick}
          variant="outline"
          className="border-slate-300 text-slate-700 hover:bg-slate-50 gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Unidade
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Unidade</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Diretora Geral</TableHead>
              <TableHead>Gerente da Unidade</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="pl-6 py-8 text-center text-sm text-slate-500"
                >
                  Carregando unidades...
                </TableCell>
              </TableRow>
            ) : units.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="pl-6 py-8 text-center text-sm text-slate-500"
                >
                  Nenhuma unidade encontrada.
                </TableCell>
              </TableRow>
            ) : (
              units.map((unit) => (
                <TableRow
                  key={unit.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <TableCell className="pl-6 font-medium text-slate-900">
                    {unit.name}
                  </TableCell>
                  <TableCell className="text-slate-600 font-mono text-xs">
                    {unit.code}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {unit.address || "Endereço não informado"}
                    </div>
                  </TableCell>
                  <TableCell>{renderPerson(unit.directorGeneral)}</TableCell>
                  <TableCell>{renderPerson(unit.unitManager)}</TableCell>
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
                          className="gap-2 cursor-pointer"
                          onClick={() => onAddDirectorClick(unit)}
                        >
                          <UserPlus className="w-4 h-4 text-slate-500" />
                          Definir Gerente da Unidade
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => onEditClick(unit)}
                        >
                          <Pencil className="w-4 h-4 text-slate-500" />
                          Editar Unidade
                        </DropdownMenuItem>
                        {onManageStagesClick && (
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => onManageStagesClick(unit)}
                          >
                            <BookOpen className="w-4 h-4 text-slate-500" />
                            Gerenciar Etapas
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
