'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AgentState, Message, CartSummary, Product } from '@/types';
import { getApiUrl, getWsUrl } from '@/lib/apiConfig';

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
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);

  const nextScheduledTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const completionTimerRef = useRef<any>(null);
  const lastAudioPacketTimeRef = useRef<number>(0);
  const thinkingStartTimeRef = useRef<number>(0);
  const silenceTimeoutRef = useRef<any>(null);
  const accumulatedSpeechRef = useRef<string>('');

  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  const continuousModeRef = useRef<boolean>(continuousMode);
  continuousModeRef.current = continuousMode;

  const stateRef = useRef<AgentState>(state);
  stateRef.current = state;

  // Track whether user has initiated interaction (prevents auto-listening before user gesture)
  const hasInteractedRef = useRef<boolean>(false);

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
    utterance.pitch = 0.92; // Natural male timbre
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
      if (continuousModeRef.current && hasInteractedRef.current) {
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

      const now = ctx.currentTime;
      if (nextScheduledTimeRef.current < now) {
        nextScheduledTimeRef.current = now;
      }
      const startTime = nextScheduledTimeRef.current;
      source.start(startTime);
      nextScheduledTimeRef.current = startTime + audioBuffer.duration;

      isPlayingRef.current = true;
      lastAudioPacketTimeRef.current = Date.now();
      setState('speaking');
      activeSourcesRef.current.push(source);
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
      if (continuousModeRef.current && hasInteractedRef.current) {
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
      if (continuousModeRef.current && hasInteractedRef.current) {
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
  }, []);

  // Connect to backend WebSocket once on mount
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isUnmounted = false;

    const connectWebSocket = () => {
      if (typeof window === 'undefined') return;
      const wsUrl = getWsUrl('default');

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
            } else if (data.type === 'SESSION_RESET') {
              if (data.cart) {
                callbacksRef.current.onUpdateCart(data.cart);
              }
              setInterimText('');
              accumulatedSpeechRef.current = '';
              setState('idle');
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

      hasInteractedRef.current = true;
      stopPlayback();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }

      appendMessage('user', promptText);
      thinkingStartTimeRef.current = Date.now();
      setState('thinking');
      setInterimText('');
      accumulatedSpeechRef.current = '';

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
          const res = await fetch(`${getApiUrl()}/api/chat`, {
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

  // Monitor real mic volume level in an animation loop
  const startMicVolumeMonitor = useCallback(() => {
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
    }

    const checkVolume = () => {
      if (stateRef.current !== 'listening') {
        setAudioLevel(0);
        return;
      }

      if (micAnalyserRef.current) {
        const dataArray = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
        micAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = Math.min(1, (sum / dataArray.length) / 80);
        // Add minimal ambient pulse (0.1) so user knows mic is active
        setAudioLevel(Math.max(0.08, avg));
      } else {
        setAudioLevel(0.2);
      }

      micAnimFrameRef.current = requestAnimationFrame(checkVolume);
    };

    micAnimFrameRef.current = requestAnimationFrame(checkVolume);
  }, []);

  // Start Continuous Microphone capture with real audio level metering
  const startListening = useCallback(async () => {
    if (isPlayingRef.current) return;

    hasInteractedRef.current = true;
    setState('listening');
    isListeningRef.current = true;
    setInterimText('');
    accumulatedSpeechRef.current = '';

    // Initialize real microphone stream for audio level visualizer
    if (typeof window !== 'undefined' && navigator.mediaDevices && !micStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        micStreamRef.current = stream;

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        micAnalyserRef.current = analyser;
      } catch (e) {
        console.warn('Could not open mic volume analyzer, using fallback visualization:', e);
      }
    }

    startMicVolumeMonitor();

    // Initialize Continuous Speech Recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            // ignore
          }
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true; // Continuous listening - no 5-second dropouts!
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onstart = () => {
          setState('listening');
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript + ' ';
            } else {
              interim += transcript;
            }
          }

          if (final) {
            accumulatedSpeechRef.current = (accumulatedSpeechRef.current + ' ' + final).trim();
          }

          const currentText = (accumulatedSpeechRef.current + ' ' + interim).trim();
          if (currentText) {
            setInterimText(currentText);
          }

          // Debounce: when user pauses for 900ms after speaking, send prompt!
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }

          silenceTimeoutRef.current = setTimeout(() => {
            const textToSend = (accumulatedSpeechRef.current + ' ' + interim).trim();
            if (textToSend && isListeningRef.current) {
              isListeningRef.current = false;
              sendUserPrompt(textToSend);
            }
          }, 900);
        };

        recognition.onerror = (e: any) => {
          if (e.error === 'no-speech' || e.error === 'aborted') {
            return;
          }
          console.warn('Speech recognition warning:', e.error);
        };

        recognition.onend = () => {
          // If in continuous mode and still supposed to be listening, keep it open!
          if (continuousModeRef.current && !isPlayingRef.current && stateRef.current === 'listening') {
            try {
              recognition.start();
            } catch (err) {
              // ignore already running
            }
          }
        };

        try {
          recognition.start();
        } catch (e) {
          console.warn('SpeechRecognition start notice:', e);
        }
      }
    }
  }, [sendUserPrompt, startMicVolumeMonitor]);

  startListeningRef.current = startListening;

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setInterimText('');
    accumulatedSpeechRef.current = '';
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
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
    if (state === 'speaking') {
      stopPlayback();
      if (continuousModeRef.current) {
        startListening();
      } else {
        setState('idle');
      }
    } else if (state === 'listening') {
      stopListening();
    } else {
      stopPlayback();
      startListening();
    }
  }, [state, startListening, stopListening, stopPlayback]);

  // Active unfreeze watchdog to guarantee UI never gets stuck
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const ctx = audioContextRef.current;

      // If in speaking state but all scheduled audio has finished and no new audio for > 2.5s
      if (stateRef.current === 'speaking') {
        const audioFinished = ctx ? ctx.currentTime >= nextScheduledTimeRef.current : true;
        const noRecentAudio = now - lastAudioPacketTimeRef.current > 2500;
        if (audioFinished && noRecentAudio && activeSourcesRef.current.length === 0) {
          isPlayingRef.current = false;
          setAudioLevel(0);
          if (continuousModeRef.current && hasInteractedRef.current) {
            startListeningRef.current();
          } else {
            setState('idle');
          }
        }
      }

      // If in thinking state for > 7s without server response, recover gracefully
      if (stateRef.current === 'thinking' && now - thinkingStartTimeRef.current > 7000) {
        setState('idle');
        setInterimText('');
      }
    }, 400);

    return () => clearInterval(timer);
  }, []);

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

  // Clean Fresh Start: Resets conversation, cart, and restores idle dormant state
  const resetAgent = useCallback(async () => {
    hasInteractedRef.current = false;
    stopPlayback();
    stopListening();
    setState('idle');
    setAudioLevel(0);
    setInterimText('');
    accumulatedSpeechRef.current = '';

    setMessages([
      {
        id: 'welcome',
        sender: 'agent',
        text: "Shubh Deepavali! Welcome to the Grand Festive Showcase. I'm Aarav, your personal gifting concierge. Who are you shopping for today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    const emptyCart: CartSummary = {
      items: [],
      total_items_count: 0,
      subtotal: 0,
      discount_amount: 0,
      coupon_code: null,
      free_diya_gift: false,
      total: 0,
      pincode: null,
      delivery_info: null
    };
    callbacksRef.current.onUpdateCart(emptyCart);

    // Notify backend WebSocket to reset session
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'RESET_SESSION' }));
    }

    // Call REST endpoint as well to guarantee reset
    try {
      await fetch(`${getApiUrl()}/api/session/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: 'default' })
      });
    } catch (e) {
      // ignore
    }
  }, [stopPlayback, stopListening]);

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
    stopPlayback,
    resetAgent
  };
}
