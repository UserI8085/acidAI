
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiPatternResponse, Step, DrumPattern } from "../types";
import { DEFAULT_STEPS, DEFAULT_DRUM_PATTERN } from "../constants";

export const generateAcidPattern = async (userPrompt: string): Promise<{ steps: Step[], drums: DrumPattern }> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("No API Key found");
      return { steps: DEFAULT_STEPS, drums: DEFAULT_DRUM_PATTERN };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const systemInstruction = `
    You are a legendary Acid Techno producer using a Roland TB-303 and TR-808.
    Generate a 16-step bassline sequence and a complementary drum beat based on the user's description.
    
    For the 303 Bassline:
    - Use a mix of octaves, accents, and slides.
    - Notes should be standard musical notes (C, C#, D, etc.).
    - Octaves 1-3.
    
    For the 808 Drums:
    - BD (Bass Drum): Foundation.
    - SD (Snare): Backbeat or syncopated.
    - CH (Closed Hat): Driving rhythm (usually 16ths or 8ths).
    - OH (Open Hat): Offbeats.
    - CP (Clap): Accentuation.
    - Provide a boolean array of length 16 for each drum part, true means trigger.
    `;

    const finalPrompt = userPrompt ? `Description: ${userPrompt}` : "Generate a funky, hypnotic 303 acid line and driving 808 beat.";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: finalPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                pattern: {
                    type: Type.ARRAY,
                    description: "TB-303 Sequence",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            note: { type: Type.STRING },
                            octave: { type: Type.INTEGER },
                            accent: { type: Type.BOOLEAN },
                            slide: { type: Type.BOOLEAN },
                            active: { type: Type.BOOLEAN }
                        },
                        required: ["note", "octave", "accent", "slide", "active"]
                    }
                },
                drums: {
                    type: Type.OBJECT,
                    description: "TR-808 Pattern",
                    properties: {
                        BD: { type: Type.ARRAY, items: { type: Type.BOOLEAN } },
                        SD: { type: Type.ARRAY, items: { type: Type.BOOLEAN } },
                        CH: { type: Type.ARRAY, items: { type: Type.BOOLEAN } },
                        OH: { type: Type.ARRAY, items: { type: Type.BOOLEAN } },
                        CP: { type: Type.ARRAY, items: { type: Type.BOOLEAN } }
                    },
                    required: ["BD", "SD", "CH", "OH", "CP"]
                }
            }
        }
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text) as GeminiPatternResponse;
      
      let newSteps = DEFAULT_STEPS;
      let newDrums = DEFAULT_DRUM_PATTERN;

      if (data.pattern && Array.isArray(data.pattern)) {
        newSteps = data.pattern.map((s, i) => ({
            id: i,
            note: s.note as any,
            octave: s.octave,
            accent: s.accent,
            slide: s.slide,
            active: s.active
        })).slice(0, 16);
      }

      if (data.drums) {
          const mapDrum = (arr: boolean[]) => arr.map((active, i) => ({ id: i, active })).slice(0, 16);
          newDrums = {
              BD: mapDrum(data.drums.BD),
              SD: mapDrum(data.drums.SD),
              CH: mapDrum(data.drums.CH),
              OH: mapDrum(data.drums.OH),
              CP: mapDrum(data.drums.CP),
          };
      }

      return { steps: newSteps, drums: newDrums };
    }
    
    return { steps: DEFAULT_STEPS, drums: DEFAULT_DRUM_PATTERN };
  } catch (error) {
    console.error("Failed to generate pattern:", error);
    return { steps: DEFAULT_STEPS, drums: DEFAULT_DRUM_PATTERN };
  }
};
