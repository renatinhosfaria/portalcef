import { CachePublicoEventos } from './cache-publico-eventos';

describe('Cache público de eventos', () => {
  afterEach(() => jest.useRealTimers());

  it('consolida leitores simultâneos e busca novamente após um segundo', async () => {
    jest.useFakeTimers();
    const cache = new CachePublicoEventos<number>();
    let chamadas = 0;
    const buscar = async () => ++chamadas;
    expect(await Promise.all(Array.from({ length: 100 }, () => cache.obter('sessao', buscar)))).toEqual(Array(100).fill(1));
    expect(await cache.obter('sessao', buscar)).toBe(1);
    jest.advanceTimersByTime(1001);
    expect(await cache.obter('sessao', buscar)).toBe(2);
  });

  it('não guarda falha nem mistura sessões', async () => {
    const cache = new CachePublicoEventos<string>();
    await expect(cache.obter('a', async () => { throw new Error('Banco indisponível'); })).rejects.toThrow('Banco indisponível');
    expect(await cache.obter('a', async () => 'mapa A')).toBe('mapa A');
    expect(await cache.obter('b', async () => 'mapa B')).toBe('mapa B');
  });

  it('limita as entradas para não crescer com sessões arbitrárias', async () => {
    const cache = new CachePublicoEventos<number>(1000, 2);
    await cache.obter('a', async () => 1);
    await cache.obter('b', async () => 2);
    await cache.obter('c', async () => 3);
    expect(await cache.obter('a', async () => 4)).toBe(4);
  });
});
