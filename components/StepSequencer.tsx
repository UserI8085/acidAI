
import React, { useState, useRef, useEffect } from 'react';
import { Step, NoteName, SynthParams, EffectParams, Automation } from '../types';
import { NOTES } from '../constants';
import { Zap, Music, MoveRight, Lock, Activity, Sliders, MousePointer2, Waves, AudioWaveform, Layers, BarChart3, ChevronDown } from 'lucide-react';
import HarmonicEditor from './HarmonicEditor';

interface StepSequencerProps {
  steps: Step[];
  currentStep: number;
  editingStepId: number | null;
  globalParams: SynthParams;
  globalEffects: EffectParams;
  onStepClick: (id: number) => void;
  onUpdateStep: (id: number, updates: Partial<Step>) => void;
  onUpdateGlobalParam: (key: keyof SynthParams, value: any) => void;
}

type AutoParam = 'cutoff' | 'resonance' | 'envMod' | 'decay' | 'drive' | 'delayMix' | 'tuning' | 'accent' | 'delayTime' | 'delayFeedback';
type EditorMode = 'NOTE' | 'AUTO' | 'WAVE';
type AutoCategory = 'PARAMS' | 'HARMONICS';

// Using 64 harmonics ensures that when we snapshot a Sawtooth/Square wave to a Custom wave,
// we retain enough high-frequency content to avoid a muffled/glitchy transition sound.
const WAVE_RESOLUTION = 64;

