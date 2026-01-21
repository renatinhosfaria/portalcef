'use client';

import { Menu, Search, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import { useCart } from '@/lib/useCart';

export function ShopHeader() {
  const { getTotalItems } = useCart();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-xl border-b-2 border-stone-200 shadow-lg'
          : 'bg-white/80 backdrop-blur-md border-b border-stone-200'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Mobile Menu */}
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2.5 text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-all duration-200">
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/" className="flex items-center gap-3 group">
              {/* Logo Icon */}
              <div className="relative">
                <div className="w-11 h-11 bg-gradient-to-br from-[#A3D154] to-[#8FBD3F] rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                {/* Accent dot */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#F59E0B] rounded-full border-2 border-white" />
              </div>

              {/* Logo Text */}
              <div className="flex flex-col">
                <span className="font-display text-xl font-bold text-stone-800 tracking-tight leading-none group-hover:text-[#5a7a1f] transition-colors duration-200">
                  Portal CEF
                </span>
                <span className="font-display text-[10px] font-bold text-[#F59E0B] tracking-widest uppercase">
                  Store
                </span>
              </div>
            </Link>
          </div>

          {/* Search Bar - Desktop */}
          <div className="hidden lg:flex flex-1 max-w-lg mx-8">
            <div className="relative w-full group">
              <input
                type="text"
                placeholder="Buscar uniformes, acessórios..."
                className={`w-full pl-12 pr-4 py-3.5 rounded-xl text-sm font-medium text-stone-800 placeholder-stone-400 transition-all duration-300 ${
                  isSearchFocused
                    ? 'bg-white border-2 border-[#A3D154] ring-4 ring-[#A3D154]/10 shadow-lg'
                    : 'bg-stone-50 border-2 border-stone-200 hover:border-stone-300 hover:bg-white'
                } focus:outline-none`}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
              />
              <Search
                className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-all duration-300 ${
                  isSearchFocused ? 'text-[#A3D154] scale-110' : 'text-stone-400'
                }`}
              />

              {isSearchFocused && (
                <div className="absolute left-4 right-4 top-0 -z-10 h-full bg-[#A3D154]/5 rounded-xl blur-xl" />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile Search */}
            <button className="lg:hidden p-2.5 text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-all duration-200">
              <Search className="w-5 h-5" />
            </button>

            {/* Cart Button */}
            <Link
              href="/carrinho"
              className="relative group p-2.5 text-stone-600 hover:text-white hover:bg-[#A3D154] rounded-xl transition-all duration-200 shadow-sm hover:shadow-lg"
            >
              <ShoppingBag className="w-5 h-5" />

              {getTotalItems() > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white text-[10px] font-bold rounded-full shadow-lg animate-scale-in border-2 border-white">
                  {getTotalItems()}
                </span>
              )}

              {/* Hover glow effect */}
              <div className="absolute inset-0 rounded-xl bg-[#A3D154] opacity-0 group-hover:opacity-20 blur-lg transition-opacity duration-300" />
            </Link>
          </div>
        </div>
      </div>

      {/* Progress Bar (opcional - mostra ao scrollar) */}
      {isScrolled && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-100">
          <div className="h-full bg-gradient-to-r from-[#A3D154] to-[#F59E0B] transition-all duration-300" style={{ width: '0%' }} />
        </div>
      )}
    </header>
  );
}
