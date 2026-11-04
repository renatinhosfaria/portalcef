# Gerador de mapa a partir de PDF e conferência — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** a escola envia a planta do local em PDF vetorial, o sistema gera a proposta do mapa (fileiras, blocos, números, categorias e geometria), uma pessoa confere e corrige numa tela própria no estilo B e só então publica, e o mapa errado do ballet é trocado pelo gerado.

**Arquitetura:** o gerador roda na API em funções puras (`ler` → `legenda` → `montar` → `desenhar` → `gerar proposta`). A proposta é um documento JSON guardado em `evento_importacoes_mapa.proposta`. As edições da conferência são operações aplicadas por uma função pura compartilhada (`@essencia/shared/eventos/mapa-proposta`), usada pela API e pelo painel. Publicar transforma a proposta em `evento_mapa_assentos` (com `metadata`) e em `evento_mapas.layout`, reaproveitando `confirmar`, `substituirMapaPadrao` e `migrarSessoesEExcluir`. O desenho no estilo B fica em `@essencia/components`, para o projeto 2 reaproveitar.

**Tecnologias:** NestJS + Fastify, Drizzle/PostgreSQL, `pdfjs-dist` 6.4 (API e navegador), Next.js 15 (eventos-admin), React 19, `d3-zoom`, Jest (API) e Vitest (pacotes e painel), Zod.

**Spec:** [docs/superpowers/specs/2026-11-02-eventos-gerador-mapa-design.md](../specs/2026-11-02-eventos-gerador-mapa-design.md). Quem executa lê a spec e este plano.

## Restrições globais

- Trabalhe na worktree `/var/www/essencia/.worktrees/eventos-gerador-mapa`, branch `feat/eventos-gerador-mapa`. Antes da primeira tarefa, rode `pnpm install --frozen-lockfile`, porque a worktree não tem `node_modules`. Nunca faça push, merge no `main` ou deploy sem um "sim" explícito do Renato.
- Português do Brasil em nomes de domínio, comentários, mensagens, textos de tela e commits.
- TDD: escreva o teste, veja-o falhar pelo motivo certo e só então implemente.
- Antes de cada commit: `pnpm turbo lint && pnpm turbo typecheck`.
- **Unidade do mapa:** 1 unidade = 0,1 ponto do PDF. Todas as coordenadas da proposta, do layout e de `evento_mapa_assentos` são inteiros nessa unidade. A prancheta é a página: 842×595 pt viram 8420×5950.
- Em `evento_mapa_assentos`, `x`/`y` são o canto superior esquerdo da caixa sem rotação (a convenção que o renderer atual de `apps/eventos` já usa). A rotação, em graus em torno do centro, vai em `metadata.rotacao`.
- **Categorias (lista fixa):** `COMUM`, `CADEIRANTE`, `OPCIONAL_CADEIRANTE`, `OBESO`. O campo `accessible` vale `true` para as três últimas. "Acesso externo" é a marca `acessoExterno`, não uma categoria. Rótulos: "Comum", "Cadeirante", "Opcional para cadeirante", "Especial para obeso".
- **Só PDF.** Imagem, SVG e IA ficam fora do escopo. O detector antigo (`map-detector.ts`) sai.
- **Nenhuma regra específica da planta do ballet** no código do gerador. Os limiares são relativos ao passo típico. Se o teste de aceite falhar, ajuste os limiares genéricos e nunca crie uma exceção para o ballet.
- Não altere `apps/eventos` nem `PublicSeat`/`PublicMap`.
- Apps não acessam o banco. O painel chama `/eventos-admin/api/eventos/admin/...`, e o proxy repassa binários.
- Erros da API: `throw new BadRequestException({ code, message, details })`. O filtro devolve `{ success: false, error: { code, message, details } }`.
- **Estilo B:**
  - fundo `#fffdf8`; texto `#24302c`; texto secundário `#69736e`; linhas `#e5e8df`; botões `#a3d154`;
  - selecionado: preenchimento `#7fae2e`, contorno `#4d6a17`;
  - comum: preenchimento `#ffffff`, contorno `#9fb08a`;
  - cadeirante: preenchimento `#3b82f6`, contorno `#1d4ed8`, número branco;
  - opcional para cadeirante: preenchimento `#ffffff`, contorno `#3b82f6`;
  - acesso externo: preenchimento `#ecfeff`, contorno `#06b6d4`;
  - obeso: preenchimento `#faf5ff`, contorno `#a855f7`;
  - não vender: preenchimento `#e4e6e1`, contorno `#c9cdc6`;
  - sem categoria: preenchimento `#fff7ed`, contorno `#d97706`;
  - destaque de ponto: contorno tracejado `#d97706`;
  - palco: preenchimento `#f1ead9`, contorno `#e2d6bb`;
  - fontes: Outfit nos títulos e DM Sans no texto.
- A migration é escrita à mão (`0052`), com uma entrada no `_journal.json` e sem snapshot, igual à `0051`. O deploy passa a ser `./scripts/deploy.sh --migrar`.

## Foco da revisão

Cinco situações que a spec implica, que nenhum teste "óbvio" cobre e que são as mais prováveis de morder quem usa. Cada uma tem um teste na tarefa dona do código.

1. **Duas abas editando a mesma conferência:** a segunda gravação recebe `PROPOSTA_DESATUALIZADA`, nada é sobrescrito em silêncio, e o painel recarrega a versão mais nova com um aviso. Testes nas Tarefas 8 e 11.
2. **Queda de rede no meio de uma edição:** a mudança otimista não fica na tela como se tivesse sido salva. O painel recarrega a conferência e avisa. Teste na Tarefa 11.
3. **Clique duplo em Publicar:** confirma uma vez só. A segunda chamada à API recebe `MAP_NOT_IN_REVIEW`, e o painel não dispara duas publicações. Testes nas Tarefas 8 e 13.
4. **Envio de outra planta com uma conferência aberta:** a proposta anterior é arquivada, e a página retoma a mais nova. Testes nas Tarefas 7 e 13.
5. **PDF com página girada (`/Rotate 90`) ou origem deslocada:** o mapa sai na orientação em que a planta aparece na tela. Teste na Tarefa 2.

---

### Tarefa 1: Modelo da proposta (pacote compartilhado)

**Arquivos:**
- Criar: `packages/shared/src/eventos/mapa-proposta.ts`
- Criar: `packages/shared/src/eventos/mapa-proposta.test.ts`
- Modificar: `packages/shared/package.json`, adicionando o export `"./eventos/mapa-proposta"` no mesmo formato de `"./formatar-data"` (`types`/`import`/`require`/`default` apontando para `dist/eventos/mapa-proposta.*` e `src/eventos/mapa-proposta.ts`)

**Interfaces:**
- Produz (todas exportadas de `mapa-proposta.ts`):
  ```ts
  export const CATEGORIAS_LUGAR = ["COMUM", "CADEIRANTE", "OPCIONAL_CADEIRANTE", "OBESO"] as const;
  export type CategoriaLugar = (typeof CATEGORIAS_LUGAR)[number];
  export const ROTULO_CATEGORIA: Record<CategoriaLugar, string>;
  export const CATEGORIA_ACESSIVEL: Record<CategoriaLugar, boolean>;
  export type TipoPonto = "FORA_DA_LINHA" | "LETRA_HERDADA" | "SEM_FILEIRA" | "SALTO_NUMERACAO" | "NUMERO_REPETIDO";
  export interface LugarProposto { id: string; fileira: string; numero: string; x: number; y: number; largura: number; altura: number; rotacao: number; blocoId: string | null; cor: string; categoriaManual: CategoriaLugar | null; acessoExternoManual: boolean | null; vender: boolean; origem: "GERADOR" | "MANUAL"; }
  export interface EntradaLegenda { cor: string; texto: string | null; quantidade: number; categoria: CategoriaLugar | null; acessoExterno: boolean; confirmada: boolean; }
  export interface PontoConferir { id: string; tipo: TipoPonto; mensagem: string; lugarIds: string[]; conferido: boolean; }
  export interface RotuloFileira { fileira: string; x: number; y: number; }
  export interface ElementoPlanta { tipo: "PALCO" | "ENTRADA" | "SAIDA"; texto: string; x: number; y: number; }
  export interface PropostaMapa { versao: 1; revisao: number; pagina: { numero: number; largura: number; altura: number }; lugares: LugarProposto[]; rotulos: RotuloFileira[]; elementos: ElementoPlanta[]; legenda: EntradaLegenda[]; pontos: PontoConferir[]; }
  export interface LayoutMapa { versao: 1; largura: number; altura: number; rotulos: RotuloFileira[]; elementos: ElementoPlanta[]; }
  export interface MetadadosAssento { rotacao: number; blocoId: string | null; acessoExterno: boolean; origem: "GERADOR" | "MANUAL"; }
  export type OperacaoProposta =
    | { tipo: "EDITAR_LUGAR"; lugarId: string; fileira?: string; numero?: string; categoria?: CategoriaLugar | null; acessoExterno?: boolean | null; vender?: boolean }
    | { tipo: "EXCLUIR_LUGAR"; lugarId: string }
    | { tipo: "ADICIONAR_LUGAR"; lugar: { id: string; fileira: string; numero: string; x: number; y: number } }
    | { tipo: "CONFERIR_PONTO"; pontoId: string }
    | { tipo: "CONFIRMAR_LEGENDA"; cor: string; categoria: CategoriaLugar; acessoExterno: boolean };
  export const operacoesPropostaSchema: z.ZodType<OperacaoProposta[]>; // 1 a 500 operações
  export class ErroProposta extends Error { constructor(public readonly code: "PROPOSTA_OPERACAO_INVALIDA", message: string) }
  export type TipoPendencia = "MAPA_VAZIO" | "PONTO_NAO_CONFERIDO" | "COR_NAO_CONFIRMADA" | "LUGAR_REPETIDO" | "LUGAR_SEM_FILEIRA";
  export interface Pendencia { tipo: TipoPendencia; mensagem: string; lugarIds: string[]; }
  export function categoriaEfetiva(proposta: PropostaMapa, lugar: LugarProposto): CategoriaLugar | null;
  export function acessoExternoEfetivo(proposta: PropostaMapa, lugar: LugarProposto): boolean;
  export function dimensoesLugar(lugar: LugarProposto, categoria: CategoriaLugar | null): { largura: number; altura: number }; // OBESO: largura × 1,6 arredondada
  export function aplicarOperacoes(proposta: PropostaMapa, operacoes: OperacaoProposta[]): PropostaMapa; // pura, revisao + 1 por chamada
  export function pendenciasPublicacao(proposta: PropostaMapa): Pendencia[];
  export function resumoProposta(proposta: PropostaMapa): { fileiras: number; blocos: number; lugares: number; porCategoria: Record<CategoriaLugar | "SEM_CATEGORIA", number>; acessoExterno: number; naoVender: number };
  ```
