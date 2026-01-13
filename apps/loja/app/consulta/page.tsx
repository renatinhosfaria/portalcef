'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { LoadingSpinner } from '@/components/Loading';

export default function ConsultaPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!orderNumber || !phone) {
      setError('Preencha todos os campos');
      return;
    }

    setLoading(true);

    try {
      // Validate order existence and phone match
      const res = await fetch(`/api/shop/orders/lookup/${orderNumber}?phone=${encodeURIComponent(phone.replace(/\D/g, ''))}`);

      if (res.ok) {
        // Order exists, redirect
        router.push(`/pedido/${orderNumber}?phone=${encodeURIComponent(phone.replace(/\D/g, ''))}`);
      } else {
        const data = await res.json();
        if (res.status === 404) {
          setError('Pedido não encontrado. Verifique o número e o telefone informado.');
        } else {
          setError(data.error?.message || 'Erro ao buscar pedido. Tente novamente.');
        }
        setLoading(false);
      }
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-slate-800">Consultar Pedido</h1>
          <p className="text-slate-600">
            Digite o número do pedido e o telefone cadastrado
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card">
          <div className="space-y-4">
            <div>
              <label htmlFor="orderNumber" className="block text-sm font-medium mb-2">
                Número do Pedido
              </label>
              <input
                type="text"
                id="orderNumber"
                value={orderNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrderNumber(e.target.value)}
                placeholder="Ex: 123456"
                className="input"
                maxLength={6}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium mb-2">
                Telefone
              </label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                className="input"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Buscando...
                </>
              ) : (
                'Consultar Pedido'
              )}
            </button>
          </div>
        </form>

        <div className="text-center mt-8">
          <a href="/" className="text-slate-600 hover:text-slate-800 font-medium transition-colors duration-150">
            ← Voltar ao catálogo
          </a>
        </div>
      </div>
    </div>
  );
}
