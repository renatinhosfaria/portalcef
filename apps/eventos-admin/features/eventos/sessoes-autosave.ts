import type { SessaoValue } from "./etapas-contratos";

export type RespostaSessaoPersistida = { id?: string };

export function identidadeSessaoAutosave(value: SessaoValue): string {
  return value.clientId ?? value.id ?? "sessao-sem-identidade";
}

type MesclarRespostaArgs = {
  atuais: SessaoValue[];
  salvas: SessaoValue[];
  enviada: SessaoValue;
  resposta: RespostaSessaoPersistida;
  geracaoDaOperacao: number;
  geracaoAtual: number;
};

type ResultadoMescla = {
  atuais: SessaoValue[];
  salvas: SessaoValue[];
  stale: boolean;
  deveCompensar: boolean;
};

/**
 * Incorpora apenas a identidade retornada pelo servidor. Os campos atuais são
 * sempre preservados, inclusive quando a resposta pertence a uma geração
 * antiga e o rascunho foi editado enquanto a requisição estava em voo.
 */
export function mesclarRespostaSessao({
  atuais,
  salvas,
  enviada,
  resposta,
  geracaoDaOperacao,
  geracaoAtual,
}: MesclarRespostaArgs): ResultadoMescla {
  const identidade = identidadeSessaoAutosave(enviada);
  const id = resposta.id;
  const indiceAtual = atuais.findIndex((item) => identidadeSessaoAutosave(item) === identidade);
  const sobreviveu = indiceAtual >= 0;
  const deveCompensar = !sobreviveu && !enviada.id && Boolean(id);

  const proximasAtuais = [...atuais];
  if (sobreviveu && id && !proximasAtuais[indiceAtual].id) {
    proximasAtuais[indiceAtual] = { ...proximasAtuais[indiceAtual], id };
  }

  if (!sobreviveu || !id) {
    return {
      atuais: proximasAtuais,
      salvas,
      stale: geracaoDaOperacao !== geracaoAtual,
      deveCompensar,
    };
  }

  const proximaSessaoSalva = { ...enviada, id };
  const indiceSalva = salvas.findIndex((item) => identidadeSessaoAutosave(item) === identidade);
  const proximasSalvas = [...salvas];
  if (indiceSalva >= 0) {
    if (!proximasSalvas[indiceSalva].id) proximasSalvas[indiceSalva] = { ...proximasSalvas[indiceSalva], id };
  } else {
    proximasSalvas.splice(Math.min(indiceAtual, proximasSalvas.length), 0, proximaSessaoSalva);
  }

  return {
    atuais: proximasAtuais,
    salvas: proximasSalvas,
    stale: geracaoDaOperacao !== geracaoAtual,
    deveCompensar,
  };
}

type PersistirSessao = (item: SessaoValue, eventId: string) => Promise<RespostaSessaoPersistida>;

function mesmosDadosSessao(value: SessaoValue, other: SessaoValue): boolean {
  return value.startsAt === other.startsAt
    && value.endsAt === other.endsAt
    && value.capacity === other.capacity
    && value.salesStartsAt === other.salesStartsAt
    && value.salesEndsAt === other.salesEndsAt
    && value.inheritLocation === other.inheritLocation
    && value.inheritMap === other.inheritMap
    && value.locationId === other.locationId
    && value.mapId === other.mapId;
}

/**
 * Deduplica criações concorrentes do mesmo clientId. Uma edição posterior
 * aguarda o POST em voo e usa o mesmo ID para o próximo PATCH.
 */
export function criarPersistenciaSessao(persistir: PersistirSessao) {
  type Pendente = {
    inicial: SessaoValue;
    maisRecente: SessaoValue;
    promise: Promise<RespostaSessaoPersistida>;
  };
  const pendentes = new Map<string, Pendente>();
  const idsConhecidos = new Map<string, string>();

  const enviar = (item: SessaoValue, eventId: string): Promise<RespostaSessaoPersistida> => {
    if (item.id) return persistir(item, eventId);
    const identidade = `${eventId}:${identidadeSessaoAutosave(item)}`;
    const pendente = pendentes.get(identidade);
    if (pendente) {
      pendente.maisRecente = item;
      return pendente.promise;
    }
    const idConhecido = idsConhecidos.get(identidade);
    if (idConhecido) return persistir({ ...item, id: idConhecido }, eventId);

    const estado = { inicial: item, maisRecente: item } as Pendente;
    const requisicao = (async () => {
      const criada = await persistir(estado.inicial, eventId);
      if (!criada.id) return criada;
      idsConhecidos.set(identidade, criada.id);

      let resposta = criada;
      let dadosEnviados = estado.inicial;
      while (!mesmosDadosSessao(dadosEnviados, estado.maisRecente)) {
        const maisRecente = estado.maisRecente;
        resposta = await persistir({ ...maisRecente, id: criada.id }, eventId);
        dadosEnviados = maisRecente;
      }
      return resposta;
    })();
    estado.promise = requisicao;
    pendentes.set(identidade, estado);
    void requisicao.then(
      (resposta) => {
        if (resposta.id) idsConhecidos.set(identidade, resposta.id);
        if (pendentes.get(identidade) === estado) pendentes.delete(identidade);
      },
      () => { if (pendentes.get(identidade) === estado) pendentes.delete(identidade); },
    );
    return requisicao;
  };

  return { enviar };
}

type ExcluirSessao = (eventId: string, sessionId: string) => Promise<void>;

/** Evita duas limpezas concorrentes da mesma criação stale e permite retry em falha. */
export function criarCompensacaoSessao(excluir: ExcluirSessao) {
  const pendentes = new Map<string, Promise<void>>();
  const concluídas = new Set<string>();

  const executar = (eventId: string, sessionId: string): Promise<void> => {
    const chave = `${eventId}:${sessionId}`;
    if (concluídas.has(chave)) return Promise.resolve();
    const pendente = pendentes.get(chave);
    if (pendente) return pendente;

    const requisicao = excluir(eventId, sessionId);
    pendentes.set(chave, requisicao);
    void requisicao.then(
      () => { concluídas.add(chave); pendentes.delete(chave); },
      () => { pendentes.delete(chave); },
    );
    return requisicao;
  };

  return { executar };
}
