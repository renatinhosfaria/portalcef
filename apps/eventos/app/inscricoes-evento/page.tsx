"use client";

import { useTenant } from "@essencia/shared/providers/tenant";
import { Badge } from "@essencia/ui/components/badge";
import { Button } from "@essencia/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@essencia/ui/components/card";
import { Checkbox } from "@essencia/ui/components/checkbox";
import { Input } from "@essencia/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@essencia/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@essencia/ui/components/table";
import { toast } from "@essencia/ui/components/toaster";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Gift,
  Mail,
  Phone,
  Search,
  Shuffle,
  TicketCheck,
  Trophy,
  Users,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

const EVENTO_SLUG = "mae-por-inteiro";
const ALLOWED_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "auxiliar_administrativo",
];

const TURMAS = [
  "Berçário",
  "Infantil 1",
  "Infantil 2",
  "Infantil 3",
  "Infantil 4",
  "Infantil 5",
  "1º Ano do Fundamental",
  "2º Ano do Fundamental",
  "3º Ano do Fundamental",
  "4º Ano do Fundamental",
  "5º Ano do Fundamental",
];

interface Filho {
  id: string;
  nome: string;
  turma: string;
}

interface Inscricao {
  id: string;
  eventoSlug: string;
  numeroInscricao: string;
  nome: string;
  cpf: string;
  dataNascimento: string;
  email: string;
  telefone: string;
  createdAt: string;
  presencaConfirmadaEm: string | null;
  presencaConfirmadaPor: string | null;
  filhos: Filho[];
}

interface Sorteio {
  id: string;
  eventoSlug: string;
  brinde: string;
  inscricaoId: string;
  numeroInscricao: string;
  nome: string;
  telefone: string;
  email: string;
  sorteadoEm: string;
  sorteadoPor: string;
}