- Regras que os testes fixam:
  - A categoria efetiva é `categoriaManual ?? legenda[cor].categoria`. O acesso externo efetivo é `acessoExternoManual ?? legenda[cor].acessoExterno`.
  - `EXCLUIR_LUGAR` tira o id de `pontos[].lugarIds` e remove o ponto que ficar vazio.
  - `ADICIONAR_LUGAR` cria um lugar `MANUAL` com a largura e a altura medianas, `rotacao` 0, `blocoId` nulo, a cor mais frequente e `vender: true`.
  - Uma operação com id inexistente, ou um `ADICIONAR_LUGAR` com id já usado, lança `ErroProposta`.
  - Os blocos contados são os `blocoId` distintos e não nulos. As fileiras contadas são as `fileira` distintas e não vazias.

- [ ] **Passo 1: Escrever os testes que falham**

Monte uma proposta de teste com três lugares: `l1` A-1 e `l2` A-2, ambos com cor `#000000`, e `l3` A-3 com cor `#006edd`. A legenda tem `#000000` como `COMUM` e `#006edd` como `CADEIRANTE`, ambas não confirmadas. Há também um ponto `p1` sobre `l3`, ainda não conferido.

```ts
it("edita um lugar sem mutar a proposta original e incrementa a revisão", () => {
  const nova = aplicarOperacoes(base, [{ tipo: "EDITAR_LUGAR", lugarId: "l2", numero: "20", vender: false }]);
  expect(nova.revisao).toBe(base.revisao + 1);
  expect(nova.lugares[1]).toMatchObject({ numero: "20", vender: false });
  expect(base.lugares[1].numero).toBe("2");
});
it("categoria manual vence a legenda e null volta a seguir a legenda", () => { /* EDITAR_LUGAR categoria OBESO → categoriaEfetiva = OBESO; depois categoria null → CADEIRANTE para l3 */ });
it("confirmar a legenda muda a categoria efetiva de todos os lugares daquela cor", () => { /* CONFIRMAR_LEGENDA #000000 → OPCIONAL_CADEIRANTE, acessoExterno true → l1 e l2 com OPCIONAL_CADEIRANTE e acesso externo; legenda[0].confirmada true */ });
it("excluir remove o lugar e o ponto que ficou vazio", () => { expect(aplicarOperacoes(base, [{ tipo: "EXCLUIR_LUGAR", lugarId: "l3" }]).pontos).toEqual([]); });
it("adicionar cria lugar MANUAL com tamanho mediano e cor dominante", () => { /* origem MANUAL, cor #000000, largura/altura medianas, vender true */ });
it("rejeita lugar inexistente e id repetido", () => {
  expect(() => aplicarOperacoes(base, [{ tipo: "EXCLUIR_LUGAR", lugarId: "x" }])).toThrow(ErroProposta);
  expect(() => aplicarOperacoes(base, [{ tipo: "ADICIONAR_LUGAR", lugar: { id: "l1", fileira: "A", numero: "9", x: 0, y: 0 } }])).toThrow(ErroProposta);
});
it("lista as pendências que bloqueiam a publicação", () => {
  const comProblemas = aplicarOperacoes(base, [{ tipo: "EDITAR_LUGAR", lugarId: "l2", numero: "1" }, { tipo: "EDITAR_LUGAR", lugarId: "l3", fileira: "" }]);
  expect(pendenciasPublicacao(comProblemas).map((p) => p.tipo).sort()).toEqual(["COR_NAO_CONFIRMADA", "COR_NAO_CONFIRMADA", "LUGAR_REPETIDO", "LUGAR_SEM_FILEIRA", "PONTO_NAO_CONFERIDO"]);
  expect(pendenciasPublicacao({ ...base, lugares: [] }).map((p) => p.tipo)).toContain("MAPA_VAZIO");
});
it("não há pendências depois de conferir pontos e confirmar todas as cores", () => { /* CONFERIR_PONTO p1 + 2× CONFIRMAR_LEGENDA → [] */ });
it("resume fileiras, blocos, lugares e categorias", () => { /* { fileiras: 1, lugares: 3, porCategoria: { COMUM: 2, CADEIRANTE: 1, ... } } */ });
it("alarga o lugar de obeso em 1,6 vez", () => { expect(dimensoesLugar({ ...lugar, largura: 106, altura: 95 }, "OBESO")).toEqual({ largura: 170, altura: 95 }); });
it("valida as operações com zod e recusa categoria fora da lista", () => {
  expect(operacoesPropostaSchema.safeParse([{ tipo: "CONFIRMAR_LEGENDA", cor: "#000000", categoria: "VIP", acessoExterno: false }]).success).toBe(false);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Comando: `pnpm --filter @essencia/shared test -- src/eventos/mapa-proposta.test.ts`
Esperado: FAIL, com erro de módulo inexistente.

- [ ] **Passo 3: Implementar `mapa-proposta.ts`** com as assinaturas acima. `aplicarOperacoes` faz `structuredClone` e aplica as operações em ordem. As mensagens das pendências citam fileira e número, como em "A-1 aparece duas vezes" e "Confirme o significado da cor #006edd".

- [ ] **Passo 4: Rodar e ver passar.** Depois, conferir o build: `pnpm --filter @essencia/shared build && ls packages/shared/dist/eventos/mapa-proposta.js`

- [ ] **Passo 5: Commit**

```bash
git add packages/shared/src/eventos packages/shared/package.json
git commit -m "feat: adiciona modelo compartilhado da proposta de mapa"
```

---

### Tarefa 2: Leitura do PDF (texto, posição e cor)

**Arquivos:**
- Criar: `services/api/src/modules/eventos/mapas/gerador/pdfjs.ts`
- Criar: `services/api/src/modules/eventos/mapas/gerador/ler-planta-pdf.ts`
- Criar: `services/api/src/modules/eventos/mapas/gerador/ler-planta-pdf.spec.ts`
- Criar: `services/api/src/modules/eventos/mapas/gerador/__fixtures__/pdf-sintetico.ts`
- Modificar: `services/api/package.json`, com os scripts `test`, `test:watch` e `test:cov` prefixados por `NODE_OPTIONS=--experimental-vm-modules`

**Interfaces:**
- Produz:
  ```ts
  // pdfjs.ts — o Jest (CommonJS) troca import() por require(), que não carrega o pdf.js (ESM).
  // O import nativo, com o caminho resolvido, funciona no build da API e no Jest com --experimental-vm-modules.
  export function carregarPdfjs(): Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")>;
  export const URL_FONTES_PADRAO: string; // join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts/")
  // ler-planta-pdf.ts — coordenadas em pontos, na página como ela aparece (y para baixo)
  export interface TokenLido { texto: string; x: number; y: number; angulo: number; tamanho: number; cor: string }
  export interface FraseLida { texto: string; x: number; y: number; esquerda: number; tamanho: number; cor: string }
  export interface PlantaLida { pagina: { numero: number; largura: number; altura: number }; tokens: TokenLido[]; frases: FraseLida[] }
  export async function lerPlantaPdf(buffer: Buffer, pagina?: number): Promise<PlantaLida>;
  // __fixtures__/pdf-sintetico.ts — PDF 1.4 válido, Helvetica, xref correto
  export interface TextoSintetico { texto: string; x: number; y: number; cor?: string; tamanho?: number; angulo?: number } // x/y = origem da linha de base, y para baixo
  export interface PaginaSintetica { largura: number; altura: number; rotacao?: 0 | 90 | 180 | 270; textos: TextoSintetico[] }
  export function criarPdfSintetico(paginas: PaginaSintetica[]): Buffer;
  ```
- Como ler (decidido pela sonda feita na planta do ballet: 847 tokens casaram em ordem, sem falhas):
  - **Posição:** `getTextContent()` com `m = Util.transform(viewport.transform, item.transform)` e `viewport = getViewport({ scale: 1 })`. Isso já aplica `/Rotate` e o deslocamento da MediaBox.
    - `dir = normalize(m[0], m[1])` e `tamanho = hypot(m[2], m[3])`.
    - O centro do token é `origem + dir × (deslocamentoDoCaractere + larguraDoToken/2) + (dir.y, −dir.x) × 0,35·tamanho`, com a largura por caractere igual a `item.width / item.str.length`.
    - `angulo = atan2(dir.y, dir.x)` em graus.
  - **Cor:** percorra `getOperatorList()` guardando a cor de preenchimento corrente (`save`/`restore` empilham; `setFillRGBColor` traz `"#rrggbb"`). Cada `showText` gera tokens (glifos `unicode` separados por espaço) com a cor corrente. Case esses tokens em ordem com os de `getTextContent`. Se um token divergir, avance até o próximo igual. Token sem par recebe `#000000`.
  - **Frases:** itens com uma palavra de 3 ou mais letras. Elas guardam o texto inteiro, o centro, `esquerda` (o x da origem) e a cor do primeiro token.
