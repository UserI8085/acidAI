
import React, { useState, useRef, useEffect } from 'react';
import { DrumPattern, DrumParams, DrumType, DrumEffects, EffectParams, DrumKit, DrumAutomation } from '../types';
import Knob from './Knob';
import { Settings2, Layers, Disc, Activity, Zap } from 'lucide-react';

interface DrumMachineProps {
  pattern: DrumPattern;
  params: DrumParams;
  effects: DrumEffects;
  kit: DrumKit;
  currentStep: number;
  onUpdatePattern: (type: DrumType, stepId: number) => void;
  onUpdateParams: (key: keyof DrumParams, value: number) => void;
  onUpdateEffects: (type: DrumType, key: keyof EffectParams, value: number) => void;
  onUpdateKit: (kit: DrumKit) => void;
}

const INSTRUMENTS: { id: DrumType; label: string; color: string }[] = [
    { id: 'BD', label: 'Bass Drum', color: 'text-red-500' },
    { id: 'SD', label: 'Snare Drum', color: 'text-orange-500' },
    { id: 'CH', label: 'Closed Hat', color: 'text-yellow-400' },
    { id: 'OH', label: 'Open Hat', color: 'text-yellow-200' },
    { id: 'CP', label: 'Hand Clap', color: 'text-pink-400' },
];

type DrumAutoParam = keyof DrumAutomation;

