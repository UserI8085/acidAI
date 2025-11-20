
import React, { useState, useRef, useEffect } from 'react';
import { Wand2, Trash2, Activity, Waves, BarChart3, Lock, ChevronLeft, ChevronRight } from 'lucide-react';

interface HarmonicEditorProps {
  harmonics: number[];
  onChange: (harmonics: number[]) => void;
  label?: string;
  isLocked?: boolean; // If true, implies we are editing a step-specific wave
  onClear?: () => void;
}

const HarmonicEditor: React.FC<HarmonicEditorProps> = ({ harmonics = [], onChange, label = "Additive Harmonics", isLocked = false, onClear }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedHarmonic, setSelectedHarmonic] = useState<number>(0); // 0-based index
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Safe access to harmonics length
  const count = harmonics.length || 64;
  const safeSelected = Math.max(0, Math.min(selectedHarmonic, count - 1));
  const currentLevel = Math.round((harmonics[safeSelected] || 0) * 100);
  
  // --- Handlers ---

  const updateHarmonic = (index: number, value: number) => {
      const newH = [...harmonics];
      // Ensure array is big enough
      while (newH.length < count) newH.push(0);
      
      // Clamp value between 0 and 1
      const clampedVal = Math.max(0, Math.min(1, value));
      newH[index] = clampedVal;
      onChange(newH);
  };

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;

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
    const barWidth = width / count;
    const index = Math.floor(x / barWidth);

    const y = clientY - rect.top;
    const height = rect.height;
    const val = 1 - Math.max(0, Math.min(1, y / height));

    if (index >= 0 && index < count) {
        setSelectedHarmonic(index);
        
        // Update value if drawing or clicking
        if (isDrawing || e.type === 'mousedown' || e.type === 'touchstart') {
            updateHarmonic(index, val);
        }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      setIsDrawing(true);
      handleInteraction(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (isDrawing) handleInteraction(e);
  };

  const handleMouseUp = () => setIsDrawing(false);
  
  useEffect(() => {
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchend', handleMouseUp);
      return () => {
          window.removeEventListener('mouseup', handleMouseUp);
          window.removeEventListener('touchend', handleMouseUp);
      };
  }, []);

  // --- Preset Generators ---
  const generateSaw = () => { onChange(Array.from({length: count}, (_, i) => 1 / (i + 1))); };
  const generateSquare = () => { onChange(Array.from({length: count}, (_, i) => (i % 2 === 0) ? 1 / (i + 1) : 0)); };
  const generateTriangle = () => { onChange(Array.from({length: count}, (_, i) => (i % 2 === 0) ? 1 / ((i + 1) * (i + 1)) : 0)); };
  const generateSine = () => { const newH = new Array(count).fill(0); newH[0] = 1; onChange(newH); };
  const generateRandom = () => { onChange(Array.from({length: count}, () => Math.random() * Math.random())); };
  const smoothCurve = () => {
      const newH = [...harmonics];
      while (newH.length < count) newH.push(0);
      for(let i=1; i<count-1; i++) newH[i] = (newH[i-1] + newH[i] + newH[i+1]) / 3;
      onChange(newH);
  };
  const clear = () => { onChange(new Array(count).fill(0)); };

  return (
    <div className={`flex flex-col h-full select-none touch-none p-4 rounded-lg border shadow-xl transition-colors duration-300 gap-4 ${isLocked ? 'bg-cyan-950/20 border-cyan-900' : 'bg-zinc-950 border-zinc-800'}`}>
        
        {/* Top Bar */}
        <div className="flex justify-between items-center border-b border-zinc-800/50 pb-2 flex-shrink-0">
             <div className="flex items-center gap-2">
                <span className={`text-sm font-black uppercase flex items-center gap-2 tracking-wider ${isLocked ? 'text-cyan-400' : 'text-zinc-400'}`}>
                    <Activity size={18} /> {label}
                </span>
             </div>
             {isLocked && onClear && (
                 <button onClick={onClear} className="text-[10px] flex items-center gap-1 text-red-400 hover:text-red-300 font-bold uppercase px-2 py-1 rounded hover:bg-red-900/20 transition-colors border border-red-900/30">
                     <Lock size={12} /> Clear Override
                 </button>
             )}
        </div>

        {/* Graph Visualization */}
        <div className="flex-1 min-h-0 relative bg-black rounded border border-zinc-800 overflow-hidden group">
            <div 
                ref={containerRef}
                className="absolute inset-0 flex items-end cursor-crosshair px-1 pt-4 pb-0"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onTouchStart={(e) => { setIsDrawing(true); handleInteraction(e); }}
                onTouchMove={(e) => { e.preventDefault(); handleInteraction(e); }}
            >
                {/* Background Grid */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-20 p-1 z-0">
                    <div className="h-px bg-zinc-500 w-full"></div>
                    <div className="h-px bg-zinc-500 w-full"></div>
                    <div className="h-px bg-zinc-500 w-full"></div>
                    <div className="h-px bg-zinc-500 w-full"></div>
                </div>

                {/* Bars */}
                {Array.from({length: count}).map((_, i) => {
                    const val = harmonics[i] || 0;
                    const isSelected = i === safeSelected;
                    
                    return (
                        <div 
                            key={i} 
                            className={`
                                flex-1 h-full flex items-end justify-center relative z-10 
                                border-r border-black/50 last:border-r-0
                                transition-colors duration-75
                                ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}
                            `}
                        >
                            <div 
                                style={{ height: `${val * 100}%` }}
                                className={`
                                    w-full transition-all duration-75 relative
                                    ${isSelected 
                                        ? 'bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] z-20' 
                                        : isLocked 
                                            ? 'bg-cyan-600' 
                                            : 'bg-red-600'
                                    }
                                `}
                            >
                                {/* Top cap for visual clarity */}
                                <div className={`absolute top-0 left-0 right-0 h-[2px] ${isSelected ? 'bg-white' : 'bg-white/30'}`}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Control Panel (Inputs) */}
        <div className="grid grid-cols-2 gap-4 bg-zinc-900/50 p-3 rounded border border-zinc-800">
            
            {/* Harmonic Selector */}
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Harmonic Index</label>
                <div className="flex items-center bg-black border border-zinc-700 rounded h-10 px-1">
                    <button 
                        className="h-full px-2 text-zinc-500 hover:text-white active:bg-zinc-800 rounded-l"
                        onClick={() => setSelectedHarmonic(Math.max(0, safeSelected - 1))}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <input 
                        type="number"
                        min="1"
                        max={count}
                        value={safeSelected + 1}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) setSelectedHarmonic(Math.max(0, Math.min(count - 1, val - 1)));
                        }}
                        onFocus={(e) => e.target.select()}
                        className="flex-1 bg-transparent text-center text-white font-mono text-lg font-bold outline-none"
                    />
                    <button 
                        className="h-full px-2 text-zinc-500 hover:text-white active:bg-zinc-800 rounded-r"
                        onClick={() => setSelectedHarmonic(Math.min(count - 1, safeSelected + 1))}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Level Selector */}
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Amplitude Level %</label>
                <div className="flex items-center bg-black border border-zinc-700 rounded h-10 px-1 relative overflow-hidden">
                    {/* Visual fill behind input */}
                    <div 
                        className={`absolute left-0 top-0 bottom-0 opacity-20 pointer-events-none transition-all duration-100 ${isLocked ? 'bg-cyan-500' : 'bg-red-500'}`} 
                        style={{ width: `${currentLevel}%` }}
                    ></div>

                    <input 
                        type="number"
                        min="0"
                        max="100"
                        value={currentLevel}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) updateHarmonic(safeSelected, val / 100);
                        }}
                        onFocus={(e) => e.target.select()}
                        className="flex-1 bg-transparent text-center text-white font-mono text-lg font-bold outline-none z-10"
                    />
                    <span className="text-zinc-500 text-xs font-bold pr-2 z-10">%</span>
                </div>
            </div>

        </div>
        
        {/* Tools / Presets */}
        <div className="grid grid-cols-4 gap-2">
            <button onClick={generateSaw} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white text-[10px] font-bold py-2 rounded border border-zinc-800 transition-colors">SAW</button>
            <button onClick={generateSquare} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white text-[10px] font-bold py-2 rounded border border-zinc-800 transition-colors">SQR</button>
            <button onClick={generateTriangle} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white text-[10px] font-bold py-2 rounded border border-zinc-800 transition-colors">TRI</button>
            <button onClick={generateSine} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white text-[10px] font-bold py-2 rounded border border-zinc-800 transition-colors">SIN</button>
            
            <button onClick={generateRandom} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white py-2 rounded border border-zinc-800 flex items-center justify-center transition-colors" title="Randomize"><Wand2 size={14}/></button>
            <button onClick={smoothCurve} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white py-2 rounded border border-zinc-800 flex items-center justify-center transition-colors" title="Smooth"><Waves size={14}/></button>
            <button onClick={() => onChange(harmonics.map(h => h * 0.9))} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white py-2 rounded border border-zinc-800 flex items-center justify-center transition-colors" title="Attenuate"><BarChart3 size={14}/></button>
            <button onClick={clear} className="bg-red-950/30 hover:bg-red-900/50 text-red-700 hover:text-red-500 py-2 rounded border border-red-900/20 flex items-center justify-center transition-colors" title="Clear"><Trash2 size={14}/></button>
        </div>
    </div>
  );
};

export default HarmonicEditor;
