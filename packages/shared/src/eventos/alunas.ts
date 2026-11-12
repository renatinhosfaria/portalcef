/**
 * Contagem de convidados por aluna. O nome é digitado livremente na compra, então
 * a comparação ignora maiúsculas, acentos e espaços sobrando; variações maiores
 * ("Bia", "Beatriz S.") só são somadas quando a escola as junta à mão.
 */

export interface JuncaoAluna {
  sourceKey: string;
  targetKey: string;
}

export interface GrafiaAluna {
  chave: string;
  nome: string;
  total: number;
  /** Verdadeiro quando esta grafia foi juntada a outra pela escola. */
  juntada: boolean;
}

export interface GrupoAluna<T> {
  chave: string;
  nome: string;
  total: number;
  grafias: GrafiaAluna[];
  itens: T[];
}

export interface ContagemPorAluna<T> {
  alunas: Array<GrupoAluna<T>>;
  semAluna: number;
}

export function chaveAluna(nome: string | null | undefined): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const porNome = (a: string, b: string) => a.localeCompare(b, "pt-BR");

/** Grafia mais usada; no empate vale a que apareceu primeiro. */
function maisFrequente(nomes: Map<string, number>): string | undefined {
  return [...nomes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function agruparPorAluna<T extends { studentName: string | null | undefined }>(
  itens: T[],
  juncoes: JuncaoAluna[],
): ContagemPorAluna<T> {
  const destinoDe = new Map(juncoes.map((juncao) => [juncao.sourceKey, juncao.targetKey]));
  const resolver = (chave: string): string => {
    const vistos = new Set<string>([chave]);
    let atual = chave;
    for (let proximo = destinoDe.get(atual); proximo !== undefined && !vistos.has(proximo); proximo = destinoDe.get(atual)) {
      vistos.add(proximo);
      atual = proximo;
    }
    return atual;
  };

  type Parcial = { itens: T[]; grafias: Map<string, Map<string, number>> };
  const grupos = new Map<string, Parcial>();
  let semAluna = 0;

  for (const item of itens) {
    const chave = chaveAluna(item.studentName);
    if (!chave) {
      semAluna += 1;
      continue;
    }
    const destino = resolver(chave);
    const grupo: Parcial = grupos.get(destino) ?? { itens: [], grafias: new Map() };
    grupos.set(destino, grupo);
    grupo.itens.push(item);
    const escritas = grupo.grafias.get(chave) ?? new Map<string, number>();
    grupo.grafias.set(chave, escritas);
    const escrita = (item.studentName ?? "").replace(/\s+/g, " ").trim();
    escritas.set(escrita, (escritas.get(escrita) ?? 0) + 1);
  }

  const alunas = [...grupos.entries()].map(([chave, grupo]): GrupoAluna<T> => {
    const grafias = [...grupo.grafias.entries()]
      .map(([chaveGrafia, escritas]): GrafiaAluna => ({
        chave: chaveGrafia,
        nome: maisFrequente(escritas) ?? chaveGrafia,
        total: [...escritas.values()].reduce((soma, quantidade) => soma + quantidade, 0),
        juntada: chaveGrafia !== chave,
      }))
      .sort((a, b) => b.total - a.total || porNome(a.nome, b.nome));
    const nome = grafias.find((grafia) => grafia.chave === chave)?.nome ?? grafias[0]?.nome ?? chave;
    return { chave, nome, total: grupo.itens.length, grafias, itens: grupo.itens };
  });
  alunas.sort((a, b) => b.total - a.total || porNome(a.nome, b.nome));

  return { alunas, semAluna };
}
