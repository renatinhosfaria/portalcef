type Entrada<T> = { promessa: Promise<T>; expiraEm: number };

/** Consolida leituras públicas próximas, sem participar das decisões de compra. */
export class CachePublicoEventos<T> {
  private readonly entradas = new Map<string, Entrada<T>>();

  constructor(private readonly validadeMs = 1000, private readonly limite = 100) {}

  obter(chave: string, buscar: () => Promise<T>): Promise<T> {
    const existente = this.entradas.get(chave);
    if (existente && existente.expiraEm > Date.now()) return existente.promessa;
    this.entradas.delete(chave);
    while (this.entradas.size >= this.limite) {
      this.entradas.delete(this.entradas.keys().next().value!);
    }
    const entrada: Entrada<T> = { promessa: undefined as never, expiraEm: Infinity };
    entrada.promessa = Promise.resolve().then(buscar).then((valor) => {
      entrada.expiraEm = Date.now() + this.validadeMs;
      return valor;
    }, (erro: unknown) => {
      if (this.entradas.get(chave) === entrada) this.entradas.delete(chave);
      throw erro;
    });
    this.entradas.set(chave, entrada);
    return entrada.promessa;
  }
}