const StepSequencer: React.FC<StepSequencerProps> = ({ 
  steps, 
  currentStep, 
  editingStepId, 
  globalParams,
  globalEffects,
  onStepClick, 
  onUpdateStep,
  onUpdateGlobalParam
}) => {
  
  const [editorMode, setEditorMode] = useState<EditorMode>('NOTE');
  
  // Automation State
  const [autoCategory, setAutoCategory] = useState<AutoCategory>('PARAMS');
  const [selectedAutoParam, setSelectedAutoParam] = useState<AutoParam>('cutoff');
  const [selectedHarmonicIdx, setSelectedHarmonicIdx] = useState<number>(0); // 0-63
  
  const [isDrawing, setIsDrawing] = useState(false);
  const graphRef = useRef<HTMLDivElement>(null);

  // Numeric Editing State
  const [editingAutoStep, setEditingAutoStep] = useState<number | null>(null);
  const [autoInputValue, setAutoInputValue] = useState('');
  const autoInputRef = useRef<HTMLInputElement>(null);

  const editingStep = editingStepId !== null ? steps[editingStepId] : null;

  // --- Helpers for Automation Graph ---

  // Helper to get the effective harmonic value considering wave shape
  const getEffectiveHarmonic = (shape: 'sawtooth' | 'square' | 'custom' | undefined, customWave: number[] | undefined, index: number): number => {
      const s = shape || 'sawtooth';
      if (s === 'custom') {
          if (customWave && customWave.length > 0) {
              // Return 0 if index is out of bounds of the existing custom wave array
              return customWave[index] ?? 0;
          }
          // If custom mode is active but array is missing (rare), fallback to Sawtooth
          return 1 / (index + 1);
      }
      if (s === 'sawtooth') {
          return 1 / (index + 1);
      }
      if (s === 'square') {
          return (index % 2 === 0) ? 1 / (index + 1) : 0;
      }
      return 0;
  };

  const getGlobalValue = () => {
      if (autoCategory === 'PARAMS') {
        switch(selectedAutoParam) {
            case 'cutoff': return globalParams.cutoff;
            case 'resonance': return globalParams.resonance;
            case 'envMod': return globalParams.envMod;
            case 'decay': return globalParams.decay;
            case 'tuning': return globalParams.tuning;
            case 'accent': return globalParams.accent;
            case 'drive': return globalEffects.distortion;
            case 'delayMix': return globalEffects.delayMix;
            case 'delayTime': return globalEffects.delayTime;
            case 'delayFeedback': return globalEffects.delayFeedback;
            default: return 0;
        }
      } else {
          // Global Harmonic Value
          return getEffectiveHarmonic(globalParams.waveShape, globalParams.customWave, selectedHarmonicIdx) * 100;
      }
  };

  const normalizeValue = (val: number): number => {
      if (autoCategory === 'PARAMS' && selectedAutoParam === 'tuning') {
          return val + 50;
      }
      return val;
  };

  const denormalizeValue = (normVal: number): number => {
      if (autoCategory === 'PARAMS' && selectedAutoParam === 'tuning') {
          return normVal - 50;
      }
      return normVal;
  };

  const handleGraphInteraction = (e: React.MouseEvent | React.TouchEvent) => {
      if (!graphRef.current || editingAutoStep !== null) return;
      const rect = graphRef.current.getBoundingClientRect();
      
      let clientX, clientY;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }

      // Ensure relative coords are within bounds
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
      
      const stepWidth = rect.width / 16;
      const stepIndex = Math.min(15, Math.floor(x / stepWidth));
      
      const val = 1 - (y / rect.height); 
      const rawVal = Math.round(val * 100);
      const finalVal = denormalizeValue(rawVal);

      if (stepIndex >= 0 && stepIndex < 16) {
          const step = steps[stepIndex];
          const currentAuto = step.automation || {};

          if (autoCategory === 'PARAMS') {
              onUpdateStep(step.id, {
                  automation: {
                      ...currentAuto,
                      [selectedAutoParam]: finalVal
                  }
              });
          } else {
              // Harmonic Automation
              // 1. Determine current state to snapshot
              let baseWave: number[] = [];
              
              if (currentAuto.customWave && currentAuto.customWave.length > 0) {
                  baseWave = [...currentAuto.customWave];
                  // If existing wave is shorter than our desired resolution, pad it
                  while (baseWave.length < WAVE_RESOLUTION) baseWave.push(0);
              } else {
                  // Initialize from effective shape (Snapshotting)
                  const effectiveShape = currentAuto.waveShape || globalParams.waveShape;
                  const sourceCustomWave = globalParams.customWave;
                  
                  baseWave = Array.from({length: WAVE_RESOLUTION}, (_, i) => 
                      getEffectiveHarmonic(effectiveShape, sourceCustomWave, i)
                  );
              }
              
              // 2. Update specific harmonic
              // Limit: Don't let user set harmonic > 1.0 (100%)
              const newVal = Math.max(0, Math.min(100, finalVal)) / 100;
              
              // Optimization: If we are editing, ensure array is big enough
              if (baseWave.length <= selectedHarmonicIdx) {
                  while(baseWave.length <= selectedHarmonicIdx) baseWave.push(0);
              }
              
              baseWave[selectedHarmonicIdx] = newVal;
              
              // 3. Save back
              onUpdateStep(step.id, {
                  automation: {
                      ...currentAuto,
                      customWave: baseWave,
                      waveShape: 'custom' // Force custom mode for this step
                  }
              });
          }
      }
  };

  const commitAutoEdit = () => {
      if (editingAutoStep === null) return;
      const step = steps[editingAutoStep];
      let val = parseFloat(autoInputValue);
      
      if (!isNaN(val)) {
           if (autoCategory === 'PARAMS') {
               if (selectedAutoParam === 'tuning') val = Math.max(-50, Math.min(50, val));
               else val = Math.max(0, Math.min(100, val));
               
               onUpdateStep(step.id, {
                  automation: {
                      ...step.automation,
                      [selectedAutoParam]: val
                  }
              });
           } else {
               // Harmonic
               val = Math.max(0, Math.min(100, val));
               const currentAuto = step.automation || {};
               
               let baseWave: number[] = [];
               if (currentAuto.customWave && currentAuto.customWave.length > 0) {
                   baseWave = [...currentAuto.customWave];
                   while (baseWave.length < WAVE_RESOLUTION) baseWave.push(0);
               } else {
                   const effectiveShape = currentAuto.waveShape || globalParams.waveShape;
                   baseWave = Array.from({length: WAVE_RESOLUTION}, (_, i) => getEffectiveHarmonic(effectiveShape, globalParams.customWave, i));
               }

               baseWave[selectedHarmonicIdx] = val / 100;
               
               onUpdateStep(step.id, {
                   automation: {
                       ...currentAuto,
                       customWave: baseWave,
                       waveShape: 'custom'
                   }
               });
           }
      }
      setEditingAutoStep(null);
  };

  useEffect(() => {
      if (editingAutoStep !== null && autoInputRef.current) {
          autoInputRef.current.focus();
          autoInputRef.current.select();
      }
  }, [editingAutoStep]);

  const clearLane = () => {
      steps.forEach(step => {
          if (step.automation) {
              const newAuto = { ...step.automation };
              
              if (autoCategory === 'PARAMS') {
                  if (newAuto[selectedAutoParam] !== undefined) {
                      delete newAuto[selectedAutoParam];
                  }
              } else {
                  if (newAuto.customWave) {
                      const newWave = [...newAuto.customWave];
                      if (selectedHarmonicIdx < newWave.length) {
                         newWave[selectedHarmonicIdx] = 0;
                         newAuto.customWave = newWave;
                      }
                  }
              }

              if (Object.keys(newAuto).length === 0) onUpdateStep(step.id, { automation: undefined });
              else onUpdateStep(step.id, { automation: newAuto });
          }
      });
  };
  
  const resetAllHarmonics = () => {
      if (confirm("Reset all step-specific waveforms to use global settings?")) {
          steps.forEach(step => {
              if (step.automation) {
                  const newAuto = { ...step.automation };
                  delete newAuto.customWave;
                  delete newAuto.waveShape;
                  if(Object.keys(newAuto).length === 0) onUpdateStep(step.id, { automation: undefined });
                  else onUpdateStep(step.id, { automation: newAuto });
              }
          });
      }
  };

  const getParamLabel = (p: AutoParam) => {
      switch(p) {
          case 'envMod': return 'Env Mod';
          case 'delayMix': return 'Dly Mix';
          case 'delayTime': return 'Dly Time';
          case 'delayFeedback': return 'Dly Fbk';
          case 'drive': return 'Distortion';
          case 'tuning': return 'Tune';
          default: return p;
      }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* === EDITOR PANEL === */}
      <div className="min-h-[16rem] rounded bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col relative overflow-hidden">
         
         {/* Header / Mode Switch */}
         <div className="flex items-center border-b border-zinc-800 bg-zinc-900/50">
             <button 
                onClick={() => setEditorMode('NOTE')}
                className={`px-4 py-2 text-xs font-bold uppercase flex items-center gap-2 transition-colors ${editorMode === 'NOTE' ? 'text-white bg-zinc-800 border-r border-zinc-700' : 'text-zinc-600 hover:text-zinc-400'}`}
             >
                 <Music size={14} /> Note Edit
             </button>
             <button 
                onClick={() => setEditorMode('AUTO')}
                className={`px-4 py-2 text-xs font-bold uppercase flex items-center gap-2 transition-colors ${editorMode === 'AUTO' ? 'text-cyan-400 bg-cyan-950/30 border-r border-cyan-900/50' : 'text-zinc-600 hover:text-zinc-400'}`}
             >
                 <Activity size={14} /> Automation
             </button>
             
             <button 
                onClick={() => setEditorMode('WAVE')}
                className={`px-4 py-2 text-xs font-bold uppercase flex items-center gap-2 transition-colors ${editorMode === 'WAVE' ? 'text-purple-400 bg-purple-950/30 border-r border-purple-900/50' : 'text-zinc-600 hover:text-zinc-400'}`}
             >
                 <Waves size={14} /> Waveform
             </button>

             <div className="flex-1"></div>
             {editorMode === 'AUTO' && (
                 <div className="px-2 flex gap-2">
                     <button onClick={clearLane} className="text-[11px] text-red-500 hover:text-red-400 uppercase font-bold">Clear Lane</button>
                     {autoCategory === 'HARMONICS' && (
                         <button onClick={resetAllHarmonics} className="text-[11px] text-orange-500 hover:text-orange-400 uppercase font-bold">Reset All Steps</button>
                     )}
                 </div>
             )}
         </div>

         {/* Mode Content */}
         <div className="flex-1 relative p-4 flex flex-col">
            
            {/* --- NOTE EDITOR --- */}
            {editorMode === 'NOTE' && (
                <div className="h-full">
                    {editingStep ? (
                         <div className="flex flex-col h-full justify-between gap-4">
                             <div className="flex gap-8 items-end">
                                {/* Pitch */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] text-zinc-500 uppercase font-bold">Note</label>
                                    <div className="flex items-center gap-2">
                                        <select 
                                            className="bg-zinc-900 text-white font-mono text-2xl font-bold border border-zinc-700 rounded px-2 py-1 outline-none focus:border-red-500"
                                            value={editingStep.note}
                                            onChange={(e) => onUpdateStep(editingStep.id, { note: e.target.value as NoteName })}
                                        >
                                            {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                        
                                        <div className="flex bg-zinc-900 rounded border border-zinc-700">
                                            <button className="px-3 hover:bg-zinc-800 text-zinc-400" onClick={() => onUpdateStep(editingStep.id, { octave: Math.max(1, editingStep.octave - 1) })}>-</button>
                                            <span className="px-2 py-1 font-mono font-bold text-red-500">{editingStep.octave}</span>
                                            <button className="px-3 hover:bg-zinc-800 text-zinc-400" onClick={() => onUpdateStep(editingStep.id, { octave: Math.min(3, editingStep.octave + 1) })}>+</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-8 w-px bg-zinc-800"></div>

                                {/* Wave Selection */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[11px] text-zinc-500 uppercase font-bold">Step Wave Override</label>
                                    <div className="flex items-center gap-2 bg-zinc-900 rounded p-1 border border-zinc-800">
                                         <AudioWaveform size={14} className="text-zinc-500 ml-1" />
                                         <select 
                                             className="bg-transparent text-zinc-300 text-xs font-bold uppercase outline-none cursor-pointer"
                                             value={editingStep.automation?.waveShape || 'default'}
                                             onChange={(e) => {
                                                 const val = e.target.value;
                                                 const currentAuto = editingStep.automation || {};
                                                 
                                                 if (val === 'default') {
                                                     const newAuto = { ...currentAuto };
                                                     delete newAuto.waveShape;
                                                     delete newAuto.customWave;
                                                     onUpdateStep(editingStep.id, { automation: newAuto });
                                                 } else if (val === 'custom') {
                                                     const baseWave = editingStep.automation?.customWave || [...globalParams.customWave];
                                                     onUpdateStep(editingStep.id, { automation: { ...currentAuto, waveShape: 'custom', customWave: baseWave } });
                                                 } else {
                                                     const newAuto = { ...currentAuto, waveShape: val as any };
                                                     delete newAuto.customWave;
                                                     onUpdateStep(editingStep.id, { automation: newAuto });
                                                 }
                                             }}
                                         >
                                             <option value="default">Global Default</option>
                                             <option value="sawtooth">Sawtooth</option>
                                             <option value="square">Square</option>
                                             <option value="custom">Custom Wave</option>
                                         </select>
                                    </div>
                                </div>
                             </div>

                             {/* Toggles */}
                             <div className="flex gap-2">
                                <button 
                                    onClick={() => onUpdateStep(editingStep.id, { active: !editingStep.active })}
                                    className={`flex-1 py-2 rounded border flex items-center justify-center gap-2 transition-all ${editingStep.active ? 'bg-red-900/30 border-red-500 text-red-400' : 'bg-zinc-900 border-zinc-700 text-zinc-600'}`}
                                >
                                    <Music size={16} /> <span className="text-xs font-bold uppercase">Gate</span>
                                </button>
                                <button 
                                    onClick={() => onUpdateStep(editingStep.id, { accent: !editingStep.accent })}
                                    className={`flex-1 py-2 rounded border flex items-center justify-center gap-2 transition-all ${editingStep.accent ? 'bg-yellow-900/30 border-yellow-500 text-yellow-400' : 'bg-zinc-900 border-zinc-700 text-zinc-600'}`}
                                >
                                    <Zap size={16} /> <span className="text-xs font-bold uppercase">Accent</span>
                                </button>
                                <button 
                                    onClick={() => onUpdateStep(editingStep.id, { slide: !editingStep.slide })}
                                    className={`flex-1 py-2 rounded border flex items-center justify-center gap-2 transition-all ${editingStep.slide ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-zinc-900 border-zinc-700 text-zinc-600'}`}
                                >
                                    <MoveRight size={16} /> <span className="text-xs font-bold uppercase">Slide</span>
                                </button>
                             </div>
                         </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-2">
                            <MousePointer2 size={24} className="animate-bounce" />
                            <span className="font-mono text-xs uppercase tracking-widest">Select a step to edit notes</span>
                        </div>
                    )}
                </div>
            )}

            {/* --- HARMONICS EDITOR (WAVE TAB) --- */}
            {editorMode === 'WAVE' && (
                <div className="h-full">
                    {editingStep ? (
                         <HarmonicEditor 
                            harmonics={editingStep.automation?.customWave || globalParams.customWave} 
                            onChange={(newHarmonics) => {
                                const currentAuto = editingStep.automation || {};
                                onUpdateStep(editingStep.id, {
                                    automation: { ...currentAuto, waveShape: 'custom', customWave: newHarmonics }
                                });
                            }}
                            label={`Step ${editingStep.id + 1} Waveform`}
                            isLocked={!!editingStep.automation?.customWave}
                            onClear={() => {
                                if (editingStep.automation) {
                                    const newAuto = { ...editingStep.automation };
                                    delete newAuto.customWave;
                                    delete newAuto.waveShape;
                                    onUpdateStep(editingStep.id, { automation: newAuto });
                                }
                            }}
                        />
                    ) : (
                         <HarmonicEditor 
                            harmonics={globalParams.customWave} 
                            onChange={(newHarmonics) => {
                                onUpdateGlobalParam('customWave', newHarmonics);
                            }}
                            label="Global Waveform"
                            isLocked={false}
                        />
                    )}
                </div>
            )}

            {/* --- AUTOMATION EDITOR (AUTO TAB) --- */}
            {editorMode === 'AUTO' && (
                <div className="h-full flex flex-col gap-2">
                    
                    {/* Main Categories */}
                    <div className="flex gap-4 border-b border-zinc-800 pb-2 mb-1">
                        <button 
                            onClick={() => setAutoCategory('PARAMS')}
                            className={`text-xs font-bold uppercase flex items-center gap-1 ${autoCategory === 'PARAMS' ? 'text-cyan-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                        >
                            <Sliders size={14} /> Parameters
                        </button>
                        <button 
                            onClick={() => setAutoCategory('HARMONICS')}
                            className={`text-xs font-bold uppercase flex items-center gap-1 ${autoCategory === 'HARMONICS' ? 'text-purple-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                        >
                            <BarChart3 size={14} /> Harmonics
                        </button>

                        {autoCategory === 'HARMONICS' && (
                            <div className="ml-auto flex items-center gap-2 bg-zinc-900 p-1 rounded border border-zinc-800">
                                <span className="text-[11px] text-zinc-500 font-bold uppercase">Target:</span>
                                <select 
                                    value={selectedHarmonicIdx}
                                    onChange={(e) => setSelectedHarmonicIdx(parseInt(e.target.value))}
                                    className="bg-black border border-zinc-700 text-purple-400 text-xs font-mono rounded outline-none focus:border-purple-500 px-2 py-1 min-w-[100px]"
                                >
                                    {Array.from({ length: WAVE_RESOLUTION }).map((_, i) => (
                                        <option key={i} value={i}>
                                            Harmonic {i + 1}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Param Selectors (Only for PARAMS mode) */}
                    {autoCategory === 'PARAMS' && (
                        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide items-center min-h-[26px]">
                            {(['cutoff', 'resonance', 'envMod', 'decay', 'accent', 'tuning', 'drive', 'delayMix', 'delayTime', 'delayFeedback'] as AutoParam[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setSelectedAutoParam(p)}
                                    className={`
                                        px-3 py-1 rounded text-[11px] font-bold uppercase border whitespace-nowrap transition-colors flex-shrink-0
                                        ${selectedAutoParam === p 
                                            ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:border-zinc-600'
                                        }
                                    `}
                                >
                                    {getParamLabel(p)}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Graph Area */}
                    <div 
                        ref={graphRef}
                        className="flex-1 bg-black border border-zinc-800 rounded relative cursor-crosshair touch-none overflow-hidden"
                        onMouseDown={(e) => { setIsDrawing(true); handleGraphInteraction(e); }}
                        onMouseMove={(e) => isDrawing && handleGraphInteraction(e)}
                        onMouseUp={() => setIsDrawing(false)}
                        onMouseLeave={() => setIsDrawing(false)}
                        onTouchStart={(e) => { setIsDrawing(true); handleGraphInteraction(e); }}
                        onTouchMove={(e) => handleGraphInteraction(e)}
                        onTouchEnd={() => setIsDrawing(false)}
                    >
                        {/* Grid Lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                             {Array.from({length: 16}).map((_, i) => (
                                 <div key={i} className={`flex-1 border-r border-zinc-900 ${i % 4 === 3 ? 'border-zinc-800' : ''}`}></div>
                             ))}
                        </div>
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                            {[...Array(5)].map((_, i) => <div key={i} className="w-full h-px bg-zinc-700"></div>)}
                        </div>

                        {/* Global Value Line for Params */}
                        {autoCategory === 'PARAMS' && (
                            <div 
                                className="absolute left-0 right-0 border-t border-dashed border-zinc-600 opacity-50 pointer-events-none z-0"
                                style={{ bottom: `${normalizeValue(getGlobalValue())}%` }}
                            ></div>
                        )}

                        {/* Bars */}
                        <div className="absolute inset-0 flex items-end z-10 px-[1px] pointer-events-none">
                            {steps.map((step, i) => {
                                let displayVal = 0;
                                let isSet = false;
                                
                                if (autoCategory === 'PARAMS') {
                                    const stepVal = step.automation?.[selectedAutoParam];
                                    isSet = stepVal !== undefined;
                                    displayVal = normalizeValue(stepVal !== undefined ? stepVal : getGlobalValue());
                                } else {
                                    // Determine display value for this harmonic
                                    if (step.automation?.customWave) {
                                        // Be safe with index
                                        displayVal = (step.automation.customWave[selectedHarmonicIdx] ?? 0) * 100;
                                        isSet = true;
                                    } else {
                                        // Fallback to inherited effective shape
                                        const shape = step.automation?.waveShape || globalParams.waveShape;
                                        displayVal = getEffectiveHarmonic(shape, globalParams.customWave, selectedHarmonicIdx) * 100;
                                        isSet = false;
                                    }
                                }
                                
                                let barColor = 'bg-zinc-800/40';
                                if (isSet) {
                                    barColor = autoCategory === 'PARAMS' 
                                        ? 'bg-cyan-500 shadow-[0_0_5px_cyan]' 
                                        : 'bg-purple-500 shadow-[0_0_5px_purple]';
                                }

                                return (
                                    <div 
                                        key={i} 
                                        className="flex-1 flex items-end justify-center px-[1px] h-full group relative pointer-events-auto"
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            setEditingAutoStep(i);
                                            setAutoInputValue(Math.round(denormalizeValue(displayVal)).toString());
                                        }}
                                    >
                                        <div 
                                            className={`w-full rounded-t-sm transition-all duration-75 ${barColor}`}
                                            style={{ height: `${Math.max(0, Math.min(100, displayVal))}%` }}
                                        ></div>

                                        {/* Input Overlay */}
                                        {editingAutoStep === i && (
                                            <div className="absolute bottom-2 left-0 right-0 z-50 flex justify-center">
                                                <input
                                                    ref={autoInputRef}
                                                    value={autoInputValue}
                                                    onChange={e => setAutoInputValue(e.target.value)}
                                                    onBlur={commitAutoEdit}
                                                    onKeyDown={e => e.key === 'Enter' && commitAutoEdit()}
                                                    onMouseDown={e => e.stopPropagation()}
                                                    className="w-full max-w-[2rem] text-xs bg-zinc-900 text-white text-center font-mono border border-zinc-500 rounded shadow-lg outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

         </div>
      </div>

      {/* Step Buttons Grid */}
      <div className="grid grid-cols-8 md:grid-cols-16 gap-2 bg-zinc-950 p-4 rounded-lg border border-zinc-800 shadow-inner">
        {steps.map((step) => {
          const isCurrent = currentStep === step.id;
          const isEditing = editingStepId === step.id;
          
          let hasLocks = false;
          if (step.automation) {
              const keys = Object.keys(step.automation).filter(k => k !== 'customWave' && k !== 'waveShape');
              if (keys.length > 0) hasLocks = true;
              // If step has custom wave, it counts as a lock
              if (step.automation.customWave) hasLocks = true;
          }
          
          return (
            <div key={step.id} className="flex flex-col gap-3 items-center relative group">
              <span className="text-[10px] text-zinc-600 font-mono flex gap-1 items-center">
                  {step.id + 1}
                  {hasLocks && <div className="w-1 h-1 bg-cyan-500 rounded-full shadow-[0_0_4px_cyan]"></div>}
              </span>

              <div className={`
                w-3 h-1 rounded-sm transition-all duration-75 border border-black/50
                ${isCurrent ? 'bg-red-500 led-glow-red' : 'bg-[#3a1111]'}
              `}></div>
              
              <button
                onClick={() => onStepClick(step.id)}
                className={`
                    w-full aspect-[3/5] rounded-sm flex flex-col items-center justify-end pb-2 gap-1 transition-all relative
                    ${isEditing 
                        ? 'bg-zinc-300 shadow-[0_0_10px_rgba(255,255,255,0.2)] translate-y-[2px] ring-2 ring-cyan-500/50' 
                        : 'bg-gradient-to-b from-zinc-600 to-zinc-700 border-b-4 border-black shadow-lg hover:bg-zinc-600'
                    }
                    active:translate-y-[2px] active:border-b-0 active:shadow-none
                `}
              >
                <div className="flex gap-[2px] mb-1">
                    <div className={`w-1 h-1 rounded-full ${step.active ? 'bg-red-500 shadow-[0_0_4px_red]' : 'bg-black/30'}`}></div>
                    <div className={`w-1 h-1 rounded-full ${step.accent ? 'bg-yellow-400 shadow-[0_0_4px_yellow]' : 'bg-black/30'}`}></div>
                    <div className={`w-1 h-1 rounded-full ${step.slide ? 'bg-blue-400 shadow-[0_0_4px_blue]' : 'bg-black/30'}`}></div>
                </div>
              </button>
              
              <span className={`text-[10px] font-mono font-bold ${step.active ? 'text-zinc-400' : 'text-zinc-700'}`}>
                  {step.note}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(StepSequencer);
