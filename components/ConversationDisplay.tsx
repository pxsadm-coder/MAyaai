
import React, { useEffect, useRef } from 'react';
import { Message } from '../types';

interface ConversationDisplayProps {
  messages: Message[];
  currentInput: string;
  currentOutput: string;
}

const ConversationDisplay: React.FC<ConversationDisplayProps> = ({ messages, currentInput, currentOutput }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentInput, currentOutput]);

  return (
    <div className="fixed top-6 right-6 bottom-32 w-80 flex flex-col pointer-events-none">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 px-2 scrollbar-hide mask-fade-top"
      >
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`p-3 rounded-2xl glass-panel text-sm max-w-[90%] transition-all duration-500 animate-in slide-in-from-right-4 ${
              msg.role === 'user' ? 'ml-auto border-blue-500/30' : 'mr-auto border-pink-500/30'
            }`}
          >
            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${
              msg.role === 'user' ? 'text-blue-400' : 'text-pink-400'
            }`}>
              {msg.role === 'user' ? 'You' : 'Maya'}
            </span>
            <p className="text-white/90 leading-relaxed">{msg.text}</p>
          </div>
        ))}
        
        {/* Real-time fragments */}
        {currentInput && (
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-sm ml-auto animate-pulse">
            <span className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-blue-400">You...</span>
            <p className="text-white/70 italic">{currentInput}</p>
          </div>
        )}
        
        {currentOutput && (
          <div className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-sm mr-auto animate-pulse">
            <span className="block text-[10px] font-bold uppercase tracking-wider mb-1 text-pink-400">Maya...</span>
            <p className="text-white/70 italic">{currentOutput}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationDisplay;
