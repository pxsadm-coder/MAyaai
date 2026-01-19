
import React from 'react';
import { Emotion } from '../types';

interface AvatarVisualizerProps {
  isSpeaking: boolean;
  volume: number; // 0 to 1
  emotion: Emotion;
}

const AvatarVisualizer: React.FC<AvatarVisualizerProps> = ({ isSpeaking, volume, emotion }) => {
  
  // High-quality realistic avatar image
  const avatarUrl = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=800&h=1000";

  // Map emotions to colors and behaviors
  const emotionConfig: Record<Emotion, { glow: string; halo: string; pulseSpeed: string }> = {
    joy: { glow: 'from-amber-500/30', halo: 'border-amber-400/20', pulseSpeed: 'duration-[1000ms]' },
    empathy: { glow: 'from-rose-500/30', halo: 'border-rose-400/20', pulseSpeed: 'duration-[3000ms]' },
    calm: { glow: 'from-cyan-500/30', halo: 'border-cyan-400/20', pulseSpeed: 'duration-[4000ms]' },
    curiosity: { glow: 'from-purple-500/30', halo: 'border-purple-400/20', pulseSpeed: 'duration-[1500ms]' },
    frustration: { glow: 'from-red-600/40', halo: 'border-red-500/30', pulseSpeed: 'duration-[600ms]' },
    surprise: { glow: 'from-white/40', halo: 'border-yellow-200/40', pulseSpeed: 'duration-[400ms]' },
    boredom: { glow: 'from-slate-800/20', halo: 'border-slate-700/10', pulseSpeed: 'duration-[8000ms]' },
    default: { glow: 'from-pink-500/10', halo: 'border-white/5', pulseSpeed: 'duration-[2000ms]' }
  };

  const currentConfig = emotionConfig[emotion] || emotionConfig.default;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black transition-colors duration-1000">
      {/* Background Glow - Changes based on emotion */}
      <div 
        className={`absolute inset-0 transition-all duration-1000 bg-gradient-to-t ${currentConfig.glow} via-transparent to-transparent`}
        style={{ opacity: isSpeaking ? 0.8 : 0.3 }}
      />
      
      {/* Dynamic Halo */}
      <div 
        className={`absolute w-[120%] h-[120%] border-[20px] ${currentConfig.halo} rounded-full blur-3xl transition-all ${currentConfig.pulseSpeed} animate-pulse`}
        style={{ transform: `scale(${1 + volume * 0.3})` }}
      />

      {/* Main Avatar Image */}
      <div className="relative z-10 w-[280px] md:w-[400px] aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl border border-white/10 transition-all duration-700">
        <img 
          src={avatarUrl} 
          alt="Maya" 
          className="w-full h-full object-cover transition-all duration-700 ease-out"
          style={{ 
            transform: `scale(${1 + (emotion === 'surprise' ? volume * 0.15 : volume * 0.05)})`,
            filter: `brightness(${0.85 + volume * 0.2}) contrast(1.1) saturate(${emotion === 'joy' ? 1.3 : emotion === 'boredom' ? 0.7 : 1})`
          }}
        />
        
        {/* Subtle breathing / speaking overlay */}
        <div 
          className="absolute inset-0 bg-white/5 pointer-events-none transition-opacity duration-150"
          style={{ opacity: volume * 0.3 }}
        />
        
        {/* Emotional state indicator */}
        <div className="absolute top-6 right-6 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
            <div className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
            <span className="text-[9px] font-bold text-white/60 tracking-[0.2em] uppercase">
                {emotion}
            </span>
        </div>

        {/* Connection status */}
        <div className="absolute bottom-6 left-6 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-400 animate-pulse' : 'bg-blue-400 opacity-60'}`} />
            <span className="text-[10px] font-medium text-white/80 tracking-widest uppercase">
                {isSpeaking ? 'Voice Active' : 'Listening'}
            </span>
        </div>
      </div>

      {/* Audio Wave Visualizer Bottom Overlay */}
      <div className="absolute bottom-10 left-0 right-0 h-24 flex items-end justify-center gap-1 px-10">
        {Array.from({ length: 40 }).map((_, i) => (
          <div 
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
                emotion === 'joy' ? 'bg-amber-400' :
                emotion === 'empathy' ? 'bg-rose-400' :
                emotion === 'calm' ? 'bg-cyan-400' :
                emotion === 'curiosity' ? 'bg-purple-400' :
                emotion === 'frustration' ? 'bg-red-500' :
                emotion === 'surprise' ? 'bg-yellow-200' :
                emotion === 'boredom' ? 'bg-slate-500' :
                'bg-blue-400'
            }`}
            style={{ 
              height: isSpeaking ? `${Math.random() * volume * 100 + 4}%` : '4px',
              opacity: isSpeaking ? 0.8 : 0.2
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default AvatarVisualizer;
