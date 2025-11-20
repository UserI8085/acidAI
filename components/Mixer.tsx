
import React from 'react';
import Fader from './Fader';
import { DrumParams, SynthParams } from '../types';
import { X } from 'lucide-react';

interface MixerProps {
    synth1Params: SynthParams;
    synth2Params: SynthParams;
    drum1Params: DrumParams;
    drum2Params: DrumParams;
    onSynth1ParamChange: (key: keyof SynthParams, val: number) => void;
    onSynth2ParamChange: (key: keyof SynthParams, val: number) => void;
    onDrum1ParamChange: (key: keyof DrumParams, val: number) => void;
    onDrum2ParamChange: (key: keyof DrumParams, val: number) => void;
    onClose: () => void;
}

const Mixer: React.FC<MixerProps> = ({ 
    synth1Params, 
    synth2Params, 
    drum1Params, 
    drum2Params,
    onSynth1ParamChange, 
    onSynth2ParamChange, 
    onDrum1ParamChange,
    onDrum2ParamChange,
    onClose
}) => {
  return (
    <div className="absolute top-20 left-0 right-0 mx-auto w-full max-w-[95%] z-50 px-2">
        <div className="bg-[#1c1c1f] rounded border border-zinc-700 shadow-2xl p-6 flex flex-col gap-6 max-h-[80vh] overflow-hidden panel-texture">
            
            <div className="flex justify-between items-center border-b border-zinc-700 pb-2 flex-shrink-0">
                <h2 className="text-zinc-300 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Quad Mixer Console
                </h2>
                <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="flex overflow-x-auto pb-4 gap-8 md:justify-center">
                
                {/* Synths */}
                <div className="flex flex-col items-center bg-zinc-900/50 p-3 rounded border border-zinc-800">
                     <span className="text-[9px] text-zinc-500 uppercase font-bold mb-2 tracking-widest">Synthesizers</span>
                     <div className="flex gap-4">
                        <Fader 
                            label="303 I" 
                            value={synth1Params.volume} 
                            onChange={(v) => onSynth1ParamChange('volume', v)} 
                            color="bg-red-500"
                        />
                        <Fader 
                            label="303 II" 
                            value={synth2Params.volume} 
                            onChange={(v) => onSynth2ParamChange('volume', v)} 
                            color="bg-blue-500"
                        />
                     </div>
                </div>

                {/* Drum I */}
                <div className="flex flex-col items-center bg-zinc-900/50 p-3 rounded border border-zinc-800">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold mb-2 tracking-widest">Drum Machine I</span>
                    <div className="flex gap-2">
                        <div className="flex gap-2 mr-2 border-r border-zinc-800 pr-2">
                            <Fader label="MAIN" value={drum1Params.volume} onChange={(v) => onDrum1ParamChange('volume', v)} color="bg-white" />
                        </div>
                        <Fader label="BD" value={drum1Params.volBD} onChange={(v) => onDrum1ParamChange('volBD', v)} color="bg-orange-500" />
                        <Fader label="SD" value={drum1Params.volSD} onChange={(v) => onDrum1ParamChange('volSD', v)} color="bg-orange-500" />
                        <Fader label="CH" value={drum1Params.volCH} onChange={(v) => onDrum1ParamChange('volCH', v)} color="bg-yellow-500" />
                        <Fader label="OH" value={drum1Params.volOH} onChange={(v) => onDrum1ParamChange('volOH', v)} color="bg-yellow-500" />
                        <Fader label="CP" value={drum1Params.volCP} onChange={(v) => onDrum1ParamChange('volCP', v)} color="bg-pink-500" />
                    </div>
                </div>

                {/* Drum II */}
                <div className="flex flex-col items-center bg-zinc-900/50 p-3 rounded border border-zinc-800">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold mb-2 tracking-widest">Drum Machine II</span>
                    <div className="flex gap-2">
                        <div className="flex gap-2 mr-2 border-r border-zinc-800 pr-2">
                            <Fader label="MAIN" value={drum2Params.volume} onChange={(v) => onDrum2ParamChange('volume', v)} color="bg-white" />
                        </div>
                        <Fader label="BD" value={drum2Params.volBD} onChange={(v) => onDrum2ParamChange('volBD', v)} color="bg-orange-500" />
                        <Fader label="SD" value={drum2Params.volSD} onChange={(v) => onDrum2ParamChange('volSD', v)} color="bg-orange-500" />
                        <Fader label="CH" value={drum2Params.volCH} onChange={(v) => onDrum2ParamChange('volCH', v)} color="bg-yellow-500" />
                        <Fader label="OH" value={drum2Params.volOH} onChange={(v) => onDrum2ParamChange('volOH', v)} color="bg-yellow-500" />
                        <Fader label="CP" value={drum2Params.volCP} onChange={(v) => onDrum2ParamChange('volCP', v)} color="bg-pink-500" />
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};

export default React.memo(Mixer);
