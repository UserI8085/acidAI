
import React, { useState, useRef, useEffect } from 'react';
import { Wand2, Trash2, Activity, Waves, BarChart3, Lock } from 'lucide-react';

interface HarmonicEditorProps {
  harmonics: number[];
  onChange: (harmonics: number[]) => void;
  label?: string;
  isLocked?: boolean; // If true, implies we are editing a step-specific wave
  onClear?: () => void;
}

const HarmonicEditor: React.FC<HarmonicEditorProps> = ({ harmonics, onChange, label = "Additive Harmonics", isLocked = false, onClear }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedHarmonic, setSelectedHarmonic] = useState<number>(0); // 0-based index
  
  // Numeric Editing State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current || editingIndex !== null) return;

    const rect = containerRef.current.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const width = rect.width;
    const barWidth = width / harmonics.length;
    const index = Math.floor(x / barWidth);

    const y = clientY - rect.top;
    const height = rect.height;
    const val = 1 - Math.max(0, Math.min(1, y / height));

    if (index >= 0 && index < harmonics.length) {
        // Update selection
        setSelectedHarmonic(index);
        
        const newHarmonics = [...harmonics];
        newHarmonics[index] = val;
        onChange(newHarmonics);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (editingIndex !== null) return;
      setIsDrawing(true);
      handleInteraction(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDrawing) return;
      handleInteraction(e);
  };

  const handleMouseUp = () => setIsDrawing(false);
  const handleTouchMove = (e: React.TouchEvent) => {
      e.preventDefault(); 
      handleInteraction(e);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const barWidth = width / harmonics.length;
      const index = Math.floor(x / barWidth);
      
      if (index >= 0 && index < harmonics.length) {
          setEditingIndex(index);
          setInputValue(Math.round(harmonics[index] * 100).toString());
      }
  };

  const commitEdit = () => {
      if (editingIndex !== null) {
          let val = parseFloat(inputValue);
          if (!isNaN(val)) {
              val = Math.max(0, Math.min(100, val)) / 100;
              const newH = [...harmonics];
              newH[editingIndex] = val;
              onChange(newH);
          }
      }
      setEditingIndex(null);
  };

  useEffect(() => {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  useEffect(() => {
      if (editingIndex !== null && inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
      }
  }, [editingIndex]);

  // --- Preset Generators ---
  const generateSaw = () => { onChange(harmonics.map((_, i) => 1 / (i + 1))); };
  const generateSquare = () => { onChange(harmonics.map((_, i) => (i % 2 === 0) ? 1 / (i + 1) : 0)); };
  const generateTriangle = () => { onChange(harmonics.map((_, i) => (i % 2 === 0) ? 1 / ((i + 1) * (i + 1)) : 0)); };
  const generateSine = () => { const newH = new Array(harmonics.length).fill(0); newH[0] = 1; onChange(newH); };
  const generateRandom = () => { onChange(harmonics.map(() => Math.random() * Math.random())); };
  const smoothCurve = () => {
      const newH = [...harmonics];
      for(let i=1; i<newH.length-1; i++) newH[i] = (harmonics[i-1] + harmonics[i] + harmonics[i+1]) / 3;
      onChange(newH);
  };
  const clear = () => { onChange(new Array(harmonics.length).fill(0)); };

  return (
    <div className={`flex flex-col gap-3 select-none touch-none p-3 rounded border shadow-inner transition-colors duration-300 ${isLocked ? 'bg-cyan-950/20 border-cyan-900' : 'bg-zinc-950 border-zinc-800'}`}>
        <div className="flex justify-between items-center">
             <span className={`text-xs font-bold uppercase flex items-center gap-2 ${isLocked ? 'text-cyan-400' : 'text-zinc-500'}`}>
                <Activity size={14} /> {label}
             </span>
             {isLocked && onClear && (
                 <button onClick={onClear} className="text-[10px] flex items-center gap-1 text-red-400 hover:text-red-300 font-bold uppercase">
                     <Lock size={10} /> Unlock Step Wave
                 </button>
             )}
        </div>

        {/* Graph */}
        <div 
            ref={containerRef}
            className={`h-24 bg-black rounded border relative cursor-crosshair flex items-end shadow-[inset_0_0_20px_rgba(0,0,0,1)] ${isLocked ? 'border-cyan-800' : 'border-zinc-800'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onTouchStart={() => setIsDrawing(true)}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => setIsDrawing(false)}
            onDoubleClick={handleDoubleClick}
        >
            {/* Grid Lines */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-30 z-0">
                <div className="h-px bg-zinc-800 w-full"></div>
                <div className="h-px bg-zinc-800 w-full"></div>
                <div className="h-px bg-zinc-800 w-full"></div>
            </div>

            {/* Bars */}
            {harmonics.map((val, i) => {
                const isSelected = i === selectedHarmonic;
                return (
                    <div 
                        key={i} 
                        style={{ 
                            height: `${val * 100}%`, 
                            width: `${100 / harmonics.length}%`,
                        }}
                        className={`relative z-10 group border-r border-black/20 transition-all duration-75 ${isLocked ? 'hover:bg-cyan-800/50' : 'hover:bg-red-800/50'} ${isSelected ? 'ring-1 ring-white/50 z-20' : ''}`}
                    >
                        <div className={`
                            absolute bottom-0 left-0 right-0 top-0
                            ${isLocked 
                                ? (i === 0 ? 'bg-gradient-to-t from-cyan-900 to-cyan-400' : 'bg-gradient-to-t from-cyan-900/80 to-cyan-600/80')
                                : (i === 0 ? 'bg-gradient-to-t from-red-900 to-red-500' : 'bg-gradient-to-t from-blue-900 to-blue-500')
                            }
                            opacity-80 group-hover:opacity-100
                        `}></div>
                        
                        {/* Top Glow */}
                        {harmonics.length < 32 && (
                            <div className="absolute top-0 left-0 right-0 h-[1px] bg-white shadow-[0_0_5px_white]"></div>
                        )}

                        {/* Numeric Input Overlay */}
                        {editingIndex === i && (
                             <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-50 w-8">
                                 <input 
                                    ref={inputRef}
                                    type="number"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onBlur={commitEdit}
                                    onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="w-full bg-white text-black text-[10px] font-bold text-center rounded shadow-lg outline-none border-none py-0.5"
                                 />
                             </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* Precision Controls */}
        <div className="flex items-center gap-2 bg-zinc-900/30 p-2 rounded border border-zinc-800/50">
             <div className="flex items-center gap-1">
                 <span className="text-[10px] font-bold uppercase text-zinc-500">Harmonic</span>
                 <input 
                    type="number"
                    min="1"
                    max={harmonics.length}
                    value={selectedHarmonic + 1}
                    onChange={(e) => {
                        const v = parseInt(e.target.value);
                        if(!isNaN(v)) setSelectedHarmonic(Math.max(0, Math.min(harmonics.length - 1, v - 1)));
                    }}
                    className="w-8 bg-zinc-950 border border-zinc-700 text-white text-[11px] font-mono text-center rounded outline-none focus:border-zinc-500"
                 />
             </div>
             
             <div className="flex-1 flex items-center gap-2 border-l border-zinc-800 pl-2 ml-1">
                 <span className="text-[10px] font-bold uppercase text-zinc-500">Amp</span>
                 <input 
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round((harmonics[selectedHarmonic] || 0) * 100)}
                    onChange={(e) => {
                        const val = parseInt(e.target.value) / 100;
                        const h = [...harmonics];
                        h[selectedHarmonic] = val;
                        onChange(h);
                    }}
                    className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
                 />
                 <input 
                    type="number"
                    min="0"
                    max="100"
                    value={Math.round((harmonics[selectedHarmonic] || 0) * 100)}
                    onChange={(e) => {
                        const val = Math.max(0, Math.min(100, parseInt(e.target.value))) / 100;
                        const h = [...harmonics];
                        h[selectedHarmonic] = val;
                        onChange(h);
                    }}
                    className="w-10 bg-zinc-950 border border-zinc-700 text-white text-[11px] font-mono text-center rounded outline-none focus:border-zinc-500"
                 />
             </div>
        </div>
        
        {/* Tools */}
        <div className="grid grid-cols-4 gap-1">
            <button onClick={generateSaw} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white text-[10px] py-1 rounded border border-zinc-800 transition-colors">SAW</button>
            <button onClick={generateSquare} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white text-[10px] py-1 rounded border border-zinc-800 transition-colors">SQR</button>
            <button onClick={generateTriangle} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white text-[10px] py-1 rounded border border-zinc-800 transition-colors">TRI</button>
            <button onClick={generateSine} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white text-[10px] py-1 rounded border border-zinc-800 transition-colors">SIN</button>
            
            <button onClick={generateRandom} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white text-[10px] py-1 rounded border border-zinc-800 flex items-center justify-center"><Wand2 size={12}/></button>
            <button onClick={smoothCurve} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white text-[10px] py-1 rounded border border-zinc-800 flex items-center justify-center"><Waves size={12}/></button>
            <button onClick={() => onChange(harmonics.map(h => h * 0.9))} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white text-[10px] py-1 rounded border border-zinc-800 flex items-center justify-center"><BarChart3 size={12}/></button>
            <button onClick={clear} className="bg-red-950/30 hover:bg-red-900/50 text-red-700 hover:text-red-500 text-[10px] py-1 rounded border border-red-900/20 flex items-center justify-center"><Trash2 size={12}/></button>
        </div>
    </div>
  );
};

export default HarmonicEditor;
