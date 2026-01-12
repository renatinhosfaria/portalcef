'use client';

import { Menu, Search, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useCart } from '@/lib/useCart';

export function ShopHeader() {
  const { getTotalItems } = useCart();
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Mobile Menu */}
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-150">
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-[#A3D154] rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-semibold text-slate-800 tracking-tight leading-none">
                  Essência
                </span>
                <span className="text-[10px] font-medium text-[#A3D154] tracking-wider uppercase">
                  Store
                </span>
              </div>
            </Link>
          </div>

          {/* Search Bar - Desktop */}
          <div className="hidden lg:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Buscar produtos..."
                className={`w-full pl-10 pr-4 py-2 bg-slate-50 border rounded-lg text-sm text-slate-800 placeholder-slate-400 transition-colors duration-150 focus:outline-none ${
                  isSearchFocused
                    ? 'border-[#A3D154] bg-white ring-2 ring-[#A3D154]/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
              />
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-150 ${
                  isSearchFocused ? 'text-[#A3D154]' : 'text-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/carrinho"
              className="relative p-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors duration-150"
            >
              <ShoppingBag className="w-5 h-5" />
              {getTotalItems() > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#FB923C] text-white text-[10px] font-semibold h-4 min-w-4 px-1 flex items-center justify-center rounded-full">
                  {getTotalItems()}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
