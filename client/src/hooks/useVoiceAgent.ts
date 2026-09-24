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

  // Audio Context & Output Pipeline refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  // Microphone stream & visualizer analyser
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);

  // Playback & Timing state
  const nextScheduledTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isAgentSpeakingRef = useRef<boolean>(false);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const completionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAudioPacketTimeRef = useRef<number>(0);
  const thinkingStartTimeRef = useRef<number>(0);

  // Speech Recognition state
  const recognitionRef = useRef<any>(null);
  const isRecognitionRunningRef = useRef<boolean>(false);
  const shouldListenRef = useRef<boolean>(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedSpeechRef = useRef<string>('');
  const currentTurnMessageIdRef = useRef<string | null>(null);

  // Synchronous references
  const stateRef = useRef<AgentState>(state);
  const continuousModeRef = useRef<boolean>(continuousMode);
  continuousModeRef.current = continuousMode;
  const hasInteractedRef = useRef<boolean>(false);

  const updateState = useCallback((newState: AgentState) => {
    stateRef.current = newState;
    setState(newState);
  }, []);

  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;

  // Helper to append message
  const appendMessage = useCallback((sender: 'user' | 'agent' | 'system', text: string, toolCall?: string) => {
    const id = Math.random().toString(36).substring(7);
    setMessages((prev) => [
      ...prev,
      {
        id,
        sender,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        toolCall
      }
    ]);
    return id;
  }, []);

  // Forward declarations
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});

  // Get or initialize reusable master Web Audio pipeline
  const getAudioPipeline = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(1.0, ctx.currentTime);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;

      masterGain.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      masterGainRef.current = masterGain;
      outputAnalyserRef.current = analyser;
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return {
      ctx,
      masterGain: masterGainRef.current!,
      analyser: outputAnalyserRef.current!
    };
  }, []);

  // Stop / interrupt playing audio smoothly
  const stopPlayback = useCallback(() => {
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }

    // Stop active buffer sources
    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
        s.disconnect();
      } catch (e) {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    nextScheduledTimeRef.current = 0;
    isPlayingRef.current = false;
    isAgentSpeakingRef.current = false;

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setAudioLevel(0);
  }, []);

  // Speech synthesis fallback helper with authentic MALE voice
  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      updateState('idle');
      return;
    }

    stopPlayback();

    // Prevent mic from recording agent's spoken voice
    shouldListenRef.current = false;
    isRecognitionRunningRef.current = false;
    if (recognitionRef.current) {
      const old = recognitionRef.current;
      recognitionRef.current = null;
      old.onstart = null;
      old.onresult = null;
      old.onerror = null;
      old.onend = null;
      try {
        old.stop();
      } catch (e) {
        try { old.abort(); } catch (e2) {}
      }
    }

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
      voices.find((v) => v.lang.includes('en-IN') && isMale(v)) ||
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
      isAgentSpeakingRef.current = true;
      updateState('speaking');
      setAudioLevel(0.65);
    };

    utterance.onend = () => {
      isPlayingRef.current = false;
      isAgentSpeakingRef.current = false;
      setAudioLevel(0);

      // Acoustic decay buffer before resuming microphone
      if (continuousModeRef.current && hasInteractedRef.current) {
        setTimeout(() => {
          if (!isAgentSpeakingRef.current) {
            startListeningRef.current();
          }
        }, 350);
      } else {
        updateState('idle');
      }
    };

    utterance.onerror = () => {
      isPlayingRef.current = false;
      isAgentSpeakingRef.current = false;
      setAudioLevel(0);
      updateState('idle');
    };

    window.speechSynthesis.speak(utterance);
  }, [stopPlayback, updateState]);

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

  // Schedule raw 24kHz PCM chunk with sample-accurate Web Audio clock
  const scheduleAudioChunk = useCallback((base64Data: string, sampleRate = 24000) => {
    try {
      const { ctx, masterGain } = getAudioPipeline();

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
      source.connect(masterGain);

      const now = ctx.currentTime;
      // Ensure smooth scheduling with a 25ms lead to eliminate gaps/clicks
      if (nextScheduledTimeRef.current < now + 0.025) {
        nextScheduledTimeRef.current = now + 0.025;
      }
      const startTime = nextScheduledTimeRef.current;
      source.start(startTime);
      nextScheduledTimeRef.current = startTime + audioBuffer.duration;

      // Strictly stop microphone while agent is speaking to eliminate echo feedback
      if (shouldListenRef.current) {
        shouldListenRef.current = false;
        isRecognitionRunningRef.current = false;
        if (recognitionRef.current) {
          const old = recognitionRef.current;
          recognitionRef.current = null;
          old.onstart = null;
          old.onresult = null;
          old.onerror = null;
          old.onend = null;
          try {
            old.stop();
          } catch (e) {
            try { old.abort(); } catch (e2) {}
          }
        }
      }

      isPlayingRef.current = true;
      isAgentSpeakingRef.current = true;
      lastAudioPacketTimeRef.current = Date.now();
      updateState('speaking');
      activeSourcesRef.current.push(source);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      };
    } catch (err) {
      console.error('Error scheduling audio chunk:', err);
    }
  }, [getAudioPipeline, updateState]);

  // Handle Gemini Turn Complete
  const onGeminiTurnComplete = useCallback((finalText?: string) => {
    currentTurnMessageIdRef.current = null;

    if (!audioContextRef.current) {
      isPlayingRef.current = false;
      isAgentSpeakingRef.current = false;
      setAudioLevel(0);
      if (continuousModeRef.current && hasInteractedRef.current) {
        setTimeout(() => startListeningRef.current(), 350);
      } else {
        updateState('idle');
      }
      return;
    }

    const ctx = audioContextRef.current;
    const remainingTime = Math.max(0, nextScheduledTimeRef.current - ctx.currentTime);
    const delayMs = Math.round(remainingTime * 1000) + 350; // 350ms acoustic grace period to dissipate room echo

    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
    }

    completionTimerRef.current = setTimeout(() => {
      completionTimerRef.current = null;
      isPlayingRef.current = false;
      isAgentSpeakingRef.current = false;
      setAudioLevel(0);

      if (continuousModeRef.current && hasInteractedRef.current) {
        startListeningRef.current();
      } else {
        updateState('idle');
      }
    }, delayMs);
  }, [updateState]);

  // Send a prompt to Aarav (multi-turn conversation)
  const sendUserPrompt = useCallback(
    async (promptText: string) => {
      const text = promptText.trim();
      if (!text) return;

      hasInteractedRef.current = true;
      stopPlayback();

      // Immediately silence speech recognition so it doesn't transcribe user's own tail
      shouldListenRef.current = false;
      isRecognitionRunningRef.current = false;
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      if (recognitionRef.current) {
        const old = recognitionRef.current;
        recognitionRef.current = null;
        old.onstart = null;
        old.onresult = null;
        old.onerror = null;
        old.onend = null;
        try {
          old.stop();
        } catch (e) {
          try { old.abort(); } catch (e2) {}
        }
      }

      appendMessage('user', text);
      thinkingStartTimeRef.current = Date.now();
      updateState('thinking');
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
            text,
            history
          })
        );
      } else {
        try {
          const res = await fetch(`${getApiUrl()}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: text,
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
          updateState('idle');
        }
      }
    },
    [stopPlayback, appendMessage, handleUiEvent, speakText, updateState]
  );

  // Monitor real volume levels (mic input when listening, speaker output when speaking)
  useEffect(() => {
    let animId: number;

    const checkVolume = () => {
      if (stateRef.current === 'speaking') {
        if (outputAnalyserRef.current) {
          const dataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
          outputAnalyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(1, Math.max(0.25, avg / 70)));
        } else {
          setAudioLevel(0.6);
        }
      } else if (stateRef.current === 'listening') {
        if (micAnalyserRef.current) {
          const dataArray = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
          micAnalyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(1, Math.max(0.08, avg / 60)));
        } else {
          setAudioLevel(0.18);
        }
      } else {
        setAudioLevel(0);
      }

      animId = requestAnimationFrame(checkVolume);
    };

    animId = requestAnimationFrame(checkVolume);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Connect to backend WebSocket with auto-reconnect and ping keepalive
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isUnmounted = false;
    let pingInterval: any = null;
    let reconnectTimeout: any = null;

    const connectWebSocket = () => {
      if (typeof window === 'undefined' || isUnmounted) return;
      const wsUrl = getWsUrl('default');

      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          setIsConnected(true);
          console.log('Connected to Shubh Diwali Voice Agent server');

          // Keepalive ping every 15s to keep connection hot
          if (pingInterval) clearInterval(pingInterval);
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'PING' }));
            }
          }, 15000);
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'AUDIO_CHUNK' && data.data) {
              scheduleAudioChunk(data.data, data.rate || 24000);
            } else if (data.type === 'AGENT_TEXT_CHUNK' && data.text) {
              // Real-time live transcript streaming
              setMessages((prev) => {
                if (currentTurnMessageIdRef.current) {
                  return prev.map((m) =>
                    m.id === currentTurnMessageIdRef.current
                      ? { ...m, text: m.text + data.text }
                      : m
                  );
                } else {
                  const newId = Math.random().toString(36).substring(7);
                  currentTurnMessageIdRef.current = newId;
                  return [
                    ...prev,
                    {
                      id: newId,
                      sender: 'agent',
                      text: data.text,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                  ];
                }
              });
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
              onGeminiTurnComplete(data.text);
            } else if (data.type === 'SESSION_RESET') {
              if (data.cart) {
                callbacksRef.current.onUpdateCart(data.cart);
              }
              setInterimText('');
              accumulatedSpeechRef.current = '';
              updateState('idle');
            } else if (data.type === 'PONG') {
              // Keepalive confirmed
            } else if (data.type === 'SYSTEM_INFO') {
              console.log('Voice Concierge status:', data.message);
            }
          } catch (e) {
            console.error('Error handling WebSocket message:', e);
          }
        };

        ws.onclose = () => {
          if (!isUnmounted) {
            setIsConnected(false);
            if (pingInterval) clearInterval(pingInterval);
            reconnectTimeout = setTimeout(connectWebSocket, 2000);
          }
        };

        ws.onerror = () => {
          if (!isUnmounted) {
            setIsConnected(false);
          }
        };
      } catch (e) {
        console.warn('Could not establish WebSocket connection, will retry:', e);
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, [scheduleAudioChunk, onGeminiTurnComplete, handleUiEvent, appendMessage, speakText, stopPlayback, updateState]);

  // Start Continuous Microphone capture with real audio level metering
  const startListening = useCallback(async () => {
    // If agent is currently speaking, do NOT open microphone
    if (isAgentSpeakingRef.current || isPlayingRef.current) return;

    // If already actively listening with an ongoing session, don't re-create
    if (shouldListenRef.current && isRecognitionRunningRef.current && stateRef.current === 'listening') {
      return;
    }

    hasInteractedRef.current = true;
    shouldListenRef.current = true;
    updateState('listening');
    setInterimText('');
    accumulatedSpeechRef.current = '';

    // Clean up any stale recognition reference safely
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      isRecognitionRunningRef.current = false;
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch (e) {
        try { rec.abort(); } catch (e2) {}
      }
    }

    // Micro-delay to allow browser audio hardware to cleanly switch from speaker output to mic capture
    await new Promise((r) => setTimeout(r, 60));
    if (!shouldListenRef.current || isAgentSpeakingRef.current || isPlayingRef.current) return;

    // Initialize real microphone stream for audio level visualizer
    if (typeof window !== 'undefined' && navigator.mediaDevices && !micStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        micStreamRef.current = stream;

        const { ctx } = getAudioPipeline();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);

        // Required for Web Audio pull architecture without outputting to speakers:
        const silenceGain = ctx.createGain();
        silenceGain.gain.setValueAtTime(0, ctx.currentTime);
        analyser.connect(silenceGain);
        silenceGain.connect(ctx.destination);

        micAnalyserRef.current = analyser;
      } catch (e) {
        console.warn('Could not open mic volume analyzer:', e);
      }
    }

    // Initialize Continuous Speech Recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        
        const browserLang = (typeof navigator !== 'undefined' && navigator.language) || 'en-IN';
        recognition.lang = browserLang.startsWith('en') ? browserLang : 'en-IN';

        recognition.onstart = () => {
          isRecognitionRunningRef.current = true;
          if (shouldListenRef.current && !isAgentSpeakingRef.current) {
            updateState('listening');
          }
        };

        recognition.onresult = (event: any) => {
          // If agent started speaking in the meantime, ignore any residual speech
          if (isAgentSpeakingRef.current || !shouldListenRef.current) return;

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

          // Natural silence debouncer (950ms after speech)
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
          }

          silenceTimeoutRef.current = setTimeout(() => {
            const textToSend = (accumulatedSpeechRef.current + ' ' + interim).trim();
            if (textToSend.length >= 2 && shouldListenRef.current && !isAgentSpeakingRef.current) {
              shouldListenRef.current = false;
              sendUserPrompt(textToSend);
            }
          }, 950);
        };

        recognition.onerror = (e: any) => {
          if (e.error === 'no-speech') {
            return;
          }
          if (e.error === 'aborted') {
            isRecognitionRunningRef.current = false;
            return;
          }
          if (e.error === 'not-allowed') {
            shouldListenRef.current = false;
            isRecognitionRunningRef.current = false;
            updateState('idle');
            return;
          }
          console.warn('Speech recognition warning:', e.error);
        };

        recognition.onend = () => {
          isRecognitionRunningRef.current = false;
          recognitionRef.current = null;

          // If still supposed to be listening and agent is not speaking:
          if (
            continuousModeRef.current &&
            shouldListenRef.current &&
            !isAgentSpeakingRef.current &&
            !isPlayingRef.current
          ) {
            // Clean fresh instance restart
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
            restartTimerRef.current = setTimeout(() => {
              if (shouldListenRef.current && !isAgentSpeakingRef.current && !isPlayingRef.current) {
                startListeningRef.current();
              }
            }, 80);
          }
        };

        try {
          recognition.start();
        } catch (e: any) {
          console.warn('SpeechRecognition start notice:', e);
          isRecognitionRunningRef.current = false;
          recognitionRef.current = null;
          if (continuousModeRef.current && shouldListenRef.current && !isAgentSpeakingRef.current) {
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
            restartTimerRef.current = setTimeout(() => {
              if (shouldListenRef.current && !isAgentSpeakingRef.current) {
                startListeningRef.current();
              }
            }, 150);
          }
        }
      }
    }
  }, [getAudioPipeline, sendUserPrompt, updateState]);

  startListeningRef.current = startListening;

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    isRecognitionRunningRef.current = false;
    setInterimText('');
    accumulatedSpeechRef.current = '';
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch (e) {
        try { rec.abort(); } catch (e2) {}
      }
    }
    updateState('idle');
    setAudioLevel(0);
  }, [updateState]);

  stopListeningRef.current = stopListening;

  const toggleListening = useCallback(() => {
    if (stateRef.current === 'speaking') {
      stopPlayback();
      if (continuousModeRef.current) {
        startListening();
      } else {
        updateState('idle');
      }
    } else if (stateRef.current === 'listening') {
      stopListening();
    } else {
      stopPlayback();
      startListening();
    }
  }, [startListening, stopListening, stopPlayback, updateState]);

  // Active unfreeze watchdog to guarantee UI never gets stuck
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const ctx = audioContextRef.current;

      // Never interfere if a scheduled completion timer is already active!
      if (completionTimerRef.current) return;

      // If in speaking state but all scheduled audio has finished and no new audio packet for > 6s
      if (stateRef.current === 'speaking') {
        const audioFinished = ctx ? ctx.currentTime >= nextScheduledTimeRef.current : true;
        const noRecentAudio = now - lastAudioPacketTimeRef.current > 6000;
        if (audioFinished && noRecentAudio && activeSourcesRef.current.length === 0) {
          isPlayingRef.current = false;
          isAgentSpeakingRef.current = false;
          setAudioLevel(0);
          if (continuousModeRef.current && hasInteractedRef.current) {
            startListeningRef.current();
          } else {
            updateState('idle');
          }
        }
      }

      // If in thinking state for > 15s without server response, recover gracefully
      if (stateRef.current === 'thinking' && now - thinkingStartTimeRef.current > 15000) {
        console.warn('Thinking timeout, recovering...');
        updateState('idle');
        setInterimText('');
        if (continuousModeRef.current && hasInteractedRef.current) {
          startListeningRef.current();
        }
      }
    }, 500);

    return () => clearInterval(timer);
  }, [updateState]);

  const toggleContinuousMode = useCallback(() => {
    setContinuousMode((prev) => {
      const next = !prev;
      continuousModeRef.current = next;
      if (!next && stateRef.current === 'listening') {
        stopListening();
      }
      return next;
    });
  }, [stopListening]);

  // Clean Fresh Start: Resets conversation, cart, and restores idle dormant state
  const resetAgent = useCallback(async () => {
    hasInteractedRef.current = false;
    currentTurnMessageIdRef.current = null;
    stopPlayback();
    stopListening();
    updateState('idle');
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

    try {
      await fetch(`${getApiUrl()}/api/session/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: 'default' })
      });
    } catch (e) {
      // ignore
    }
  }, [stopPlayback, stopListening, updateState]);

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
