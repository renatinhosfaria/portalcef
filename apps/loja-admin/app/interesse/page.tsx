'use client';

import { Phone, Mail, Check, Sparkles, Users, Clock } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface InterestRequest {
    id: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    studentName: string;
    studentClass: string;
    notes: string;
    itemsCount: number;
    contactedAt: string | null;
    createdAt: string;
}

export default function InteressePage() {
    const [requests, setRequests] = useState<InterestRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'PENDENTE' | 'CONTATADO' | 'TODOS'>('PENDENTE');

    const loadRequests = useCallback(async () => {
        try {
            setLoading(true);
            await new Promise(resolve => setTimeout(resolve, 500));

            const mockData: InterestRequest[] = [
                { id: '1', customerName: 'Maria Silva', customerPhone: '11987654321', customerEmail: 'maria@email.com', studentName: 'João Silva', studentClass: 'Infantil 3A', notes: 'Preciso de 2 camisetas tamanho 8', itemsCount: 2, contactedAt: null, createdAt: new Date().toISOString() },
                { id: '2', customerName: 'Carlos Santos', customerPhone: '11998765432', customerEmail: 'carlos@email.com', studentName: 'Ana Santos', studentClass: '3º Ano B', notes: '', itemsCount: 3, contactedAt: null, createdAt: new Date(Date.now() - 86400000).toISOString() },
                { id: '3', customerName: 'Ana Costa', customerPhone: '11912345678', customerEmail: 'ana@email.com', studentName: 'Pedro Costa', studentClass: '5º Ano A', notes: 'Aguardando uniforme de educação física', itemsCount: 1, contactedAt: new Date(Date.now() - 3600000).toISOString(), createdAt: new Date(Date.now() - 172800000).toISOString() },
            ];

            let filtered = mockData;
            if (statusFilter === 'PENDENTE') {
                filtered = mockData.filter(r => !r.contactedAt);
            } else if (statusFilter === 'CONTATADO') {
                filtered = mockData.filter(r => r.contactedAt);
            }

            setRequests(filtered);
        } catch (err) {
            console.error('Error loading requests:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('pt-BR');
    };

    const formatPhone = (phone: string) => {
        if (phone.length === 11) {
            return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
        }
        return phone;
    };

    const handleMarkContacted = async (id: string) => {
        setRequests(requests.map(r =>
            r.id === id ? { ...r, contactedAt: new Date().toISOString() } : r
        ));
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Lista de Interesse</h1>
                <p className="text-slate-500 mt-1">Clientes interessados em produtos sem estoque</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button 
                    onClick={() => setStatusFilter('TODOS')}
                    className={`stat-card text-left ${statusFilter === 'TODOS' ? 'ring-2 ring-[#A3D154]' : ''}`}
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="stat-card-label">Total</p>
                            <p className="stat-card-value">15</p>
                        </div>
                        <div className="stat-card-icon bg-blue-100 text-blue-600">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                </button>
                <button 
                    onClick={() => setStatusFilter('PENDENTE')}
                    className={`stat-card text-left ${statusFilter === 'PENDENTE' ? 'ring-2 ring-[#A3D154]' : ''}`}
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="stat-card-label">Pendentes</p>
                            <p className="stat-card-value text-amber-600">12</p>
                        </div>
                        <div className="stat-card-icon bg-amber-100 text-amber-600">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>
                </button>
                <button 
                    onClick={() => setStatusFilter('CONTATADO')}
                    className={`stat-card text-left ${statusFilter === 'CONTATADO' ? 'ring-2 ring-[#A3D154]' : ''}`}
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="stat-card-label">Contatados</p>
                            <p className="stat-card-value text-[#5a7a1f]">3</p>
                        </div>
                        <div className="stat-card-icon bg-[#A3D154]/20 text-[#5a7a1f]">
                            <Check className="w-6 h-6" />
                        </div>
                    </div>
                </button>
            </div>

            {/* Table */}
            <div className="admin-card">
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Responsável</th>
                                <th>Aluno</th>
                                <th>Turma</th>
                                <th>Contato</th>
                                <th>Itens</th>
                                <th>Data</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12">
                                        <div className="loading-spinner-admin mx-auto"></div>
                                    </td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={8}>
                                        <div className="empty-state">
                                            <div className="empty-state-icon">💡</div>
                                            <div className="empty-state-title">Nenhuma solicitação</div>
                                            <div className="empty-state-description">Não há solicitações de interesse no momento</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                requests.map((req) => (
                                    <tr key={req.id}>
                                        <td className="font-semibold text-slate-800">{req.customerName}</td>
                                        <td>{req.studentName}</td>
                                        <td>
                                            <span className="badge badge-neutral">{req.studentClass}</span>
                                        </td>
                                        <td>
                                            <div className="space-y-1">
                                                <a href={`tel:${req.customerPhone}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-[#A3D154]">
                                                    <Phone className="w-3 h-3" />
                                                    {formatPhone(req.customerPhone)}
                                                </a>
                                                <a href={`mailto:${req.customerEmail}`} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#A3D154]">
                                                    <Mail className="w-3 h-3" />
                                                    {req.customerEmail}
                                                </a>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge badge-info flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" />
                                                {req.itemsCount}
                                            </span>
                                        </td>
                                        <td className="text-sm text-slate-500">{formatDate(req.createdAt)}</td>
                                        <td>
                                            {req.contactedAt ? (
                                                <span className="badge badge-success">
                                                    <Check className="w-3 h-3" />
                                                    Contatado
                                                </span>
                                            ) : (
                                                <span className="badge badge-warning">Pendente</span>
                                            )}
                                        </td>
                                        <td>
                                            {!req.contactedAt && (
                                                <button
                                                    onClick={() => handleMarkContacted(req.id)}
                                                    className="btn-admin btn-admin-primary btn-admin-sm"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    Marcar Contatado
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