- **Erros:**
  - `PDF_INVALIDO` — "Não foi possível ler este arquivo. Envie a planta em PDF."
  - `PDF_PAGINA_OBRIGATORIA`, com `details: { paginas }` — "Este PDF tem N páginas. Escolha a página que contém a planta."
  - `PDF_PAGINA_INEXISTENTE` — "A página N não existe neste PDF."
  - `PLANTA_SEM_NUMEROS`, quando nenhum token casa com `/^\d{1,4}$/` — "Não encontramos os números dos assentos nesta planta. Se ela foi escaneada ou salva como imagem, envie o PDF exportado do programa em que a planta foi desenhada."

- [ ] **Passo 1: Escrever os testes que falham** (`ler-planta-pdf.spec.ts`, todos com PDFs gerados por `criarPdfSintetico`)

```ts
it("lê números e letras no centro do texto, com a cor de cada um", async () => { /* "12" preto, "13" #0000ff, "A" #ff0000 → cores exatas; centro de "12" a ±1 pt do esperado */ });
it("separa um item com vários números ('27 26') em dois tokens", async () => { /* um Tj "27 26" → dois tokens, x(27) < x(26), mesma cor */ });
it("lê texto girado com o ângulo da fileira", async () => { /* angulo 30 no PDF → Math.round(token.angulo) === -30 */ });
it("guarda frases da legenda e do palco com o texto inteiro", async () => { /* "EXCLUSIVO CADEIRANTES" vira uma frase; "PALCO" também */ });
it("exige a escolha da página quando o PDF tem várias", async () => { await expect(lerPlantaPdf(doisPaginas)).rejects.toMatchObject({ response: { code: "PDF_PAGINA_OBRIGATORIA", details: { paginas: 2 } } }); });
it("lê a página escolhida e recusa página inexistente", async () => { /* pagina 2 → pagina.numero 2; pagina 3 → PDF_PAGINA_INEXISTENTE */ });
it("recusa planta sem números (PDF escaneado)", async () => { /* página sem texto → PLANTA_SEM_NUMEROS */ });
it("recusa arquivo que não é PDF", async () => { /* Buffer "olá" → PDF_INVALIDO */ });
it("respeita /Rotate 90: números na mesma linha do PDF ficam alinhados na vertical", async () => {
  // página 400×300 com /Rotate 90 e "1","2" em y=50 (x 100 e 120) → pagina { largura: 300, altura: 400 }, |x1 - x2| < 1 e |y1 - y2| ≈ 20
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas/gerador/ler-planta-pdf.spec.ts`
Esperado: FAIL, com módulo inexistente.

- [ ] **Passo 3: Implementar** `pdfjs.ts`, `pdf-sintetico.ts` e `ler-planta-pdf.ts`. Passe `standardFontDataUrl: URL_FONTES_PADRAO`, `isEvalSupported: false` e `useSystemFonts: false` em `getDocument`, e chame `doc.destroy()` num `finally`.

- [ ] **Passo 4: Rodar e ver passar.** Rode também a suíte inteira da API (`pnpm --filter @essencia/api test`) para provar que a flag `--experimental-vm-modules` não quebrou nada. Esperado: todas as suítes passam.

- [ ] **Passo 5: Commit**

```bash
git add services/api/package.json services/api/src/modules/eventos/mapas/gerador
git commit -m "feat: le texto, posicao e cor da planta em PDF"
```

---

### Tarefa 3: Legenda e elementos da planta

**Arquivos:**
- Criar: `services/api/src/modules/eventos/mapas/gerador/ler-legenda.ts`
- Criar: `services/api/src/modules/eventos/mapas/gerador/ler-legenda.spec.ts`

**Interfaces:**
- Consome: `PlantaLida`, `TokenLido`, `FraseLida` (Tarefa 2); `CategoriaLugar` (Tarefa 1).
- Produz:
  ```ts
  export interface Caixa { x0: number; y0: number; x1: number; y1: number }
  export interface EntradaLegendaLida { cor: string; texto: string; categoria: CategoriaLugar | null; acessoExterno: boolean }
  export interface ElementoLido { tipo: "PALCO" | "ENTRADA" | "SAIDA"; texto: string; x: number; y: number }
  export function interpretarTextoLegenda(texto: string): { categoria: CategoriaLugar | null; acessoExterno: boolean };
  export function lerLegenda(planta: PlantaLida, coresDosNumeros: ReadonlySet<string>): { entradas: EntradaLegendaLida[]; area: Caixa | null };
  export function lerElementos(planta: PlantaLida, areaLegenda: Caixa | null): ElementoLido[];
  export function dentroDaCaixa(ponto: { x: number; y: number }, caixa: Caixa | null): boolean;
  ```
- **Regras:**
  - **Amostra:** um token não numérico de 1 caractere, com cor de `coresDosNumeros` e diferente da cor dominante dos números.
  - **Frase de uma amostra:** cada frase pertence à amostra mais próxima à sua esquerda, com `0 < esquerda − amostra.x ≤ 6·amostra.tamanho` e `|Δy| ≤ 1,2·amostra.tamanho`. Várias frases da mesma amostra são unidas em ordem de y. É assim que "OPCIONAL PARA CADEIRANTES" e "entrada atraves de acesso externo" viram uma entrada só.
  - **Área da legenda:** a caixa das amostras e das frases, com margem de 1·tamanho.
  - **Interpretação do texto** (normalizado sem acento e em minúsculas):
    - `opcional` + `cadeirant` → `OPCIONAL_CADEIRANTE`;
    - `cadeirant` → `CADEIRANTE`;
    - `obes` → `OBESO`;
    - qualquer outro texto → `null`;
    - `acesso externo` → `acessoExterno: true`.
  - **Elementos:** frases fora da legenda. "PALCO" vira `PALCO`, "ENTRADA" vira `ENTRADA` e "SAÍDA"/"SAIDA" vira `SAIDA`.

- [ ] **Passo 1: Escrever os testes que falham.** Use objetos `PlantaLida` montados à mão, sem PDF.

```ts
it.each([
  ["EXCLUSIVO CADEIRANTES", "CADEIRANTE", false],
  ["OPCIONAL PARA CADEIRANTES", "OPCIONAL_CADEIRANTE", false],
  ["OPCIONAL PARA CADEIRANTES entrada atraves de acesso externo", "OPCIONAL_CADEIRANTE", true],
  ["ESPECIAIS OBESOS", "OBESO", false],
  ["CAMAROTE VIP", null, false],
])("interpreta '%s'", (texto, categoria, acessoExterno) => expect(interpretarTextoLegenda(texto)).toEqual({ categoria, acessoExterno }));
it("associa amostra colorida à frase da direita, inclusive a linha de continuação", () => { /* entradas com cor/texto/categoria; area cobre amostras e frases */ });
it("ignora amostra cuja cor não aparece em nenhum número e letras de fileira sem frase ao lado", () => { /* "A" vermelho com números à direita não vira entrada */ });
it("sem legenda devolve entradas vazias e área nula", () => {});
it("lê PALCO, ENTRADA e SAÍDA fora da legenda e ignora 'entrada' dentro dela", () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas/gerador/ler-legenda.spec.ts`. Esperado: FAIL.
- [ ] **Passo 3: Implementar `ler-legenda.ts`** com as regras acima.
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Commit.** `git commit -m "feat: interpreta legenda e elementos da planta"`

---

