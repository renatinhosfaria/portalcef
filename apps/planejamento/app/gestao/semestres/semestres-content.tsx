"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Input } from "@essencia/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@essencia/ui/components/tabs";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  type SemestreRelatorio,
  useSemestreRelatorio,
} from "../../../features/relatorio";

const ETAPAS = ["BERCARIO", "INFANTIL"] as const;
type Etapa = (typeof ETAPAS)[number];

function getEtapasPermitidas(role?: string): Etapa[] {
  if (!role) return [];
  if (
    role === "master" ||
    role === "diretora_geral" ||
    role === "gerente_unidade" ||
    role === "coordenadora_geral"
  ) {
    return [...ETAPAS];
  }
  if (role === "coordenadora_bercario") return ["BERCARIO"];
  if (role === "coordenadora_infantil") return ["INFANTIL"];
  return [];
}

function semestreLabel(semestre: SemestreRelatorio) {
  return (
    semestre.descricao ||
    `${semestre.semestre}º semestre de ${semestre.anoLetivo}`
  );
}

export function SemestresRelatorioContent() {
  const { role, isLoaded } = useTenant();
  const {
    semestres,
    isLoading,
    error,
    criarSemestre,
    excluirSemestre,
  } = useSemestreRelatorio();
  const etapasPermitidas = useMemo(() => getEtapasPermitidas(role), [role]);
  const [selectedEtapa, setSelectedEtapa] = useState<Etapa>("BERCARIO");
  const [form, setForm] = useState({
    anoLetivo: String(new Date().getFullYear()),
    semestre: "",
    descricao: "",
    dataInicio: "",
    dataFim: "",
    dataMaximaEntrega: "",
  });
  const [salvando, setSalvando] = useState(false);

  const selectedEtapaValida = etapasPermitidas.includes(selectedEtapa)
    ? selectedEtapa
    : etapasPermitidas[0];

  const handleSubmit = async () => {
    if (!selectedEtapaValida) return;
    setSalvando(true);
    try {
      await criarSemestre({
        etapa: selectedEtapaValida,
        anoLetivo: Number(form.anoLetivo),
        semestre: Number(form.semestre),
        descricao: form.descricao || undefined,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
        dataMaximaEntrega: form.dataMaximaEntrega,
      });
      setForm({
        anoLetivo: String(new Date().getFullYear()),
        semestre: "",
        descricao: "",
        dataInicio: "",
        dataFim: "",
        dataMaximaEntrega: "",
      });
    } finally {
      setSalvando(false);
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (etapasPermitidas.length === 0 || !selectedEtapaValida) {
    return (
      <div className="container mx-auto py-6">
        <p className="py-12 text-center text-muted-foreground">
          Você não tem permissão para gerenciar semestres de relatório.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <p className="py-12 text-center text-destructive">
          Erro ao carregar semestres de relatório.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Semestres de Relatórios</h1>
        <p className="mt-2 text-muted-foreground">
          Configure semestres para Berçário e Infantil.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Novo Semestre</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-7">
          <Select
            value={selectedEtapaValida}
            onValueChange={(value) => setSelectedEtapa(value as Etapa)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {etapasPermitidas.map((etapa) => (
                <SelectItem key={etapa} value={etapa}>
                  {etapa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Ano letivo"
            value={form.anoLetivo}
            onChange={(event) =>
              setForm((atual) => ({ ...atual, anoLetivo: event.target.value }))
            }
          />
          <Input
            type="number"
            placeholder="Semestre"
            value={form.semestre}
            onChange={(event) =>
              setForm((atual) => ({ ...atual, semestre: event.target.value }))
            }
          />
          <Input
            placeholder="Descrição"
            value={form.descricao}
            onChange={(event) =>
              setForm((atual) => ({ ...atual, descricao: event.target.value }))
            }
          />
          <Input
            type="date"
            value={form.dataInicio}
            onChange={(event) =>
              setForm((atual) => ({ ...atual, dataInicio: event.target.value }))
            }
          />
          <Input
            type="date"
            value={form.dataFim}
            onChange={(event) =>
              setForm((atual) => ({ ...atual, dataFim: event.target.value }))
            }
          />
          <div className="flex gap-2">
            <Input
              type="date"
              value={form.dataMaximaEntrega}
              onChange={(event) =>
                setForm((atual) => ({
                  ...atual,
                  dataMaximaEntrega: event.target.value,
                }))
              }
            />
            <Button
              onClick={handleSubmit}
              disabled={
                salvando ||
                !form.anoLetivo ||
                !form.semestre ||
                !form.dataInicio ||
                !form.dataFim ||
                !form.dataMaximaEntrega
              }
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs
        defaultValue={selectedEtapaValida}
        value={selectedEtapaValida}
        onValueChange={(v) => setSelectedEtapa(v as Etapa)}
      >
        <TabsList className="grid w-full grid-cols-2">
          {ETAPAS.map((etapa) => (
            <TabsTrigger
              key={etapa}
              value={etapa}
              disabled={!etapasPermitidas.includes(etapa)}
            >
              {etapa}
            </TabsTrigger>
          ))}
        </TabsList>

        {ETAPAS.map((etapa) => (
          <TabsContent key={etapa} value={etapa} className="mt-6">
            <div className="grid gap-3 md:grid-cols-2">
              {semestres
                .filter((semestre) => semestre.etapa === etapa)
                .map((semestre) => (
                  <Card key={semestre.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">
                          {semestreLabel(semestre)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {semestre.dataInicio} até {semestre.dataFim} • Prazo{" "}
                          {semestre.dataMaximaEntrega}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {semestre.relatoriosVinculados ?? 0} relatório(s)
                          vinculado(s)
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => excluirSemestre(semestre.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
