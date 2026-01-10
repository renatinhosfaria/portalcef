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
      // TODO: API call to validate order
      // For now, just redirect
      router.push(`/pedido/${orderNumber}?phone=${encodeURIComponent(phone)}`);
    } catch {
      setError('Erro ao buscar pedido. Verifique os dados e tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-3xl font-bold mb-2">Consultar Pedido</h1>
          <p className="text-muted-foreground">
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
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
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
          <a href="/" className="text-primary hover:underline">
            ← Voltar ao catálogo
          </a>
        </div>
      </div>
    </div>
  );
}
