'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/pedidos', label: 'Pedidos', icon: '📋' },
    { href: '/venda-presencial', label: 'Venda Presencial', icon: '🛒' },
    { href: '/produtos', label: 'Produtos', icon: '📦' },
    { href: '/estoque', label: 'Estoque', icon: '📈' },
    { href: '/interesse', label: 'Interesse', icon: '💡' },
    { href: '/configuracoes', label: 'Configurações', icon: '⚙️' },
    { href: '/relatorios', label: 'Relatórios', icon: '📉' },
];

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="admin-sidebar">
            <div className="sidebar-logo">
                🛍️ CEF Shop Admin
            </div>
            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <span className="sidebar-link-icon">{item.icon}</span>
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
                <Link
                    href="/"
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-2"
                >
                    ← Voltar ao Portal
                </Link>
            </div>
        </aside>
    );
}
