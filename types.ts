

export type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export interface Automation {
  cutoff?: number;
  resonance?: number;
  envMod?: number;
  decay?: number;
  accent?: number; // Accent Intensity (0-100)
  tuning?: number; // (-50 to 50)
  drive?: number; // Input gain to distortion (0-100)
  delayMix?: number; // Delay Dry/Wet (0-100)
  delayTime?: number; // (0-100)
  delayFeedback?: number; // (0-100)
  customWave?: number[]; // Array of harmonics for per-step additive synthesis
  waveShape?: 'sawtooth' | 'square' | 'custom';
}

export interface Step {
  id: number;
  active: boolean;
  note: NoteName;
  octave: number; // 1, 2, 3
  accent: boolean;
  slide: boolean;
  automation?: Automation;
}

export interface SynthParams {
  waveShape: 'sawtooth' | 'square' | 'custom';
  customWave: number[]; // Array of harmonic amplitudes (0-1)
  cutoff: number; // 0-100
  resonance: number; // 0-100
  envMod: number; // 0-100
  decay: number; // 0-100
  accent: number; // 0-100
  volume: number; // 0-100
  tempo: number; // 60-200
  tuning: number; // -50 to 50 cents
}

export interface EffectParams {
  distortion: number; // 0-100 (Drive)
  delayTime: number; // 0-100 (Time)
  delayFeedback: number; // 0-100 (Feedback)
  delayMix: number; // 0-100 (Dry/Wet)
}

// --- Drum Machine Types ---

export type DrumType = 'BD' | 'SD' | 'CH' | 'OH' | 'CP';
export type DrumKit = '808' | '909';

export interface DrumAutomation {
    volume?: number;
    tuning?: number; // -50 to 50
    decay?: number; // 0-100
    pan?: number; // -50 to 50 (Left to Right)
    cutoff?: number; // 0-100
    resonance?: number; // 0-100
    distortion?: number;
    delayMix?: number;
    delayTime?: number;
    delayFeedback?: number;
}

export interface DrumStep {
  id: number;
  active: boolean;
  automation?: DrumAutomation;
}

export type DrumPattern = Record<DrumType, DrumStep[]>;

export interface DrumParams {
  volume: number; // Master volume for the drum machine
  volBD: number;
  volSD: number;
  volCH: number;
  volOH: number;
  volCP: number;
}

export type DrumEffects = Record<DrumType, EffectParams>;

export interface GeminiPatternResponse {
  pattern: {
    note: string;
    octave: number;
    accent: boolean;
    slide: boolean;
    active: boolean;
  }[];
  drums?: {
    BD: boolean[];
    SD: boolean[];
    CH: boolean[];
    OH: boolean[];
    CP: boolean[];
  };
}

export interface SynthState {
    steps: Step[];
    params: SynthParams;
    effects: EffectParams;
    editingStepId: number | null;
}

export interface DrumState {
    pattern: DrumPattern;
    params: DrumParams;
    effects: DrumEffects;
    kit: DrumKit;
}

export interface ProjectData {
    version: string;
    synths: SynthState[];
    drums: DrumState[];
    masterVolume: number;
}