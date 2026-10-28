import { criarEventoSchema, atualizarEventoSchema, criarSessaoSchema, politicaSchema } from "@essencia/shared/schemas";
export class CriarEventoDto { static schema = criarEventoSchema; }
export class AtualizarEventoDto { static schema = atualizarEventoSchema; }
export class CriarSessaoDto { static schema = criarSessaoSchema; }
export class PoliticaDto { static schema = politicaSchema; }
