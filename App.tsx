





import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Sparkles, RefreshCw, Settings2, SlidersHorizontal, TableProperties, Download, Upload, Box } from 'lucide-react';
import Knob from './components/Knob';
import StepSequencer from './components/StepSequencer';
import DrumMachine from './components/DrumMachine';
import Mixer from './components/Mixer';
import Tracker from './components/Tracker';
import AIModal from './components/AIModal';
import { audioEngine } from './services/audioEngine';
import { generateAcidPattern } from './services/geminiService';
import { Step, SynthParams, DrumPattern, DrumParams, DrumType, EffectParams, DrumEffects, DrumKit, SynthState, DrumState, ProjectData, Automation, DrumAutomation } from './types';
import { DEFAULT_STEPS, DEFAULT_PARAMS, DEFAULT_DRUM_PATTERN, DEFAULT_DRUM_PARAMS, DEFAULT_EFFECT_PARAMS, DEFAULT_DRUM_EFFECTS } from './constants';

const App: React.FC = () => {
  // --- State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [masterVolume, setMasterVolume] = useState(80);
  const [showMixer, setShowMixer] = useState(false);
  const [showTracker, setShowTracker] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  
  // Synth Selection (0 or 1)
  const [activeSynthIndex, setActiveSynthIndex] = useState<0 | 1>(0);
  
  // Dual 303 State
  const [synths, setSynths] = useState<SynthState[]>([
      { steps: DEFAULT_STEPS, params: DEFAULT_PARAMS, effects: DEFAULT_EFFECT_PARAMS, editingStepId: null },
      { steps: DEFAULT_STEPS, params: { ...DEFAULT_PARAMS, tuning: 12 }, effects: DEFAULT_EFFECT_PARAMS, editingStepId: null } // Slightly detuned 2nd synth
  ]);
  
  // Drum Selection (0 or 1)
  const [activeDrumIndex, setActiveDrumIndex] = useState<0 | 1>(0);

  // Dual Drum State
  const [drums, setDrums] = useState<DrumState[]>([
      { pattern: DEFAULT_DRUM_PATTERN, params: DEFAULT_DRUM_PARAMS, effects: DEFAULT_DRUM_EFFECTS, kit: '808' },
      { pattern: DEFAULT_DRUM_PATTERN, params: DEFAULT_DRUM_PARAMS, effects: DEFAULT_DRUM_EFFECTS, kit: '909' }
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Initialization ---
  useEffect(() => {
    audioEngine.updateState(
        synths.map(s => ({ steps: s.steps, params: s.params, effects: s.effects })),
        drums.map(d => ({ pattern: d.pattern, params: d.params, effects: d.effects, kit: d.kit })),
        (stepIndex) => {
            setCurrentStep(stepIndex);
        }
    );
  }, [synths, drums]);

  useEffect(() => {
      audioEngine.setMasterVolume(masterVolume);
  }, [masterVolume]);

  // Listen for Drum Automation Events from DrumMachine component
  useEffect(() => {
      const handleDrumAuto = (e: Event) => {
          const detail = (e as CustomEvent).detail;
          if (detail) {
              const { instrument, stepId, automation } = detail;
              setDrums(prev => {
                  const next = [...prev];
                  const currentDrum = next[activeDrumIndex];
                  const currentPattern = currentDrum.pattern;
                  const newSteps = currentPattern[instrument as DrumType].map(s => {
                      if (s.id === stepId) {
                          return {
                              ...s,
                              automation: { ...s.automation, ...automation }
                          };
                      }
                      return s;
                  });
                  
                  next[activeDrumIndex] = {
                      ...currentDrum,
                      pattern: {
                          ...currentPattern,
                          [instrument as DrumType]: newSteps
                      }
                  };
                  return next;
              });
          }
      };
      window.addEventListener('drum-automation-update', handleDrumAuto);
      return () => window.removeEventListener('drum-automation-update', handleDrumAuto);
  }, [activeDrumIndex]);

  // --- Handlers ---
  const togglePlay = useCallback(() => {
    audioEngine.init();
    audioEngine.toggle();
    setIsPlaying(prev => {
        const next = !prev;
        if (next) setCurrentStep(-1);
        return next;
    });
  }, [isPlaying]);

  const updateActiveSynth = useCallback((updater: (prev: typeof synths[0]) => typeof synths[0]) => {
      setSynths(prev => {
          const next = [...prev];
          next[activeSynthIndex] = updater(next[activeSynthIndex]);
          return next;
      });
  }, [activeSynthIndex]);

  const handleStepUpdate = useCallback((id: number, updates: Partial<Step>) => {
    updateActiveSynth(s => ({
        ...s,
        steps: s.steps.map(step => step.id === id ? { ...step, ...updates } : step)
    }));
  }, [updateActiveSynth]);

  const activeSynth = synths[activeSynthIndex];
  const activeDrum = drums[activeDrumIndex];
  const editingStep = activeSynth.editingStepId !== null ? activeSynth.steps[activeSynth.editingStepId] : null;

  // --- Parameter Logic ---
  
  const handleParamChange = useCallback((key: keyof SynthParams, value: any) => {
    updateActiveSynth(s => ({ ...s, params: { ...s.params, [key]: value } }));
  }, [updateActiveSynth]);

  const handleSynthEffectChange = useCallback((key: keyof EffectParams, value: number) => {
    updateActiveSynth(s => ({ ...s, effects: { ...s.effects, [key]: value } }));
  }, [updateActiveSynth]);

  const handleEditingStepChange = useCallback((id: number | null) => {
      updateActiveSynth(s => ({ ...s, editingStepId: s.editingStepId === id ? null : id }));
  }, [updateActiveSynth]);

  // --- Standard Handlers ---

  const handleSynthParamByIndex = useCallback((index: number, key: keyof SynthParams, value: any) => {
      setSynths(prev => {
          const next = [...prev];
          next[index] = { ...next[index], params: { ...next[index].params, [key]: value } };
          return next;
      });
  }, []);

  const handleSynthStepByIndex = useCallback((index: number, stepId: number, updates: Partial<Step>) => {
      setSynths(prev => {
          const next = [...prev];
          next[index] = {
              ...next[index],
              steps: next[index].steps.map(s => s.id === stepId ? { ...s, ...updates } : s)
          };
          return next;
      });
  }, []);

  const updateActiveDrum = useCallback((updater: (prev: typeof drums[0]) => typeof drums[0]) => {
      setDrums(prev => {
          const next = [...prev];
          next[activeDrumIndex] = updater(next[activeDrumIndex]);
          return next;
      });
  }, [activeDrumIndex]);

  const handleDrumPatternUpdate = useCallback((type: DrumType, stepId: number) => {
      updateActiveDrum(d => ({
          ...d,
          pattern: {
              ...d.pattern,
              [type]: d.pattern[type].map(s => s.id === stepId ? { ...s, active: !s.active } : s)
          }
      }));
  }, [updateActiveDrum]);
  
  const handleDrumPatternByIndex = useCallback((index: number, type: DrumType, stepId: number) => {
      setDrums(prev => {
          const next = [...prev];
          next[index] = {
              ...next[index],
              pattern: {
                  ...next[index].pattern,
                  [type]: next[index].pattern[type].map(s => s.id === stepId ? { ...s, active: !s.active } : s)
              }
          };
          return next;
      });
  }, []);

  const handleDrumParamUpdate = useCallback((key: keyof DrumParams, value: number) => {
      updateActiveDrum(d => ({ ...d, params: { ...d.params, [key]: value } }));
  }, [updateActiveDrum]);
  
  const handleDrumParamByIndex = useCallback((index: number, key: keyof DrumParams, value: number) => {
      setDrums(prev => {
          const next = [...prev];
          next[index] = { ...next[index], params: { ...next[index].params, [key]: value } };
          return next;
      });
  }, []);

  const handleDrumEffectUpdate = useCallback((type: DrumType, key: keyof EffectParams, value: number) => {
      updateActiveDrum(d => ({
          ...d,
          effects: {
              ...d.effects,
              [type]: { ...d.effects[type], [key]: value }
          }
      }));
  }, [updateActiveDrum]);

  const handleDrumKitUpdate = useCallback((kit: DrumKit) => {
      updateActiveDrum(d => ({ ...d, kit }));
  }, [updateActiveDrum]);

  const handleGenerateWithPrompt = async (prompt: string) => {
    setIsGenerating(true);
    const result = await generateAcidPattern(prompt);
    updateActiveSynth(s => ({ ...s, steps: result.steps }));
    updateActiveDrum(d => ({ ...d, pattern: result.drums || DEFAULT_DRUM_PATTERN }));
    setIsGenerating(false);
    setShowAIModal(false);
  };

  const handleRandomize = useCallback(() => {
     const newSteps = synths[activeSynthIndex].steps.map(s => ({
         ...s,
         active: Math.random() > 0.3,
         accent: Math.random() > 0.7,
         slide: Math.random() > 0.8,
         octave: Math.floor(Math.random() * 3) + 1,
         note: (['C', 'D#', 'F', 'G', 'A#'] as const)[Math.floor(Math.random() * 5)]
     }));
     updateActiveSynth(s => ({ ...s, steps: newSteps }));

     const newDrums: DrumPattern = { ...drums[activeDrumIndex].pattern };
     (['BD', 'SD', 'CH', 'OH', 'CP'] as DrumType[]).forEach(type => {
         newDrums[type] = newDrums[type].map(s => ({
             ...s,
             active: Math.random() > (type === 'BD' || type === 'CH' ? 0.6 : 0.8)
         }));
     });
     updateActiveDrum(d => ({ ...d, pattern: newDrums }));
  }, [synths, drums, activeSynthIndex, activeDrumIndex, updateActiveSynth, updateActiveDrum]);

  const handleSaveProject = () => {
      const data: ProjectData = {
          version: "1.0.0",
          synths,
          drums,
          masterVolume
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `acidgen-project-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleLoadClick = () => {
      if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const text = ev.target?.result as string;
              const data = JSON.parse(text) as ProjectData;
              if (data.synths && data.drums) {
                  const mergedSynths = data.synths.map(s => ({
                      ...s,
                      params: { ...DEFAULT_PARAMS, ...s.params },
                      effects: { ...DEFAULT_EFFECT_PARAMS, ...s.effects }
                  }));
                  const mergedDrums = data.drums.map(d => ({
                      ...d,
                      params: { ...DEFAULT_DRUM_PARAMS, ...d.params },
                      effects: (['BD', 'SD', 'CH', 'OH', 'CP'] as DrumType[]).reduce((acc, type) => {
                          acc[type] = { ...DEFAULT_EFFECT_PARAMS, ...d.effects[type] };
                          return acc;
                      }, {} as DrumEffects)
                  }));
                  setSynths(mergedSynths);
                  setDrums(mergedDrums);
                  if (data.masterVolume !== undefined) setMasterVolume(data.masterVolume);
                  if (fileInputRef.current) fileInputRef.current.value = '';
              } else {
                  alert("Invalid project file.");
              }
          } catch (err) {
              console.error(err);
              alert("Failed to load project file.");
          }
      };
      reader.readAsText(file);
  };

  // Colors
  const baseColor = activeSynthIndex === 0 ? '#ef4444' : '#3b82f6'; 

  const getKnobColor = (key: keyof SynthParams) => baseColor;
  const getFxKnobColor = (key: keyof EffectParams) => (key === 'distortion' ? '#ef4444' : '#3b82f6');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 md:p-8 font-sans">
      
      <AIModal 
        isOpen={showAIModal} 
        isGenerating={isGenerating}
        onClose={() => setShowAIModal(false)}
        onGenerate={handleGenerateWithPrompt}
      />
      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
      
      {/* Rack Container */}
      <div className="w-full max-w-6xl bg-[#0a0a0a] border-4 border-[#111] rounded-lg shadow-2xl flex flex-col gap-1 relative">
        {/* Handles */}
        <div className="absolute -left-8 top-20 bottom-20 w-6 bg-zinc-800 rounded-l-full border-r-4 border-black shadow-lg hidden xl:block"></div>
        <div className="absolute -right-8 top-20 bottom-20 w-6 bg-zinc-800 rounded-r-full border-l-4 border-black shadow-lg hidden xl:block"></div>

        {/* === RACK UNIT 1: MASTER & UTILS === */}
        <div className="panel-texture border-b-2 border-black p-4 flex flex-col md:flex-row items-center justify-between relative z-20">
            {/* Brand */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-zinc-800 to-black border border-zinc-700 rounded flex items-center justify-center shadow-lg">
                    <Box size={24} className="text-red-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-black italic tracking-tighter text-zinc-200">ACIDGEN<span className="text-red-500">303</span></h1>
                    <p className="text-xs text-zinc-500 font-mono tracking-widest uppercase">Hybrid Analog/AI Workstation</p>
                </div>
            </div>

            {/* Transport */}
            <div className="flex items-center gap-8 my-4 md:my-0 bg-black/30 p-2 rounded-lg border border-zinc-800">
                 <div className="flex flex-col items-center gap-1">
                      <Knob label="Tempo" value={activeSynth.params.tempo} min={60} max={200} onChange={(v) => handleParamChange('tempo', v)} size={45} color="#eab308" />
                 </div>
                 
                 <button 
                    onClick={togglePlay}
                    className={`
                        w-16 h-16 rounded-full flex items-center justify-center border-4 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]
                        ${isPlaying 
                            ? 'bg-red-600 border-red-800 text-white shadow-[0_0_30px_rgba(220,38,38,0.4)] scale-95' 
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                        }
                    `}
                 >
                     {isPlaying ? <Square fill="currentColor" size={24} /> : <Play fill="currentColor" className="ml-1" size={32} />}
                 </button>

                 <div className="flex flex-col items-center gap-1">
                      <Knob label="Master" value={masterVolume} onChange={setMasterVolume} size={45} color="#fff" />
                 </div>
            </div>

            {/* Tools */}
            <div className="flex gap-2">
                 <button onClick={() => setShowTracker(true)} className="p-2 bg-zinc-800 border border-zinc-700 rounded hover:bg-zinc-700 text-zinc-400 hover:text-green-400 transition-colors" title="Tracker">
                    <TableProperties size={20} />
                 </button>
                 <button onClick={() => setShowMixer(true)} className="p-2 bg-zinc-800 border border-zinc-700 rounded hover:bg-zinc-700 text-zinc-400 hover:text-blue-400 transition-colors" title="Mixer">
                    <SlidersHorizontal size={20} />
                 </button>
                 <button onClick={handleRandomize} className="p-2 bg-zinc-800 border border-zinc-700 rounded hover:bg-zinc-700 text-zinc-400 hover:text-yellow-400 transition-colors" title="Randomize">
                    <RefreshCw size={20} />
                 </button>
                 <button onClick={() => setShowAIModal(true)} className="px-4 py-2 bg-gradient-to-r from-indigo-900 to-purple-900 border border-indigo-700 rounded hover:from-indigo-800 hover:to-purple-800 text-indigo-200 font-bold text-xs uppercase flex items-center gap-2 transition-all shadow-lg" title="AI Generate">
                    <Sparkles size={16} />
                    AI Gen
                 </button>
                 <div className="w-px h-8 bg-zinc-800 mx-2"></div>
                 <button onClick={handleSaveProject} className="p-2 bg-zinc-900 border border-zinc-800 rounded text-zinc-500 hover:text-zinc-300" title="Save"><Download size={18}/></button>
                 <button onClick={handleLoadClick} className="p-2 bg-zinc-900 border border-zinc-800 rounded text-zinc-500 hover:text-zinc-300" title="Load"><Upload size={18}/></button>
            </div>
        </div>

        {/* === RACK UNIT 2: 303 SYNTH === */}
        <div className="panel-texture p-1 relative border-b-2 border-black">
            {/* Rack Ears */}
            <div className="absolute top-2 left-2 text-zinc-700 text-[10px]">⊕</div>
            <div className="absolute top-2 right-2 text-zinc-700 text-[10px]">⊕</div>
            <div className="absolute bottom-2 left-2 text-zinc-700 text-[10px]">⊕</div>
            <div className="absolute bottom-2 right-2 text-zinc-700 text-[10px]">⊕</div>

            <div className="bg-[#18181b] m-1 rounded border border-zinc-800 p-4 flex flex-col lg:flex-row gap-8">
                
                {/* Left: Control Cluster */}
                <div className="flex-shrink-0 w-full lg:w-80 flex flex-col gap-6 border-r border-zinc-800 pr-6">
                    {/* Selector Switch */}
                    <div className="flex bg-black rounded p-1 border border-zinc-800 shadow-inner">
                        <button 
                            onClick={() => setActiveSynthIndex(0)}
                            className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeSynthIndex === 0 ? 'bg-red-900 text-red-100 shadow-[0_0_10px_rgba(220,38,38,0.3)]' : 'text-zinc-600 hover:text-zinc-400'}`}
                        >
                            Unit A
                        </button>
                        <div className="w-px bg-zinc-800 mx-1"></div>
                        <button 
                            onClick={() => setActiveSynthIndex(1)}
                            className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeSynthIndex === 1 ? 'bg-blue-900 text-blue-100 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'text-zinc-600 hover:text-zinc-400'}`}
                        >
                            Unit B
                        </button>
                    </div>

                    {/* Filter Section */}
                    <div className="space-y-2 relative">
                        <h3 className="text-[11px] uppercase font-bold border-b pb-1 mb-2 text-zinc-500 border-zinc-800">
                            VCF / Envelope
                        </h3>
                        <div className="grid grid-cols-3 gap-y-6">
                            <Knob label="Cutoff" value={activeSynth.params.cutoff} onChange={(v) => handleParamChange('cutoff', v)} size={45} color={getKnobColor('cutoff')} />
                            <Knob label="Resonance" value={activeSynth.params.resonance} onChange={(v) => handleParamChange('resonance', v)} size={45} color={getKnobColor('resonance')} />
                            <Knob label="Env Mod" value={activeSynth.params.envMod} onChange={(v) => handleParamChange('envMod', v)} size={45} color={getKnobColor('envMod')} />
                            <Knob label="Decay" value={activeSynth.params.decay} onChange={(v) => handleParamChange('decay', v)} size={45} color={getKnobColor('decay')} />
                            <Knob label="Accent" value={activeSynth.params.accent} onChange={(v) => handleParamChange('accent', v)} size={45} color={baseColor} />
                            <Knob label="Tune" value={activeSynth.params.tuning} min={-50} max={50} onChange={(v) => handleParamChange('tuning', v)} size={45} color={baseColor} paramDisplay="c" />
                        </div>
                    </div>

                    {/* FX Section */}
                    <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                             <span className="text-[11px] font-bold uppercase text-zinc-500">Effects Chain</span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                            <Knob label="Dist" value={activeSynth.effects.distortion} onChange={(v) => handleSynthEffectChange('distortion', v)} size={40} color={getFxKnobColor('distortion')} />
                            <Knob label="Delay" value={activeSynth.effects.delayMix} onChange={(v) => handleSynthEffectChange('delayMix', v)} size={40} color={getFxKnobColor('delayMix')} />
                            <Knob label="Time" value={activeSynth.effects.delayTime} onChange={(v) => handleSynthEffectChange('delayTime', v)} size={40} color="#3b82f6" />
                            <Knob label="Fdbk" value={activeSynth.effects.delayFeedback} onChange={(v) => handleSynthEffectChange('delayFeedback', v)} size={40} color="#3b82f6" />
                        </div>
                    </div>
                </div>

                {/* Right: Sequencer & Wave */}
                <div className="flex-1 flex flex-col gap-6">
                     {/* Waveform Selector */}
                     <div className="flex items-center gap-4 bg-zinc-900/30 p-2 rounded border border-zinc-800">
                          <span className="text-[11px] font-bold text-zinc-500 uppercase px-2">VCO Mode</span>
                          <div className="flex gap-1">
                              {(['sawtooth', 'square', 'custom'] as const).map(shape => (
                                  <button 
                                    key={shape}
                                    onClick={() => handleParamChange('waveShape', shape)}
                                    className={`px-3 py-1 rounded text-[11px] font-bold uppercase border ${activeSynth.params.waveShape === shape ? `border-${activeSynthIndex===0?'red':'blue'}-500/50 bg-${activeSynthIndex===0?'red':'blue'}-900/20 text-white` : 'border-zinc-700 bg-zinc-800 text-zinc-500'}`}
                                  >
                                      {shape === 'custom' ? 'Additive' : shape.substring(0,3)}
                                  </button>
                              ))}
                          </div>
                     </div>

                     <StepSequencer 
                        steps={activeSynth.steps} 
                        currentStep={currentStep}
                        editingStepId={activeSynth.editingStepId}
                        globalParams={activeSynth.params}
                        globalEffects={activeSynth.effects}
                        onStepClick={handleEditingStepChange}
                        onUpdateStep={handleStepUpdate}
                        onUpdateGlobalParam={handleParamChange}
                     />
                </div>
            </div>
        </div>

        {/* === RACK UNIT 3: DRUMS === */}
        <div className="panel-texture p-1 relative">
             {/* Rack Ears */}
             <div className="absolute top-2 left-2 text-zinc-700 text-[10px]">⊕</div>
             <div className="absolute top-2 right-2 text-zinc-700 text-[10px]">⊕</div>
             <div className="absolute bottom-2 left-2 text-zinc-700 text-[10px]">⊕</div>
             <div className="absolute bottom-2 right-2 text-zinc-700 text-[10px]">⊕</div>
             
             <div className="bg-[#18181b] m-1 rounded border border-zinc-800 p-4 flex flex-col md:flex-row gap-6">
                 
                 {/* Drum Selector */}
                 <div className="w-full md:w-24 flex md:flex-col gap-2 border-b md:border-b-0 md:border-r border-zinc-800 pb-4 md:pb-0 md:pr-4">
                     <button 
                        onClick={() => setActiveDrumIndex(0)}
                        className={`flex-1 py-4 rounded text-xs font-black uppercase tracking-widest writing-mode-vertical transition-all ${activeDrumIndex === 0 ? 'bg-orange-900/50 text-orange-200 border border-orange-700/50 shadow-[inset_0_0_10px_rgba(249,115,22,0.2)]' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'}`}
                     >
                        Drum I
                     </button>
                     <button 
                        onClick={() => setActiveDrumIndex(1)}
                        className={`flex-1 py-4 rounded text-xs font-black uppercase tracking-widest transition-all ${activeDrumIndex === 1 ? 'bg-yellow-900/50 text-yellow-200 border border-yellow-700/50 shadow-[inset_0_0_10px_rgba(234,179,8,0.2)]' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'}`}
                     >
                        Drum II
                     </button>
                 </div>

                 {/* Machine UI */}
                 <div className="flex-1">
                     <DrumMachine 
                        pattern={activeDrum.pattern}
                        params={activeDrum.params}
                        effects={activeDrum.effects}
                        kit={activeDrum.kit}
                        currentStep={currentStep}
                        onUpdatePattern={handleDrumPatternUpdate}
                        onUpdateParams={handleDrumParamUpdate}
                        onUpdateEffects={handleDrumEffectUpdate}
                        onUpdateKit={handleDrumKitUpdate}
                     />
                 </div>
             </div>
        </div>

      </div>
      
      {/* Footer */}
      <div className="mt-8 text-zinc-600 text-xs font-mono">
          ACIDGEN v3.2 | AUDIO ENGINE: {audioEngine ? 'ONLINE' : 'OFFLINE'}
      </div>
      
      {/* Modals */}
      {showMixer && (
        <Mixer 
            synth1Params={synths[0].params}
            synth2Params={synths[1].params}
            drum1Params={drums[0].params}
            drum2Params={drums[1].params}
            onSynth1ParamChange={(k, v) => handleSynthParamByIndex(0, k, v)}
            onSynth2ParamChange={(k, v) => handleSynthParamByIndex(1, k, v)}
            onDrum1ParamChange={(k, v) => handleDrumParamByIndex(0, k, v)}
            onDrum2ParamChange={(k, v) => handleDrumParamByIndex(1, k, v)}
            onClose={() => setShowMixer(false)}
        />
      )}

      {showTracker && (
        <Tracker
            synths={synths}
            drums={drums}
            currentStep={currentStep}
            onUpdateSynthStep={handleSynthStepByIndex}
            onUpdateDrumPattern={handleDrumPatternByIndex}
            onClose={() => setShowTracker(false)}
        />
      )}

    </div>
  );
};

export default App;
