'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AgentState, Message, CartSummary, Product } from '@/types';

interface UseVoiceAgentProps {
  onSpotlightProduct: (product: Product) => void;
  onUpdateCart: (cart: CartSummary) => void;
  onOpenCheckout: (cart: CartSummary) => void;
  onCouponApplied: (payload: any) => void;
}

export function useVoiceAgent({
  onSpotlightProduct,
  onUpdateCart,
  onOpenCheckout,
  onCouponApplied
}: UseVoiceAgentProps) {
  const [state, setState] = useState<AgentState>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "Shubh Deepavali! Welcome to the Grand Festive Showcase. I'm Aarav, your personal gifting concierge. Who are you shopping for today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [liveMode, setLiveMode] = useState<boolean>(true);

  // Audio Context & WebSocket refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);

  // Helper to append message
  const appendMessage = useCallback((sender: 'user' | 'agent' | 'system', text: string, toolCall?: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        sender,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCall
      }
    ]);
  }, []);

  // Handle incoming UI events from tools
  const handleUiEvent = useCallback((event: any) => {
    if (!event) return;
    const { type, payload } = event;

    if (type === 'SPOTLIGHT_PRODUCT' && payload?.product) {
      onSpotlightProduct(payload.product);
    } else if (type === 'CART_UPDATED' && payload?.cart) {
      onUpdateCart(payload.cart);
    } else if (type === 'COUPON_APPLIED' && payload) {
      onCouponApplied(payload);
      if (payload.cart) onUpdateCart(payload.cart);
    } else if (type === 'PINCODE_CHECKED' && payload?.delivery) {
      // delivery verified
    } else if (type === 'OPEN_CHECKOUT' && payload?.cart) {
      onOpenCheckout(payload.cart);
    }
  }, [onSpotlightProduct, onUpdateCart, onCouponApplied, onOpenCheckout]);

  // Audio playback queue worker for 24kHz Gemini Live audio
  const playNextAudioChunk = useCallback(() => {
    if (audioQueueRef.current.length === 0 || !audioContextRef.current) {
      isPlayingRef.current = false;
      setState((prev) => (prev === 'speaking' ? 'idle' : prev));
      setAudioLevel(0);
      return;
    }

    isPlayingRef.current = true;
    setState('speaking');

    const buffer = audioQueueRef.current.shift()!;
    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    currentSourceRef.current = source;

    // Connect to volume level analyzer
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyser.connect(ctx.destination);

    // Audio level simulation during playback
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animId: number;
    const checkAudioLevel = () => {
      if (!isPlayingRef.current) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length / 255;
      setAudioLevel(avg);
      animId = requestAnimationFrame(checkAudioLevel);
    };
    animId = requestAnimationFrame(checkAudioLevel);

    source.onended = () => {
      cancelAnimationFrame(animId);
      currentSourceRef.current = null;
      playNextAudioChunk();
    };

    source.start();
  }, []);

  // Enqueue 24kHz raw PCM from base64 string
  const enqueueAudioChunk = useCallback((base64Data: string, sampleRate = 24000) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;

      const binaryStr = window.atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32Array.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32Array);

      audioQueueRef.current.push(audioBuffer);

      if (!isPlayingRef.current) {
        playNextAudioChunk();
      }
    } catch (err) {
      console.error('Error decoding audio chunk:', err);
    }
  }, [playNextAudioChunk]);

  // Stop / interrupt playing audio
  const stopPlayback = useCallback(() => {
    audioQueueRef.current = [];
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        // ignore if already ended
      }
      currentSourceRef.current = null;
    }
    isPlayingRef.current = false;
    setAudioLevel(0);
    setState('idle');
  }, []);

  // Connect to backend WebSocket
  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8000/ws/live/default`;
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log('Connected to Diwali Voice Agent server');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'AUDIO_CHUNK' && data.data) {
            enqueueAudioChunk(data.data, data.rate || 24000);
          } else if (data.type === 'AGENT_TEXT' && data.text) {
            appendMessage('agent', data.text);
          } else if (data.type === 'AGENT_RESPONSE' && data.text) {
            appendMessage('agent', data.text);
            if (data.ui_events) {
              data.ui_events.forEach(handleUiEvent);
            }
            if (data.cart) {
              onUpdateCart(data.cart);
            }
            // Speak text via synthesis if not using live audio chunks
            speakText(data.text);
          } else if (data.type === 'UI_EVENT' && data.event) {
            handleUiEvent(data.event);
          } else if (data.type === 'INTERRUPTED') {
            stopPlayback();
          } else if (data.type === 'SYSTEM_INFO') {
            console.log('Server info:', data.message);
          }
        } catch (e) {
          console.error('Error handling WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket closed');
      };

      ws.onerror = (err) => {
        console.warn('WebSocket error, running in local fallback mode:', err);
        setIsConnected(false);
      };
    } catch (e) {
      console.warn('Failed to initialize WebSocket:', e);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enqueueAudioChunk, handleUiEvent, appendMessage, onUpdateCart, stopPlayback]);

  // Speech synthesis fallback helper
  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.lang = 'en-IN';

    // Find Indian English voice if available, otherwise friendly English
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('en-IN')) || 
                           voices.find(v => v.lang.includes('en-GB')) || 
                           voices.find(v => v.lang.includes('en-US'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setState('speaking');
      setAudioLevel(0.65);
    };

    utterance.onend = () => {
      setState('idle');
      setAudioLevel(0);
    };

    utterance.onerror = () => {
      setState('idle');
      setAudioLevel(0);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  // Send a prompt to Aarav (via WebSocket or HTTP /api/chat fallback)
  const sendUserPrompt = useCallback(async (promptText: string) => {
    if (!promptText.trim()) return;

    stopPlayback();
    appendMessage('user', promptText);
    setState('thinking');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'USER_TEXT',
        text: promptText
      }));
    } else {
      // Direct REST fallback
      try {
        const res = await fetch('http://localhost:8000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: promptText,
            session_id: 'default'
          })
        });
        const data = await res.json();
        appendMessage('agent', data.reply);
        if (data.ui_events) {
          data.ui_events.forEach(handleUiEvent);
        }
        if (data.cart) {
          onUpdateCart(data.cart);
        }
        speakText(data.reply);
      } catch (err) {
        console.error('Chat error:', err);
        setState('idle');
      }
    }
  }, [stopPlayback, appendMessage, handleUiEvent, onUpdateCart, speakText]);

  // Start Microphone capture
  const startListening = useCallback(async () => {
    stopPlayback();
    setState('listening');

    // Use Web Speech API for voice transcription
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-IN';

        recognition.onstart = () => {
          setState('listening');
          setAudioLevel(0.4);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            sendUserPrompt(transcript);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition event:', e.error);
          setState('idle');
          setAudioLevel(0);
        };

        recognition.onend = () => {
          if (state === 'listening') {
            setState('idle');
            setAudioLevel(0);
          }
        };

        try {
          recognition.start();
        } catch (e) {
          console.warn('Could not start recognition:', e);
        }
      }
    }
  }, [stopPlayback, sendUserPrompt, state]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setState('idle');
    setAudioLevel(0);
  }, []);

  const toggleListening = useCallback(() => {
    if (state === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  }, [state, startListening, stopListening]);

  return {
    state,
    audioLevel,
    messages,
    isConnected,
    isMuted,
    setIsMuted,
    liveMode,
    setLiveMode,
    startListening,
    stopListening,
    toggleListening,
    sendUserPrompt,
    stopPlayback
  };
}
