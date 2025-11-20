
import React, { useState, useRef, useEffect } from 'react';
import { Step, NoteName, SynthParams, EffectParams, Automation } from '../types';
import { NOTES } from '../constants';
import { Zap, Music, MoveRight, Lock, Activity, Sliders, MousePointer2, Waves, AudioWaveform, Layers, BarChart3, ChevronDown, Minus, Plus } from 'lucide-react';
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

  // --- Helpers ---
  const getEffectiveHarmonic = (shape: 'sawtooth' | 'square' | 'custom' | undefined, customWave: number[] | undefined, index: number): number => {
      const s = shape || 'sawtooth';
      if (s === 'custom') {
          if (customWave && customWave.length > 0) return customWave[index] ?? 0;
          return 1 / (index + 1);
      }
      if (s === 'sawtooth') return 1 / (index + 1);
      if (s === 'square') return (index % 2 === 0) ? 1 / (index + 1) : 0;
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
          return getEffectiveHarmonic(globalParams.waveShape, globalParams.customWave, selectedHarmonicIdx) * 100;
      }
  };

  const normalizeValue = (val: number): number => {
      if (autoCategory === 'PARAMS' && selectedAutoParam === 'tuning') return val + 50;
      return val;
  };

  const denormalizeValue = (normVal: number): number => {
      if (autoCategory === 'PARAMS' && selectedAutoParam === 'tuning') return normVal - 50;
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
                  automation: { ...currentAuto, [selectedAutoParam]: finalVal }
              });
          } else {
              let baseWave: number[] = [];
              
              if (currentAuto.customWave && currentAuto.customWave.length > 0) {
                  baseWave = [...currentAuto.customWave];
                  while (baseWave.length < WAVE_RESOLUTION) baseWave.push(0);
              } else {
                  const effectiveShape = currentAuto.waveShape || globalParams.waveShape;
                  const sourceCustomWave = globalParams.customWave;
                  baseWave = Array.from({length: WAVE_RESOLUTION}, (_, i) => 
                      getEffectiveHarmonic(effectiveShape, sourceCustomWave, i)
                  );
              }
              
              const newVal = Math.max(0, Math.min(100, finalVal)) / 100;
              if (baseWave.length <= selectedHarmonicIdx) {
                  while(baseWave.length <= selectedHarmonicIdx) baseWave.push(0);
              }
              baseWave[selectedHarmonicIdx] = newVal;
              
              onUpdateStep(step.id, {
                  automation: {
                      ...currentAuto,
                      customWave: baseWave,
                      waveShape: 'custom'
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
               onUpdateStep(step.id, { automation: { ...step.automation, [selectedAutoParam]: val } });
           } else {
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
               onUpdateStep(step.id, { automation: { ...currentAuto, customWave: baseWave, waveShape: 'custom' } });
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
                  if (newAuto[selectedAutoParam] !== undefined) delete newAuto[selectedAutoParam];
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
    <div className="flex flex-col gap-6 w-full h-full">
      
      {/* === EDITOR PANEL === */}
      <div className="min-h-[18rem] rounded bg-zinc-950 border border-zinc-800 shadow-xl flex flex-col relative overflow-hidden">
         
         {/* Header / Mode Switch */}
         <div className="flex items-center border-b border-zinc-800 bg-zinc-900/50">
             <button 
                onClick={() => setEditorMode('NOTE')}
                className={`px-5 py-3 text-xs font-bold uppercase flex items-center gap-2 transition-colors ${editorMode === 'NOTE' ? 'text-white bg-zinc-800 border-r border-zinc-700' : 'text-zinc-600 hover:text-zinc-400'}`}
             >
                 <Music size={16} /> Note
             </button>
             <button 
                onClick={() => setEditorMode('AUTO')}
                className={`px-5 py-3 text-xs font-bold uppercase flex items-center gap-2 transition-colors ${editorMode === 'AUTO' ? 'text-cyan-400 bg-cyan-950/30 border-r border-cyan-900/50' : 'text-zinc-600 hover:text-zinc-400'}`}
             >
                 <Activity size={16} /> Automate
             </button>
             
             <button 
                onClick={() => setEditorMode('WAVE')}
                className={`px-5 py-3 text-xs font-bold uppercase flex items-center gap-2 transition-colors ${editorMode === 'WAVE' ? 'text-purple-400 bg-purple-950/30 border-r border-purple-900/50' : 'text-zinc-600 hover:text-zinc-400'}`}
             >
                 <Waves size={16} /> Wave
             </button>

             <div className="flex-1"></div>
             {editorMode === 'AUTO' && (
                 <div className="px-2 flex gap-3">
                     <button onClick={clearLane} className="text-xs text-red-500 hover:text-red-400 uppercase font-bold px-2 py-1 rounded hover:bg-red-900/20 transition-colors">Clear Lane</button>
                     {autoCategory === 'HARMONICS' && (
                         <button onClick={resetAllHarmonics} className="text-xs text-orange-500 hover:text-orange-400 uppercase font-bold px-2 py-1 rounded hover:bg-orange-900/20 transition-colors">Reset All</button>
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
                         <div className="flex flex-col h-full justify-between gap-6">
                             <div className="flex flex-col md:flex-row gap-8 items-start md:items-end">
                                {/* Pitch */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Step Pitch</label>
                                    <div className="flex items-center gap-2">
                                        <select 
                                            className="bg-zinc-900 text-white font-mono text-3xl font-bold border border-zinc-700 rounded px-3 py-2 outline-none focus:border-red-500 shadow-lg"
                                            value={editingStep.note}
                                            onChange={(e) => onUpdateStep(editingStep.id, { note: e.target.value as NoteName })}
                                        >
                                            {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                        
                                        <div className="flex bg-zinc-900 rounded border border-zinc-700 overflow-hidden shadow-lg">
                                            <button className="px-4 py-2 hover:bg-zinc-800 text-zinc-400 active:bg-black" onClick={() => onUpdateStep(editingStep.id, { octave: Math.max(1, editingStep.octave - 1) })}>-</button>
                                            <span className="px-4 py-2 font-mono font-bold text-red-500 text-xl bg-black border-x border-zinc-800 flex items-center">{editingStep.octave}</span>
                                            <button className="px-4 py-2 hover:bg-zinc-800 text-zinc-400 active:bg-black" onClick={() => onUpdateStep(editingStep.id, { octave: Math.min(3, editingStep.octave + 1) })}>+</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-12 w-px bg-zinc-800 hidden md:block"></div>

                                {/* Wave Selection */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Step Wave Override</label>
                                    <div className="flex items-center gap-2 bg-zinc-900 rounded px-2 py-2 border border-zinc-800 shadow-md">
                                         <AudioWaveform size={16} className="text-zinc-500 ml-1" />
                                         <select 
                                             className="bg-transparent text-zinc-300 text-sm font-bold uppercase outline-none cursor-pointer min-w-[140px]"
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
                             <div className="flex gap-4 mt-4">
                                <button 
                                    onClick={() => onUpdateStep(editingStep.id, { active: !editingStep.active })}
                                    className={`flex-1 py-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${editingStep.active ? 'bg-red-900/30 border-red-500 text-red-400 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'bg-zinc-900 border-zinc-700 text-zinc-600'}`}
                                >
                                    <Music size={20} /> <span className="text-sm font-bold uppercase tracking-wider">Gate</span>
                                </button>
                                <button 
                                    onClick={() => onUpdateStep(editingStep.id, { accent: !editingStep.accent })}
                                    className={`flex-1 py-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${editingStep.accent ? 'bg-yellow-900/30 border-yellow-500 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'bg-zinc-900 border-zinc-700 text-zinc-600'}`}
                                >
                                    <Zap size={20} /> <span className="text-sm font-bold uppercase tracking-wider">Accent</span>
                                </button>
                                <button 
                                    onClick={() => onUpdateStep(editingStep.id, { slide: !editingStep.slide })}
                                    className={`flex-1 py-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${editingStep.slide ? 'bg-blue-900/30 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.2)]' : 'bg-zinc-900 border-zinc-700 text-zinc-600'}`}
                                >
                                    <MoveRight size={20} /> <span className="text-sm font-bold uppercase tracking-wider">Slide</span>
                                </button>
                             </div>
                         </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4">
                            <MousePointer2 size={32} className="animate-bounce opacity-50" />
                            <span className="font-mono text-sm uppercase tracking-widest font-bold">Select a step below to edit</span>
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
                <div className="h-full flex flex-col gap-3">
                    
                    {/* Main Categories & Controls */}
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                        <div className="flex gap-6">
                            <button 
                                onClick={() => setAutoCategory('PARAMS')}
                                className={`text-xs font-bold uppercase flex items-center gap-2 transition-colors ${autoCategory === 'PARAMS' ? 'text-cyan-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                            >
                                <Sliders size={14} /> Parameters
                            </button>
                            <button 
                                onClick={() => setAutoCategory('HARMONICS')}
                                className={`text-xs font-bold uppercase flex items-center gap-2 transition-colors ${autoCategory === 'HARMONICS' ? 'text-purple-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                            >
                                <BarChart3 size={14} /> Harmonics
                            </button>
                        </div>

                        {autoCategory === 'HARMONICS' && (
                            <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded gap-1 p-1">
                                <button 
                                    onClick={() => setSelectedHarmonicIdx(Math.max(0, selectedHarmonicIdx - 1))}
                                    className="w-6 h-full flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-sm transition-colors"
                                >
                                    <Minus size={12} />
                                </button>
                                <div className="flex flex-col items-center w-20 bg-black/40 rounded px-1">
                                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Target</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-xs text-purple-500 font-bold">#</span>
                                        <input 
                                            type="number"
                                            value={selectedHarmonicIdx + 1}
                                            min={1}
                                            max={WAVE_RESOLUTION}
                                            onChange={(e) => {
                                                const v = parseInt(e.target.value);
                                                if(!isNaN(v)) setSelectedHarmonicIdx(Math.max(0, Math.min(WAVE_RESOLUTION - 1, v - 1)));
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            className="w-10 bg-transparent text-purple-400 text-sm font-mono font-bold outline-none text-center"
                                        />
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedHarmonicIdx(Math.min(WAVE_RESOLUTION - 1, selectedHarmonicIdx + 1))}
                                    className="w-6 h-full flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-sm transition-colors"
                                >
                                    <Plus size={12} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Param Selectors (Only for PARAMS mode) */}
                    {autoCategory === 'PARAMS' && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center">
                            {(['cutoff', 'resonance', 'envMod', 'decay', 'accent', 'tuning', 'drive', 'delayMix', 'delayTime', 'delayFeedback'] as AutoParam[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setSelectedAutoParam(p)}
                                    className={`
                                        px-4 py-1.5 rounded text-xs font-bold uppercase border whitespace-nowrap transition-all flex-shrink-0
                                        ${selectedAutoParam === p 
                                            ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400'
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
                        {/* Background Grid */}
                        <div className="absolute inset-0 flex pointer-events-none">
                             {Array.from({length: 16}).map((_, i) => (
                                 <div key={i} className={`flex-1 border-r border-zinc-900/50 ${i % 4 === 3 ? 'border-zinc-800' : ''}`}></div>
                             ))}
                        </div>
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
                            {[...Array(5)].map((_, i) => <div key={i} className="w-full h-px bg-zinc-800"></div>)}
                        </div>

                        {/* Global Value Line */}
                        {autoCategory === 'PARAMS' && (
                            <div 
                                className="absolute left-0 right-0 border-t border-dashed border-zinc-500 opacity-40 pointer-events-none z-0"
                                style={{ bottom: `${normalizeValue(getGlobalValue())}%` }}
                            ></div>
                        )}

                        {/* Bars */}
                        <div className="absolute inset-0 flex items-end z-10 px-[2px] pointer-events-none gap-[2px]">
                            {steps.map((step, i) => {
                                let displayVal = 0;
                                let isSet = false;
                                
                                if (autoCategory === 'PARAMS') {
                                    const stepVal = step.automation?.[selectedAutoParam];
                                    isSet = stepVal !== undefined;
                                    displayVal = normalizeValue(stepVal !== undefined ? stepVal : getGlobalValue());
                                } else {
                                    if (step.automation?.customWave) {
                                        displayVal = (step.automation.customWave[selectedHarmonicIdx] ?? 0) * 100;
                                        isSet = true;
                                    } else {
                                        const shape = step.automation?.waveShape || globalParams.waveShape;
                                        displayVal = getEffectiveHarmonic(shape, globalParams.customWave, selectedHarmonicIdx) * 100;
                                        isSet = false;
                                    }
                                }
                                
                                let barColor = 'bg-zinc-800/50';
                                if (isSet) {
                                    barColor = autoCategory === 'PARAMS' 
                                        ? 'bg-cyan-500 shadow-[0_0_8px_cyan]' 
                                        : 'bg-purple-500 shadow-[0_0_8px_purple]';
                                }

                                return (
                                    <div 
                                        key={i} 
                                        className="flex-1 flex items-end justify-center h-full group relative pointer-events-auto"
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            setEditingAutoStep(i);
                                            setAutoInputValue(Math.round(denormalizeValue(displayVal)).toString());
                                        }}
                                    >
                                        <div 
                                            className={`w-full rounded-sm transition-all duration-100 ${barColor} ${isSet ? 'opacity-90' : 'opacity-40'}`}
                                            style={{ height: `${Math.max(0, Math.min(100, displayVal))}%` }}
                                        ></div>

                                        {/* Input Overlay */}
                                        {editingAutoStep === i && (
                                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-50 w-full px-1">
                                                <input
                                                    ref={autoInputRef}
                                                    value={autoInputValue}
                                                    onChange={e => setAutoInputValue(e.target.value)}
                                                    onBlur={commitAutoEdit}
                                                    onKeyDown={e => e.key === 'Enter' && commitAutoEdit()}
                                                    onMouseDown={e => e.stopPropagation()}
                                                    onFocus={e => e.target.select()}
                                                    className="w-full text-xs bg-white text-black text-center font-mono border-2 border-cyan-500 rounded shadow-lg outline-none py-0.5"
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
      <div className="grid grid-cols-8 md:grid-cols-16 gap-3 bg-zinc-950 p-4 rounded-lg border border-zinc-800 shadow-inner">
        {steps.map((step) => {
          const isCurrent = currentStep === step.id;
          const isEditing = editingStepId === step.id;
          
          let hasLocks = false;
          if (step.automation) {
              const keys = Object.keys(step.automation).filter(k => k !== 'customWave' && k !== 'waveShape');
              if (keys.length > 0) hasLocks = true;
              if (step.automation.customWave) hasLocks = true;
          }
          
          return (
            <div key={step.id} className="flex flex-col gap-3 items-center relative group">
              <span className="text-[10px] text-zinc-600 font-mono flex gap-1 items-center">
                  {step.id + 1}
                  {hasLocks && <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full shadow-[0_0_4px_cyan]"></div>}
              </span>

              <div className={`
                w-4 h-1.5 rounded-sm transition-all duration-75 border border-black/50
                ${isCurrent ? 'bg-red-500 led-glow-red' : 'bg-[#3a1111]'}
              `}></div>
              
              <button
                onClick={() => onStepClick(step.id)}
                className={`
                    w-full aspect-[2/3] rounded flex flex-col items-center justify-end pb-2 gap-1.5 transition-all relative
                    ${isEditing 
                        ? 'bg-zinc-300 shadow-[0_0_15px_rgba(255,255,255,0.2)] translate-y-[2px] ring-2 ring-cyan-500' 
                        : 'bg-gradient-to-b from-zinc-600 to-zinc-700 border-b-4 border-black shadow-lg hover:bg-zinc-600'
                    }
                    active:translate-y-[2px] active:border-b-0 active:shadow-none
                `}
              >
                <div className="flex gap-1 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${step.active ? 'bg-red-500 shadow-[0_0_4px_red]' : 'bg-black/40'}`}></div>
                    <div className={`w-1.5 h-1.5 rounded-full ${step.accent ? 'bg-yellow-400 shadow-[0_0_4px_yellow]' : 'bg-black/40'}`}></div>
                    <div className={`w-1.5 h-1.5 rounded-full ${step.slide ? 'bg-blue-400 shadow-[0_0_4px_blue]' : 'bg-black/40'}`}></div>
                </div>
              </button>
              
              <span className={`text-[11px] font-mono font-bold ${step.active ? 'text-zinc-300' : 'text-zinc-700'}`}>
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
