'use client';

import React, { useEffect, useRef } from 'react';
import { Product } from '@/types';
import { Sparkles, ShoppingBag, Star, ShieldCheck, Flame } from 'lucide-react';

interface ProductSpotlightProps {
  products: Product[];
  spotlightId: string | null;
  onAddToCart: (product: Product) => void;
  onAskAboutProduct: (product: Product) => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export const ProductSpotlight: React.FC<ProductSpotlightProps> = ({
  products,
  spotlightId,
  onAddToCart,
  onAskAboutProduct,
  selectedCategory,
  onSelectCategory
}) => {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (spotlightId && cardRefs.current[spotlightId]) {
      cardRefs.current[spotlightId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [spotlightId]);

  const categories = [
    { id: 'all', label: 'All Treasures' },
    { id: 'hampers', label: 'Festive Hampers' },
    { id: 'sweets', label: 'Gourmet Sweets' },
    { id: 'dry-fruits', label: 'Royal Dry Fruits' },
    { id: 'diyas', label: 'Artisanal Diyas' },
    { id: 'silver', label: 'Auspicious Silver' }
  ];

  const filtered = selectedCategory === 'all'
    ? products
    : products.filter(p => p.category === selectedCategory);

  return (
    <div className="w-full">
      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none mb-6">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-semibold shadow-md shadow-amber-500/20 scale-105'
                  : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:border-amber-500/40 hover:text-amber-200'
              }`}
            >
              {isActive && <Sparkles className="w-3.5 h-3.5 text-slate-950" />}
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((product) => {
          const isSpotlighted = spotlightId === product.id;
          const discountPercent = Math.round(
            ((product.original_price - product.price) / product.original_price) * 100
          );

          return (
            <div
              key={product.id}
              ref={(el) => { cardRefs.current[product.id] = el; }}
              className={`relative rounded-2xl overflow-hidden transition-all duration-500 flex flex-col justify-between ${
                isSpotlighted
                  ? 'bg-gradient-to-b from-amber-950/80 via-slate-900/95 to-slate-950 border-2 border-amber-400 shadow-2xl shadow-amber-500/40 scale-[1.02] ring-4 ring-amber-400/20'
                  : 'bg-slate-900/80 border border-slate-800 hover:border-amber-500/30 hover:shadow-xl hover:shadow-amber-950/20'
              }`}
            >
              {/* Voice Spotlight Banner */}
              {isSpotlighted && (
                <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 text-xs font-bold py-1 px-3 text-center flex items-center justify-center gap-1.5 shadow-md animate-pulse">
                  <Flame className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Aarav is presenting this gift</span>
                </div>
              )}

              {/* Product Image & Badges */}
              <div className="relative w-full h-48 overflow-hidden bg-slate-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image}
                  alt={product.name}
                  className={`w-full h-full object-cover transition-transform duration-700 ${
                    isSpotlighted ? 'scale-110' : 'hover:scale-105'
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                {/* Badge Tag */}
                <div className="absolute top-3 left-3 z-10">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/90 text-slate-950 shadow-md">
                    {product.badge}
                  </span>
                </div>

                {/* Discount Tag */}
                <div className="absolute top-3 right-3 z-10">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600/90 text-white shadow-md">
                    {discountPercent}% OFF
                  </span>
                </div>

                {/* Rating */}
                <div className="absolute bottom-2 left-3 z-10 flex items-center gap-1 text-xs text-amber-300 font-medium bg-slate-950/70 px-2 py-0.5 rounded-full backdrop-blur-sm border border-amber-500/20">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{product.rating}</span>
                  <span className="text-slate-400">({product.reviews})</span>
                </div>
              </div>

              {/* Product Content */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-xs text-amber-200/70 mt-0.5 line-clamp-1">
                    {product.subtitle}
                  </p>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {product.description}
                  </p>

                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-amber-400/90 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="truncate">{product.festive_note}</span>
                  </div>
                </div>

                {/* Price and Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-amber-300">
                        ₹{product.price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-slate-500 line-through">
                        ₹{product.original_price.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium">Free Festive Box</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onAskAboutProduct(product)}
                      title="Ask Aarav about this item"
                      className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Ask</span>
                    </button>
                    <button
                      onClick={() => onAddToCart(product)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-slate-950" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
