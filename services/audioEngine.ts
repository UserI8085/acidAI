
import { SynthParams, Step, DrumPattern, DrumParams, DrumType, EffectParams, DrumEffects, DrumKit, DrumStep, DrumAutomation } from '../types';
import { getFrequency } from '../constants';

class FXChain {
    public input: GainNode;
    public output: GainNode;
    private distortionNode: WaveShaperNode;
    private delayNode: DelayNode;
    private delayFeedbackNode: GainNode;
    private delayDryNode: GainNode;
    private delayWetNode: GainNode;
    private makeupGain: GainNode;
    private lastDistortionValue: number = -999; // Force update on first run

    // Optimization: Cache the curve to avoid garbage collection churn
    private curveCache: Float32Array | null = null;

    constructor(ctx: AudioContext) {
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        
        this.distortionNode = ctx.createWaveShaper();
        this.distortionNode.oversample = '4x'; // Better quality for distortion

        // Makeup gain to compensate for distortion curve attenuation
        this.makeupGain = ctx.createGain();
        this.makeupGain.gain.value = 1.0;

        this.delayNode = ctx.createDelay(2.0);
        
        this.delayFeedbackNode = ctx.createGain();
        this.delayFeedbackNode.gain.value = 0; 

        this.delayDryNode = ctx.createGain();
        this.delayDryNode.gain.value = 1; 

        this.delayWetNode = ctx.createGain();
        this.delayWetNode.gain.value = 0; 

        // Routing
        // Input -> Distortion -> Makeup -> Split
        this.input.connect(this.distortionNode);
        this.distortionNode.connect(this.makeupGain);
        
        this.makeupGain.connect(this.delayDryNode);
        this.makeupGain.connect(this.delayNode);

        // Delay Loop
        this.delayNode.connect(this.delayFeedbackNode);
        this.delayFeedbackNode.connect(this.delayNode);
        this.delayNode.connect(this.delayWetNode);

        // Sum to Output
        this.delayDryNode.connect(this.output);
        this.delayWetNode.connect(this.output);
    }

    public update(params: EffectParams, ctx: AudioContext) {
        const now = ctx.currentTime;

        // Distortion
        const distAmount = isNaN(params.distortion) ? 0 : params.distortion;
        
        // Check if changed significantly or first run
        if (Math.abs(this.lastDistortionValue - distAmount) > 0.1) { 
            if (distAmount <= 0) {
                // Bypass distortion curve for clean signal
                this.distortionNode.curve = null;
            } else {
                const k = distAmount * 5; 
                this.distortionNode.curve = this.makeDistortionCurve(k);
            }
            this.lastDistortionValue = distAmount;
        }

        // Delay (Base values, can be overridden by scheduler)
        const timeS = (params.delayTime / 100) * 1.0; 
        this.delayNode.delayTime.setTargetAtTime(Math.max(0.01, timeS), now, 0.1);
        
        const fb = (params.delayFeedback / 100) * 0.95;
        this.delayFeedbackNode.gain.setTargetAtTime(fb, now, 0.1);
        
        const mix = params.delayMix / 100;
        this.delayDryNode.gain.setTargetAtTime(1.0 - mix, now, 0.1);
        this.delayWetNode.gain.setTargetAtTime(mix, now, 0.1);
    }

    public scheduleDelayMix(mixPercent: number, time: number) {
        const mix = Math.max(0, Math.min(100, mixPercent)) / 100;
        this.delayDryNode.gain.setTargetAtTime(1.0 - mix, time, 0.02);
        this.delayWetNode.gain.setTargetAtTime(mix, time, 0.02);
    }

    public scheduleDelayTime(timePercent: number, time: number) {
        const timeS = Math.max(0.01, (timePercent / 100) * 1.0);
        this.delayNode.delayTime.setTargetAtTime(timeS, time, 0.05);
    }

    public scheduleDelayFeedback(fbPercent: number, time: number) {
        const fb = Math.min(0.95, (fbPercent / 100) * 0.95);
        this.delayFeedbackNode.gain.setTargetAtTime(fb, time, 0.02);
    }
    
