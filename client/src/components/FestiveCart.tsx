'use client';

import React, { useState } from 'react';
import { CartSummary, Product } from '@/types';
import { 
  X, 
  Trash2, 
  Tag, 
  Sparkles, 
  Gift, 
  Truck, 
  CheckCircle2, 
  ArrowRight, 
  QrCode, 
  CreditCard,
  Percent
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface FestiveCartProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartSummary;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onApplyCoupon: (code: string) => void;
  onCheckPincode: (pincode: string) => void;
}

export const FestiveCart: React.FC<FestiveCartProps> = ({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onApplyCoupon,
  onCheckPincode,
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [pincodeInput, setPincodeInput] = useState(cart.pincode || '');
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  if (!isOpen) return null;

  const handleApplyCoupon = (codeToApply?: string) => {
    const code = codeToApply || couponInput;
    if (code.trim()) {
      onApplyCoupon(code.trim().toUpperCase());
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#EF4444', '#10B981', '#FCD34D']
      });
      setCouponInput('');
    }
  };

  const handleSimulatePayment = () => {
    setPaymentDone(true);
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#F59E0B', '#FBBF24', '#DC2626', '#10B981']
    });
  };

  const giftThreshold = 1999;
  const amountNeededForGift = Math.max(0, giftThreshold - cart.subtotal);
  const giftProgress = Math.min(100, (cart.subtotal / giftThreshold) * 100);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-md flex justify-end">
      {/* Slide-out Cart Panel */}
      <div className="w-full max-w-md bg-slate-900 border-l border-amber-500/30 h-full flex flex-col shadow-2xl relative">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Your Diwali Festive Cart</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
              {cart.total_items_count} items
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gift Progress Bar */}
        <div className="p-3 bg-gradient-to-r from-amber-950/40 via-amber-900/30 to-amber-950/40 border-b border-amber-500/20">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-amber-200 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {cart.free_diya_gift ? (
                <span className="font-bold text-emerald-400">Complimentary Brass Diya Set Unlocked!</span>
              ) : (
                <span>Add ₹{amountNeededForGift.toLocaleString('en-IN')} for a Free Brass Diya</span>
              )}
            </span>
            <span className="font-semibold text-amber-400">{Math.round(giftProgress)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
              style={{ width: `${giftProgress}%` }}
            />
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Gift className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-300">Your festive basket is empty</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Speak to Aarav or tap on any treasure in the catalog to add items.
              </p>
            </div>
          ) : (
            cart.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 hover:border-amber-500/20 transition-all"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-14 h-14 rounded-lg object-cover bg-slate-800 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-white truncate">{item.name}</h4>
                  <p className="text-xs font-bold text-amber-400 mt-0.5">
                    ₹{item.price.toLocaleString('en-IN')}
                  </p>
                  
                  {/* Quantity Controller */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="text-xs font-medium text-white px-1">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between self-stretch">
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="text-slate-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-200">
                    ₹{item.total.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))
          )}

          {/* Complimentary Gift item if eligible */}
          {cart.free_diya_gift && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                <Gift className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Free Gift Unlocked</span>
                <p className="text-xs font-semibold text-white">Handcrafted Peacock Brass Diya Set</p>
              </div>
              <span className="text-xs font-bold text-emerald-400 line-through">₹499</span>
              <span className="text-xs font-bold text-emerald-400">FREE</span>
            </div>
          )}

          {/* Festive Coupon Input */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5 mb-2">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Apply Festive Promo Code</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="e.g. DIWALI20"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white uppercase placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={() => handleApplyCoupon()}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
              >
                Apply
              </button>
            </div>

            {/* Quick Coupon Chips */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleApplyCoupon('DIWALI20')}
                className="text-[10px] px-2 py-1 rounded-md bg-slate-800 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 flex items-center gap-1"
              >
                <Percent className="w-3 h-3" />
                <span>DIWALI20 (20% Off)</span>
              </button>
              <button
                onClick={() => handleApplyCoupon('LAKSHMI500')}
                className="text-[10px] px-2 py-1 rounded-md bg-slate-800 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>LAKSHMI500 (₹500 Off)</span>
              </button>
            </div>

            {cart.coupon_code && (
              <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Coupon &apos;{cart.coupon_code}&apos; active: Saved ₹{cart.discount_amount.toLocaleString('en-IN')}!</span>
              </div>
            )}
          </div>

          {/* Delivery Pincode Check */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5 mb-2">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              <span>Pre-Diwali Guaranteed Delivery</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={pincodeInput}
                onChange={(e) => setPincodeInput(e.target.value)}
                placeholder="Enter 6-digit Pincode"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={() => onCheckPincode(pincodeInput)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700 hover:border-amber-400 transition-colors"
              >
                Verify
              </button>
            </div>

            {cart.delivery_info && (
              <div className="mt-2 text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                <p className="font-semibold text-emerald-400">{cart.delivery_info.tier} Confirmed</p>
                <p className="text-slate-300 mt-0.5">{cart.delivery_info.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer & Checkout Total */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <div className="space-y-1.5 text-xs text-slate-400 mb-3">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-slate-200">₹{cart.subtotal.toLocaleString('en-IN')}</span>
            </div>
            {cart.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Festive Discount</span>
                <span>- ₹{cart.discount_amount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Festive Gift Wrapping & Shipping</span>
              <span className="text-emerald-400 font-semibold">FREE</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
              <span>Grand Total</span>
              <span className="text-amber-300 text-base">₹{cart.total.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <button
            disabled={cart.items.length === 0}
            onClick={() => setCheckoutModalOpen(true)}
            className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            <span>Proceed to Diwali Checkout</span>
            <ArrowRight className="w-4 h-4 text-slate-950" />
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => { setCheckoutModalOpen(false); setPaymentDone(false); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {!paymentDone ? (
              <div>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-2 text-amber-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Complete Your Festive Order</h3>
                  <p className="text-xs text-slate-400 mt-1">Guaranteed delivery before Diwali with premium packaging</p>
                </div>

                <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 text-xs mb-4">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Order Total:</span>
                    <span className="font-bold text-amber-300 text-sm">₹{cart.total.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Items:</span>
                    <span>{cart.total_items_count} products</span>
                  </div>
                  {cart.coupon_code && (
                    <div className="flex justify-between text-emerald-400 mt-1">
                      <span>Applied Code:</span>
                      <span>{cart.coupon_code}</span>
                    </div>
                  )}
                </div>

                {/* Instant Mock Payment Options */}
                <div className="space-y-2 mb-5">
                  <button
                    onClick={handleSimulatePayment}
                    className="w-full p-3 rounded-xl bg-slate-800/80 border border-amber-500/30 hover:border-amber-400 text-left flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <QrCode className="w-5 h-5 text-amber-400" />
                      <div>
                        <p className="text-xs font-bold text-white group-hover:text-amber-300">Instant UPI (GPay / PhonePe / Paytm)</p>
                        <p className="text-[10px] text-slate-400">Scan QR or Pay directly</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">Fastest</span>
                  </button>

                  <button
                    onClick={handleSimulatePayment}
                    className="w-full p-3 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-amber-400 text-left flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <CreditCard className="w-5 h-5 text-amber-400" />
                      <div>
                        <p className="text-xs font-bold text-white group-hover:text-amber-300">Credit / Debit Card / Netbanking</p>
                        <p className="text-[10px] text-slate-400">All major Indian banks accepted</p>
                      </div>
                    </div>
                  </button>
                </div>

                <button
                  onClick={handleSimulatePayment}
                  className="w-full py-3 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/30 hover:opacity-95"
                >
                  Pay ₹{cart.total.toLocaleString('en-IN')} & Confirm Order
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto mb-4 text-emerald-400 animate-bounce">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-white">Shubh Deepavali! Order Confirmed!</h3>
                <p className="text-xs text-amber-300 mt-1 font-semibold">Order ID: #DWL-{Math.floor(100000 + Math.random() * 900000)}</p>
                <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto">
                  Your festive gift hamper is being hand-packaged with love and auspicious blessings.
                </p>

                <div className="mt-6">
                  <button
                    onClick={() => { setCheckoutModalOpen(false); onClose(); setPaymentDone(false); }}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md"
                  >
                    Continue Celebrating & Shopping
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
