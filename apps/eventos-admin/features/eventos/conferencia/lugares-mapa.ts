import type { LugarMapa } from "@essencia/components/eventos/mapa-estilo-b";
import { acessoExternoEfetivo, categoriaEfetiva, dimensoesLugar, type PropostaMapa } from "@essencia/shared/eventos/mapa-proposta";

/** Converte os lugares da proposta no formato que o `MapaEstiloB` desenha. */
export function paraLugaresMapa(proposta: PropostaMapa): LugarMapa[] {
  return proposta.lugares.map((lugar) => {
    const categoria = categoriaEfetiva(proposta, lugar);
    return {
      id: lugar.id,
      fileira: lugar.fileira,
      numero: lugar.numero,
      x: lugar.x,
      y: lugar.y,
      ...dimensoesLugar(lugar, categoria),
      rotacao: lugar.rotacao,
      categoria,
      acessoExterno: acessoExternoEfetivo(proposta, lugar),
      estado: lugar.vender ? "livre" : "bloqueado",
    };
  });
}
