"use client";

import { api } from "@essencia/shared/fetchers/client";
import { AlertCircle, ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DirectorForm } from "../../../components/units/director-form";
import { UnitForm } from "../../../components/units/unit-form";
import {
  UnitList,
  type UnitListItem,
} from "../../../components/units/unit-list";
import { UnitStagesForm } from "../../../components/units/unit-stages-form";

interface SchoolDetails {
  id: string;
  name: string;
  code: string;
}

interface DirectorSummary {
  id: string;
  name: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
}

export default function Page() {
  const params = useParams<{ id: string | string[] }>();
  const rawSchoolId = Array.isArray(params.id) ? params.id[0] : params.id;
  const schoolId = typeof rawSchoolId === "string" ? rawSchoolId : "";

  const [isUnitFormOpen, setIsUnitFormOpen] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<UnitListItem | null>(null);

  const [isDirectorFormOpen, setIsDirectorFormOpen] = useState(false);
  const [targetUnit, setTargetUnit] = useState<UnitListItem | null>(null);

  const [isStagesFormOpen, setIsStagesFormOpen] = useState(false);
  const [targetUnitForStages, setTargetUnitForStages] =
    useState<UnitListItem | null>(null);

  const [school, setSchool] = useState<SchoolDetails | null>(null);
  const [isSchoolLoading, setIsSchoolLoading] = useState(true);
  const [schoolError, setSchoolError] = useState<string | null>(null);

  const [units, setUnits] = useState<UnitListItem[]>([]);
  const [isUnitsLoading, setIsUnitsLoading] = useState(true);
  const [unitsError, setUnitsError] = useState<string | null>(null);

  const loadSchool = useCallback(async () => {
    if (!schoolId) {
      setSchoolError("Escola inválida.");
      setIsSchoolLoading(false);
      return;
    }

    setIsSchoolLoading(true);
    setSchoolError(null);
    setSchool(null);

    try {
      const data = await api.get<SchoolDetails | null>(`/schools/${schoolId}`);
      if (!data) {
        setSchool(null);
        setSchoolError("Escola não encontrada.");
      } else {
        setSchool(data);
      }
    } catch (err) {
      setSchoolError(
        err instanceof Error ? err.message : "Erro ao carregar escola.",
      );
    } finally {
      setIsSchoolLoading(false);
    }
  }, [schoolId]);

  const loadUnits = useCallback(async () => {
    if (!schoolId) {
      setUnitsError("Escola inválida.");
      setIsUnitsLoading(false);
      return;
    }

    setIsUnitsLoading(true);
    setUnitsError(null);
    setUnits([]);

    try {
      const data = await api.get<
        Array<{
          id: string;
          name: string;
          code: string;
          address?: string | null;
        }>
      >(`/schools/${schoolId}/units`);

      let managerByUnit = new Map<string, string>();
      let directorGeneral: string | null = null;

      try {
        const users = await api.get<DirectorSummary[]>("/users");
        const schoolUsers = users.filter((user) => user.schoolId === schoolId);
        managerByUnit = new Map(
          schoolUsers
            .filter((user) => user.role === "gerente_unidade" && user.unitId)
            .map((user) => [user.unitId as string, user.name]),
        );
        directorGeneral =
          schoolUsers.find(
            (user) => user.role === "diretora_geral" && !user.unitId,
          )?.name ?? null;
      } catch (err) {
        console.warn("Falha ao carregar diretoras da unidade.", err);
      }

      const mappedUnits: UnitListItem[] = data.map((unit) => ({
        id: unit.id,
        name: unit.name,
        code: unit.code,
        address: unit.address ?? "",
        directorGeneral,
        unitManager: managerByUnit.get(unit.id) ?? null,
        students: 0,
      }));

      setUnits(mappedUnits);
    } catch (err) {
      setUnitsError(
        err instanceof Error ? err.message : "Erro ao carregar unidades.",
      );
    } finally {
      setIsUnitsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadSchool();
    void loadUnits();
  }, [loadSchool, loadUnits]);

  const handleCreateUnit = () => {
    setUnitToEdit(null);
    setIsUnitFormOpen(true);
  };

  const handleEditUnit = (unit: UnitListItem) => {
    setUnitToEdit(unit);
    setIsUnitFormOpen(true);
  };

  const handleAddDirector = (unit: UnitListItem) => {
    setTargetUnit(unit);
    setIsDirectorFormOpen(true);
  };

  const handleCloseUnitForm = () => {
    setIsUnitFormOpen(false);
    setUnitToEdit(null);
  };

  const handleCloseDirectorForm = () => {
    setIsDirectorFormOpen(false);
    setTargetUnit(null);
  };

  const handleManageStages = (unit: UnitListItem) => {
    setTargetUnitForStages(unit);
    setIsStagesFormOpen(true);
  };

  const handleCloseStagesForm = () => {
    setIsStagesFormOpen(false);
    setTargetUnitForStages(null);
  };

  const schoolName = school?.name ?? "Escola";
  const schoolCode = school?.code ?? "desconhecida";

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div>
        <Link
          href="/schools"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Escolas
        </Link>
        {schoolError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {schoolError}
          </div>
        )}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              {isSchoolLoading ? "Carregando..." : schoolName}
              <span className="text-sm font-normal text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md">
                ID: {school?.id ?? schoolId}
              </span>
            </h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Código:{" "}
              <span className="font-mono text-slate-700">
                {isSchoolLoading ? "..." : schoolCode}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200" />

      {/* Units Section */}
      <UnitList
        onCreateClick={handleCreateUnit}
        onEditClick={handleEditUnit}
        onAddDirectorClick={handleAddDirector}
        onManageStagesClick={handleManageStages}
        units={units}
        isLoading={isUnitsLoading}
        error={unitsError}
      />

      <UnitForm
        isOpen={isUnitFormOpen}
        onClose={handleCloseUnitForm}
        unitToEdit={unitToEdit}
        schoolId={schoolId}
        onSaved={loadUnits}
      />

      <DirectorForm
        isOpen={isDirectorFormOpen}
        onClose={handleCloseDirectorForm}
        unit={targetUnit}
        schoolId={schoolId}
        onSaved={loadUnits}
      />

      <UnitStagesForm
        isOpen={isStagesFormOpen}
        onClose={handleCloseStagesForm}
        unit={targetUnitForStages}
        onSaved={loadUnits}
      />
    </div>
  );
}