### Tarefa 4: Montar fileiras e blocos

**Arquivos:**
- Criar: `services/api/src/modules/eventos/mapas/gerador/montar-mapa.ts`
- Criar: `services/api/src/modules/eventos/mapas/gerador/montar-mapa.spec.ts`

**Interfaces:**
- Consome: `TipoPonto` (Tarefa 1).
- Produz:
  ```ts
  export interface NumeroLido { id: string; numero: number; x: number; y: number; angulo: number; cor: string }
  export interface LetraLida { letra: string; x: number; y: number }
  export interface BlocoMontado { id: string; fileira: string | null; numeros: NumeroLido[]; foraDaLinha: string[] } // números em ordem de numeração
  export interface PontoMontado { tipo: TipoPonto; fileira: string | null; numeroIds: string[]; mensagem: string }
  export const LIMITES: { aoLongo: 2.3; perpendicular: 0.45; perpendicularJuncao: 1.0; letra: 3.2; heranca: 4.6 }; // múltiplos do passo
  export function passoTipico(numeros: NumeroLido[]): number; // mediana da distância de cada número ao vizinho mais próximo
  export function montarMapa(numeros: NumeroLido[], letras: LetraLida[]): { passo: number; blocos: BlocoMontado[]; pontos: PontoMontado[] };
  ```
- **Algoritmo.** Os limiares vêm da sonda no ballet: passo de 13,2 pt; números deslocados a ~1,0 passo ao longo e ~0,75 na perpendicular; corredores a ~3,4 passos ao longo; a fileira vizinha a ≥ 2,5 passos na perpendicular. Ao longo e perpendicular são medidos na direção do texto do número de origem (`angulo`), em valor absoluto.
  1. **Encadear com passo 1:** a candidata é `n → n+1` com ao longo ≤ 2,3P e perpendicular ≤ 0,45P. O custo é `aoLongo + 5·perpendicular`. Aceite em ordem de custo, com no máximo um próximo e um anterior por número.
  2. **Encadear com passo 2:** só entre números que ficaram sem próximo e sem anterior na etapa 1 (ímpares de um lado, pares do outro), com os mesmos limites. Cada cadeia vira um bloco.
  3. **Letra:** a letra mais próxima de uma das pontas, até 3,2P.
  4. **Junção por continuidade:** se a ponta de um bloco continua a numeração da ponta de outro (mesmo passo), com ao longo ≤ 2,3P, perpendicular ≤ 1,0P e letras iguais (ou uma delas nula), una os dois. Os números do bloco menor entram em `foraDaLinha`. Junte um ponto `FORA_DA_LINHA` por fileira, com todos esses números: "Fileira R: os números 13, 14, 26 e 27 estão fora da linha da fileira e foram ligados a ela pela numeração. Confira na planta."
  5. **Herança:** um bloco sem letra cuja ponta continua a de um bloco com letra a até 4,6P herda essa letra e gera `LETRA_HERDADA` ("Os lugares 1 a 5 não têm letra de fileira por perto e receberam a letra X porque continuam a numeração. Confira."). Sem continuidade, o ponto é `SEM_FILEIRA` com `fileira: null` ("Os lugares numerados de 3 a 9 não ficam ao lado de nenhuma letra de fileira. Informe a fileira.").
  6. **Validação por fileira:** ordene os blocos de passo 1 pelo primeiro número. Os de passo 2 são ordenados separadamente por paridade. O bloco seguinte deve começar em `último + passo`. Se começar depois, gera `SALTO_NUMERACAO` ("Fileira C: a numeração pula de 12 para 15."). Se começar antes ou repetir, gera `NUMERO_REPETIDO` ("Fileira C: o número 12 aparece em dois trechos.").

- [ ] **Passo 1: Escrever os testes que falham.** Use um ajudante local, `fileira(letra, y, numeros, x0, { passo: 13, sentido: ±1, angulo: 0, corredor: 45 })`, que gera números e letras nos dois corredores. Também use `girar(pontos, graus, centro)` para os blocos inclinados.

```ts
it("monta três blocos separados por corredores e dá a letra de cada ponta", () => { /* 1–12 · 13–27 · 28–39, letras nos corredores → 3 blocos "R", sem pontos */ });
it("não atravessa o corredor mesmo com a numeração contínua", () => { /* 12 → 13 a 45 pt → blocos distintos */ });
it("segue blocos inclinados", () => { /* bloco girado 25° → um bloco com 12 números em ordem */ });
it("aceita numeração de dois em dois sem pontos", () => { /* ímpares 1..23 à direita, pares 2..24 à esquerda → 2 blocos, pontos [] */ });
it("liga números fora da linha pela continuidade e gera um ponto por fileira", () => {
  // 15..25 na linha; 13,14 e 26,27 deslocados 10 pt na perpendicular → 1 bloco de 15, foraDaLinha com 4 ids, 1 ponto FORA_DA_LINHA
});
it("trecho sem letra herda pela numeração (LETRA_HERDADA)", () => {});
it("trecho sem letra e sem continuidade fica com fileira null (SEM_FILEIRA)", () => {});
it("aponta salto de numeração e número repetido", () => {});
it("não mistura fileiras vizinhas a 1,7 passo", () => {});
it("monta 2000 números em menos de 2 s", () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas/gerador/montar-mapa.spec.ts`. Esperado: FAIL.
- [ ] **Passo 3: Implementar `montar-mapa.ts`.** Os ids de bloco são `bloco-<índice>`, na ordem de saída: fileira e depois primeiro número.
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Commit.** `git commit -m "feat: monta fileiras e blocos pela numeracao da planta"`

---

### Tarefa 5: Desenhar os blocos em curvas suaves

**Arquivos:**
- Criar: `services/api/src/modules/eventos/mapas/gerador/desenhar-mapa.ts`
- Criar: `services/api/src/modules/eventos/mapas/gerador/desenhar-mapa.spec.ts`