const DrumMachine: React.FC<DrumMachineProps> = ({ 
  pattern, 
  params,
  effects,
  kit,
  currentStep, 
  onUpdatePattern,
  onUpdateParams,
  onUpdateEffects,
  onUpdateKit
}) => {
  const [selectedInstrument, setSelectedInstrument] = useState<DrumType>('BD');
  const [editorMode, setEditorMode] = useState<'TRIGGER' | 'AUTO'>('TRIGGER');
  const [selectedAutoParam, setSelectedAutoParam] = useState<DrumAutoParam>('volume');

  const currentEffects = effects[selectedInstrument];
  const activeInstData = INSTRUMENTS.find(i => i.id === selectedInstrument);

  // --- Automation Helpers ---
  const getGlobalValue = (param: DrumAutoParam): number => {
      const fx = effects[selectedInstrument];
      switch(param) {
          case 'volume': return params[`vol${selectedInstrument}` as keyof DrumParams];
          case 'tuning': return 0; 
          case 'decay': return 50; 
          case 'pan': return 0;
          case 'cutoff': return 100;
          case 'resonance': return 0;
          case 'distortion': return fx.distortion;
          case 'delayMix': return fx.delayMix;
          case 'delayTime': return fx.delayTime;
          case 'delayFeedback': return fx.delayFeedback;
          default: return 0;
      }
  };

  const getParamLabel = (p: DrumAutoParam) => {
      switch(p) {
          case 'pan': return 'Pan';
          case 'cutoff': return 'Cutoff';
          case 'resonance': return 'Res';
          case 'delayMix': return 'Dly Mix';
          case 'delayTime': return 'Dly Time';
          case 'delayFeedback': return 'Dly Fbk';
          case 'distortion': return 'Dist';
          default: return p;
      }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center border border-zinc-700 shadow-inner">
                 <Disc size={24} className={kit === '808' ? 'text-orange-500' : 'text-yellow-500'} />
            </div>
            <div>
                <h3 className="text-lg font-black text-zinc-300 tracking-widest uppercase leading-none">
                    Rhythm Core
                </h3>
                <div className="flex gap-2 items-center">
                    <span className={`text-xs font-mono font-bold ${kit === '808' ? 'text-orange-500' : 'text-yellow-500'}`}>
                        TR-{kit}
                    </span>
                    <span className="text-[10px] text-zinc-600">|</span>
                    <span className={`text-xs font-bold uppercase ${activeInstData?.color}`}>
                        {activeInstData?.label}
                    </span>
                </div>
            </div>
            
            <div className="flex bg-zinc-950 rounded p-1 border border-zinc-800 ml-4">
                <button onClick={() => onUpdateKit('808')} className={`px-3 py-1 text-xs font-bold rounded transition-all ${kit === '808' ? 'bg-orange-600 text-white shadow' : 'text-zinc-600 hover:text-zinc-400'}`}>808</button>
                <button onClick={() => onUpdateKit('909')} className={`px-3 py-1 text-xs font-bold rounded transition-all ${kit === '909' ? 'bg-yellow-600 text-white shadow' : 'text-zinc-600 hover:text-zinc-400'}`}>909</button>
            </div>
          </div>

          {/* Mode Switch */}
          <div className="flex bg-zinc-900 rounded border border-zinc-800">
               <button 
                 onClick={() => setEditorMode('TRIGGER')}
                 className={`px-3 py-2 flex items-center gap-2 text-xs font-bold uppercase transition-colors ${editorMode === 'TRIGGER' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
               >
                   <Layers size={14} /> Triggers
               </button>
               <div className="w-px bg-zinc-800"></div>
               <button 
                 onClick={() => setEditorMode('AUTO')}
                 className={`px-3 py-2 flex items-center gap-2 text-xs font-bold uppercase transition-colors ${editorMode === 'AUTO' ? 'bg-cyan-950/50 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
               >
                   <Activity size={14} /> Automation
               </button>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Controls / Selectors */}
          <div className="lg:col-span-7 flex justify-between items-end bg-zinc-900/50 p-4 rounded border border-zinc-800">
              {INSTRUMENTS.map((inst) => {
                  const isSelected = selectedInstrument === inst.id;
                  const paramKey = `vol${inst.id}` as keyof DrumParams;
                  
                  return (
                      <div key={inst.id} className="flex flex-col items-center gap-3 group">
                          <Knob 
                              label="Level" 
                              value={params[paramKey]} 
                              onChange={(v) => onUpdateParams(paramKey, v)} 
                              size={36}
                              color={isSelected ? '#eab308' : '#71717a'}
                          />
                          <button
                              onClick={() => setSelectedInstrument(inst.id)}
                              className={`
                                  w-12 h-8 rounded text-xs font-bold transition-all border border-transparent
                                  ${isSelected 
                                    ? 'bg-zinc-700 text-white border-zinc-500 shadow-[0_0_8px_rgba(255,255,255,0.1)]' 
                                    : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700'
                                  }
                              `}
                          >
                              {inst.id}
                          </button>
                          <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-green-500 led-glow-green' : 'bg-zinc-800'}`}></div>
                      </div>
                  );
              })}
          </div>

          {/* Right: FX Knobs */}
          <div className="lg:col-span-5 bg-zinc-900/80 p-4 rounded border border-zinc-700 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800"></div>
               <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-2">
                    <Settings2 size={14} className="text-zinc-500"/>
                    <span className="text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
                        {activeInstData?.label} FX
                    </span>
               </div>
               <div className="grid grid-cols-3 gap-4">
                     <Knob label="Dist" value={currentEffects.distortion} onChange={(v) => onUpdateEffects(selectedInstrument, 'distortion', v)} size={40} color="#ef4444" />
                     <Knob label="Time" value={currentEffects.delayTime} onChange={(v) => onUpdateEffects(selectedInstrument, 'delayTime', v)} size={40} color="#3b82f6" />
                     <Knob label="Mix" value={currentEffects.delayMix} onChange={(v) => onUpdateEffects(selectedInstrument, 'delayMix', v)} size={40} color="#3b82f6" />
               </div>
          </div>
      </div>

      {/* Editor Area */}
      <div className="bg-zinc-950 p-4 rounded border border-zinc-800 shadow-inner min-h-[140px] flex flex-col gap-2">
         
         {/* HEADER */}
         <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                {editorMode === 'TRIGGER' ? 'Trigger Sequence' : 'Parameter Automation'}
            </span>
            
            {editorMode === 'AUTO' && (
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                    {(['volume', 'tuning', 'decay', 'pan', 'cutoff', 'resonance', 'distortion', 'delayMix', 'delayTime', 'delayFeedback'] as DrumAutoParam[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setSelectedAutoParam(p)}
                            className={`
                                px-2 py-1 rounded text-[10px] font-bold uppercase border whitespace-nowrap transition-colors
                                ${selectedAutoParam === p 
                                    ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' 
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:border-zinc-600'
                                }
                            `}
                        >
                            {getParamLabel(p)}
                        </button>
                    ))}
                </div>
            )}
         </div>

         {/* VIEW */}
         {editorMode === 'TRIGGER' ? (
             <div className="grid grid-cols-8 md:grid-cols-16 gap-1 md:gap-2">
                {pattern[selectedInstrument].map((step) => {
                    const isCurrent = currentStep === step.id;
                    const hasAutomation = step.automation && Object.keys(step.automation).length > 0;
                    const accentColor = activeInstData?.id === 'BD' ? 'bg-red-500' : activeInstData?.id === 'SD' ? 'bg-orange-500' : 'bg-yellow-400';

                    return (
                        <div key={step.id} className="flex flex-col gap-2 items-center">
                            <div className={`w-1 h-1 rounded-full ${step.id % 4 === 0 ? 'bg-zinc-500' : 'bg-zinc-800'}`}></div>
                            <button
                                onClick={() => onUpdatePattern(selectedInstrument, step.id)}
                                className={`
                                    w-full aspect-square rounded-sm border transition-all flex items-center justify-center relative overflow-hidden
                                    ${step.active 
                                        ? `${accentColor} border-transparent shadow-[0_0_10px_rgba(255,255,255,0.3)]` 
                                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
                                    }
                                `}
                            >
                                {isCurrent && <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>}
                                {hasAutomation && <div className="absolute bottom-0.5 right-0.5 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_4px_cyan]"></div>}
                            </button>
                            <span className={`text-[10px] font-mono ${isCurrent ? 'text-white' : 'text-zinc-600'}`}>{step.id + 1}</span>
                        </div>
                    );
                })}
             </div>
         ) : (
             <DrumGraph 
                steps={pattern[selectedInstrument]} 
                param={selectedAutoParam} 
                globalVal={getGlobalValue(selectedAutoParam)}
                onUpdate={(stepId, val) => {
                    (window as any).dispatchEvent(new CustomEvent('drum-automation-update', { 
                        detail: { 
                            instrument: selectedInstrument, 
                            stepId, 
                            automation: { [selectedAutoParam]: val } 
                        }
                    }));
                }}
             />
         )}
      </div>
    </div>
  );
};

