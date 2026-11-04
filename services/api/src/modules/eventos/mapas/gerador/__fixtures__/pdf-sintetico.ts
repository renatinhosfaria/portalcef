// Gera PDFs 1.4 mínimos (Helvetica, sem embutir fonte) para testar a leitura da planta.

export interface TextoSintetico {
  texto: string;
  /** Origem da linha de base, em pontos, com y para baixo. */
  x: number;
  y: number;
  /** Cor de preenchimento "#rrggbb". Padrão: preto. */
  cor?: string;
  tamanho?: number;
  /** Ângulo em graus, anti-horário, como no PDF. */
  angulo?: number;
}

export interface PaginaSintetica {
  largura: number;
  altura: number;
  rotacao?: 0 | 90 | 180 | 270;
  /**
   * Canto inferior esquerdo do MediaBox, em pontos. Padrão: (0, 0).
   * As posições dos textos continuam relativas ao canto da página visível; o gerador soma a origem.
   */
  origem?: { x: number; y: number };
  textos: TextoSintetico[];
}

function escaparTexto(texto: string): string {
  return texto.replace(/[\\()]/g, (c) => `\\${c}`);
}

function componenteCor(cor: string, inicio: number): string {
  return (parseInt(cor.slice(inicio, inicio + 2), 16) / 255).toFixed(4);
}

function conteudoDaPagina(pagina: PaginaSintetica): string {
  const partes = pagina.textos.map((t) => {
    const cor = t.cor ?? "#000000";
    const radianos = ((t.angulo ?? 0) * Math.PI) / 180;
    const cos = Math.cos(radianos).toFixed(6);
    const sen = Math.sin(radianos).toFixed(6);
    const menosSen = (-Math.sin(radianos)).toFixed(6);
    const cx = (t.x + (pagina.origem?.x ?? 0)).toFixed(3);
    const cy = (pagina.altura - t.y + (pagina.origem?.y ?? 0)).toFixed(3);
    return [
      `${componenteCor(cor, 1)} ${componenteCor(cor, 3)} ${componenteCor(cor, 5)} rg`,
      "BT",
      `/F1 ${t.tamanho ?? 10} Tf`,
      `${cos} ${sen} ${menosSen} ${cos} ${cx} ${cy} Tm`,
      `(${escaparTexto(t.texto)}) Tj`,
      "ET",
    ].join("\n");
  });
  return partes.join("\n");
}

export function criarPdfSintetico(paginas: PaginaSintetica[]): Buffer {
  // Objetos: 1 catálogo, 2 árvore de páginas, 3 fonte; depois, par página + conteúdo.
  const objetos: string[] = [];
  const idsPaginas = paginas.map((_, i) => 4 + i * 2);
  objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objetos[2] = `<< /Type /Pages /Kids [${idsPaginas.map((id) => `${id} 0 R`).join(" ")}] /Count ${paginas.length} >>`;
  objetos[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  paginas.forEach((pagina, i) => {
    const idPagina = 4 + i * 2;
    const idConteudo = idPagina + 1;
    const origem = pagina.origem ?? { x: 0, y: 0 };
    const rotate = pagina.rotacao ? ` /Rotate ${pagina.rotacao}` : "";
    objetos[idPagina] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [${origem.x} ${origem.y} ${origem.x + pagina.largura} ${origem.y + pagina.altura}]${rotate} ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${idConteudo} 0 R >>`;
    const conteudo = conteudoDaPagina(pagina);
    objetos[idConteudo] = `<< /Length ${Buffer.byteLength(conteudo, "latin1")} >>\nstream\n${conteudo}\nendstream`;
  });

  let saida = "%PDF-1.4\n";
  const posicoes: number[] = [];
  for (let id = 1; id < objetos.length; id++) {
    posicoes[id] = Buffer.byteLength(saida, "latin1");
    saida += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
  }
  const inicioXref = Buffer.byteLength(saida, "latin1");
  saida += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objetos.length; id++) {
    saida += `${String(posicoes[id]).padStart(10, "0")} 00000 n \n`;
  }
  saida += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(saida, "latin1");
}