function formatarData(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarDataNascimento(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const EXPORT_HEADERS = [
  "Nº Inscrição",
  "Data inscrição",
  "Nome",
  "CPF",
  "Data Nascimento",
  "Email",
  "Telefone",
  "Presença",
  "Presença confirmada em",
  "Filhos",
] as const;

function buildExportRows(items: Inscricao[]) {
  return items.map((i) => [
    i.numeroInscricao,
    formatarData(i.createdAt),
    i.nome,
    i.cpf,
    formatarDataNascimento(i.dataNascimento),
    i.email,
    i.telefone,
    i.presencaConfirmadaEm ? "Presente" : "Pendente",
    i.presencaConfirmadaEm ? formatarData(i.presencaConfirmadaEm) : "",
    i.filhos.map((f) => `${f.nome} (${f.turma})`).join(" | "),
  ]);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dataHoje() {
  return new Date().toISOString().slice(0, 10);
}

function exportarCSV(items: Inscricao[]) {
  const escape = (v: string) => {
    if (v.includes(";") || v.includes("\"") || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const linhas = [
    EXPORT_HEADERS.map(escape).join(";"),
    ...buildExportRows(items).map((row) =>
      row.map((v) => escape(String(v ?? ""))).join(";"),
    ),
  ];
  const csv = "﻿" + linhas.join("\r\n"); // BOM para Excel reconhecer UTF-8
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `inscricoes-${EVENTO_SLUG}-${dataHoje()}.csv`);
}

async function exportarXLSX(items: Inscricao[]) {
  // Carrega ExcelJS apenas no cliente (lazy import → fora do bundle inicial)
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Portal CEF";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Inscrições", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Nº Inscrição", key: "numero", width: 14 },
    { header: "Data inscrição", key: "data", width: 20 },
    { header: "Nome", key: "nome", width: 32 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "Data Nascimento", key: "nasc", width: 16 },
    { header: "Email", key: "email", width: 36 },
    { header: "Telefone", key: "telefone", width: 18 },
    { header: "Presença", key: "presenca", width: 14 },
    { header: "Presença confirmada em", key: "presencaEm", width: 24 },
    { header: "Filhos", key: "filhos", width: 60 },
  ];

  // Estilo do cabeçalho
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF8E5963" }, // rose-deep
  };
  headerRow.height = 22;

  // Linhas
  for (const i of items) {
    sheet.addRow({
      numero: i.numeroInscricao,
      data: formatarData(i.createdAt),
      nome: i.nome,
      cpf: i.cpf,
      nasc: formatarDataNascimento(i.dataNascimento),
      email: i.email,
      telefone: i.telefone,
      presenca: i.presencaConfirmadaEm ? "Presente" : "Pendente",
      presencaEm: i.presencaConfirmadaEm
        ? formatarData(i.presencaConfirmadaEm)
        : "",
      filhos: i.filhos.map((f) => `${f.nome} (${f.turma})`).join(" | "),
    });
  }

  // AutoFilter no cabeçalho
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  // Bordas leves nas células de dados
  const lastRow = sheet.rowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    if (r % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFAF7F2" },
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `inscricoes-${EVENTO_SLUG}-${dataHoje()}.xlsx`);
}

export default function InscricoesEventoPage() {
  const { role } = useTenant();
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [turma, setTurma] = useState<string>("__all__");
  const [somentePresentes, setSomentePresentes] = useState(false);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [atualizandoPresencaId, setAtualizandoPresencaId] = useState<
    string | null
  >(null);
  const [sorteios, setSorteios] = useState<Sorteio[]>([]);
  const [loadingSorteios, setLoadingSorteios] = useState(false);
  const [brinde, setBrinde] = useState("");
  const [sorteando, setSorteando] = useState(false);
  const [ultimoSorteio, setUltimoSorteio] = useState<Sorteio | null>(null);

  const podeAcessar = Boolean(role && ALLOWED_ROLES.includes(role));

  const carregar = useCallback(async () => {
    if (!podeAcessar) return;
    try {
      setLoading(true);
      setErro(null);
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (turma && turma !== "__all__") params.set("turma", turma);
      if (somentePresentes) params.set("somentePresentes", "true");
      const url = `/api/eventos/${EVENTO_SLUG}/inscricoes${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          setErro("Acesso negado. Sua sessão pode ter expirado.");
        } else {
          setErro(`Erro ${resp.status} ao carregar inscrições.`);
        }
        setInscricoes([]);
        setTotal(0);
        return;
      }
      const data = await resp.json();
      setInscricoes(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error(err);
      setErro("Não foi possível carregar as inscrições.");
      setInscricoes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [podeAcessar, q, somentePresentes, turma]);

  const carregarSorteios = useCallback(async () => {
    if (!podeAcessar) return;
    try {
      setLoadingSorteios(true);
      const resp = await fetch(`/api/eventos/${EVENTO_SLUG}/sorteios`, {
        credentials: "include",
      });
      if (!resp.ok) {
        throw new Error(`Erro ${resp.status} ao carregar sorteios.`);
      }
      const data = (await resp.json()) as Sorteio[];
      setSorteios(data);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar o histórico de sorteios.");
    } finally {
      setLoadingSorteios(false);
    }
  }, [podeAcessar]);

  useEffect(() => {
    if (!podeAcessar) {
      setLoading(false);
      return;
    }
    const id = setTimeout(carregar, 250); // debounce do search
    return () => clearTimeout(id);
  }, [carregar, podeAcessar]);

  useEffect(() => {
    if (!podeAcessar) return;
    carregarSorteios();
  }, [carregarSorteios, podeAcessar]);

  const totalFilhos = useMemo(
    () => inscricoes.reduce((acc, i) => acc + i.filhos.length, 0),
    [inscricoes],
  );

  const presentesConfirmadas = useMemo(
    () => inscricoes.filter((i) => i.presencaConfirmadaEm).length,
    [inscricoes],
  );

  const sorteadosIds = useMemo(
    () => new Set(sorteios.map((s) => s.inscricaoId)),
    [sorteios],
  );

  const elegiveisSorteio = useMemo(
    () =>
      inscricoes.filter(
        (i) => i.presencaConfirmadaEm && !sorteadosIds.has(i.id),
      ).length,
    [inscricoes, sorteadosIds],
  );

  async function atualizarPresenca(inscricao: Inscricao, presente: boolean) {
    try {
      setAtualizandoPresencaId(inscricao.id);
      const resp = await fetch(
        `/api/eventos/${EVENTO_SLUG}/inscricoes/${inscricao.id}/presenca`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ presente }),
        },
      );
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.message ?? `Erro ${resp.status}`);
      }
      const atualizada = (await resp.json()) as Inscricao;
      setInscricoes((atuais) => {
        if (somentePresentes && !atualizada.presencaConfirmadaEm) {
          return atuais.filter((i) => i.id !== atualizada.id);
        }
        return atuais.map((i) => (i.id === atualizada.id ? atualizada : i));
      });
      if (somentePresentes && !atualizada.presencaConfirmadaEm) {
        setTotal((atual) => Math.max(0, atual - 1));
      }
      toast.success(
        presente ? "Presença confirmada." : "Presença desfeita.",
      );
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar a presença.",
      );
    } finally {
      setAtualizandoPresencaId(null);
    }
  }

  async function sortearBrinde() {
    const nomeBrinde = brinde.trim();
    if (!nomeBrinde) {
      toast.error("Informe o nome do brinde antes de sortear.");
      return;
    }

    try {
      setSorteando(true);
      const resp = await fetch(`/api/eventos/${EVENTO_SLUG}/sorteios`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brinde: nomeBrinde }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.message ?? `Erro ${resp.status}`);
      }
      const sorteio = (await resp.json()) as Sorteio;
      setSorteios((atuais) => [sorteio, ...atuais]);
      setUltimoSorteio(sorteio);
      setBrinde("");
      toast.success(`Brinde sorteado para Nº ${sorteio.numeroInscricao}.`);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Não foi possível sortear.",
      );
    } finally {
      setSorteando(false);
    }
  }

  if (!podeAcessar) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">
              Esta página é exclusiva para Diretora Geral, Gerente de Unidade
              e Auxiliar Administrativo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            Inscrições — Mãe por Inteiro
          </h1>
          <p className="text-slate-500 mt-1">
            16 de Maio · Parque Una. Inscrições recebidas pela landing page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => exportarXLSX(inscricoes)}
            disabled={inscricoes.length === 0}
            title="Excel (.xlsx) com formatação"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => exportarCSV(inscricoes)}
            disabled={inscricoes.length === 0}
            title="CSV separado por ponto-e-vírgula"
          >
            <FileText className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <Users className="w-8 h-8 text-[#A3D154]" />
            <div>
              <p className="text-2xl font-semibold text-slate-900">{total}</p>
              <p className="text-sm text-slate-500">Inscrições no total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <Users className="w-8 h-8 text-rose-500" />
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {totalFilhos}
              </p>
              <p className="text-sm text-slate-500">
                Crianças vinculadas (página atual)
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <TicketCheck className="w-8 h-8 text-emerald-600" />
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {presentesConfirmadas}
              </p>
              <p className="text-sm text-slate-500">Presentes confirmadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <Calendar className="w-8 h-8 text-amber-500" />
            <div>
              <p className="text-2xl font-semibold text-slate-900">100</p>
              <p className="text-sm text-slate-500">Vagas disponíveis</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Sorteio de brindes</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Cada Nº Inscrição só pode ganhar uma vez.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="brinde"
              >
                Nome do brinde
              </label>
              <Input
                id="brinde"
                value={brinde}
                onChange={(e) => setBrinde(e.target.value)}
                placeholder="Ex.: cesta de café"
                className="w-full sm:w-72"
              />
            </div>
            <Button
              onClick={sortearBrinde}
              disabled={sorteando || brinde.trim().length === 0}
              className="sm:mb-0"
            >
              <Shuffle className="w-4 h-4" />
              {sorteando ? "Sorteando..." : "Sortear entre presentes"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-500">Elegíveis para sorteio</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {elegiveisSorteio}
              </p>
              <p className="mt-1 text-xs text-slate-500">na lista atual</p>
            </div>
            <div className="rounded-md border border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-500">Brindes sorteados</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {sorteios.length}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-500">Último sorteio</p>
              {ultimoSorteio ? (
                <div className="mt-1">
                  <p className="font-mono text-lg font-semibold text-slate-900">
                    {ultimoSorteio.numeroInscricao}
                  </p>
                  <p className="text-xs text-slate-500">
                    {ultimoSorteio.brinde}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  Nenhum nesta sessão.
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900">
                Histórico de sorteios
              </h2>
            </div>
            {loadingSorteios ? (
              <p className="py-6 text-sm text-slate-500">
                Carregando sorteios...
              </p>
            ) : sorteios.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">
                Nenhum brinde sorteado ainda.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brinde</TableHead>
                      <TableHead>Nº Inscrição</TableHead>
                      <TableHead>Ganhadora</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Sorteado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorteios.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-slate-900">
                          <span className="inline-flex items-center gap-2">
                            <Gift className="h-4 w-4 text-rose-500" />
                            {s.brinde}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-block rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-sm font-semibold tracking-wider text-slate-900">
                            {s.numeroInscricao}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-700">
                          {s.nome}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 text-xs text-slate-700">
                            <span>{s.telefone}</span>
                            <span>{s.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {formatarData(s.sorteadoEm)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Lista de inscritas</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome, CPF, email..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 w-full sm:w-72"
              />
            </div>
            <Select value={turma} onValueChange={setTurma}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Filtrar por turma do filho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as turmas</SelectItem>
                {TURMAS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm text-slate-700">
              <Checkbox
                checked={somentePresentes}
                onCheckedChange={(checked) =>
                  setSomentePresentes(checked === true)
                }
              />
              Somente presentes
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500 py-12 text-center">
              Carregando inscrições...
            </p>
          ) : erro ? (
            <p className="text-red-600 py-12 text-center">{erro}</p>
          ) : inscricoes.length === 0 ? (
            <p className="text-slate-500 py-12 text-center">
              Nenhuma inscrição encontrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-28">Nº Inscrição</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-center">Filhos</TableHead>
                  <TableHead>Presença</TableHead>
                  <TableHead>Inscrita em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inscricoes.map((i) => (
                  <Fragment key={i.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandidoId(expandidoId === i.id ? null : i.id)
                      }
                    >
                      <TableCell>
                        {expandidoId === i.id ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-block font-mono text-sm font-semibold text-slate-900 tracking-wider bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                          {i.numeroInscricao}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {i.nome}
                        <p className="text-xs text-slate-500 mt-0.5">
                          Nasc. {formatarDataNascimento(i.dataNascimento)}
                        </p>
                      </TableCell>
                      <TableCell className="text-slate-700">{i.cpf}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            {i.telefone}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3" />
                            {i.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-medium w-7 h-7">
                          {i.filhos.length}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex min-w-40 flex-col gap-2">
                          {i.presencaConfirmadaEm ? (
                            <div className="space-y-1">
                              <Badge className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                                Presente
                              </Badge>
                              <p className="text-xs text-slate-500">
                                {formatarData(i.presencaConfirmadaEm)}
                              </p>
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className="w-fit border-slate-200 text-slate-500"
                            >
                              Pendente
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={atualizandoPresencaId === i.id}
                            onClick={() =>
                              atualizarPresenca(i, !i.presencaConfirmadaEm)
                            }
                          >
                            <TicketCheck className="w-4 h-4" />
                            {i.presencaConfirmadaEm
                              ? "Desfazer presença"
                              : "Confirmar presença"}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {formatarData(i.createdAt)}
                      </TableCell>
                    </TableRow>
                    {expandidoId === i.id && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-slate-50">
                          <div className="py-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                              Filhos matriculados
                            </p>
                            <ul className="space-y-2">
                              {i.filhos.map((f) => (
                                <li
                                  key={f.id}
                                  className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-slate-200"
                                >
                                  <span className="font-medium text-slate-900">
                                    {f.nome}
                                  </span>
                                  <span className="text-sm text-slate-600">
                                    {f.turma}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