const DrumGraph = ({ steps, param, globalVal, onUpdate }: { steps: any[], param: string, globalVal: number, onUpdate: (id: number, val: number) => void }) => {
    const [isDrawing, setIsDrawing] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    
    // Numeric Edit State
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const isBipolar = param === 'tuning' || param === 'pan';
    const normalize = (val: number) => isBipolar ? val + 50 : val;
    const denormalize = (val: number) => isBipolar ? val - 50 : val;

    const handleMove = (e: any) => {
        if (!ref.current || editingIndex !== null) return;
        const rect = ref.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const x = clientX - rect.left;
        const stepW = rect.width / 16;
        const idx = Math.floor(x / stepW);
        
        const y = clientY - rect.top;
        const valNorm = 1 - Math.max(0, Math.min(1, y / rect.height));
        const valRaw = Math.round(valNorm * 100);
        
        if (idx >= 0 && idx < 16) {
            onUpdate(idx, denormalize(valRaw));
        }
    }

    const commitEdit = () => {
        if (editingIndex !== null) {
            let val = parseFloat(inputValue);
            if (!isNaN(val)) {
                const min = isBipolar ? -50 : 0;
                const max = isBipolar ? 50 : 100;
                val = Math.max(min, Math.min(max, val));
                onUpdate(editingIndex, val);
            }
        }
        setEditingIndex(null);
    };

    useEffect(() => {
        if (editingIndex !== null && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingIndex]);

    return (
        <div 
            ref={ref}
            className="h-32 bg-black border border-zinc-800 rounded relative cursor-crosshair overflow-hidden"
            onMouseDown={(e) => { setIsDrawing(true); handleMove(e); }}
            onMouseMove={(e) => isDrawing && handleMove(e)}
            onMouseUp={() => setIsDrawing(false)}
            onMouseLeave={() => setIsDrawing(false)}
            onTouchStart={(e) => { setIsDrawing(true); handleMove(e); }}
            onTouchMove={handleMove}
            onTouchEnd={() => setIsDrawing(false)}
        >
            <div className="absolute inset-0 flex">{Array.from({length:16}).map((_,i) => <div key={i} className={`flex-1 border-r border-zinc-900 ${i%4===3?'border-zinc-800':''}`}></div>)}</div>
            
            {/* Center Line for bipolar */}
            {isBipolar && <div className="absolute w-full border-t border-zinc-800 top-1/2 pointer-events-none"></div>}

            <div className="absolute w-full border-t border-dashed border-zinc-600 opacity-30 pointer-events-none" style={{bottom: `${normalize(globalVal)}%`}}></div>
            
            <div className="absolute inset-0 flex items-end px-[1px] pointer-events-none">
                {steps.map((s: any, i: number) => {
                    const auto = s.automation?.[param];
                    const isSet = auto !== undefined;
                    const val = isSet ? normalize(auto) : normalize(globalVal);
                    return (
                        <div 
                            key={i} 
                            className="flex-1 flex items-end justify-center px-[1px] h-full relative pointer-events-auto"
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                setEditingIndex(i);
                                const currentVal = isSet ? auto : globalVal;
                                setInputValue(Math.round(currentVal).toString());
                            }}
                        >
                            <div className={`w-full rounded-t-sm ${isSet ? 'bg-cyan-500 shadow-[0_0_5px_cyan]' : 'bg-zinc-800/40'}`} style={{height: `${val}%`}}></div>
                            
                            {/* Input Overlay */}
                            {editingIndex === i && (
                                <div className="absolute bottom-2 left-0 right-0 z-50 flex justify-center">
                                    <input
                                        ref={inputRef}
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onBlur={commitEdit}
                                        onKeyDown={e => e.key === 'Enter' && commitEdit()}
                                        onMouseDown={e => e.stopPropagation()}
                                        className="w-full max-w-[2rem] text-xs bg-zinc-900 text-white text-center font-mono border border-zinc-500 rounded shadow-lg outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default React.memo(DrumMachine);
