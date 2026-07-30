"use client";

import type {
  WorkflowCategoria,
  WorkflowModeloDetalhe,
} from "@essencia/shared/types/workflows";
import { Button } from "@essencia/ui/components/button";
import { Input } from "@essencia/ui/components/input";
import { Textarea } from "@essencia/ui/components/textarea";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Check,
  EyeOff,
  FilePlus2,
  Plus,
  Save,
  Send,
  Trash2,
  X,
  Wand2,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { criarCategoria, obterSugestoes } from "@/lib/api";

type EditorOrientacao = {
  id?: string;
  titulo: string;
  conteudo: string;
  ordem: number;
};

type EditorEtapa = {
  id?: string;
  titulo: string;
  instrucao: string | null;
  ordem: number;
};

type EditorFase = {
  id?: string;
  nome: string;
  ordem: number;
  etapas: EditorEtapa[];
};

type EditorState = {
  nome: string;
  descricaoCurta: string;
  categoriaId: string;
  orientacoes: EditorOrientacao[];
  fases: EditorFase[];
};

export type WorkflowEditorPayload = EditorState;

interface WorkflowEditorProps {
  categorias: WorkflowCategoria[];
  modelo?: WorkflowModeloDetalhe;
  onSalvar: (payload: WorkflowEditorPayload) => void | Promise<void>;
  onPublicar?: () => void | Promise<void>;
  onInativar?: () => void | Promise<void>;
  onDuplicar?: () => void | Promise<void>;
}

const estadoInicial: EditorState = {
  nome: "",
  descricaoCurta: "",
  categoriaId: "",
  orientacoes: [],
  fases: [],
};

const VALOR_CRIAR_CATEGORIA = "__criar_categoria__";

function ordenarPorOrdem<T extends { ordem: number }>(itens: T[]) {
  return [...itens].sort((a, b) => a.ordem - b.ordem);
}

function criarEstadoDoModelo(modelo?: WorkflowModeloDetalhe): EditorState {
  if (!modelo) return estadoInicial;

  return {
    nome: modelo.nome,
    descricaoCurta: modelo.descricaoCurta,
    categoriaId: modelo.categoriaId,
    orientacoes: ordenarPorOrdem(modelo.orientacoes).map((orientacao, index) => ({
      id: orientacao.id,
      titulo: orientacao.titulo,
      conteudo: orientacao.conteudo,
      ordem: index + 1,
    })),
    fases: ordenarPorOrdem(modelo.fases).map((fase, faseIndex) => ({
      id: fase.id,
      nome: fase.nome,
      ordem: faseIndex + 1,
      etapas: ordenarPorOrdem(fase.etapas).map((etapa, etapaIndex) => ({
        id: etapa.id,
        titulo: etapa.titulo,
        instrucao: etapa.instrucao,
        ordem: etapaIndex + 1,
      })),
    })),
  };
}

function reordenar<T extends { ordem: number }>(itens: T[]) {
  return itens.map((item, index) => ({ ...item, ordem: index + 1 }));
}

function moverItem<T extends { ordem: number }>(
  itens: T[],
  index: number,
  direcao: -1 | 1,
) {
  const destino = index + direcao;
  if (destino < 0 || destino >= itens.length) return itens;

  const proximos = [...itens];
  const atual = proximos[index];
  const outro = proximos[destino];
  if (!atual || !outro) return itens;

  proximos[index] = outro;
  proximos[destino] = atual;
  return reordenar(proximos);
}

function normalizarPayload(estado: EditorState): WorkflowEditorPayload {
  return {
    categoriaId: estado.categoriaId,
    nome: estado.nome.trim(),
    descricaoCurta: estado.descricaoCurta.trim(),
    orientacoes: estado.orientacoes.map((orientacao, index) => ({
      ...(orientacao.id ? { id: orientacao.id } : {}),
      titulo: orientacao.titulo.trim(),
      conteudo: orientacao.conteudo.trim(),
      ordem: index + 1,
    })),
    fases: estado.fases.map((fase, faseIndex) => ({
      ...(fase.id ? { id: fase.id } : {}),
      nome: fase.nome.trim(),
      ordem: faseIndex + 1,
      etapas: fase.etapas.map((etapa, etapaIndex) => ({
        ...(etapa.id ? { id: etapa.id } : {}),
        titulo: etapa.titulo.trim(),
        instrucao:
          etapa.instrucao && etapa.instrucao.trim().length > 0
            ? etapa.instrucao.trim()
            : null,
        ordem: etapaIndex + 1,
      })),
    })),
  };
}

