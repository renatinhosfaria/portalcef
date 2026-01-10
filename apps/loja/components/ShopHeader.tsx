'use client';

import { ShoppingBag, Search, Menu } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/lib/useCart';
import { useState } from 'react';

export function ShopHeader() {
    const { getTotalItems } = useCart();
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass">
            <div className="max-w-7xl mx-auto px-4 lg:px-6">
                <div className="flex items-center justify-between h-20">
                    {/* Logo & Mobile Menu */}
                    <div className="flex items-center gap-4">
                        <button className="lg:hidden p-2 text-brand-800 hover:bg-brand-50 rounded-xl transition-colors">
                            <Menu className="w-6 h-6" />
                        </button>
                        <Link href="/" className="flex items-center gap-2 group">
                            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform duration-300">
                                <ShoppingBag className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-bold text-brand-900 tracking-tight leading-none">
                                    Essência
                                </span>
                                <span className="text-xs font-semibold text-essencia-green tracking-wider uppercase">
                                    Store
                                </span>
                            </div>
                        </Link>
                    </div>

                    {/* Search Bar - Desktop */}
                    <div className="hidden lg:flex flex-1 max-w-xl mx-12">
                        <div
                            className={`relative w-full transition-all duration-300 ${isSearchFocused ? 'scale-105' : 'scale-100'
                                }`}
                        >
                            <input
                                type="text"
                                placeholder="O que você procura hoje?"
                                className="w-full pl-12 pr-4 py-3 bg-brand-50/50 border border-brand-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white text-brand-900 placeholder-brand-400 transition-all font-medium"
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setIsSearchFocused(false)}
                            />
                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isSearchFocused ? 'text-brand-500' : 'text-brand-400'
                                }`} />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4">
                        <Link
                            href="/carrinho"
                            className="relative p-3 bg-white hover:bg-brand-50 rounded-2xl border border-transparent hover:border-brand-100 transition-all duration-300 group"
                        >
                            <ShoppingBag className="w-6 h-6 text-brand-700 group-hover:text-brand-900 transition-colors" />
                            {getTotalItems() > 0 && (
                                <span className="absolute -top-1 -right-1 bg-essencia-orange text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full shadow-sm ring-2 ring-white transform group-hover:scale-110 transition-transform">
                                    {getTotalItems()}
                                </span>
                            )}
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
