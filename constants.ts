
import { Step, NoteName, DrumPattern, DrumParams, EffectParams, DrumEffects, DrumType, SynthParams } from './types';

export const NOTES: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const DEFAULT_STEPS: Step[] = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  active: i % 4 === 0, // Default basic beat
  note: 'C',
  octave: 2,
  accent: false,
  slide: false,
}));

// Default to a Sawtooth approximation (1/n) for richer initial sound
// Increased to 64 harmonics for better fidelity and smoother transitions from native oscillators
const DEFAULT_HARMONICS = Array.from({ length: 64 }, (_, i) => {
    return 1 / (i + 1);
});

export const DEFAULT_PARAMS: SynthParams = {
  waveShape: 'sawtooth',
  customWave: DEFAULT_HARMONICS,
  cutoff: 50,
  resonance: 60,
  envMod: 40,
  decay: 40,
  accent: 50,
  volume: 70,
  tempo: 120,
  tuning: 0,
};

export const DEFAULT_EFFECT_PARAMS: EffectParams = {
  distortion: 0,
  delayTime: 25,
  delayFeedback: 30,
  delayMix: 0,
};

export const DEFAULT_DRUM_PATTERN: DrumPattern = {
    'BD': Array.from({ length: 16 }, (_, i) => ({ id: i, active: i % 4 === 0 })),
    'SD': Array.from({ length: 16 }, (_, i) => ({ id: i, active: i % 8 === 4 })),
    'CH': Array.from({ length: 16 }, (_, i) => ({ id: i, active: i % 2 === 0 })), // 8th notes
    'OH': Array.from({ length: 16 }, (_, i) => ({ id: i, active: i % 8 === 2 })), // Off-beat
    'CP': Array.from({ length: 16 }, (_, i) => ({ id: i, active: false })),
};

export const DEFAULT_DRUM_PARAMS: DrumParams = {
    volume: 80,
    volBD: 80,
    volSD: 70,
    volCH: 50,
    volOH: 50,
    volCP: 60,
};

export const DEFAULT_DRUM_EFFECTS: DrumEffects = {
    'BD': { ...DEFAULT_EFFECT_PARAMS },
    'SD': { ...DEFAULT_EFFECT_PARAMS },
    'CH': { ...DEFAULT_EFFECT_PARAMS },
    'OH': { ...DEFAULT_EFFECT_PARAMS },
    'CP': { ...DEFAULT_EFFECT_PARAMS },
};

// Frequency map for notes starting at C1 (approx 32.7Hz)
const BASE_FREQ_C1 = 32.703;
export const getFrequency = (note: NoteName, octave: number): number => {
  const semitones = NOTES.indexOf(note);
  // Base calculation relative to C1
  // Octave 1 is base, Octave 2 is x2, Octave 3 is x4
  const octaveMultiplier = Math.pow(2, octave - 1);
  const noteMultiplier = Math.pow(2, semitones / 12);
  return BASE_FREQ_C1 * octaveMultiplier * noteMultiplier;
};