function validarPayload(payload: WorkflowEditorPayload) {
  if (!payload.categoriaId) return "Selecione uma categoria.";
  if (payload.nome.length < 3) return "Informe um nome com pelo menos 3 letras.";
  if (payload.descricaoCurta.length < 3) {
    return "Informe uma descrição curta com pelo menos 3 letras.";
  }
  if (payload.orientacoes.length === 0) {
    return "Adicione pelo menos uma orientação.";
  }
  if (payload.orientacoes.some((orientacao) => orientacao.titulo.length < 2)) {
    return "Cada orientação precisa de título com pelo menos 2 letras.";
  }
  if (payload.orientacoes.some((orientacao) => orientacao.conteudo.length < 1)) {
    return "Cada orientação precisa de conteúdo.";
  }
  if (payload.fases.length === 0) return "Adicione pelo menos uma fase.";
  if (payload.fases.some((fase) => fase.nome.length < 2)) {
    return "Cada fase precisa de nome com pelo menos 2 letras.";
  }
  if (payload.fases.some((fase) => fase.etapas.length === 0)) {
    return "Cada fase precisa de pelo menos uma etapa.";
  }
  if (
    payload.fases.some((fase) =>
      fase.etapas.some((etapa) => etapa.titulo.length < 2),
    )
  ) {
    return "Cada etapa precisa de título com pelo menos 2 letras.";
  }

  return null;
}