    public setDistortion(amount: number) {
        if (Math.abs(this.lastDistortionValue - amount) > 0.1) {
             if (amount <= 0) {
                this.distortionNode.curve = null;
            } else {
                const k = amount * 5;
                this.distortionNode.curve = this.makeDistortionCurve(k);
            }
            this.lastDistortionValue = amount;
        }
    }

    private makeDistortionCurve(amount: number) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 256; 
        
        if (!this.curveCache || this.curveCache.length !== n_samples) {
             this.curveCache = new Float32Array(n_samples);
        }
        
        const curve = this.curveCache;
        const deg = Math.PI / 180;
        // Adjusted normalization to maintain unity gain at 0 distortion roughly
        const normalizationFactor = 1.0; 

        for (let i = 0; i < n_samples; ++i) {
          const x = (i * 2) / n_samples - 1;
          // Standard sigmoid wave shaper
          const val = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
          curve[i] = val * normalizationFactor;
        }
        return curve;
    }
}

interface SynthState {
    steps: Step[];
    params: SynthParams;
    effects: EffectParams;
}

interface DrumState {
    pattern: DrumPattern;
    params: DrumParams;
    effects: DrumEffects;
    kit: DrumKit;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private nextNoteTime: number = 0;
  private currentStepIndex: number = 0;
  private timerID: number | null = null;
  private isPlaying: boolean = false;
  
  // Master
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private currentMasterVolume: number = 0.8; 

  // Chains
  private synthChains: FXChain[] = []; 
  private drumChains: Array<Record<DrumType, FXChain>> = []; 
  private drumMasterGains: GainNode[] = []; 

  // Buffers
  private noiseBuffer: AudioBuffer | null = null;
  private metallicBuffer: AudioBuffer | null = null; 
  
  // Custom Wave Cache
  private periodicWaveCaches: (PeriodicWave | null)[] = [null, null];
  // Cache for array object -> PeriodicWave to prevent re-creation on every step
  private waveCache = new WeakMap<number[], PeriodicWave>();

  private lastCustomWaves: (number[] | null)[] = [null, null];
  private customWaveUpdatePending: boolean[] = [false, false];
  private pendingHarmonics: (number[] | null)[] = [null, null];
  
  // Current State Reference
  private synths: SynthState[] = [];
  private drums: DrumState[] = [];
  
  private onStepChange: ((stepIndex: number) => void) | null = null;

  constructor() {
  }

