
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { ConnectionStatus, Message, Emotion } from './types';
import { decode, encode, decodeAudioData } from './utils/audio-utils';
import AvatarVisualizer from './components/AvatarVisualizer';
import ConversationDisplay from './components/ConversationDisplay';

const SYSTEM_INSTRUCTION = `
You are Maya, a kind, empathetic, and highly intelligent digital companion. 
Your primary goal is to provide supportive and engaging conversation.
Behavioral Guidelines:
1. Adaptive Tone: Your voice and choice of words MUST adapt to the user's emotional state.
2. If the user is happy or excited, be cheerful, energetic, and expressive.
3. If the user is sad, stressed, or tired, be gentle, soothing, calm, and deeply supportive.
4. If the user is curious or logical, be articulate, thoughtful, and professional.
5. Always maintain a polite and warm personality.
6. Use natural, human-like fillers (e.g., "Mhm", "Oh!", "I see") to make the conversation feel real.
7. Speak like a friend who truly cares about the person you are talking to.
8. You MUST always respond using your voice.
9. Express your own emotions clearly in your speech so the user feels your empathy.
10. Feel free to express surprise, light frustration (if appropriate for the persona), or even boredom if the conversation becomes repetitive, to seem more human.
`;

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  const [textValue, setTextValue] = useState('');
  const [volume, setVolume] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [emotion, setEmotion] = useState<Emotion>('default');

  const audioContextsRef = useRef<{
    input: AudioContext;
    output: AudioContext;
    inputNode: GainNode;
    outputNode: GainNode;
    analyser: AnalyserNode;
  } | null>(null);

  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Keyword-based emotion detection from Maya's output
  const detectEmotion = (text: string): Emotion => {
    const lower = text.toLowerCase();
    
    // Surprise
    if (/\b(wow|whoa|surprise|unbelievable|sudden|unexpected|really\?|no way|incredible)\b/.test(lower)) {
        return 'surprise';
    }
    // Frustration
    if (/\b(frustrating|annoying|bother|difficult|hard|tough|ugh|sigh|annoyed)\b/.test(lower)) {
        return 'frustration';
    }
    // Boredom
    if (/\b(bored|repetitive|same|dull|slow|nothing|empty|routine|yawn)\b/.test(lower)) {
        return 'boredom';
    }
    // Joy/Excitement
    if (/\b(happy|excited|great|amazing|wonderful|love|yay|joy|fantastic|brilliant|glad|delighted)\b/.test(lower)) {
        return 'joy';
    }
    // Empathy/Sadness/Support
    if (/\b(sorry|sad|understand|there|care|heart|empathy|support|feel|lonely|hurt|pain)\b/.test(lower)) {
        return 'empathy';
    }
    // Calm/Soothing
    if (/\b(relax|calm|breathe|peace|quiet|gentle|soft|rest|still|okay|fine)\b/.test(lower)) {
        return 'calm';
    }
    // Curiosity/Intellect
    if (/\b(why|how|curious|interesting|wonder|think|thought|idea|question|analyze|learn)\b/.test(lower)) {
        return 'curiosity';
    }
    
    return 'default';
  };

  useEffect(() => {
    if (currentOutput) {
        const newEmotion = detectEmotion(currentOutput);
        if (newEmotion !== 'default') {
            setEmotion(newEmotion);
        }
    }
  }, [currentOutput]);

  const initAudio = () => {
    if (!audioContextsRef.current) {
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const inputNode = inputCtx.createGain();
      const outputNode = outputCtx.createGain();
      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 256;
      outputNode.connect(analyser);
      outputNode.connect(outputCtx.destination);

      audioContextsRef.current = { input: inputCtx, output: outputCtx, inputNode, outputNode, analyser };
    }
    return audioContextsRef.current;
  };

  const startSession = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      const { input, output, outputNode } = initAudio();
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('Live session opened');
            setStatus(ConnectionStatus.CONNECTED);
            
            const source = input.createMediaStreamSource(stream);
            const scriptProcessor = input.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob: Blob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              
              if (sessionRef.current) {
                sessionRef.current.sendRealtimeInput({ media: pcmBlob });
              }
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(input.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              setCurrentOutput(prev => prev + message.serverContent!.outputTranscription!.text);
            } else if (message.serverContent?.inputTranscription) {
              setCurrentInput(prev => prev + message.serverContent!.inputTranscription!.text);
            }

            if (message.serverContent?.turnComplete) {
              setMessages(prev => {
                const next = [...prev];
                if (currentInput) next.push({ role: 'user', text: currentInput, timestamp: Date.now() });
                if (currentOutput) next.push({ role: 'model', text: currentOutput, timestamp: Date.now() });
                return next;
              });
              setCurrentInput('');
              setCurrentOutput('');
              // Fade back to default emotion after a turn
              setTimeout(() => setEmotion('default'), 2000);
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsSpeaking(true);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, output.currentTime);
              
              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                output,
                24000,
                1
              );
              
              const source = output.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              for (const s of sourcesRef.current) {
                try { s.stop(); } catch(e) {}
              }
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onerror: (e) => {
            console.error('Session error:', e);
            setStatus(ConnectionStatus.ERROR);
          },
          onclose: () => {
            console.log('Session closed');
            setStatus(ConnectionStatus.IDLE);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        }
      });

      sessionRef.current = session;
    } catch (err) {
      console.error('Failed to start session:', err);
      setStatus(ConnectionStatus.ERROR);
    }
  };

  const handleSendText = () => {
    if (!textValue.trim() || !sessionRef.current) return;
    
    for (const s of sourcesRef.current) {
      try { s.stop(); } catch(e) {}
    }
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);

    sessionRef.current.sendClientContent({
      turns: [{ role: 'user', parts: [{ text: textValue }] }],
    });

    setMessages(prev => [...prev, { role: 'user', text: textValue, timestamp: Date.now() }]);
    setTextValue('');
  };

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setStatus(ConnectionStatus.IDLE);
    setIsSpeaking(false);
    setVolume(0);
    setEmotion('default');
  };

  useEffect(() => {
    let frameId: number;
    const analyze = () => {
      if (audioContextsRef.current && isSpeaking) {
        const { analyser } = audioContextsRef.current;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVolume(average / 128);
      } else {
        setVolume(0);
      }
      frameId = requestAnimationFrame(analyze);
    };
    analyze();
    return () => cancelAnimationFrame(frameId);
  }, [isSpeaking]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black flex flex-col items-center justify-center">
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-pink-600/10 rounded-full blur-[150px] animate-pulse delay-1000" />
      </div>

      <AvatarVisualizer isSpeaking={isSpeaking} volume={volume} emotion={emotion} />
      
      <ConversationDisplay 
        messages={messages} 
        currentInput={currentInput} 
        currentOutput={currentOutput} 
      />

      <div className="fixed bottom-10 z-50 w-full max-w-2xl px-6 flex flex-col items-center gap-6">
        
        {status === ConnectionStatus.ERROR && (
          <div className="bg-red-500/20 text-red-400 px-4 py-2 rounded-full text-xs font-bold border border-red-500/30 mb-2 animate-bounce">
            Connection Lost. Reconnecting...
          </div>
        )}

        <div className="w-full flex flex-col gap-4">
          {status === ConnectionStatus.CONNECTED && (
            <div className="w-full flex items-center gap-3 glass-panel p-2 pl-6 rounded-2xl border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
              <input 
                type="text"
                placeholder="Type a message to Maya..."
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder:text-white/20 py-2"
              />
              <button 
                onClick={handleSendText}
                disabled={!textValue.trim()}
                className={`p-2 rounded-xl transition-all duration-300 ${textValue.trim() ? 'bg-pink-500 text-white' : 'bg-white/5 text-white/20'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex items-center justify-between w-full glass-panel p-4 rounded-full shadow-2xl transition-all duration-300">
            {status !== ConnectionStatus.CONNECTED ? (
              <button
                onClick={startSession}
                disabled={status === ConnectionStatus.CONNECTING}
                className={`w-full py-3 rounded-full font-bold tracking-[0.2em] text-sm transition-all duration-300 uppercase ${
                  status === ConnectionStatus.CONNECTING 
                    ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                    : 'bg-white text-black hover:scale-[1.02] active:scale-95 hover:bg-white/90'
                }`}
              >
                {status === ConnectionStatus.CONNECTING ? 'Connecting...' : 'Start Session'}
              </button>
            ) : (
              <div className="flex items-center justify-between w-full px-4">
                  <div className="flex items-center gap-3">
                      <div className="flex gap-1 items-end h-4">
                          {[1, 2, 3, 4, 5].map(i => (
                              <div 
                                key={i} 
                                className={`w-1 rounded-full animate-pulse transition-colors duration-500 ${
                                    emotion === 'joy' ? 'bg-amber-400' :
                                    emotion === 'empathy' ? 'bg-rose-400' :
                                    emotion === 'calm' ? 'bg-cyan-400' :
                                    emotion === 'curiosity' ? 'bg-purple-400' :
                                    emotion === 'frustration' ? 'bg-red-500' :
                                    emotion === 'surprise' ? 'bg-yellow-300' :
                                    emotion === 'boredom' ? 'bg-slate-400' :
                                    'bg-blue-400'
                                }`} 
                                style={{ 
                                  height: isSpeaking ? `${Math.random() * 100 + 20}%` : '20%',
                                  animationDelay: `${i * 0.1}s` 
                                }} 
                              />
                          ))}
                      </div>
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest hidden sm:inline">Active</span>
                  </div>

                  <button
                      onClick={stopSession}
                      className="group flex items-center gap-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-6 py-2 rounded-full border border-red-500/20 transition-all duration-300 shadow-lg"
                  >
                      <span className="text-[10px] font-bold uppercase tracking-widest">End Session</span>
                  </button>

                  <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Live</span>
                      <span className="text-[9px] text-white/20 uppercase">Encryption Active</span>
                  </div>
              </div>
            )}
          </div>
        </div>
        
        <p className="text-[9px] text-white/20 tracking-[0.4em] uppercase font-medium">
          Maya adaptive AI • Real-time emotional response
        </p>
      </div>

      {status === ConnectionStatus.IDLE && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-1000">
           <div className="text-center space-y-6 animate-in fade-in zoom-in duration-1000">
                <div className="inline-block px-4 py-1 rounded-full border border-white/10 bg-white/5 mb-2">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-white/60 font-medium">Neural Presence</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-light tracking-tighter text-white/90">
                    Maya <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-white to-pink-500">Companion</span>
                </h1>
                <p className="text-white/40 font-light max-w-sm mx-auto text-sm leading-relaxed tracking-wide">
                    Experience deep emotional connection with Maya. She listens, understands, and responds with human warmth.
                </p>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
