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
  const [continuousMode, setContinuousMode] = useState<boolean>(true);

  // Store latest callbacks in ref to avoid reconnecting WebSocket
  const callbacksRef = useRef({
    onSpotlightProduct,
    onUpdateCart,
    onOpenCheckout,
    onCouponApplied
  });

  useEffect(() => {
    callbacksRef.current = {
      onSpotlightProduct,
      onUpdateCart,
      onOpenCheckout,
      onCouponApplied
    };
  }, [onSpotlightProduct, onUpdateCart, onOpenCheckout, onCouponApplied]);

  // Audio Context & WebSocket refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  const continuousModeRef = useRef<boolean>(continuousMode);
  continuousModeRef.current = continuousMode;

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

  // Forward declarations for circular dependencies
  const startListeningRef = useRef<() => void>(() => {});

  // Speech synthesis fallback helper with authentic MALE voice
  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 0.92; // Slightly deeper, natural male pitch
    utterance.lang = 'en-IN';

    // Prioritize MALE English / Indian voices for Aarav
    const voices = window.speechSynthesis.getVoices();
    const isMale = (v: SpeechSynthesisVoice) => {
      const name = v.name.toLowerCase();
      return (
        name.includes('male') ||
        name.includes('david') ||
        name.includes('george') ||
        name.includes('rishi') ||
        name.includes('prabhat') ||
        name.includes('james') ||
        name.includes('guy') ||
        name.includes('alex') ||
        name.includes('daniel')
      ) && !name.includes('female');
    };
    const isFemale = (v: SpeechSynthesisVoice) => {
      const name = v.name.toLowerCase();
      return (
        name.includes('female') ||
        name.includes('zira') ||
        name.includes('veena') ||
        name.includes('heera') ||
        name.includes('samantha') ||
        name.includes('karen') ||
        name.includes('victoria')
      );
    };

    const preferredVoice =
      voices.find((v) => v.lang.includes('en') && isMale(v)) ||
      voices.find((v) => v.lang.includes('en-IN') && !isFemale(v)) ||
      voices.find((v) => v.lang.includes('en-GB') && !isFemale(v)) ||
      voices.find((v) => v.lang.includes('en') && !isFemale(v)) ||
      voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setState('speaking');
      setAudioLevel(0.65);
    };

    utterance.onend = () => {
      setAudioLevel(0);
      if (continuousModeRef.current) {
        // Automatically resume listening for user response after Aarav finishes speaking
        setTimeout(() => {
          startListeningRef.current();
        }, 400);
      } else {
        setState('idle');
      }
    };

    utterance.onerror = () => {
      setAudioLevel(0);
      setState('idle');
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  // Handle incoming UI events from tools
  const handleUiEvent = useCallback((event: any) => {
    if (!event) return;
    const { type, payload } = event;
    const cb = callbacksRef.current;

    if (type === 'SPOTLIGHT_PRODUCT' && payload?.product) {
      cb.onSpotlightProduct(payload.product);
    } else if (type === 'CART_UPDATED' && payload?.cart) {
      cb.onUpdateCart(payload.cart);
    } else if (type === 'COUPON_APPLIED' && payload) {
      cb.onCouponApplied(payload);
      if (payload.cart) cb.onUpdateCart(payload.cart);
    } else if (type === 'OPEN_CHECKOUT' && payload?.cart) {
      cb.onOpenCheckout(payload.cart);
    }
  }, []);

  // Audio playback queue worker for 24kHz Gemini Live audio
  const playNextAudioChunk = useCallback(() => {
    if (audioQueueRef.current.length === 0 || !audioContextRef.current) {
      isPlayingRef.current = false;
      setAudioLevel(0);
      if (continuousModeRef.current) {
        setTimeout(() => {
          startListeningRef.current();
        }, 400);
      } else {
        setState((prev) => (prev === 'speaking' ? 'idle' : prev));
      }
      return;
    }

    isPlayingRef.current = true;
    setState('speaking');

    const buffer = audioQueueRef.current.shift()!;
    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    currentSourceRef.current = source;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyser.connect(ctx.destination);

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
        // ignore
      }
      currentSourceRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isPlayingRef.current = false;
    setAudioLevel(0);
    setState('idle');
  }, []);

  // Connect to backend WebSocket once on mount
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isUnmounted = false;

    const connectWebSocket = () => {
      if (typeof window === 'undefined') return;
      const host = window.location.hostname || 'localhost';
      const wsUrl = `ws://${host}:8000/ws/live/default`;

      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          setIsConnected(true);
          console.log('Connected to Shubh Diwali Voice Agent server');
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
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
                callbacksRef.current.onUpdateCart(data.cart);
              }
              speakText(data.text);
            } else if (data.type === 'UI_EVENT' && data.event) {
              handleUiEvent(data.event);
            } else if (data.type === 'INTERRUPTED') {
              stopPlayback();
            } else if (data.type === 'SYSTEM_INFO') {
              console.log('Voice Concierge info:', data.message);
            }
          } catch (e) {
            console.error('Error handling WebSocket message:', e);
          }
        };

        ws.onclose = () => {
          if (!isUnmounted) {
            setIsConnected(false);
          }
        };

        ws.onerror = () => {
          if (!isUnmounted) {
            setIsConnected(false);
          }
        };
      } catch (e) {
        console.warn('Could not establish WebSocket connection, using REST fallback');
      }
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (ws) {
        ws.close();
      }
    };
  }, [enqueueAudioChunk, handleUiEvent, appendMessage, speakText, stopPlayback]);

  // Send a prompt to Aarav (multi-turn conversation)
  const sendUserPrompt = useCallback(
    async (promptText: string) => {
      if (!promptText.trim()) return;

      stopPlayback();
      appendMessage('user', promptText);
      setState('thinking');

      // Build context history from previous turns
      const history = messagesRef.current
        .filter((m) => m.sender === 'user' || m.sender === 'agent')
        .slice(-8)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          content: m.text
        }));

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'USER_TEXT',
            text: promptText,
            history
          })
        );
      } else {
        // Direct REST fallback
        try {
          const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
          const res = await fetch(`http://${host}:8000/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: promptText,
              session_id: 'default',
              history
            })
          });
          const data = await res.json();
          appendMessage('agent', data.reply);
          if (data.ui_events) {
            data.ui_events.forEach(handleUiEvent);
          }
          if (data.cart) {
            callbacksRef.current.onUpdateCart(data.cart);
          }
          speakText(data.reply);
        } catch (err) {
          console.error('Chat error:', err);
          setState('idle');
        }
      }
    },
    [stopPlayback, appendMessage, handleUiEvent, speakText]
  );

  // Start Microphone capture
  const startListening = useCallback(() => {
    stopPlayback();
    setState('listening');
    isListeningRef.current = true;

    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (e) {
            // ignore
          }
        }

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
            isListeningRef.current = false;
            sendUserPrompt(transcript);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition status:', e.error);
          isListeningRef.current = false;
          setAudioLevel(0);
          if (e.error !== 'no-speech') {
            setState('idle');
          }
        };

        recognition.onend = () => {
          isListeningRef.current = false;
          setAudioLevel(0);
          setState((prev) => (prev === 'listening' ? 'idle' : prev));
        };

        try {
          recognition.start();
        } catch (e) {
          console.warn('Could not start recognition:', e);
          setState('idle');
        }
      }
    }
  }, [stopPlayback, sendUserPrompt]);

  startListeningRef.current = startListening;

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
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

  const toggleContinuousMode = useCallback(() => {
    setContinuousMode((prev) => !prev);
  }, []);

  return {
    state,
    audioLevel,
    messages,
    isConnected,
    isMuted,
    setIsMuted,
    continuousMode,
    toggleContinuousMode,
    startListening,
    stopListening,
    toggleListening,
    sendUserPrompt,
    stopPlayback
  };
}