export function WorkflowEditor({
  categorias,
  modelo,
  onSalvar,
  onPublicar,
  onInativar,
  onDuplicar,
}: WorkflowEditorProps) {
  const [estado, setEstado] = useState<EditorState>(() =>
    criarEstadoDoModelo(modelo),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aplicandoSugestoes, setAplicandoSugestoes] = useState(false);
  const [acaoSecundaria, setAcaoSecundaria] = useState<string | null>(null);
  const [categoriasLocais, setCategoriasLocais] =
    useState<WorkflowCategoria[]>(categorias);
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [formCategoriaAberto, setFormCategoriaAberto] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");

  useEffect(() => {
    setEstado(criarEstadoDoModelo(modelo));
    setErro(null);
  }, [modelo]);

  useEffect(() => {
    setCategoriasLocais(categorias);
  }, [categorias]);

  const emEdicao = Boolean(modelo);
  const modeloPublicado = modelo?.status === "PUBLICADO";
  const categoriaSelecionada = useMemo(
    () =>
      categoriasLocais.find((categoria) => categoria.id === estado.categoriaId),
    [categoriasLocais, estado.categoriaId],
  );
  const categoriasSelecionaveis = useMemo(
    () =>
      categoriasLocais.filter(
        (categoria) =>
          categoria.ativo || categoria.id === modelo?.categoriaId,
      ),
    [categoriasLocais, modelo?.categoriaId],
  );
  const payloadAtual = useMemo(() => normalizarPayload(estado), [estado]);
  const payloadBase = useMemo(
    () => (modelo ? normalizarPayload(criarEstadoDoModelo(modelo)) : null),
    [modelo],
  );
  const temAlteracoesPendentes =
    emEdicao && payloadBase
      ? JSON.stringify(payloadAtual) !== JSON.stringify(payloadBase)
      : false;
  const mutacaoEmAndamento =
    salvando || acaoSecundaria !== null || criandoCategoria;

  function atualizarCampo(campo: keyof EditorState, valor: string) {
    setEstado((atual) => ({ ...atual, [campo]: valor }));
  }

  function atualizarCategoria(valor: string) {
    if (valor === VALOR_CRIAR_CATEGORIA) {
      setFormCategoriaAberto(true);
      return;
    }

    atualizarCampo("categoriaId", valor);
  }

  async function salvarNovaCategoria() {
    const nome = novaCategoriaNome.trim();
    if (nome.length < 2) {
      setErro("Informe uma categoria com pelo menos 2 letras.");
      return;
    }

    try {
      setErro(null);
      setCriandoCategoria(true);
      const categoriaCriada = await criarCategoria({ nome });
      setCategoriasLocais((atuais) => {
        const semDuplicidade = atuais.filter(
          (categoria) => categoria.id !== categoriaCriada.id,
        );
        return [...semDuplicidade, categoriaCriada].sort((a, b) => {
          if (a.ordem !== b.ordem) return a.ordem - b.ordem;
          return a.nome.localeCompare(b.nome, "pt-BR");
        });
      });
      atualizarCampo("categoriaId", categoriaCriada.id);
      setNovaCategoriaNome("");
      setFormCategoriaAberto(false);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a categoria.",
      );
    } finally {
      setCriandoCategoria(false);
    }
  }

  function adicionarOrientacao() {
    setEstado((atual) => ({
      ...atual,
      orientacoes: [
        ...atual.orientacoes,
        { titulo: "", conteudo: "", ordem: atual.orientacoes.length + 1 },
      ],
    }));
  }

  function atualizarOrientacao(
    index: number,
    campo: keyof Omit<EditorOrientacao, "id" | "ordem">,
    valor: string,
  ) {
    setEstado((atual) => ({
      ...atual,
      orientacoes: atual.orientacoes.map((orientacao, orientacaoIndex) =>
        orientacaoIndex === index ? { ...orientacao, [campo]: valor } : orientacao,
      ),
    }));
  }

  function removerOrientacao(index: number) {
    setEstado((atual) => ({
      ...atual,
      orientacoes: reordenar(
        atual.orientacoes.filter((_, orientacaoIndex) => orientacaoIndex !== index),
      ),
    }));
  }

  function adicionarFase() {
    if (modeloPublicado) return;

    setEstado((atual) => ({
      ...atual,
      fases: [...atual.fases, { nome: "", ordem: atual.fases.length + 1, etapas: [] }],
    }));
  }

  function atualizarFase(index: number, nome: string) {
    setEstado((atual) => ({
      ...atual,
      fases: atual.fases.map((fase, faseIndex) =>
        faseIndex === index ? { ...fase, nome } : fase,
      ),
    }));
  }

  function removerFase(index: number) {
    if (modeloPublicado) return;

    setEstado((atual) => ({
      ...atual,
      fases: reordenar(atual.fases.filter((_, faseIndex) => faseIndex !== index)),
    }));
  }

  function moverFase(index: number, direcao: -1 | 1) {
    if (modeloPublicado) return;

    setEstado((atual) => ({
      ...atual,
      fases: moverItem(atual.fases, index, direcao),
    }));
  }

  function adicionarEtapa(faseIndex: number) {
    if (modeloPublicado) return;

    setEstado((atual) => ({
      ...atual,
      fases: atual.fases.map((fase, index) =>
        index === faseIndex
          ? {
              ...fase,
              etapas: [
                ...fase.etapas,
                { titulo: "", instrucao: null, ordem: fase.etapas.length + 1 },
              ],
            }
          : fase,
      ),
    }));
  }

  function atualizarEtapa(
    faseIndex: number,
    etapaIndex: number,
    campo: keyof Omit<EditorEtapa, "id" | "ordem">,
    valor: string,
  ) {
    setEstado((atual) => ({
      ...atual,
      fases: atual.fases.map((fase, index) =>
        index === faseIndex
          ? {
              ...fase,
              etapas: fase.etapas.map((etapa, atualEtapaIndex) =>
                atualEtapaIndex === etapaIndex
                  ? { ...etapa, [campo]: campo === "instrucao" ? valor || null : valor }
                  : etapa,
              ),
            }
          : fase,
      ),
    }));
  }

  function removerEtapa(faseIndex: number, etapaIndex: number) {
    if (modeloPublicado) return;

    setEstado((atual) => ({
      ...atual,
      fases: atual.fases.map((fase, index) =>
        index === faseIndex
          ? {
              ...fase,
              etapas: reordenar(
                fase.etapas.filter(
                  (_, atualEtapaIndex) => atualEtapaIndex !== etapaIndex,
                ),
              ),
            }
          : fase,
      ),
    }));
  }

  function moverEtapa(faseIndex: number, etapaIndex: number, direcao: -1 | 1) {
    if (modeloPublicado) return;

    setEstado((atual) => ({
      ...atual,
      fases: atual.fases.map((fase, index) =>
        index === faseIndex
          ? { ...fase, etapas: moverItem(fase.etapas, etapaIndex, direcao) }
          : fase,
      ),
    }));
  }

  async function aplicarSugestoes() {
    if (modeloPublicado) {
      setErro("Modelos publicados não permitem alterações estruturais.");
      return;
    }

    if (!estado.categoriaId) {
      setErro("Selecione uma categoria para aplicar sugestões.");
      return;
    }

    try {
      setErro(null);
      setAplicandoSugestoes(true);
      const sugestoes = await obterSugestoes(estado.categoriaId);
      setEstado((atual) => ({
        ...atual,
        orientacoes: sugestoes.orientacoes.map((orientacao, index) => ({
          titulo: orientacao.titulo,
          conteudo: orientacao.conteudo,
          ordem: index + 1,
        })),
        fases: sugestoes.fases.map((fase, faseIndex) => ({
          nome: fase.nome,
          ordem: faseIndex + 1,
          etapas: fase.etapas.map((etapa, etapaIndex) => ({
            titulo: etapa.titulo,
            instrucao: etapa.instrucao,
            ordem: etapaIndex + 1,
          })),
        })),
      }));
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível aplicar as sugestões.",
      );
    } finally {
      setAplicandoSugestoes(false);
    }
  }

  async function handleSalvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = payloadAtual;
    const erroValidacao = validarPayload(payload);
    if (erroValidacao) {
      setErro(erroValidacao);
      return;
    }

    try {
      setErro(null);
      setSalvando(true);
      await onSalvar(payload);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o modelo.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function executarAcaoSecundaria(nome: string, acao?: () => void | Promise<void>) {
    if (!acao) return;
    if (mutacaoEmAndamento) return;
    if (temAlteracoesPendentes) {
      setErro("Salve o rascunho antes de executar esta ação.");
      return;
    }

    try {
      setErro(null);
      setAcaoSecundaria(nome);
      await acao();
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Não foi possível concluir a ação.",
      );
    } finally {
      setAcaoSecundaria(null);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSalvar}>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="nome-modelo" className="text-sm font-medium text-slate-700">
              Nome
            </label>
            <Input
              id="nome-modelo"
              value={estado.nome}
              onChange={(event) => atualizarCampo("nome", event.target.value)}
              placeholder="Ex.: Evento Dia dos Pais"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="descricao-curta"
              className="text-sm font-medium text-slate-700"
            >
              Descrição curta
            </label>
            <Input
              id="descricao-curta"
              value={estado.descricaoCurta}
              onChange={(event) =>
                atualizarCampo("descricaoCurta", event.target.value)
              }
              placeholder="Resumo objetivo do protocolo"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="categoria" className="text-sm font-medium text-slate-700">
              Categoria
            </label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                id="categoria"
                value={estado.categoriaId}
                onChange={(event) => atualizarCategoria(event.target.value)}
                disabled={mutacaoEmAndamento}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Selecione</option>
                {categoriasSelecionaveis.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
                <option value={VALOR_CRIAR_CATEGORIA}>Criar categoria...</option>
              </select>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={mutacaoEmAndamento}
                onClick={() => setFormCategoriaAberto(true)}
              >
                <Plus className="h-4 w-4" />
                Criar categoria
              </Button>
            </div>
            {formCategoriaAberto ? (
              <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                <div className="space-y-2">
                  <label
                    htmlFor="nova-categoria"
                    className="text-sm font-medium text-slate-700"
                  >
                    Nova categoria
                  </label>
                  <Input
                    id="nova-categoria"
                    value={novaCategoriaNome}
                    onChange={(event) => setNovaCategoriaNome(event.target.value)}
                    disabled={criandoCategoria}
                    placeholder="Ex.: Financeiro"
                  />
                </div>
                <Button
                  type="button"
                  className="gap-2"
                  disabled={criandoCategoria}
                  onClick={() => void salvarNovaCategoria()}
                >
                  <Check className="h-4 w-4" />
                  {criandoCategoria ? "Salvando..." : "Salvar categoria"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2"
                  disabled={criandoCategoria}
                  onClick={() => {
                    setFormCategoriaAberto(false);
                    setNovaCategoriaNome("");
                  }}
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => void aplicarSugestoes()}
            disabled={
              aplicandoSugestoes ||
              !estado.categoriaId ||
              modeloPublicado ||
              mutacaoEmAndamento
            }
          >
            <Wand2 className="h-4 w-4" />
            {aplicandoSugestoes ? "Aplicando..." : "Aplicar sugestões"}
          </Button>
          {categoriaSelecionada ? (
            <span className="text-sm text-slate-500">
              Sugestões para {categoriaSelecionada.nome}
            </span>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Orientações</h2>
            <p className="text-sm text-slate-600">
              Informações gerais que aparecem antes da execução.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={adicionarOrientacao}>
            <Plus className="h-4 w-4" />
            Adicionar orientação
          </Button>
        </div>

        {estado.orientacoes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Nenhuma orientação adicionada.
          </div>
        ) : (
          <div className="space-y-3">
            {estado.orientacoes.map((orientacao, index) => (
              <div
                key={`${orientacao.id ?? "orientacao"}-${index}`}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        htmlFor={`orientacao-titulo-${index}`}
                        className="text-sm font-medium text-slate-700"
                      >
                        Título da orientação
                      </label>
                      <Input
                        id={`orientacao-titulo-${index}`}
                        value={orientacao.titulo}
                        onChange={(event) =>
                          atualizarOrientacao(index, "titulo", event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor={`orientacao-conteudo-${index}`}
                        className="text-sm font-medium text-slate-700"
                      >
                        Conteúdo
                      </label>
                      <Input
                        id={`orientacao-conteudo-${index}`}
                        value={orientacao.conteudo}
                        onChange={(event) =>
                          atualizarOrientacao(index, "conteudo", event.target.value)
                        }
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remover orientação"
                    onClick={() => removerOrientacao(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Fases e etapas</h2>
            <p className="text-sm text-slate-600">
              Organize a sequência sem drag and drop.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={adicionarFase}
            disabled={modeloPublicado || mutacaoEmAndamento}
          >
            <FilePlus2 className="h-4 w-4" />
            Adicionar fase
          </Button>
        </div>

        {estado.fases.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Nenhuma fase adicionada.
          </div>
        ) : (
          <div className="space-y-4">
            {estado.fases.map((fase, faseIndex) => (
              <div
                key={`${fase.id ?? "fase"}-${faseIndex}`}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="space-y-2">
                      <label
                        htmlFor={`fase-nome-${faseIndex}`}
                        className="text-sm font-medium text-slate-700"
                      >
                        Nome da fase
                      </label>
                      <Input
                        id={`fase-nome-${faseIndex}`}
                        value={fase.nome}
                        onChange={(event) =>
                          atualizarFase(faseIndex, event.target.value)
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Mover fase para cima"
                        disabled={
                          modeloPublicado || mutacaoEmAndamento || faseIndex === 0
                        }
                        onClick={() => moverFase(faseIndex, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Mover fase para baixo"
                        disabled={
                          modeloPublicado ||
                          mutacaoEmAndamento ||
                          faseIndex === estado.fases.length - 1
                        }
                        onClick={() => moverFase(faseIndex, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover fase"
                        disabled={modeloPublicado || mutacaoEmAndamento}
                        onClick={() => removerFase(faseIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-800">Etapas</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={modeloPublicado || mutacaoEmAndamento}
                        onClick={() => adicionarEtapa(faseIndex)}
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar etapa
                      </Button>
                    </div>

                    {fase.etapas.length === 0 ? (
                      <p className="text-sm text-slate-600">
                        Nenhuma etapa adicionada nesta fase.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {fase.etapas.map((etapa, etapaIndex) => (
                          <div
                            key={`${etapa.id ?? "etapa"}-${faseIndex}-${etapaIndex}`}
                            className="rounded-md border border-slate-200 bg-white p-3"
                          >
                            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                              <div className="space-y-2">
                                <label
                                  htmlFor={`etapa-titulo-${faseIndex}-${etapaIndex}`}
                                  className="text-sm font-medium text-slate-700"
                                >
                                  Título da etapa
                                </label>
                                <Input
                                  id={`etapa-titulo-${faseIndex}-${etapaIndex}`}
                                  value={etapa.titulo}
                                  onChange={(event) =>
                                    atualizarEtapa(
                                      faseIndex,
                                      etapaIndex,
                                      "titulo",
                                      event.target.value,
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <label
                                  htmlFor={`etapa-instrucao-${faseIndex}-${etapaIndex}`}
                                  className="text-sm font-medium text-slate-700"
                                >
                                  Instrução
                                </label>
                                <Textarea
                                  id={`etapa-instrucao-${faseIndex}-${etapaIndex}`}
                                  value={etapa.instrucao ?? ""}
                                  onChange={(event) =>
                                    atualizarEtapa(
                                      faseIndex,
                                      etapaIndex,
                                      "instrucao",
                                      event.target.value,
                                    )
                                  }
                                  className="min-h-10"
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  aria-label="Mover etapa para cima"
                                  disabled={
                                    modeloPublicado ||
                                    mutacaoEmAndamento ||
                                    etapaIndex === 0
                                  }
                                  onClick={() =>
                                    moverEtapa(faseIndex, etapaIndex, -1)
                                  }
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  aria-label="Mover etapa para baixo"
                                  disabled={
                                    modeloPublicado ||
                                    mutacaoEmAndamento ||
                                    etapaIndex === fase.etapas.length - 1
                                  }
                                  onClick={() =>
                                    moverEtapa(faseIndex, etapaIndex, 1)
                                  }
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Remover etapa"
                                  disabled={modeloPublicado || mutacaoEmAndamento}
                                  onClick={() => removerEtapa(faseIndex, etapaIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutacaoEmAndamento} className="gap-2">
          <Save className="h-4 w-4" />
          {salvando ? "Salvando..." : "Salvar rascunho"}
        </Button>

        {emEdicao && modelo?.status !== "PUBLICADO" && onPublicar ? (
          <Button
            type="button"
            variant="outline"
            disabled={mutacaoEmAndamento}
            onClick={() => void executarAcaoSecundaria("publicar", onPublicar)}
          >
            <Send className="h-4 w-4" />
            {acaoSecundaria === "publicar" ? "Publicando..." : "Publicar"}
          </Button>
        ) : null}

        {emEdicao && modelo?.status !== "INATIVO" && onInativar ? (
          <Button
            type="button"
            variant="outline"
            disabled={mutacaoEmAndamento}
            onClick={() => void executarAcaoSecundaria("inativar", onInativar)}
          >
            <EyeOff className="h-4 w-4" />
            {acaoSecundaria === "inativar" ? "Inativando..." : "Inativar"}
          </Button>
        ) : null}

        {emEdicao && onDuplicar ? (
          <Button
            type="button"
            variant="outline"
            disabled={mutacaoEmAndamento}
            onClick={() => void executarAcaoSecundaria("duplicar", onDuplicar)}
          >
            <Copy className="h-4 w-4" />
            {acaoSecundaria === "duplicar" ? "Duplicando..." : "Duplicar"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
