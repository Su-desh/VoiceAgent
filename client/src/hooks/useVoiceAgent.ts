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
  const [interimText, setInterimText] = useState<string>('');
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

  // Audio Context & Scheduling refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextScheduledTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const completionTimerRef = useRef<any>(null);

  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  const continuousModeRef = useRef<boolean>(continuousMode);
  continuousModeRef.current = continuousMode;

  const stateRef = useRef<AgentState>(state);
  stateRef.current = state;

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
      isPlayingRef.current = true;
      setState('speaking');
      setAudioLevel(0.65);
    };

    utterance.onend = () => {
      isPlayingRef.current = false;
      setAudioLevel(0);
      if (continuousModeRef.current) {
        setTimeout(() => {
          startListeningRef.current();
        }, 350);
      } else {
        setState('idle');
      }
    };

    utterance.onerror = () => {
      isPlayingRef.current = false;
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

  // Schedule raw 24kHz PCM chunk with time-scheduled jitter buffer
  const scheduleAudioChunk = useCallback((base64Data: string, sampleRate = 24000) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

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

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      // Start time scheduling
      const now = ctx.currentTime;
      if (nextScheduledTimeRef.current < now) {
        nextScheduledTimeRef.current = now;
      }
      const startTime = nextScheduledTimeRef.current;
      source.start(startTime);
      nextScheduledTimeRef.current = startTime + audioBuffer.duration;

      isPlayingRef.current = true;
      setState('speaking');
      activeSourcesRef.current.push(source);

      // Monitor audio level
      setAudioLevel(0.7);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      };
    } catch (err) {
      console.error('Error scheduling audio chunk:', err);
    }
  }, []);

  // Handle Gemini Turn Complete
  const onGeminiTurnComplete = useCallback(() => {
    if (!audioContextRef.current) {
      isPlayingRef.current = false;
      setAudioLevel(0);
      if (continuousModeRef.current) {
        setTimeout(() => startListeningRef.current(), 350);
      } else {
        setState('idle');
      }
      return;
    }

    const ctx = audioContextRef.current;
    const remainingTime = Math.max(0, nextScheduledTimeRef.current - ctx.currentTime);
    const delayMs = Math.round(remainingTime * 1000) + 350;

    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
    }

    completionTimerRef.current = setTimeout(() => {
      isPlayingRef.current = false;
      setAudioLevel(0);
      if (continuousModeRef.current) {
        startListeningRef.current();
      } else {
        setState('idle');
      }
    }, delayMs);
  }, []);

  // Stop / interrupt playing audio
  const stopPlayback = useCallback(() => {
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch (e) {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    nextScheduledTimeRef.current = 0;

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
              scheduleAudioChunk(data.data, data.rate || 24000);
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
            } else if (data.type === 'TURN_COMPLETE') {
              onGeminiTurnComplete();
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
  }, [scheduleAudioChunk, onGeminiTurnComplete, handleUiEvent, appendMessage, speakText, stopPlayback]);

  // Send a prompt to Aarav (multi-turn conversation)
  const sendUserPrompt = useCallback(
    async (promptText: string) => {
      if (!promptText.trim()) return;

      stopPlayback();
      appendMessage('user', promptText);
      setState('thinking');
      setInterimText('');

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

  // Start Microphone capture with auto-recovery from no-speech
  const startListening = useCallback(() => {
    if (isPlayingRef.current) return; // Don't listen while agent is speaking

    setState('listening');
    isListeningRef.current = true;
    setInterimText('');

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
        recognition.interimResults = true; // Show words as user speaks
        recognition.lang = 'en-IN';

        recognition.onstart = () => {
          setState('listening');
          setAudioLevel(0.4);
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }

          if (interim) {
            setInterimText(interim);
          }

          if (final.trim()) {
            isListeningRef.current = false;
            setInterimText('');
            sendUserPrompt(final.trim());
          }
        };

        recognition.onerror = (e: any) => {
          if (e.error === 'no-speech') {
            // User just paused to think! If in continuous mode and agent not speaking, auto-resume
            setInterimText('');
            if (continuousModeRef.current && !isPlayingRef.current) {
              setTimeout(() => {
                if (continuousModeRef.current && !isPlayingRef.current) {
                  startListening();
                }
              }, 200);
            }
            return;
          }
          if (e.error === 'aborted') {
            return;
          }
          console.warn('Speech recognition status:', e.error);
          isListeningRef.current = false;
          setAudioLevel(0);
          setInterimText('');
          setState('idle');
        };

        recognition.onend = () => {
          isListeningRef.current = false;
          setAudioLevel(0);
          // If ended without speech and continuous mode active, seamlessly restart
          if (continuousModeRef.current && !isPlayingRef.current && stateRef.current === 'listening') {
            setTimeout(() => {
              if (continuousModeRef.current && !isPlayingRef.current) {
                startListening();
              }
            }, 200);
          } else if (!isPlayingRef.current && stateRef.current !== 'thinking') {
            setState('idle');
          }
        };

        try {
          recognition.start();
        } catch (e) {
          console.warn('Could not start recognition:', e);
          setState('idle');
        }
      }
    }
  }, [sendUserPrompt]);

  startListeningRef.current = startListening;

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setInterimText('');
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
      stopPlayback();
      startListening();
    }
  }, [state, startListening, stopListening, stopPlayback]);

  const toggleContinuousMode = useCallback(() => {
    setContinuousMode((prev) => {
      const next = !prev;
      continuousModeRef.current = next;
      if (!next && state === 'listening') {
        stopListening();
      }
      return next;
    });
  }, [state, stopListening]);

  return {
    state,
    audioLevel,
    interimText,
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
