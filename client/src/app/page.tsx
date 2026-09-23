'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Product, CartSummary } from '@/types';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { ProductSpotlight } from '@/components/ProductSpotlight';
import { FestiveCart } from '@/components/FestiveCart';
import { LiveTranscript } from '@/components/LiveTranscript';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { 
  Sparkles, 
  ShoppingBag, 
  Mic, 
  MicOff, 
  Flame, 
  Gift, 
  Send, 
  ShieldCheck, 
  Truck, 
  Award,
  Zap,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';

const FALLBACK_PRODUCTS: Product[] = [
  {
    id: "dw-01",
    name: "Royal Shahi Dry Fruit Box",
    subtitle: "Kashmiri Walnuts, Roasted Pistachios, Jumbo Almonds & Cashews",
    category: "dry-fruits",
    price: 1499,
    original_price: 1999,
    rating: 4.9,
    reviews: 128,
    image: "/images/products/dw-01.jpg",
    badge: "Bestseller",
    description: "Handpicked 4-tier artisanal dry fruit wooden keepsake box featuring Californian jumbo almonds, roasted Afghan pistachios, Goan cashews, and Kashmiri walnut kernels. Net weight 800g.",
    festive_note: "Auspicious gift for family elders, colleagues, and festive poojas.",
    in_stock: true,
    stock_count: 45
  },
  {
    id: "dw-02",
    name: "Swarna Luxury Mithai & Brass Diya Hamper",
    subtitle: "Artisanal Kaju Katli, Besan Ladoo, Saffron Motichoor & Engraved Brass Diya",
    category: "sweets",
    price: 2199,
    original_price: 2799,
    rating: 4.8,
    reviews: 94,
    image: "/images/products/dw-02.jpg",
    badge: "Festive Favorite",
    description: "Pure desi ghee confectionery crafted by master halwais. Includes 250g Silver-foiled Kaju Katli, 250g Shahi Motichoor Ladoo, 200g Besan Ladoo, paired with a solid brass hand-engraved peacock Diya.",
    festive_note: "Ideal traditional gift for relatives, housewarmings, and festive dinners.",
    in_stock: true,
    stock_count: 30
  },
  {
    id: "dw-03",
    name: "Anandam Handcrafted Terracotta Diya Set",
    subtitle: "Set of 6 Organic Hand-painted Diyas with Soy Wax & Rose Petals",
    category: "diyas",
    price: 799,
    original_price: 1099,
    rating: 4.9,
    reviews: 210,
    image: "/images/products/dw-03.jpg",
    badge: "Eco Friendly",
    description: "Meticulously molded and painted by rural Indian artisans using organic clay, natural vibrant colors, and pre-filled with organic smokeless soy wax scented with cardamom and Indian rose.",
    festive_note: "Brings traditional warmth and divine glow to entrance balconies and rangolis.",
    in_stock: true,
    stock_count: 120
  },
  {
    id: "dw-04",
    name: "Grand Celebration Corporate Hamper",
    subtitle: "Artisanal Gourmet Snacks, Darjeeling First Flush Tea, Dry Fruits & Diya",
    category: "hampers",
    price: 2899,
    original_price: 3500,
    rating: 5.0,
    reviews: 68,
    image: "/images/products/dw-04.jpg",
    badge: "Corporate Luxury",
    description: "Executive celebratory hamper presented in a royal midnight blue velvet trunk. Contains estate Darjeeling first-flush tea, Belgian chocolate florentines, salted peri-peri makhanas, premium dry fruits, and gold-foiled greeting card.",
    festive_note: "Top choice for corporate gifting, VIP clients, and executive colleagues.",
    in_stock: true,
    stock_count: 25
  },
  {
    id: "dw-05",
    name: "Shubh Lakshmi-Ganesh 999 Silver Coin Box",
    subtitle: "10g Hallmarked Pure Silver Coin with Gangajal & Roli Chawal",
    category: "silver",
    price: 3499,
    original_price: 3999,
    rating: 5.0,
    reviews: 42,
    image: "/images/products/dw-05.jpg",
    badge: "Auspicious",
    description: "Certified 999 Fine Silver 10-gram coin embossed with Goddess Lakshmi and Lord Ganesha in proof finish. Presented in a crimson velvet box with consecrated Gangajal vial and brass pooja thali accessories.",
    festive_note: "Auspicious investment and blessing gift for Dhanteras and Diwali Pooja.",
    in_stock: true,
    stock_count: 15
  },
  {
    id: "dw-06",
    name: "Kesariya Saffron & Rose Sweet Platter",
    subtitle: "Assorted Gourmet Sweets Infused with Kashmiri Mongra Saffron",
    category: "sweets",
    price: 1299,
    original_price: 1699,
    rating: 4.7,
    reviews: 85,
    image: "/images/products/dw-06.jpg",
    badge: "Chef Special",
    description: "Luxury confectionery box featuring Saffron Peda, Rose Petal Kaju Roll, and Walnut Fudge made with zero refined sugar and 100% pure A2 Gir Cow ghee. Shelf life: 15 days.",
    festive_note: "Guilt-free indulgence for modern festive celebrations.",
    in_stock: true,
    stock_count: 50
  }
];

export default function Home() {
  const [products, setProducts] = useState<Product[]>(FALLBACK_PRODUCTS);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>('');

  const [cart, setCart] = useState<CartSummary>({
    items: [],
    total_items_count: 0,
    subtotal: 0,
    discount_amount: 0,
    coupon_code: null,
    free_diya_gift: false,
    total: 0,
    pincode: null,
    delivery_info: null
  });

  // Callbacks for Voice Agent Hook
  const handleSpotlightProduct = useCallback((product: Product) => {
    setSpotlightId(product.id);
  }, []);

  const handleUpdateCart = useCallback((newCart: CartSummary) => {
    setCart(newCart);
  }, []);

  const handleOpenCheckout = useCallback((checkoutCart: CartSummary) => {
    setCart(checkoutCart);
    setIsCartOpen(true);
  }, []);

  const handleCouponApplied = useCallback((payload: any) => {
    if (payload.success) {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#EF4444', '#10B981', '#FCD34D']
      });
    }
  }, []);

  // Voice Agent Hook
  const {
    state,
    audioLevel,
    interimText,
    messages,
    continuousMode,
    toggleContinuousMode,
    toggleListening,
    sendUserPrompt,
    resetAgent
  } = useVoiceAgent({
    onSpotlightProduct: handleSpotlightProduct,
    onUpdateCart: handleUpdateCart,
    onOpenCheckout: handleOpenCheckout,
    onCouponApplied: handleCouponApplied
  });

  const [resetToast, setResetToast] = useState<string | null>(null);

  const handleFreshStart = useCallback(() => {
    resetAgent();
    setSpotlightId(null);
    setResetToast('Fresh session started! Aarav is ready.');
    setTimeout(() => setResetToast(null), 3500);
  }, [resetAgent]);

  // Load products from server if available
  useEffect(() => {
    fetch('http://localhost:8000/api/catalog')
      .then((res) => res.json())
      .then((data) => {
        if (data.products && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      })
      .catch(() => {
        // Fallback already preloaded
      });
  }, []);

  // Add to cart directly from UI
  const handleAddToCart = (product: Product) => {
    sendUserPrompt(`Add 1 ${product.name} to my cart`);
    setIsCartOpen(true);
  };

  // Ask Aarav about specific product
  const handleAskAboutProduct = (product: Product) => {
    setSpotlightId(product.id);
    sendUserPrompt(`Tell me more about the ${product.name} and who it's best for`);
  };

  // Cart operations
  const handleUpdateQuantity = (productId: string, quantity: number) => {
    sendUserPrompt(`Update quantity of ${productId} to ${quantity}`);
  };

  const handleRemoveItem = (productId: string) => {
    sendUserPrompt(`Remove ${productId} from my cart`);
  };

  const handleApplyCoupon = (code: string) => {
    sendUserPrompt(`Apply coupon code ${code}`);
  };

  const handleCheckPincode = (pincode: string) => {
    sendUserPrompt(`Check delivery for pincode ${pincode}`);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      sendUserPrompt(customInput.trim());
      setCustomInput('');
    }
  };

  // Curated 1-click presentation demo scenarios
  const demoPrompts = [
    {
      icon: "🎁",
      label: "Corporate Gifting",
      prompt: "I need luxury corporate hampers under ₹3,000 for VIP clients"
    },
    {
      icon: "🍬",
      label: "Desi Ghee Sweets",
      prompt: "Show me authentic Indian sweets and mithai hampers for family"
    },
    {
      icon: "🏷️",
      label: "20% Festive Coupon",
      prompt: "Add the Royal Shahi Dry Fruit Box and apply coupon DIWALI20"
    },
    {
      icon: "🚚",
      label: "Pre-Diwali Delivery",
      prompt: "Can you guarantee delivery before Diwali to pincode 400001?"
    }
  ];

  return (
    <main className="min-h-screen bg-radial-[at_50%_0%] from-amber-950/20 via-[#0B0F19] to-[#0B0F19] flex flex-col relative pb-24 overflow-x-hidden">
      {/* Ambient Diwali Glow Background Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-20 right-1/4 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-amber-500/20 bg-[#0B0F19]/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Flame className="w-5 h-5 text-slate-950 fill-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-wide bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                SHUBH DIWALI 2026
              </h1>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                AI Sales Concierge
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Conversational Voice Shopping powered by Google Gemini
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Fresh Start Button */}
          <button
            onClick={handleFreshStart}
            title="Start Fresh (Reset conversation & cart)"
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-750 hover:border-amber-400/60 text-slate-300 hover:text-amber-300 transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm active:scale-95 group"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400 group-hover:-rotate-45 transition-transform duration-200" />
            <span className="hidden sm:inline">Start Fresh</span>
          </button>

          {/* Status Pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">Aarav is Online</span>
          </div>

          {/* Cart Trigger */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-400/40 text-amber-200 hover:border-amber-400 hover:text-white transition-all flex items-center gap-2 text-xs font-semibold shadow-lg shadow-amber-950/20"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>₹{cart.total.toLocaleString('en-IN')}</span>
            {cart.total_items_count > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center -mr-1 shadow-sm">
                {cart.total_items_count}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Fresh Start Feedback Notification Toast */}
      {resetToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 backdrop-blur-md">
          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
          <span>{resetToast}</span>
        </div>
      )}

      {/* Hero & Interactive Voice Visualizer Section */}
      <section className="px-4 sm:px-8 pt-8 pb-10 max-w-6xl mx-auto w-full flex flex-col items-center text-center">
        {/* Festive Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-4 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>The Grand Festive Gifting Showcase • Code: DIWALI20</span>
        </div>

        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight max-w-3xl leading-tight">
          Talk to <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">Aarav</span>, Your Festive Gifting Concierge
        </h2>

        <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
          Simply speak to discover bespoke Diwali hampers, taste traditional pure desi ghee sweets, and secure pre-Diwali express delivery.
        </p>

        {/* Central Golden Diya Audio Visualizer */}
        <div className="my-6 flex flex-col items-center">
          <AudioVisualizer
            state={state}
            audioLevel={audioLevel}
            onClick={toggleListening}
          />

          {/* Live Speech Interim Transcription Bubble */}
          {interimText && (
            <div className="mt-3 px-4 py-2 rounded-2xl bg-slate-900/90 border border-amber-400/60 shadow-lg shadow-amber-900/30 text-amber-200 text-xs font-medium flex items-center gap-2 animate-in fade-in zoom-in-95 max-w-md">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping flex-shrink-0" />
              <span className="italic truncate">&ldquo;{interimText}&rdquo;</span>
            </div>
          )}
        </div>

        {/* Voice Trigger Buttons & Continuous Dialogue Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={toggleListening}
            className={`px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2.5 transition-all shadow-xl active:scale-95 ${
              state === 'listening'
                ? 'bg-red-600 text-white shadow-red-900/40 animate-pulse'
                : state === 'speaking'
                ? 'bg-emerald-600 text-white shadow-emerald-900/40'
                : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 shadow-amber-500/30 hover:shadow-amber-500/50 hover:brightness-105'
            }`}
          >
            {state === 'listening' ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Listening... (Tap to Pause)</span>
              </>
            ) : state === 'speaking' ? (
              <>
                <Flame className="w-4 h-4 text-white fill-white animate-bounce" />
                <span>Aarav Speaking... (Tap to Interrupt)</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-slate-950" />
                <span>Tap to Speak to Aarav</span>
              </>
            )}
          </button>

          {/* Hands-Free Mode Toggle */}
          <button
            onClick={toggleContinuousMode}
            className={`px-4 py-2.5 rounded-2xl text-xs font-semibold border transition-all flex items-center gap-2 ${
              continuousMode
                ? 'bg-amber-500/15 border-amber-400/50 text-amber-300 shadow-sm'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${continuousMode ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
            <span>Hands-Free Auto-Listen: {continuousMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Fresh Start Button */}
          <button
            onClick={handleFreshStart}
            className="px-4 py-2.5 rounded-2xl text-xs font-semibold border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 transition-all flex items-center gap-1.5 active:scale-95 group shadow-sm"
            title="Clear cart and conversation to start completely fresh"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400 group-hover:-rotate-45 transition-transform duration-200" />
            <span>Fresh Start</span>
          </button>
        </div>

        {/* One-Click Client Demo Scenarios */}
        <div className="mt-8 w-full max-w-3xl">
          <p className="text-xs uppercase tracking-wider font-bold text-amber-400/90 mb-3 flex items-center justify-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Instant Demo Prompts (Click to test voice & visual sync)</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {demoPrompts.map((item, idx) => (
              <button
                key={idx}
                onClick={() => sendUserPrompt(item.prompt)}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 transition-all text-left flex items-start gap-2.5 group"
              >
                <span className="text-lg">{item.icon}</span>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                    &ldquo;{item.prompt}&rdquo;
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Custom Prompt Input Bar */}
          <form onSubmit={handleCustomSubmit} className="mt-4 flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Or type a question for Aarav (e.g. 'What is the best gift for my team?')"
              className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 shadow-inner"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors flex items-center gap-1.5"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </section>

      {/* Product Showcase Section */}
      <section className="px-4 sm:px-8 max-w-6xl mx-auto w-full pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-400" />
              <span>Auspicious Diwali Treasures</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hand-packaged gifts curated for prosperity, gratitude, and joyous celebrations
            </p>
          </div>
        </div>

        <ProductSpotlight
          products={products}
          spotlightId={spotlightId}
          onAddToCart={handleAddToCart}
          onAskAboutProduct={handleAskAboutProduct}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </section>

      {/* Trust & Festive Perks Banner */}
      <section className="px-4 sm:px-8 max-w-6xl mx-auto w-full mt-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/20 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">100% Desi Ghee & Pure Silver</h4>
              <p className="text-[11px] text-slate-400">Certified purity, freshness, and authentic traditional recipes.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Guaranteed Pre-Diwali Delivery</h4>
              <p className="text-[11px] text-slate-400">Express insured shipping across 19,000+ Indian postal pincodes.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Luxury Keepsake Packaging</h4>
              <p className="text-[11px] text-slate-400">Presented in velvet trunks, gold foils, and eco-friendly terracotta.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Dialogue Transcript Drawer */}
      <LiveTranscript
        messages={messages}
        isOpen={isTranscriptOpen}
        onToggle={() => setIsTranscriptOpen(!isTranscriptOpen)}
      />

      {/* Slide-out Festive Cart */}
      <FestiveCart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onApplyCoupon={handleApplyCoupon}
        onCheckPincode={handleCheckPincode}
        onReset={handleFreshStart}
      />
    </main>
  );
}
