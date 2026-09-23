'use client';

import React, { useEffect, useRef } from 'react';
import { AgentState } from '@/types';
import { Sparkles, Mic, Volume2, Loader2 } from 'lucide-react';

interface AudioVisualizerProps {
  state: AgentState;
  audioLevel: number; // 0 to 1
  onClick?: () => void;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ state, audioLevel, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Base radius
      const baseRadius = 55;
      const dynamicRadius = baseRadius + audioLevel * 30;

      // Outer golden glow rings
      const numRings = state === 'speaking' || state === 'listening' ? 4 : 2;
      for (let i = numRings; i >= 1; i--) {
        const ringRadius = dynamicRadius + i * 16 + Math.sin(phase + i) * 6;
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.max(10, ringRadius), 0, Math.PI * 2);
        
        let strokeAlpha = (0.25 / i) * (0.5 + audioLevel * 0.8);
        if (state === 'listening') {
          ctx.strokeStyle = `rgba(245, 158, 11, ${strokeAlpha * 1.5})`; // Warm Gold
        } else if (state === 'speaking') {
          ctx.strokeStyle = `rgba(251, 191, 36, ${strokeAlpha * 1.8})`; // Bright Gold
        } else if (state === 'thinking') {
          ctx.strokeStyle = `rgba(239, 68, 68, ${strokeAlpha * 1.2})`; // Festive Ruby
        } else {
          ctx.strokeStyle = `rgba(217, 119, 6, ${strokeAlpha * 0.4})`;
        }
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Inner glowing core
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 5,
        centerX, centerY, dynamicRadius
      );
      if (state === 'listening') {
        gradient.addColorStop(0, 'rgba(251, 191, 36, 0.9)');
        gradient.addColorStop(0.5, 'rgba(217, 119, 6, 0.5)');
        gradient.addColorStop(1, 'rgba(180, 83, 9, 0)');
      } else if (state === 'speaking') {
        gradient.addColorStop(0, 'rgba(254, 240, 138, 1)');
        gradient.addColorStop(0.4, 'rgba(245, 158, 11, 0.7)');
        gradient.addColorStop(1, 'rgba(180, 83, 9, 0)');
      } else if (state === 'thinking') {
        gradient.addColorStop(0, 'rgba(252, 165, 165, 0.9)');
        gradient.addColorStop(0.6, 'rgba(220, 38, 38, 0.4)');
        gradient.addColorStop(1, 'rgba(153, 27, 27, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.5)');
        gradient.addColorStop(0.6, 'rgba(180, 83, 9, 0.2)');
        gradient.addColorStop(1, 'rgba(120, 53, 15, 0)');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, dynamicRadius, 0, Math.PI * 2);
      ctx.fill();

      // Floating golden sparks
      if (state === 'speaking' || state === 'listening') {
        for (let p = 0; p < 8; p++) {
          const sparkAngle = phase * 1.5 + (p * Math.PI) / 4;
          const sparkDist = dynamicRadius + 22 + Math.sin(phase * 2 + p) * 12;
          const sx = centerX + Math.cos(sparkAngle) * sparkDist;
          const sy = centerY + Math.sin(sparkAngle) * sparkDist;

          ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
          ctx.beginPath();
          ctx.arc(sx, sy, 2 + (p % 2), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      phase += 0.05 + audioLevel * 0.08;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [state, audioLevel]);

  const getStatusBadge = () => {
    switch (state) {
      case 'listening':
        return audioLevel > 0.12 ? (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/25 border border-emerald-400 text-emerald-300 text-sm font-semibold animate-pulse shadow-lg shadow-emerald-950/40">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
            <span>Hearing your voice...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-sm font-medium animate-pulse shadow-lg shadow-amber-900/30">
            <Mic className="w-4 h-4 text-amber-400" />
            <span>Listening... Speak anytime</span>
          </div>
        );
      case 'thinking':
        return (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/20 border border-red-400/40 text-red-300 text-sm font-medium animate-pulse shadow-lg shadow-red-900/30">
            <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
            <span>Aarav is curating gifts...</span>
          </div>
        );
      case 'speaking':
        return (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-sm font-medium shadow-lg shadow-emerald-900/30">
            <Volume2 className="w-4 h-4 text-emerald-400 animate-bounce" />
            <span>Aarav is speaking</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/80 border border-amber-500/30 text-amber-200/80 text-sm font-medium hover:border-amber-400 cursor-pointer transition-all">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Tap Diya to Speak to Aarav</span>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      {/* Visualizer Canvas Container */}
      <div 
        onClick={onClick}
        className="relative w-56 h-56 flex items-center justify-center cursor-pointer group"
      >
        <canvas
          ref={canvasRef}
          width={240}
          height={240}
          className="absolute inset-0 pointer-events-none"
        />

        {/* Center Glowing Diya Icon Motif */}
        <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-b from-amber-400/30 to-amber-950/80 border border-amber-400/50 flex flex-col items-center justify-center shadow-2xl shadow-amber-500/40 backdrop-blur-sm group-hover:scale-105 group-hover:border-amber-300 transition-all duration-300">
          {/* Traditional Flame Graphic */}
          <div className="relative mb-1">
            <div className={`w-5 h-8 bg-gradient-to-t from-orange-500 via-amber-300 to-yellow-100 rounded-full blur-[1px] ${state === 'speaking' || state === 'listening' ? 'scale-125 animate-pulse' : 'scale-100'}`} style={{ borderRadius: '50% 50% 35% 35% / 60% 60% 40% 40%' }} />
            <div className="absolute inset-0 w-3 h-5 mx-auto my-auto bg-white rounded-full blur-[0.5px] opacity-80" />
          </div>
          {/* Brass Diya Base */}
          <div className="w-12 h-3.5 bg-gradient-to-r from-amber-600 via-amber-300 to-amber-700 rounded-b-full border-t border-amber-200/80 shadow-inner" />
        </div>
      </div>

      {/* Dynamic Status Pill */}
      <div className="mt-3">
        {getStatusBadge()}
      </div>
    </div>
  );
};
