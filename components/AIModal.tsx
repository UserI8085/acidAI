
import React, { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';

interface AIModalProps {
  isOpen: boolean;
  isGenerating: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => void;
}

const AIModal: React.FC<AIModalProps> = ({ isOpen, isGenerating, onClose, onGenerate }) => {
  const [prompt, setPrompt] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(prompt);
  };

  const suggestedPrompts = [
    "Fast hard techno bassline with aggressive distortion",
    "Deep hypnotic minimal house groove",
    "Funky acid breaks with syncopated snare",
    "Slow ambient evolving acid line"
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 w-full max-w-md rounded-xl border border-zinc-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-gradient-to-r from-indigo-900/50 to-purple-900/50">
          <div className="flex items-center gap-2">
            <Sparkles className="text-indigo-400" size={20} />
            <h2 className="text-white font-bold tracking-wide">AI Pattern Generator</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
           <p className="text-zinc-400 text-sm">
             Describe the style, mood, or rhythm you want. The AI will generate a pattern for the active synthesizer and drum machine.
           </p>

           <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. A dark, driving acid line in F# with heavy accents..."
                className="w-full h-32 bg-zinc-950 text-zinc-200 border border-zinc-700 rounded p-3 focus:outline-none focus:border-indigo-500 resize-none font-mono text-sm"
                autoFocus
              />
              
              <div className="flex flex-col gap-2">
                 <span className="text-[10px] uppercase font-bold text-zinc-600">Suggestions</span>
                 <div className="flex flex-wrap gap-2">
                    {suggestedPrompts.map((p, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setPrompt(p)}
                            className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded hover:bg-zinc-700 hover:text-zinc-200 transition-colors border border-zinc-700"
                        >
                            {p}
                        </button>
                    ))}
                 </div>
              </div>

              <div className="flex justify-end pt-2">
                  <button 
                    type="submit" 
                    disabled={isGenerating}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isGenerating ? (
                        <>
                            <Loader2 className="animate-spin" size={16} />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Sparkles size={16} />
                            Generate Pattern
                        </>
                    )}
                  </button>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
};

export default AIModal;
