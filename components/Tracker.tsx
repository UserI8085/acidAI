
import React from 'react';
import { Step, NoteName, DrumPattern, DrumType, DrumKit } from '../types';
import { NOTES } from '../constants';
import { X, Zap, MoveRight, Music } from 'lucide-react';

interface TrackerProps {
  synths: Array<{ steps: Step[] }>;
  drums: Array<{ pattern: DrumPattern; kit: DrumKit }>;
  currentStep: number;
  onUpdateSynthStep: (synthIndex: number, stepId: number, updates: Partial<Step>) => void;
  onUpdateDrumPattern: (drumIndex: number, type: DrumType, stepId: number) => void;
  onClose: () => void;
}

const Tracker: React.FC<TrackerProps> = ({
  synths,
  drums,
  currentStep,
  onUpdateSynthStep,
  onUpdateDrumPattern,
  onClose
}) => {
  // Helper to render a synth cell
  const renderSynthCell = (synthIndex: number, step: Step) => {
    const isActive = step.active;
    
    return (
      <div className="flex items-center gap-1 px-1 h-full">
        {/* Note */}
        <div className="relative group">
            <div className={`
                w-8 text-center text-xs font-bold font-mono cursor-pointer hover:bg-zinc-700 rounded
                ${isActive ? 'text-green-400' : 'text-zinc-600'}
            `}>
                {step.note}
            </div>
            <select 
                className="absolute inset-0 opacity-0 cursor-pointer"
                value={step.note}
                onChange={(e) => onUpdateSynthStep(synthIndex, step.id, { note: e.target.value as NoteName, active: true })}
            >
                {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
        </div>

        {/* Octave */}
        <button 
            onClick={() => onUpdateSynthStep(synthIndex, step.id, { octave: step.octave >= 3 ? 1 : step.octave + 1, active: true })}
            className={`
                w-4 text-center text-xs font-mono font-bold cursor-pointer hover:bg-zinc-700 rounded
                ${isActive ? 'text-yellow-500' : 'text-zinc-600'}
            `}
        >
            {step.octave}
        </button>

        {/* Gate */}
        <button 
            onClick={() => onUpdateSynthStep(synthIndex, step.id, { active: !step.active })}
            className={`p-1 rounded hover:bg-zinc-700 ${isActive ? 'text-red-500' : 'text-zinc-700'}`}
            title="Gate"
        >
            <Music size={10} fill={isActive ? "currentColor" : "none"} />
        </button>

        {/* Accent */}
        <button 
            onClick={() => onUpdateSynthStep(synthIndex, step.id, { accent: !step.accent, active: true })}
            className={`p-1 rounded hover:bg-zinc-700 ${step.accent && isActive ? 'text-yellow-400' : 'text-zinc-700'}`}
            title="Accent"
        >
            <Zap size={10} fill={step.accent && isActive ? "currentColor" : "none"} />
        </button>

        {/* Slide */}
        <button 
            onClick={() => onUpdateSynthStep(synthIndex, step.id, { slide: !step.slide, active: true })}
            className={`p-1 rounded hover:bg-zinc-700 ${step.slide && isActive ? 'text-blue-400' : 'text-zinc-700'}`}
            title="Slide"
        >
            <MoveRight size={10} />
        </button>
      </div>
    );
  };

  // Helper to render drum triggers
  const renderDrumCell = (drumIndex: number, pattern: DrumPattern, stepId: number) => {
      const types: DrumType[] = ['BD', 'SD', 'CH', 'OH', 'CP'];
      
      return (
          <div className="flex gap-1 justify-between px-1">
              {types.map(type => {
                  const active = pattern[type][stepId].active;
                  let colorClass = 'text-zinc-700';
                  if (active) {
                      if (type === 'BD') colorClass = 'text-red-500 bg-red-900/20';
                      else if (type === 'SD') colorClass = 'text-orange-500 bg-orange-900/20';
                      else if (type.includes('H')) colorClass = 'text-yellow-500 bg-yellow-900/20';
                      else colorClass = 'text-pink-500 bg-pink-900/20';
                  }

                  return (
                      <button
                        key={type}
                        onClick={() => onUpdateDrumPattern(drumIndex, type, stepId)}
                        className={`
                            w-5 h-6 text-[9px] font-bold font-mono flex items-center justify-center rounded border border-transparent hover:border-zinc-600
                            ${colorClass}
                        `}
                      >
                          {type.substring(0, 1)}
                      </button>
                  )
              })}
          </div>
      )
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#111] flex flex-col overflow-hidden font-mono text-sm">
      
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-3 flex justify-between items-center flex-shrink-0">
        <div className="flex gap-4 items-center">
            <h2 className="text-green-500 font-bold tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span>
                TRACKER VIEW
            </h2>
            <div className="text-zinc-600 text-xs hidden sm:block uppercase tracking-widest">
                Step Editor Mode
            </div>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1">
            <span className="text-xs uppercase">Close</span>
            <X size={18} />
        </button>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr] bg-zinc-900 border-b border-zinc-800 text-zinc-500 text-[10px] font-bold uppercase sticky top-0 z-10 shadow-lg">
         <div className="p-2 text-center border-r border-zinc-800">Step</div>
         <div className="p-2 text-center border-r border-zinc-800 bg-red-900/10 text-red-500">TB-303 I</div>
         <div className="p-2 text-center border-r border-zinc-800 bg-blue-900/10 text-blue-500">TB-303 II</div>
         <div className="p-2 text-center border-r border-zinc-800 text-orange-500">Drum I ({drums[0].kit})</div>
         <div className="p-2 text-center text-yellow-500">Drum II ({drums[1].kit})</div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto flex-1 p-2">
          <div className="flex flex-col gap-[1px] pb-20">
             {Array.from({ length: 16 }).map((_, stepIndex) => {
                 const isCurrent = currentStep === stepIndex;
                 const rowBg = isCurrent ? 'bg-zinc-800 border-l-4 border-l-green-500' : stepIndex % 4 === 0 ? 'bg-zinc-900/50' : 'bg-transparent';

                 return (
                     <div 
                        key={stepIndex} 
                        className={`grid grid-cols-[3rem_1fr_1fr_1fr_1fr] h-8 items-center hover:bg-zinc-800 transition-colors border-b border-zinc-800/30 ${rowBg}`}
                     >
                         {/* Step Number */}
                         <div className={`text-center font-mono text-xs border-r border-zinc-800/50 ${isCurrent ? 'text-white font-bold' : 'text-zinc-600'}`}>
                             {stepIndex.toString().padStart(2, '0')}
                         </div>

                         {/* Synth 1 */}
                         <div className="border-r border-zinc-800/50 h-full">
                            {renderSynthCell(0, synths[0].steps[stepIndex])}
                         </div>

                         {/* Synth 2 */}
                         <div className="border-r border-zinc-800/50 h-full">
                            {renderSynthCell(1, synths[1].steps[stepIndex])}
                         </div>

                         {/* Drum 1 */}
                         <div className="border-r border-zinc-800/50 h-full flex items-center justify-center">
                             {renderDrumCell(0, drums[0].pattern, stepIndex)}
                         </div>

                         {/* Drum 2 */}
                         <div className="h-full flex items-center justify-center">
                             {renderDrumCell(1, drums[1].pattern, stepIndex)}
                         </div>
                     </div>
                 )
             })}
          </div>
      </div>
    </div>
  );
};

export default React.memo(Tracker);
