/** Eventos representam datas civis; a hora serializada pela API não altera o dia. */
export function dataDoEvento(data: string | Date): string {
  return (typeof data === "string" ? data : data.toISOString()).slice(0, 10);
}

/** Converte uma data do formulário em um Date local sem deslocar o dia civil. */
export function criarDataDoEvento(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano!, mes! - 1, dia!, 12);
}

export function formatarDataEvento(
  data: string | Date,
  extenso = false,
): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: extenso ? "long" : "2-digit",
  }).format(new Date(`${dataDoEvento(data)}T12:00:00Z`));
}