  public init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          this.setupRouting();
          this.noiseBuffer = this.createNoiseBuffer();
          this.metallicBuffer = this.createMetallicBuffer();
          this.restoreState();
      } else {
          console.error("Web Audio API not supported");
          return;
      }
    }
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(console.error);
    }
  }

  // Helper to create a stereo panner or fallback
  private createPanner(): AudioNode {
      if (!this.ctx) throw new Error("No Context");
      if (this.ctx.createStereoPanner) {
          return this.ctx.createStereoPanner();
      }
      // Fallback for browsers without StereoPanner (e.g. older Safari)
      const panner = this.ctx.createPanner();
      panner.panningModel = 'equalpower';
      return panner;
  }
  
  private setPannerValue(node: AudioNode, pan: number, time: number) {
      // pan is -1 to 1
      const safePan = Math.max(-1, Math.min(1, pan));
      if (node instanceof StereoPannerNode) {
          node.pan.setValueAtTime(safePan, time);
      } else if (node instanceof PannerNode) {
          // Simple mapping for 3D panner to stereo
          const x = safePan;
          const z = 1 - Math.abs(x);
          node.setPosition(x, 0, z);
      }
  }

  private restoreState() {
      if (!this.ctx) return;
      
      if (this.masterGain) {
          this.masterGain.gain.setValueAtTime(this.currentMasterVolume, this.ctx.currentTime);
      }

      this.synths.forEach((synth, index) => {
          if (synth.params.waveShape === 'custom' && synth.params.customWave) {
              this.updateCustomWave(index, synth.params.customWave);
          }
          if (this.synthChains[index]) {
              this.synthChains[index].update(synth.effects, this.ctx!);
              const vol = isNaN(synth.params.volume) ? 0.7 : synth.params.volume / 100;
              this.synthChains[index].output.gain.setValueAtTime(vol, this.ctx!.currentTime);
          }
      });

      this.drums.forEach((drumMachine, index) => {
          if (this.drumMasterGains[index]) {
              const drumMasterVol = isNaN(drumMachine.params.volume) ? 0.8 : drumMachine.params.volume / 100;
              this.drumMasterGains[index].gain.setValueAtTime(drumMasterVol, this.ctx!.currentTime);
          }

          if (this.drumChains[index]) {
              (Object.keys(this.drumChains[index]) as DrumType[]).forEach(type => {
                   const chain = this.drumChains[index][type];
                   const effects = drumMachine.effects[type];
                   const params = drumMachine.params;
                   
                   chain.update(effects, this.ctx!);
                   const volKey = `vol${type}` as keyof DrumParams;
                   const val = params[volKey];
                   const vol = isNaN(val) ? 0.8 : val / 100;
                   chain.output.gain.setValueAtTime(vol, this.ctx!.currentTime);
              });
          }
      });
  }

  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createMetallicBuffer(): AudioBuffer | null {
      if (!this.ctx) return null;
      const bufferSize = this.ctx.sampleRate * 1.0;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      const freqs = [263, 400, 421, 474, 587, 845];
      
      for (let i = 0; i < bufferSize; i++) {
          let sample = 0;
          const t = i / this.ctx.sampleRate;
          for (const f of freqs) {
              sample += (Math.floor(t * f * 2) % 2 === 0 ? 1 : -1);
          }
          data[i] = sample / freqs.length;
      }
      return buffer;
  }

  private setupRouting() {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.currentMasterVolume;

    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -8; // Slightly higher threshold
    this.masterCompressor.knee.value = 10;
    this.masterCompressor.ratio.value = 12; // Higher ratio for safety
    this.masterCompressor.attack.value = 0.005;
    this.masterCompressor.release.value = 0.15;
    
    this.masterCompressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.synthChains = [
        new FXChain(this.ctx),
        new FXChain(this.ctx)
    ];
    this.synthChains.forEach(chain => {
        if (this.masterCompressor) chain.output.connect(this.masterCompressor);
        chain.output.gain.value = 0.7;
    });

    this.drumMasterGains = [this.ctx.createGain(), this.ctx.createGain()];
    this.drumMasterGains.forEach(g => {
         if (this.masterCompressor) g.connect(this.masterCompressor);
         g.gain.value = 0.8; 
    });

    this.drumChains = [
        {
            'BD': new FXChain(this.ctx),
            'SD': new FXChain(this.ctx),
            'CH': new FXChain(this.ctx),
            'OH': new FXChain(this.ctx),
            'CP': new FXChain(this.ctx),
        },
        {
            'BD': new FXChain(this.ctx),
            'SD': new FXChain(this.ctx),
            'CH': new FXChain(this.ctx),
            'OH': new FXChain(this.ctx),
            'CP': new FXChain(this.ctx),
        }
    ];

    this.drumChains.forEach((machine, index) => {
        Object.values(machine).forEach(chain => {
            if (this.drumMasterGains[index]) {
                chain.output.connect(this.drumMasterGains[index]);
            }
            chain.output.gain.value = 0.7;
        });
    });
  }

  public setMasterVolume(volume: number) {
      this.currentMasterVolume = Math.max(0, volume / 100);
      if (this.ctx && this.masterGain) {
          this.masterGain.gain.setTargetAtTime(this.currentMasterVolume, this.ctx.currentTime, 0.1);
      }
  }

  public updateState(
    synths: SynthState[], 
    drums: DrumState[],
    onStepChange: (idx: number) => void
  ) {
    this.synths = synths;
    this.drums = drums;
    this.onStepChange = onStepChange;
    
    if (!this.ctx) return;

    synths.forEach((synth, index) => {
        // Check if Global Custom Wave changed
        if (synth.params.waveShape === 'custom' && synth.params.customWave !== this.lastCustomWaves[index]) {
            this.updateCustomWave(index, synth.params.customWave);
        }
        if (this.synthChains[index]) {
            this.synthChains[index].update(synth.effects, this.ctx!);
            const vol = isNaN(synth.params.volume) ? 0.7 : synth.params.volume / 100;
            this.synthChains[index].output.gain.setTargetAtTime(vol, this.ctx!.currentTime, 0.1);
        }
    });
    
    // ... drum updates ...
    drums.forEach((drumMachine, index) => {
        if (this.drumMasterGains[index]) {
            const mVol = isNaN(drumMachine.params.volume) ? 0.8 : drumMachine.params.volume / 100;
            this.drumMasterGains[index].gain.setTargetAtTime(mVol, this.ctx!.currentTime, 0.1);
        }

        if (this.drumChains[index]) {
            (Object.keys(this.drumChains[index]) as DrumType[]).forEach(type => {
                const chain = this.drumChains[index][type];
                chain.update(drumMachine.effects[type], this.ctx!);
                
                const volKey = `vol${type}` as keyof DrumParams;
                const val = drumMachine.params[volKey];
                const vol = isNaN(val) ? 0.8 : val / 100;
                chain.output.gain.setTargetAtTime(vol, this.ctx!.currentTime, 0.1);
            });
        }
    });
  }

  private updateCustomWave(index: number, harmonics: number[]) {
      if (!this.ctx) return;
      this.pendingHarmonics[index] = harmonics;
      if (!this.customWaveUpdatePending[index]) {
          this.customWaveUpdatePending[index] = true;
          setTimeout(() => {
             this.applyCustomWave(index);
             this.customWaveUpdatePending[index] = false;
          }, 50);
      }
      this.lastCustomWaves[index] = harmonics;
  }

  private applyCustomWave(index: number) {
      if (!this.ctx || !this.pendingHarmonics[index]) return;
      const harmonics = this.pendingHarmonics[index]!;
      this.periodicWaveCaches[index] = this.createPeriodicWaveFromHarmonics(harmonics);
  }

  private createPeriodicWaveFromHarmonics(harmonics: number[]): PeriodicWave | null {
      if (!this.ctx) return null;
      
      // Validate Harmonics Array
      if (!harmonics || harmonics.length < 1) {
          return null;
      }

      // Check Cache (Reference Based)
      if (this.waveCache.has(harmonics)) {
          return this.waveCache.get(harmonics)!;
      }
      
      // WebAudio API expects arrays where index 1 is fundamental
      // Index 0 is DC offset (usually 0)
      const real = new Float32Array(harmonics.length + 1);
      const imag = new Float32Array(harmonics.length + 1);
      
      // Ensure we have valid numbers
      for (let i = 0; i < harmonics.length; i++) {
          const h = harmonics[i];
          imag[i + 1] = isNaN(h) ? 0 : h; 
      }
      
      try {
        // Create wave with default normalization enabled
        // NOTE: createPeriodicWave throws if length < 2
        if (imag.length < 2) return null;
        
        const wave = this.ctx.createPeriodicWave(real, imag);
        // Add to cache
        this.waveCache.set(harmonics, wave);
        return wave;
      } catch (e) {
          console.error("Failed to create periodic wave", e);
          return null;
      }
  }

  public start() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
    }
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStepIndex = 0;
    this.nextNoteTime = this.ctx!.currentTime + 0.1; // Lower latency start
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerID) {
      window.clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  public toggle() {
    if (this.isPlaying) this.stop();
    else this.start();
  }

  private scheduler() {
    if (!this.isPlaying || !this.ctx) return;

    const masterTempo = (this.synths[0]?.params.tempo) || 120;
    const lookahead = 0.25; 

    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this.scheduleStep(this.currentStepIndex, this.nextNoteTime);
      this.nextNoteTime += (60.0 / masterTempo) / 4; 
      this.currentStepIndex = (this.currentStepIndex + 1) % 16;
    }
    this.timerID = window.setTimeout(() => this.scheduler(), 50);
  }

  private scheduleStep(stepIndex: number, time: number) {
    if (!this.onStepChange) return;
    
    // Only schedule visual update if it's in the future but not too far
    const timeUntilNote = (time - this.ctx!.currentTime) * 1000;
    if (timeUntilNote < 500) {
        setTimeout(() => {
            if(this.isPlaying && this.onStepChange) this.onStepChange(stepIndex);
        }, Math.max(0, timeUntilNote));
    }

    this.synths.forEach((synth, idx) => {
        const step = synth.steps[stepIndex];
        if (step && step.active) {
            this.playVoice(step, time, synth.params, synth.effects, idx);
        }
    });

    this.drums.forEach((drumMachine, idx) => {
        const pattern = drumMachine.pattern;
        const kit = drumMachine.kit;
        if (pattern) {
            if (pattern.BD[stepIndex].active) this.playBD(time, idx, kit, pattern.BD[stepIndex]);
            if (pattern.SD[stepIndex].active) this.playSD(time, idx, kit, pattern.SD[stepIndex]);
            if (pattern.CH[stepIndex].active) this.playHat(time, false, idx, kit, pattern.CH[stepIndex]);
            if (pattern.OH[stepIndex].active) this.playHat(time, true, idx, kit, pattern.OH[stepIndex]);
            if (pattern.CP[stepIndex].active) this.playClap(time, idx, kit, pattern.CP[stepIndex]);
        }
    });
  }

  // Helper to get automated parameter value with default fallback
  private getDrumParam(step: DrumStep, param: keyof DrumAutomation, defaultVal: number): number {
      if (step.automation && step.automation[param] !== undefined) {
          return step.automation[param]!;
      }
      return defaultVal;
  }

  private applyDrumAutomation(chain: FXChain, step: DrumStep, globalEffects: EffectParams, time: number) {
      // FX Automation
      const delayMix = step.automation?.delayMix ?? globalEffects.delayMix;
      chain.scheduleDelayMix(delayMix, time);

      const delayTime = step.automation?.delayTime ?? globalEffects.delayTime;
      chain.scheduleDelayTime(delayTime, time);

      const delayFeedback = step.automation?.delayFeedback ?? globalEffects.delayFeedback;
      chain.scheduleDelayFeedback(delayFeedback, time);
      
      // Distortion
      const dist = step.automation?.distortion ?? globalEffects.distortion;
      chain.setDistortion(dist);
  }

  private connectVoiceToChain(source: AudioNode, step: DrumStep, chain: FXChain, time: number) {
      if (!this.ctx) return;
      
      const pan = this.getDrumParam(step, 'pan', 0); // -50 to 50
      const cutoff = this.getDrumParam(step, 'cutoff', 100);
      const resonance = this.getDrumParam(step, 'resonance', 0);

      // Filter (LP for shaping)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      // Map 0-100 to 20Hz-20kHz log scale
      const minFreq = 20;
      const maxFreq = 20000;
      // Safe exponential mapping
      const freq = minFreq * Math.pow(maxFreq / minFreq, cutoff / 100);
      filter.frequency.setValueAtTime(freq, time);
      filter.Q.setValueAtTime((resonance / 100) * 20, time);

      // Panner
      // Use Polyfill helper to support all browsers
      const panner = this.createPanner();
      this.setPannerValue(panner, pan / 50, time);

      source.connect(filter);
      filter.connect(panner);
      panner.connect(chain.input);
  }

  // --- SYNTH VOICE ---
  private playVoice(step: Step, time: number, globalParams: SynthParams, globalEffects: EffectParams, synthIndex: number) {
    if (!this.ctx || !this.synthChains[synthIndex]) return;
    const chain = this.synthChains[synthIndex];

    // AUTOMATION
    const cutoffVal = step.automation?.cutoff ?? globalParams.cutoff;
    const resonanceVal = step.automation?.resonance ?? globalParams.resonance;
    const envModVal = step.automation?.envMod ?? globalParams.envMod;
    const decayVal = step.automation?.decay ?? globalParams.decay;
    
    const tuningVal = step.automation?.tuning ?? globalParams.tuning;
    const accentParamVal = step.automation?.accent ?? globalParams.accent;
    
    // FX Automation
    const delayMixVal = step.automation?.delayMix ?? globalEffects.delayMix;
    chain.scheduleDelayMix(delayMixVal, time);

    const delayTimeVal = step.automation?.delayTime ?? globalEffects.delayTime;
    chain.scheduleDelayTime(delayTimeVal, time);

    const delayFbkVal = step.automation?.delayFeedback ?? globalEffects.delayFeedback;
    chain.scheduleDelayFeedback(delayFbkVal, time);
    
    // Drive (Pre-Distortion Gain)
    const driveLevel = step.automation?.drive !== undefined ? step.automation.drive / 100 : 1.0;

    const osc = this.ctx.createOscillator();
    
    // WAVE SHAPE AUTOMATION
    // Determine effective shape
    let waveShape = step.automation?.waveShape ?? globalParams.waveShape;
    
    // Priority: Step Custom Wave Array > Step Wave Shape > Global Wave Shape
    if (step.automation?.customWave && step.automation.customWave.length > 0) {
        // If step has a custom wave array, we must use it
        const customWave = this.createPeriodicWaveFromHarmonics(step.automation.customWave);
        if (customWave) {
            osc.setPeriodicWave(customWave);
        } else {
            osc.type = 'sawtooth';
        }
    } else if (waveShape === 'custom') {
        // Global or Step-specified 'custom' type, but no step-specific array
        // Use Global Cached Wave
        if (this.periodicWaveCaches[synthIndex]) {
            osc.setPeriodicWave(this.periodicWaveCaches[synthIndex]!);
        } else {
            // Fallback if cache empty
             osc.type = 'sawtooth'; 
        }
    } else {
        // Standard Shapes
        osc.type = waveShape as OscillatorType;
    }

    const freq = getFrequency(step.note, step.octave);
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.value = tuningVal; 

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    
    const minCutoff = 50;
    const maxCutoff = 12000;
    const safeCutoff = Math.max(0, Math.min(100, cutoffVal));
    const cutoffFreq = minCutoff * Math.pow(maxCutoff / minCutoff, safeCutoff / 100);
    const q = (resonanceVal / 100) * 25;

    filter.frequency.setValueAtTime(cutoffFreq, time);
    filter.Q.setValueAtTime(q, time);

    const envAmount = (envModVal / 100) * 7000; 
    let currentDecay = decayVal;
    let currentEnvAmount = envAmount;
    
    let currentVol = 1.0 * driveLevel;

    if (step.accent) {
        currentDecay = Math.max(10, currentDecay * 0.7);
        currentEnvAmount = envAmount * 1.5 + (accentParamVal * 10);
        currentVol = (1.0 + (accentParamVal / 100)) * driveLevel;
        filter.Q.setValueAtTime(q + 5, time);
    }

    const decayTime = 0.1 + (currentDecay / 100) * 0.5; 
    filter.frequency.linearRampToValueAtTime(cutoffFreq + currentEnvAmount, time + 0.005);
    filter.frequency.setTargetAtTime(cutoffFreq, time + 0.01, decayTime / 3);

    const vca = this.ctx.createGain();
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(currentVol, time + 0.005);
    
    const masterTempo = this.synths[0]?.params.tempo || 120;
    const stepDuration = (60 / masterTempo) / 4;
    const gateLength = step.slide ? stepDuration * 1.1 : stepDuration * 0.5;

    vca.gain.setTargetAtTime(0, time + gateLength, 0.05);

    osc.connect(filter);
    filter.connect(vca);
    vca.connect(chain.input);

    osc.start(time);
    osc.stop(time + stepDuration + 0.3);
  }

  // --- DRUM VOICES ---

  private playBD(time: number, index: number, kit: DrumKit, step: DrumStep) {
      if (!this.ctx || !this.drumChains[index]) return;
      const chains = this.drumChains[index];
      const globalEffects = this.drums[index].effects['BD'];
      
      if (chains['BD']) this.applyDrumAutomation(chains['BD'], step, globalEffects, time);

      const tuning = this.getDrumParam(step, 'tuning', 0); 
      const decayAmt = this.getDrumParam(step, 'decay', 50); 
      const volume = this.getDrumParam(step, 'volume', this.drums[index].params.volBD);
      
      const pitchMult = Math.pow(2, tuning / 1200 * 12); 
      const decayMult = 0.5 + (decayAmt / 100); 

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const voiceOutput = this.ctx.createGain(); // Combined voice output
      
      // Output Level (Track Level)
      chains['BD']!.output.gain.setTargetAtTime(volume / 100, time, 0.01);

      if (kit === '808') {
          osc.frequency.setValueAtTime(150 * pitchMult, time);
          osc.frequency.exponentialRampToValueAtTime(50 * pitchMult, time + (0.5 * decayMult));
          gain.gain.setValueAtTime(1.0, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + (0.5 * decayMult));
      } else {
          osc.frequency.setValueAtTime(200 * pitchMult, time);
          osc.frequency.exponentialRampToValueAtTime(45 * pitchMult, time + (0.3 * decayMult));
          
          const clickOsc = this.ctx.createOscillator();
          clickOsc.frequency.setValueAtTime(300 * pitchMult, time);
          clickOsc.frequency.exponentialRampToValueAtTime(10, time + 0.02);
          const clickGain = this.ctx.createGain();
          clickGain.gain.setValueAtTime(0.8, time);
          clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
          
          clickOsc.connect(clickGain);
          clickGain.connect(voiceOutput);
          clickOsc.start(time);
          clickOsc.stop(time + 0.05);

          gain.gain.setValueAtTime(1.0, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + (0.3 * decayMult));
      }
      
      osc.connect(gain);
      gain.connect(voiceOutput);
      osc.start(time);
      osc.stop(time + (0.5 * decayMult));

      if (chains['BD']) {
        this.connectVoiceToChain(voiceOutput, step, chains['BD'], time);
      }
  }

  private playSD(time: number, index: number, kit: DrumKit, step: DrumStep) {
      if (!this.ctx || !this.drumChains[index]) return;
      const chains = this.drumChains[index];
      if (!chains['SD']) return;
      const globalEffects = this.drums[index].effects['SD'];
      this.applyDrumAutomation(chains['SD'], step, globalEffects, time);

      const tuning = this.getDrumParam(step, 'tuning', 0);
      const decayAmt = this.getDrumParam(step, 'decay', 50);
      const volume = this.getDrumParam(step, 'volume', this.drums[index].params.volSD);

      const pitchMult = Math.pow(2, tuning / 1200 * 12);
      const decayMult = 0.5 + (decayAmt / 100);

      chains['SD'].output.gain.setTargetAtTime(volume / 100, time, 0.01);

      const voiceOutput = this.ctx.createGain();

      if (kit === '808') {
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(250 * pitchMult, time);
          const oscGain = this.ctx.createGain();
          oscGain.gain.setValueAtTime(0.5, time);
          oscGain.gain.exponentialRampToValueAtTime(0.01, time + (0.15 * decayMult));
          osc.connect(oscGain);
          oscGain.connect(voiceOutput);
          osc.start(time);
          osc.stop(time + 0.3);

          if (this.noiseBuffer) {
              const noise = this.ctx.createBufferSource();
              noise.buffer = this.noiseBuffer;
              const noiseFilter = this.ctx.createBiquadFilter();
              noiseFilter.type = 'highpass';
              noiseFilter.frequency.value = 1000;
              const noiseGain = this.ctx.createGain();
              noiseGain.gain.setValueAtTime(0.8, time);
              noiseGain.gain.exponentialRampToValueAtTime(0.01, time + (0.2 * decayMult));
              noise.connect(noiseFilter);
              noiseFilter.connect(noiseGain);
              noiseGain.connect(voiceOutput);
              noise.start(time);
              noise.stop(time + 0.3);
          }
      } else {
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(180 * pitchMult, time);
          osc.frequency.exponentialRampToValueAtTime(120 * pitchMult, time + (0.15 * decayMult)); 
          const oscGain = this.ctx.createGain();
          oscGain.gain.setValueAtTime(0.7, time);
          oscGain.gain.exponentialRampToValueAtTime(0.01, time + (0.15 * decayMult));
          osc.connect(oscGain);
          oscGain.connect(voiceOutput);
          osc.start(time);
          osc.stop(time + 0.3);

          if (this.noiseBuffer) {
              const noise = this.ctx.createBufferSource();
              noise.buffer = this.noiseBuffer;
              const noiseFilter = this.ctx.createBiquadFilter();
              noiseFilter.type = 'lowpass'; 
              noiseFilter.frequency.value = 8000;
              const noiseGain = this.ctx.createGain();
              noiseGain.gain.setValueAtTime(1.0, time);
              noiseGain.gain.exponentialRampToValueAtTime(0.01, time + (0.25 * decayMult)); 
              noise.connect(noiseFilter);
              noiseFilter.connect(noiseGain);
              noiseGain.connect(voiceOutput);
              noise.start(time);
              noise.stop(time + 0.4);
          }
      }
      
      this.connectVoiceToChain(voiceOutput, step, chains['SD'], time);
  }

  private playHat(time: number, open: boolean, index: number, kit: DrumKit, step: DrumStep) {
      const type: DrumType = open ? 'OH' : 'CH';
      if (!this.ctx || !this.drumChains[index]) return;
      const chains = this.drumChains[index];
      if (!chains[type]) return;
      const globalEffects = this.drums[index].effects[type];
      this.applyDrumAutomation(chains[type], step, globalEffects, time);

      const tuning = this.getDrumParam(step, 'tuning', 0);
      const decayAmt = this.getDrumParam(step, 'decay', 50);
      const volume = this.getDrumParam(step, 'volume', open ? this.drums[index].params.volOH : this.drums[index].params.volCH);
      
      const pitchMult = Math.pow(2, tuning / 1200 * 24); // Hats can take more extreme pitch
      const decayMult = 0.5 + (decayAmt / 100);

      chains[type].output.gain.setTargetAtTime(volume / 100, time, 0.01);

      let source: AudioBufferSourceNode;
      let filter: BiquadFilterNode;

      if (kit === '909' && this.metallicBuffer) {
           source = this.ctx.createBufferSource();
           source.buffer = this.metallicBuffer;
           source.playbackRate.value = 1.0 * pitchMult;
           filter = this.ctx.createBiquadFilter();
           filter.type = 'highpass';
           filter.frequency.value = 8000; 
      } else {
           if (!this.noiseBuffer) return;
           source = this.ctx.createBufferSource();
           source.buffer = this.noiseBuffer;
           source.playbackRate.value = 1.0 * pitchMult;
           filter = this.ctx.createBiquadFilter();
           filter.type = 'highpass';
           filter.frequency.value = 7000;
      }
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.6, time);
      
      let baseDecay = open ? (kit === '909' ? 0.5 : 0.3) : 0.05;
      const finalDecay = baseDecay * (open ? decayMult : (0.8 + decayMult * 0.2));

      gain.gain.exponentialRampToValueAtTime(0.01, time + finalDecay);
      
      source.connect(filter);
      filter.connect(gain);
      
      source.start(time);
      source.stop(time + finalDecay + 0.1);

      this.connectVoiceToChain(gain, step, chains[type], time);
  }

  private playClap(time: number, index: number, kit: DrumKit, step: DrumStep) {
     if (!this.ctx || !this.drumChains[index] || !this.noiseBuffer) return;
     const chains = this.drumChains[index];
     if (!chains['CP']) return;
     const globalEffects = this.drums[index].effects['CP'];
     this.applyDrumAutomation(chains['CP'], step, globalEffects, time);
     
     const tuning = this.getDrumParam(step, 'tuning', 0);
     const decayAmt = this.getDrumParam(step, 'decay', 50);
     const volume = this.getDrumParam(step, 'volume', this.drums[index].params.volCP);
     
     const pitchMult = Math.pow(2, tuning / 1200 * 12);
     const decayMult = 0.5 + (decayAmt / 100);

     chains['CP'].output.gain.setTargetAtTime(volume / 100, time, 0.01);

     const source = this.ctx.createBufferSource();
     source.buffer = this.noiseBuffer;
     source.playbackRate.value = pitchMult;

     const filter = this.ctx.createBiquadFilter();
     filter.type = 'bandpass';
     filter.frequency.value = (kit === '909' ? 2000 : 1500) * pitchMult; 
     filter.Q.value = 1;

     const gain = this.ctx.createGain();
     const t = time;
     
     gain.gain.setValueAtTime(0, t);
     gain.gain.linearRampToValueAtTime(1.0, t + 0.010);
     gain.gain.linearRampToValueAtTime(0, t + 0.020);
     gain.gain.linearRampToValueAtTime(1.0, t + 0.030);
     gain.gain.linearRampToValueAtTime(0, t + 0.040);
     gain.gain.linearRampToValueAtTime(1.0, t + 0.050);
     
     const decay = (kit === '909' ? 0.3 : 0.2) * decayMult;
     gain.gain.exponentialRampToValueAtTime(0.01, t + decay);

     source.connect(filter);
     filter.connect(gain);
     source.start(time);
     source.stop(time + decay + 0.05);

     this.connectVoiceToChain(gain, step, chains['CP'], time);
  }
}

export const audioEngine = new AudioEngine();