**Interfaces:**
- Consome: `BlocoMontado` (Tarefa 4).
- Produz: `export interface LugarDesenhado { numeroId: string; x: number; y: number; rotacao: number }` e `export function desenharBlocos(blocos: BlocoMontado[]): LugarDesenhado[]`. As coordenadas estão em pontos; a rotação está em graus, em (−90°, 90°].
- **Algoritmo por bloco** (é o do teste descartável, com uma mudança: a curva é ajustada só com os números que estão na linha):
  - **1 número:** mantém a posição, e a rotação é o `angulo` do texto.
  - **2 números na linha:** reta.
  - **3 ou mais:**
    - eixo principal `θ = ½·atan2(2·Sxy, Sxx − Syy)` dos números na linha;
    - coordenadas `(u, v)` nesse eixo;
    - mínimos quadrados para `v = a·u² + b·u + c`, usando os números na linha.
  - **Espaçamento:** `u` vai da projeção do primeiro ao último número do bloco (inclusive os de fora da linha), com passo igual. O `v` vem da curva. A rotação é `θ + atan(dv/du)`, normalizada.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it("redistribui com espaçamento igual sobre a curva", () => {
  // 15 números sobre v = 0,002·(x−200)² com ruído de ±1,5 pt → distâncias consecutivas a até 3% uma da outra; cada ponto a até 0,5 pt da curva verdadeira
});
it("gira cada cadeira pela tangente da curva", () => { /* rotação a ±1° de atan(derivada) */ });
it("projeta os números fora da linha na curva do bloco", () => { /* 13 e 14 deslocados 10 pt → a até 0,5 pt da curva e no passo regular */ });
it("bloco de dois vira reta e bloco de um mantém a posição e o ângulo do texto", () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas/gerador/desenhar-mapa.spec.ts`
- [ ] **Passo 3: Implementar `desenhar-mapa.ts`.**
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Commit.** `git commit -m "feat: desenha blocos em curvas suaves com espacamento uniforme"`

---

### Tarefa 6: Gerar a proposta e teste de aceite com a planta do ballet

**Arquivos:**
- Criar: `services/api/src/modules/eventos/mapas/gerador/gerar-proposta.ts`
- Criar: `services/api/src/modules/eventos/mapas/gerador/gerar-proposta.spec.ts`
- Criar: `services/api/src/modules/eventos/mapas/gerador/gerador-mapa-pdf.ts`
- Criar: `services/api/src/modules/eventos/mapas/gerador/__fixtures__/planta-ballet.pdf`, copiado de `/tmp/claude-0/-var-www-essencia/29cd7f22-a50f-4907-981e-2a1eccd378c3/scratchpad/planta/planta.pdf`, que é o PDF oficial "Mapa plateia Novo" (275 KB). Se o scratchpad não existir mais, peça o PDF ao Renato.

**Interfaces:**
- Consome: as Tarefas 1 a 5.
- Produz:
  - `export async function gerarPropostaDePdf(buffer: Buffer, pagina?: number): Promise<PropostaMapa>`;
  - `@Injectable() export class GeradorMapaPdf { gerar(buffer: Buffer, pagina?: number): Promise<PropostaMapa> }`, que só delega para a função.
- **Montagem da proposta:**
  - `coresDosNumeros` = as cores dos tokens `/^\d{1,4}$/`.
  - Tokens dentro da área da legenda são descartados.
  - As letras são tokens `/^[A-Z]{1,2}$/` fora da legenda e viram `rotulos`.
  - Para cada número desenhado:
    - `x = round(x·10)`; `largura = round(0,8·passo·10)`; `altura = round(0,72·passo·10)`;
    - `rotacao` arredondada a 0,1;
    - id `lugar-<i>`;
    - `fileira = bloco.fileira ?? ""`;
    - `categoriaManual: null`, `acessoExternoManual: null`, `vender: true`, `origem: "GERADOR"`.
  - A legenda tem uma entrada por cor de número, ordenada pela quantidade (decrescente):
    - com entrada lida: `texto`, `categoria` e `acessoExterno` vêm dela;
    - sem entrada: `texto: null`, `categoria` = `"COMUM"` se for a cor dominante (senão `null`) e `acessoExterno: false`;
    - em todos os casos, `confirmada: false`.
  - Pontos: ids `ponto-<k>`, `conferido: false`. `revisao: 0`, `versao: 1`.

- [ ] **Passo 1: Escrever o teste de aceite (critério da spec), que deve falhar**

```ts
const FIXTURE = join(__dirname, "__fixtures__/planta-ballet.pdf");
it("gera o mapa do ballet conforme a tabela da spec", async () => {
  const inicio = Date.now();
  const p = await gerarPropostaDePdf(readFileSync(FIXTURE));
  expect(Date.now() - inicio).toBeLessThan(10_000);
  expect(p.lugares).toHaveLength(786);
  expect(contarPorFileira(p)).toEqual({ X: 34, A: 35, B: 37, C: 39, D: 39, E: 41, F: 41, G: 43, H: 43, I: 39, J: 45, K: 45, L: 45, M: 45, N: 45, O: 45, P: 43, Q: 43, R: 39 });
  expect(blocosPorFileira(p)).toMatchObject({ X: [5, 5, 14, 5, 5], A: [11, 13, 11], B: [11, 15, 11], C: [12, 15, 12], E: [13, 15, 13], G: [14, 15, 14], I: [12, 15, 12], J: [15, 15, 15], P: [14, 15, 14], R: [12, 15, 12] }); // tamanhos ordenados pelo primeiro número
  const comLegendaSugerida = confirmarLegendaSugerida(p); // CONFIRMAR_LEGENDA com a sugestão de cada cor
  expect(resumoProposta(comLegendaSugerida).porCategoria).toMatchObject({ COMUM: 750, CADEIRANTE: 4, OPCIONAL_CADEIRANTE: 24, OBESO: 8 });
  expect(resumoProposta(comLegendaSugerida).acessoExterno).toBe(12);
  expect(p.pontos).toHaveLength(1);
  expect(p.pontos[0]).toMatchObject({ tipo: "FORA_DA_LINHA" });
  expect(numerosDoPonto(p, p.pontos[0])).toEqual(["R-13", "R-14", "R-26", "R-27"]);
  expect(blocoDe(p, "I", "39").map((l) => l.numero)).toEqual(range(28, 39)); // bloco esquerdo inclinado da I
  expect(categoriaEfetiva(comLegendaSugerida, lugar(p, "I", "39"))).toBe("OBESO");
  expect(p.rotulos).toHaveLength(38);
  expect(p.elementos.map((e) => e.tipo).sort()).toEqual(["ENTRADA", "PALCO", "SAIDA", "SAIDA"]);
  expect(p.pagina).toEqual({ numero: 1, largura: 8420, altura: 5950 });
});
it("sugere a legenda do ballet", async () => { /* #000000 COMUM sem texto; #006edd CADEIRANTE; #0000ff OPCIONAL_CADEIRANTE; #00ffff OPCIONAL_CADEIRANTE + acesso externo; #ff00ff OBESO */ });
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas/gerador/gerar-proposta.spec.ts`
- [ ] **Passo 3: Implementar** `gerar-proposta.ts` e `gerador-mapa-pdf.ts`.
- [ ] **Passo 4: Rodar e ver passar.** Se algum número divergir da tabela, ajuste só os `LIMITES` genéricos da Tarefa 4 e rode de novo as Tarefas 4 e 6. Nunca crie uma regra para o ballet.
- [ ] **Passo 5: Commit.** `git commit -m "feat: gera proposta de mapa a partir do PDF com aceite do ballet"`

---

### Tarefa 7: Importação, listagem, original e revisão

**Arquivos:**
- Criar: `packages/db/drizzle/0052_evento_mapas_gerador.sql`, com `ALTER TABLE "evento_mapas" ADD COLUMN "layout" jsonb;` e `ALTER TABLE "evento_importacoes_mapa" ADD COLUMN "proposta" jsonb;`
- Modificar: `packages/db/drizzle/meta/_journal.json`, com `idx` 52, `tag` `0052_evento_mapas_gerador`, `version` "7" e `breakpoints` true
- Modificar: `packages/db/src/schema/eventos.ts`, com `layout: jsonb("layout")` em `eventoMapas` e `proposta: jsonb("proposta")` em `eventoImportacoesMapa`
- Modificar: `services/api/src/modules/eventos/mapas/mapas.service.ts`, `mapas.controller.ts`, `mapas.service.spec.ts` e `mapas.controller.spec.ts`
- Modificar: `services/api/src/modules/eventos/eventos.module.ts`, trocando `MapDetector` por `GeradorMapaPdf`
- Apagar: `mapas/map-detector.ts`, `mapas/map-detector.spec.ts` e `mapas/map-sanitizer.ts`. Tire `tesseract.js`, `sharp` e `fast-xml-parser` de `services/api/package.json` depois de confirmar com `grep -rn "<pacote>" services/api/src` que não restou uso. Atualize o lockfile com `pnpm install`.

**Interfaces:**
- Consome: `GeradorMapaPdf` (Tarefa 6).
- Produz:
  ```ts
  constructor(database: DatabaseService, storage: StorageService | undefined, gerador: GeradorMapaPdf) // 3º parâmetro no lugar do detector (os testes atuais passam {} e continuam compilando)
  async importar(eventId: string, file: MultipartFile, actor: EventoActor, pagina?: number): Promise<{ importId: string; mapId: string; status: "EM_REVISAO"; proposalCount: number; conflictCount: number }>
  async listar(eventId: string, actor: EventoActor): Promise<Array<{ id: string; version: number; status: string; originalFileName: string | null; createdAt: Date; confirmedAt: Date | null }>> // mais nova primeiro
  async obterOriginal(eventId: string, versionId: string, actor: EventoActor): Promise<{ body: unknown; contentType: string; contentLength?: number }>
  async revisao(eventId: string, versionId: string, actor: EventoActor): Promise<{ map: EventoMapa; import: EventoImportacaoMapa | null; proposta: PropostaMapa | null }>
  ```
  - Rotas novas no `MapasController`:
    - `GET mapas`;
    - `POST mapas/import?pagina=N` (`pagina` opcional, inteiro ≥ 1 validado com zod; inválido → `VALIDATION_ERROR`);
    - `GET mapas/:versionId/original`, que responde com `reply.header("Content-Type", …)` e `reply.send(body)`, como no download de `plano-aula.controller.ts`.
- **Fluxo de `importar`:**
  1. Recusa o arquivo que não é PDF (pelo mimetype ou pelo começo `%PDF-`) com `INVALID_MAP_TYPE` — "Envie a planta em PDF.". Nesse caso nada vai para o storage.
  2. Gera a proposta antes do upload: se o gerador falhar, nada vai para o storage.
  3. Faz o upload do original.
  4. Numa transação: arquiva as outras versões `EM_REVISAO` do evento que nenhuma sessão usa; cria `evento_mapas` em `EM_REVISAO`; cria `evento_importacoes_mapa` com `detector: "pdf-vetorial"`, `detectorVersion: "2"`, `proposta`, `proposalCount = lugares.length` e `conflictCount = pontos.length`; registra a auditoria `{ action: "importar" }`.
  5. Não grava `evento_deteccoes_mapa`. Em caso de erro, apaga o original do storage, como hoje.

- [ ] **Passo 1: Escrever os testes que falham.** Substitua os testes do `importar` antigo. Use o banco falso em memória do `mapas.service.spec.ts`.

```ts
it("importa o PDF: gera a proposta antes do upload e grava EM_REVISAO com a proposta", async () => { /* ordem gerador → uploadMapBuffer; import com proposta, detector "pdf-vetorial", contagens; nenhum insert em eventoDeteccoesMapa */ });
it("recusa arquivo que não é PDF sem enviar ao storage", async () => {});
it("repassa a página escolhida ao gerador", async () => { /* importar(…, 2) → gerador.gerar(buffer, 2) */ });
it("erro do gerador não envia nada ao storage", async () => { /* PDF_PAGINA_OBRIGATORIA propagado; uploadMapBuffer não chamado */ });
it("arquiva a proposta em revisão anterior ao importar outra", async () => { /* versão EM_REVISAO antiga → ARQUIVADO */ });
it("lista as versões do evento da mais nova para a mais antiga e respeita a escola", async () => {});
it("revisão devolve a proposta da importação", async () => {});
it("original devolve o arquivo do storage com o content-type e recusa outra escola", async () => {});
// mapas.controller.spec.ts
it("importar lê ?pagina como número e recusa página inválida", async () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas`
- [ ] **Passo 3: Implementar.** Escreva a migration, o schema, o service, o controller e o module, e apague o detector antigo.
- [ ] **Passo 4: Rodar e ver passar.** Rode `pnpm --filter @essencia/api test` e `pnpm --filter @essencia/db build`. Esperado: tudo passa.
- [ ] **Passo 5: Commit.** `git commit -m "feat: importa planta em PDF com o gerador e guarda a proposta"`

---

### Tarefa 8: Editar a proposta e publicar

**Arquivos:**
- Criar: `services/api/src/modules/eventos/mapas/gerador/proposta-para-confirmacao.ts` e o `.spec.ts`
- Modificar: `mapas.service.ts`, `mapas.controller.ts` e os specs. Remova as rotas `PATCH mapas/:versionId/deteccoes` e `POST mapas/:versionId/confirmar`, além do método `atualizarDeteccoes` e dos testes dele. `confirmar` continua no service, mas só a publicação o chama.

**Interfaces:**
- Consome: `aplicarOperacoes`, `pendenciasPublicacao`, `operacoesPropostaSchema`, `categoriaEfetiva`, `acessoExternoEfetivo`, `dimensoesLugar`, `CATEGORIA_ACESSIVEL`, `LayoutMapa` e `MetadadosAssento` (Tarefa 1).
- Produz:
  ```ts
  export function propostaParaConfirmacao(proposta: PropostaMapa): { seats: ConfirmMapInput["seats"]; layout: LayoutMapa };
  // ConfirmMapInput ganha: seats[].metadata?: MetadadosAssento e layout?: LayoutMapa (gravado em evento_mapas.layout na mesma transação)
  async editarProposta(eventId: string, versionId: string, input: { revisaoBase: number; operacoes: OperacaoProposta[] }, actor: EventoActor): Promise<PropostaMapa>
  async publicar(eventId: string, versionId: string, input: { revisaoBase: number; motivo?: string }, actor: EventoActor): Promise<{ map: EventoMapa; seats: unknown[]; inventorySessionIds: string[]; inventoryCreatedCount: number }>
  ```
  - `PATCH mapas/:versionId/proposta` recebe `{ revisaoBase: int ≥ 0, operacoes }`.
  - `POST mapas/:versionId/publicar` recebe `{ revisaoBase: int ≥ 0, motivo?: string (aparado, até 500) }`.
  - As duas rotas respondem `{ success: true, data }` e validam o corpo com zod no controller, como `migrar-e-excluir`.
- **Regras:**
  - **Conversão:**
    - `x = round(l.x − largura/2)` e `y = round(l.y − altura/2)`, com as dimensões de `dimensoesLugar`;
    - `category` = código da categoria efetiva, e `accessible = CATEGORIA_ACESSIVEL[categoria]`;
    - `sellable = vender`;
    - `metadata = { rotacao, blocoId, acessoExterno, origem }`.
  - **Revisão:** se `revisaoBase` for diferente de `proposta.revisao`, a API responde `PROPOSTA_DESATUALIZADA` ("Esta conferência foi alterada em outra aba. Recarregue para continuar.") e não grava nada.
  - **Proposta ausente:** `PROPOSTA_INEXISTENTE`.
  - **Operação inválida:** um `ErroProposta` vira `PROPOSTA_OPERACAO_INVALIDA`.
  - **Gravação da edição:** grava a proposta nova e registra a auditoria `{ action: "editar_proposta", revisao, operacoes }`.
  - **Publicação com pendências:** `PROPOSTA_COM_PENDENCIAS` com `details.pendencias`, sem gravar nada.
  - **Publicação válida:** chama `confirmar` com o motivo como `reason`. A auditoria `confirmar` já registra quem publicou e quando.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
// proposta-para-confirmacao.spec.ts
it("converte centro em canto, alarga obeso e grava categoria, acessibilidade, venda e metadados", () => {});
it("monta o layout com prancheta, rótulos e elementos", () => {});
// mapas.service.spec.ts
it("editarProposta aplica as operações, grava a nova revisão e audita", async () => {});
it("editarProposta recusa revisão desatualizada sem gravar (duas abas)", async () => {});
it("editarProposta recusa mapa fora de revisão e operação inválida", async () => {});
it("publicar recusa proposta com pendências e devolve a lista", async () => {});
it("publicar grava assentos com metadados, layout e CONFIRMADO com o motivo opcional", async () => {});
it("publicar duas vezes: a segunda recebe MAP_NOT_IN_REVIEW", async () => {});
// mapas.controller.spec.ts
it("valida o corpo de proposta e publicar com zod", async () => {});
it("não expõe mais deteccoes nem confirmar", () => { /* Reflect.getMetadata das rotas do controller */ });
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar.** Rode também `pnpm --filter @essencia/api test`.
- [ ] **Passo 5: Commit.** `git commit -m "feat: edita a proposta com revisao e publica o mapa conferido"`

---

### Tarefa 9: Capacidade da sessão igual aos lugares vendáveis

**Arquivos:**
- Modificar: `services/api/src/modules/eventos/mapas/mapas.service.ts` (`substituirMapaPadrao` e `migrarSessoesEExcluir`) e `mapas.service.spec.ts`

**Interfaces:**
- Produz: `private async ajustarCapacidade(db: Database, sessionIds: string[], mapSeats: Array<{ sellable: boolean | null }>): Promise<void>`. Ele faz um `update eventoSessoes set capacity = quantidade de sellable !== false, updatedAt` para os ids informados, e não faz nada quando a lista está vazia.
- Ele é chamado em dois pontos, sempre dentro da transação:
  - em `substituirMapaPadrao`, para as sessões herdadas, depois de `sincronizarInventarioMapa`;
  - em `migrarSessoesEExcluir`, para as `migratedSessionIds`, depois de recriar o inventário.
- O resultado da auditoria inclui `capacity`.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it("substituir ajusta a capacidade das sessões herdadas aos lugares vendáveis do mapa novo", async () => { /* 3 assentos, 1 sellable false → capacity 2; sessão com mapId explícito de outro mapa não muda */ });
it("migrar ajusta a capacidade das sessões migradas", async () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/api test -- src/modules/eventos/mapas/mapas.service.spec.ts`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar**, incluindo a suíte inteira da API.
- [ ] **Passo 5: Commit.** `git commit -m "feat: ajusta capacidade da sessao ao mapa publicado"`

---

### Tarefa 10: Desenho do mapa no estilo B (componente reaproveitável)

**Arquivos:**
- Criar: `packages/components/src/eventos/mapa-estilo-b.tsx`, `packages/components/src/eventos/mapa-estilo-b.test.tsx` e `packages/components/src/eventos/converter-ponto.ts` (com `.test.ts`)
- Modificar: `packages/components/package.json`, com o export `"./eventos/mapa-estilo-b": "./src/eventos/mapa-estilo-b.tsx"`, as dependências `d3-zoom` `^3.0.0`, `d3-selection` `^3.0.0` e `@essencia/shared: workspace:*` (se ainda não houver), e as devDependencies `@types/d3-zoom` e `@types/d3-selection`

**Interfaces:**
- Consome: `CategoriaLugar`, `ROTULO_CATEGORIA`, `RotuloFileira` e `ElementoPlanta` (Tarefa 1).
- Produz:
  ```ts
  export interface LugarMapa { id: string; fileira: string; numero: string; x: number; y: number; largura: number; altura: number; rotacao: number; categoria: CategoriaLugar | null; acessoExterno: boolean; estado: "livre" | "bloqueado" } // x/y = centro
  export interface MapaEstiloBProps {
    largura: number; altura: number; lugares: LugarMapa[]; rotulos: RotuloFileira[]; elementos: ElementoPlanta[]; rotuloAcessivel: string;
    selecionados?: ReadonlySet<string>; destacados?: ReadonlySet<string>; foco?: { x: number; y: number; largura: number; altura: number } | null;
    fundo?: React.ReactNode; opacidadeFundo?: number; // fundo vai num <foreignObject> dentro do grupo com zoom, sob os lugares
    onLugarClick?: (id: string, evento: { shiftKey: boolean }) => void; onFundoClick?: (ponto: { x: number; y: number }) => void;
  }
  export function MapaEstiloB(props: MapaEstiloBProps): JSX.Element;
  // converter-ponto.ts: tela → coordenadas do mapa (viewBox com "meet" + transformação do zoom)
  export function converterPontoTela(entrada: { clientX: number; clientY: number; caixa: { left: number; top: number; width: number; height: number }; largura: number; altura: number; zoom: { x: number; y: number; k: number } }): { x: number; y: number };
  ```
- **Desenho:**
  - Cada lugar é um `<g data-lugar-id transform="translate(x y) rotate(r)">` com:
    - um retângulo de `rx = 0,26·altura`;
    - uma faixa de base com `0,23·altura` de altura, na cor do contorno;
    - o número com `font-size = 0,5·altura`.
  - **Cores:** as de "Estilo B" em Restrições globais. A precedência é: selecionado > bloqueado > categoria (com acesso externo sobrepondo a cor da categoria).
  - **Destaque:** o lugar destacado ganha um retângulo extra, tracejado em `#d97706`.
  - **Palco:** um caminho curvo centrado no elemento PALCO, com largura de 0,6 da caixa de todos os lugares, e o texto "PALCO" (DM Sans, `#7c6d4f`).
  - **Entrada, saída e letras:** ENTRADA/SAÍDA em `#9aa29c`, letras das fileiras em negrito `#9aa29c`, fundo do SVG `#fffdf8`.
  - **Interação:** com `onLugarClick`, o lugar ganha `role="button"`, `tabIndex 0` e `aria-label` "R-13, Cadeirante", e responde a Enter e Espaço.
  - **Zoom:** `d3-zoom` com `scaleExtent [1, 8]`. Quando `foco` muda, o zoom enquadra a caixa com 20% de margem.

- [ ] **Passo 1: Escrever os testes que falham**

```ts
it("desenha um grupo por lugar com translate e rotate", () => {});
it("pinta cada categoria, acesso externo, bloqueado e selecionado com as cores do estilo B", () => { /* COMUM fill #ffffff stroke #9fb08a; CADEIRANTE fill #3b82f6; OBESO stroke #a855f7; acessoExterno stroke #06b6d4; bloqueado fill #e4e6e1; selecionado fill #7fae2e stroke #4d6a17 */ });
it("contorna os destacados com tracejado âmbar", () => {});
it("chama onLugarClick com shiftKey e responde a Enter", () => {});
it("desenha palco, entrada e letras das fileiras", () => {});
// converter-ponto.test.ts
it("converte o clique para o mapa considerando o 'meet' e o zoom", () => { /* caixa 1000×500, mapa 8420×5950, zoom {x:0,y:0,k:1} e {x:-100,y:-50,k:2} */ });
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/components test -- src/eventos`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Commit.** `git commit -m "feat: adiciona mapa de assentos no estilo B reaproveitavel"`

---

### Tarefa 11: Cliente da API de mapas e estado da conferência no painel

**Arquivos:**
- Criar: `apps/eventos-admin/features/eventos/conferencia/api-mapas.ts` (com `.test.ts`)
- Criar: `apps/eventos-admin/features/eventos/conferencia/use-proposta.ts` (com `.test.ts`)

**Interfaces:**
- Consome: as rotas das Tarefas 7 e 8; `aplicarOperacoes`, `PropostaMapa` e `OperacaoProposta` (Tarefa 1).
- Produz:
  ```ts
  export class ErroApiMapa extends Error { code?: string; details?: Record<string, unknown> }
  export async function respostaApi<T = any>(response: Response): Promise<T>; // lança ErroApiMapa com code, message e details
  export const baseEvento = (eventoId: string) => `/eventos-admin/api/eventos/admin/${eventoId}`;
  export const urlOriginal = (eventoId: string, mapId: string) => `${baseEvento(eventoId)}/mapas/${mapId}/original`;
  export function listarMapas(eventoId: string): Promise<Array<{ id: string; version: number; status: "EM_REVISAO" | "CONFIRMADO" | "ARQUIVADO"; originalFileName: string | null }>>;
  export function importarPlanta(eventoId: string, arquivo: File, pagina?: number): Promise<{ mapId: string }>;
  export function carregarRevisao(eventoId: string, mapId: string): Promise<{ map: { id: string; status: string }; proposta: PropostaMapa | null }>;
  export function enviarOperacoes(eventoId: string, mapId: string, revisaoBase: number, operacoes: OperacaoProposta[]): Promise<PropostaMapa>;
  export function publicarMapa(eventoId: string, mapId: string, revisaoBase: number, motivo?: string): Promise<unknown>;
  export function useProposta(eventoId: string, mapId: string, inicial: PropostaMapa): { proposta: PropostaMapa; aplicar: (operacoes: OperacaoProposta[]) => void; salvando: boolean; erro: string | null; recarregar: () => Promise<void> };
  ```
- **Comportamento do `useProposta`:**
  - Aplica cada mudança na tela na hora (`aplicarOperacoes`).
  - Envia as mudanças em fila, uma por vez. O `revisaoBase` é a revisão confirmada pelo servidor na resposta anterior.
  - Em qualquer erro, descarta a fila, recarrega a revisão do servidor e mostra uma mensagem:
    - `PROPOSTA_DESATUALIZADA` → "Esta conferência foi alterada em outra aba. Carregamos a versão mais recente.";
    - outros erros → "Não foi possível salvar a última alteração. Carregamos a conferência de novo.".

- [ ] **Passo 1: Escrever os testes que falham** (com `fetch` substituído por `vi.stubGlobal` e `renderHook`)

```ts
it("respostaApi lança ErroApiMapa com code e details", async () => {});
it("importarPlanta envia multipart e ?pagina quando informada", async () => {});
it("aplica na tela na hora e envia PATCH com a revisão base", async () => {});
it("envia duas alterações rápidas em ordem, a segunda com a revisão seguinte", async () => {});
it("revisão desatualizada recarrega e avisa (duas abas)", async () => {});
it("falha de rede recarrega a conferência e avisa", async () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/eventos-admin test -- features/eventos/conferencia`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Commit.** `git commit -m "feat: adiciona cliente e estado da conferencia de mapa no painel"`

---

### Tarefa 12: Tela de conferência

**Arquivos:**
- Criar em `apps/eventos-admin/features/eventos/conferencia/`:
  - `planta-pdf.tsx` (com `.test.tsx`);
  - `conferencia-mapa.tsx` (com `.test.tsx`);
  - `painel-lugar.tsx`, `legenda-cores.tsx` e `lista-pontos.tsx`.
- Modificar: `apps/eventos-admin/package.json`, com `pdfjs-dist` `^6.4.299` (a mesma versão da API)

**Interfaces:**
- Consome: `MapaEstiloB` e `LugarMapa` (Tarefa 10); `useProposta` e `urlOriginal` (Tarefa 11); `resumoProposta`, `pendenciasPublicacao`, `categoriaEfetiva`, `acessoExternoEfetivo`, `dimensoesLugar`, `ROTULO_CATEGORIA` e `CATEGORIAS_LUGAR` (Tarefa 1).
- Produz:
  ```ts
  export function PlantaPdf(props: { url: string; pagina: number; largura: number; altura: number }): JSX.Element;
  // carrega pdfjs-dist com import() dentro de useEffect (nunca no SSR); worker em new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url); canvas com aria-label "Planta original"; erro → "Não foi possível mostrar a planta original."
  export function ConferenciaMapa(props: { eventoId: string; mapId: string; propostaInicial: PropostaMapa; onPublicar: (revisaoBase: number, motivo?: string) => Promise<void>; onReenviar: (arquivo: File) => Promise<void> }): JSX.Element;
  ```
- **Tela (estilo B, como no esboço `esboco-conferencia.png`):**
  - **Etapas:** "Enviar planta → Conferir → Publicar", com Conferir ativa.
  - **Resumo:** fileiras, blocos, lugares, cada categoria, acesso externo e "não vender".
  - **Modo de visão:** "Lado a lado" (PlantaPdf | MapaEstiloB) ou "Sobrepor" (PlantaPdf como `fundo` com opacidade de 0,35).
  - **Pontos para conferir:** clicar seleciona os lugares do ponto e dá foco na caixa deles. O botão "Marcar como conferido" envia `CONFERIR_PONTO`. Os lugares dos pontos ainda não conferidos ficam em `destacados`.
  - **Painel do lugar:**
    - clicar seleciona um lugar; Shift+clique soma à seleção;
    - fileira e número são editados com um lugar selecionado e enviados ao sair do campo ou com Enter;
    - categoria (as quatro opções mais "Seguir a legenda") e "Acesso externo" valem para todos os selecionados;
    - "Não vender" alterna `vender`;
    - "Excluir lugar" pede confirmação e envia `EXCLUIR_LUGAR`.
  - **Legenda:** cada cor aparece com a amostra e o texto lido (ou "Sem legenda na planta"). A pessoa escolhe a categoria, marca "Acesso externo" e clica em "Confirmar", que envia `CONFIRMAR_LEGENDA`.
  - **Adicionar lugar:** disponível só no modo "Sobrepor". O botão "Adicionar lugar" arma o clique no fundo, e em seguida um formulário pede fileira e número. A operação enviada é `ADICIONAR_LUGAR`, com `id` de `crypto.randomUUID()` e as coordenadas de `onFundoClick`.
  - **Publicar:**
    - fica desabilitado enquanto houver pendências, que aparecem listadas logo acima;
    - ao clicar, abre um diálogo com o campo "Motivo das correções (opcional)" e chama `onPublicar(revisao, motivo || undefined)`;
    - durante o envio, o botão fica desabilitado.
  - **Reenviar:** o botão "Enviar outra planta" pede confirmação ("A conferência atual será descartada") e chama `onReenviar`.

- [ ] **Passo 1: Escrever os testes que falham.** Use jsdom e mocks de `PlantaPdf` e de `fetch`.

```ts
// planta-pdf.test.tsx (vi.mock("pdfjs-dist"))
it("carrega o PDF pela URL e desenha a página pedida", async () => {});
it("mostra aviso quando não consegue abrir o PDF", async () => {});
// conferencia-mapa.test.tsx
it("mostra etapas e o resumo da proposta", () => {});
it("clicar num ponto seleciona os lugares e marcar como conferido envia CONFERIR_PONTO", async () => {});
it("editar número, não vender e excluir enviam as operações do lugar", async () => {});
it("Shift+clique e troca de categoria enviam uma edição por lugar numa única chamada", async () => {});
it("confirmar a cor envia CONFIRMAR_LEGENDA", async () => {});
it("adicionar lugar no modo Sobrepor envia ADICIONAR_LUGAR com as coordenadas do clique", async () => {});
it("Publicar fica desabilitado com pendências e envia o motivo opcional quando liberado", async () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/eventos-admin test -- features/eventos/conferencia`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar.** Depois rode `pnpm --filter @essencia/eventos-admin build`. Esperado: o build termina sem erro de SSR do pdf.js.
- [ ] **Passo 5: Commit.** `git commit -m "feat: adiciona tela de conferencia do mapa gerado"`

---

### Tarefa 13: Página do mapa no painel e resultado da publicação

**Arquivos:**
- Modificar (reescrever): `apps/eventos-admin/app/eventos/[id]/mapa/page.tsx` e `page.test.ts`
- Renomear: `features/eventos/map-review.tsx` → `features/eventos/resultado-publicacao.tsx` (componente `ResultadoPublicacao`) e `map-review.test.ts` → `resultado-publicacao.test.ts`. O componente perde upload, lista de propostas, campos x/y, motivo e "Confirmar mapa". Ficam só as mensagens de arquivamento, inventário e sessões afetadas, além dos botões "Substituir mapa padrão novamente" e "Migrar sessões e excluir mapa anterior". Ajuste os testes que restam.
- Remover: `adaptDetection` de `features/eventos/contracts.ts` (a página antiga era o único uso) e o caso `adapts detection` de `contracts.test.ts`.

**Interfaces:**
- Consome: `ConferenciaMapa` (Tarefa 12), `MapaEstiloB` (Tarefa 10), as funções de `api-mapas.ts` (Tarefa 11) e as rotas existentes `mapa-padrao/substituir`, `mapa-padrao` (PATCH) e `mapas/:id/migrar-e-excluir`.
- Produz: a página com estes estados:
  - **Carregando.**
  - **Em revisão:** é a versão `EM_REVISAO` mais nova da lista e mostra `ConferenciaMapa`.
  - **Publicado com proposta:** é o mapa padrão `CONFIRMADO`. Mostra `MapaEstiloB` só para leitura, o resumo e "Enviar nova planta".
  - **Publicado sem proposta (legado):** mostra "Este mapa foi criado pela versão anterior do gerador. Envie a planta em PDF para gerar o mapa novo." e o envio.
  - **Sem mapa:** mostra só o envio.
- **Envio:**
  - `accept="application/pdf"`.
  - `PDF_PAGINA_OBRIGATORIA` → mostra "Escolha a página da planta", um seletor de 1 a `details.paginas` e reenvia com `?pagina`.
  - Outros erros → mostra `error.message` da API num `role="alert"`.
- **Publicação:**
  1. `publicarMapa`, protegido por uma promise em `ref` contra clique duplo.
  2. Depois, `substituirMapaPadrao(mapId)`, preservando a lógica atual de tentar de novo com o mesmo `mapId` e de oferecer "migrar e excluir" quando a resposta for `MAP_IN_USE`.
  3. Em seguida, recarrega a lista e passa ao estado "Publicado com proposta".
- **Carga de um mapa padrão `CONFIRMADO`:** mantém o `PATCH mapa-padrao` atual.

- [ ] **Passo 1: Escrever os testes que falham.** Porte os testes de retry e de migração do `page.test.ts` atual.

```ts
it("retoma a conferência da versão EM_REVISAO mais nova", async () => {});
it("PDF com várias páginas pede a página e reenvia com ?pagina", async () => {});
it("mostra a mensagem da API quando a planta não tem números", async () => {});
it("publica uma vez mesmo com clique duplo e substitui o mapa padrão com o mesmo mapId", async () => {});
it("oferece migrar e excluir quando o mapa anterior está em uso e envia targetMapId e sessionIds", async () => {});
it("mantém o mapId no retry da substituição", async () => {});
it("mapa padrão confirmado sem proposta mostra o aviso de mapa antigo e o envio", async () => {});
it("enviar outra planta com conferência aberta passa a mostrar a nova", async () => {});
```

- [ ] **Passo 2: Rodar e ver falhar.** Comando: `pnpm --filter @essencia/eventos-admin test -- app/eventos features/eventos`
- [ ] **Passo 3: Implementar.**
- [ ] **Passo 4: Rodar e ver passar.** Rode também `pnpm --filter @essencia/eventos-admin build`.
- [ ] **Passo 5: Commit.** `git commit -m "feat: integra conferencia e publicacao na pagina de mapa do painel"`

---

### Tarefa 14: Verificação final, deploy e troca do mapa do ballet

**Arquivos:** nenhum código novo. A tarefa termina com a atualização do ai-memory (`projetos/portal-cef.md`, `workspace: "renato"`, `project: "geral"`).

- [ ] **Passo 1: Pipeline completo na worktree**

Comando: `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test --filter=@essencia/api --filter=@essencia/shared --filter=@essencia/components --filter=@essencia/eventos-admin`
Esperado: tudo verde, incluindo o teste de aceite do ballet.

- [ ] **Passo 2: Revisão da branch inteira**, com superpowers:requesting-code-review, levando a spec e este plano. Resolva os achados antes de seguir.

- [ ] **Passo 3: Pedir ao Renato o "sim" para integrar e publicar.** Mostre o resumo: o que muda, a migration `0052` e o deploy com `--migrar`. Sem o "sim", pare aqui.

- [ ] **Passo 4: Integrar e publicar**, conforme o que o Renato autorizar:
  1. merge no `main`;
  2. `git push`;
  3. no checkout `/var/www/essencia`, já limpo, rodar `./scripts/deploy.sh --migrar`;
  4. conferir que o `health-check.sh` passou e que `curl https://www.portalcef.com.br/api/health` mostra `database` e `redis` conectados.

- [ ] **Passo 5: Trocar o mapa do ballet.** O Renato faz isso no painel, com acompanhamento.
  0. **Antes de publicar**, conferir no painel (tela de inventário da sessão do ballet e lista de pedidos) se a sessão tem algum lugar RESERVADO ou VENDIDO, ou algum pedido. Conferir também se a sessão usa o mapa padrão (mapa herdado) ou tem mapa próprio. Publicar substitui o mapa padrão na hora, e o fluxo de substituição preserva lugares reservados e vendidos do mapa antigo. Por isso, se houver qualquer reserva ativa ou venda, NÃO publicar: levar o caso ao Renato, conforme a spec. Só seguir se a sessão estiver sem reservas, sem vendas e sem pedidos, ou se houver apenas pedidos de teste expirados e o Renato tiver autorizado o caminho da sessão nova.
  1. Em `/eventos-admin/eventos/<id do ballet>/mapa`, enviar `Mapa plateia Novo.pdf`. A conferência deve mostrar 786 lugares, 19 fileiras e 1 ponto (fileira R).
  2. Conferir a legenda (as 5 cores) e o ponto da fileira R, e publicar.
  3. Se a substituição devolver `MAP_IN_USE`, usar "Migrar sessões e excluir mapa anterior".
  4. Se a migração devolver `SESSION_HAS_DEPENDENCIES`, parar e verificar no painel se há algum pedido pago na sessão. Se houver, o caso volta para o Renato. Se só houver reservas ou pedidos de teste, criar a sessão nova na mesma data e horário sobre o mapa novo e tirar a antiga da venda com o recurso da tela de sessões. Se a tela não tiver como tirar uma sessão da venda, parar e levar ao Renato, sem improvisar no banco.

- [ ] **Passo 6: Verificar o resultado em produção**
  1. `curl -s https://eventos.portalcef.com.br/api/eventos/public/sessoes/<sessionId>/map | jq '.data.seats | length'` (ajuste o caminho do JSON à resposta real). Esperado: 786.
  2. A prontidão do evento (`GET /eventos/admin/<id>/prontidao`, pelo painel) não aponta bloqueio no mapa nem no inventário, e a capacidade da sessão é 786.

- [ ] **Passo 7: Registrar o resultado** no ai-memory: o deploy, a troca do mapa e o que ficou para o projeto 2. Antes de gravar, leia a página e use o `expected_page_id`.
