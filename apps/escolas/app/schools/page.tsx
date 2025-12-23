"use client";

import { api } from "@essencia/shared/fetchers/client";
import { useCallback, useEffect, useState } from "react";

import { DirectorGeneralForm } from "../../components/schools/director-general-form";
import { SchoolForm } from "../../components/schools/school-form";
import {
  SchoolList,
  type SchoolListItem,
} from "../../components/schools/school-list";

export default function Page() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [schoolToEdit, setSchoolToEdit] = useState<SchoolListItem | null>(null);
  const [isDirectorFormOpen, setIsDirectorFormOpen] = useState(false);
  const [schoolForDirector, setSchoolForDirector] =
    useState<SchoolListItem | null>(null);
  const [schools, setSchools] = useState<SchoolListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSchools = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setDeleteError(null);

    try {
      const data =
        await api.get<Array<{ id: string; name: string; code: string }>>(
          "/schools",
        );

      const baseSchools: SchoolListItem[] = data.map((school) => ({
        id: school.id,
        name: school.name,
        code: school.code,
        unitsCount: 0,
        activeStudents: 0,
        status: "active",
      }));

      setSchools(baseSchools);
      setIsLoading(false);

      const unitCounts = await Promise.all(
        baseSchools.map(async (school) => {
          try {
            const units = await api.get<Array<{ id: string }>>(
              `/schools/${school.id}/units`,
            );
            return { id: school.id, count: units.length };
          } catch {
            return { id: school.id, count: school.unitsCount };
          }
        }),
      );

      setSchools((current) =>
        current.map((school) => {
          const match = unitCounts.find((item) => item.id === school.id);
          if (!match) return school;
          return {
            ...school,
            unitsCount: match.count,
            status: match.count > 0 ? "active" : "pending",
          };
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar escolas.",
      );
      setIsLoading(false);
    }
  }, []);

  const handleCreateClick = () => {
    setSchoolToEdit(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (school: SchoolListItem) => {
    setSchoolToEdit(school);
    setIsFormOpen(true);
  };

  const handleManageDirectorClick = (school: SchoolListItem) => {
    setSchoolForDirector(school);
    setIsDirectorFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setSchoolToEdit(null);
  };

  const handleCloseDirectorForm = () => {
    setIsDirectorFormOpen(false);
    setSchoolForDirector(null);
  };

  const handleDeleteSchool = async (school: SchoolListItem) => {
    setDeleteError(null);
    setDeletingId(school.id);

    try {
      await api.delete(`/schools/${school.id}`);
      setSchools((current) => current.filter((item) => item.id !== school.id));
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Erro ao excluir escola.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    void loadSchools();
  }, [loadSchools]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Gestão de Escolas
        </h1>
        <p className="text-slate-500 text-lg">
          Cadastre as instituições de ensino que farão parte do ecossistema.
        </p>
      </div>

      <SchoolList
        onCreateClick={handleCreateClick}
        onEditClick={handleEditClick}
        onManageDirectorClick={handleManageDirectorClick}
        onDeleteClick={handleDeleteSchool}
        schools={schools}
        isLoading={isLoading}
        error={error}
        deleteError={deleteError}
        deletingId={deletingId}
      />

      <SchoolForm
        isOpen={isFormOpen}
        onClose={handleClose}
        schoolToEdit={schoolToEdit}
        onSaved={loadSchools}
      />

      <DirectorGeneralForm
        isOpen={isDirectorFormOpen}
        onClose={handleCloseDirectorForm}
        schoolId={schoolForDirector?.id ?? ""}
        schoolName={schoolForDirector?.name}
        onSaved={loadSchools}
      />
    </div>
  );
}
