
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { promptsConfig } from '../prompts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Type definitions ensuring type safety when calling the engine
type PromptKey = keyof typeof promptsConfig;

// Schema Definitions mapped to the Prompt Config keys
const SCHEMAS: Record<string, Schema> = {
  SEGMENTATION_STRATEGY: {
    type: Type.OBJECT,
    properties: {
      recommendedGranularity: { type: Type.STRING, enum: ['PARAGRAPH', 'SENTENCE', 'LINE', 'ROW', 'SECTION', 'TURN'] },
      reasoning: { type: Type.STRING }
    },
    required: ["recommendedGranularity", "reasoning"]
  },
  GLOBAL_ANALYSIS: {
    type: Type.OBJECT,
    properties: {
      genre: { type: Type.STRING },
      summary: { type: Type.STRING },
      themes: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            quotes: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["name", "description", "quotes"]
        } 
      }
    },
    required: ["genre", "summary", "themes"]
  },
  LOCAL_ANALYSIS: {
    type: Type.OBJECT,
    properties: {
      analysis: { type: Type.STRING },
      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      sentiment: { type: Type.NUMBER }
    },
    required: ["analysis", "tags", "sentiment"]
  },
  GRAPH_DATA: {
    type: Type.OBJECT,
    properties: {
      links: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            source: { type: Type.STRING },
            target: { type: Type.STRING },
            label: { type: Type.STRING },
            weight: { type: Type.NUMBER }
          }
        }
      }
    }
  }
};

/**
 * Executes a prompt from prompts.ts with variable substitution.
 */
export const runPrompt = async (key: PromptKey, variables: Record<string, string>) => {
  const config = promptsConfig[key];
  
  // 1. Inject Variables into Template
  let promptText = config.template;
  Object.entries(variables).forEach(([varName, value]) => {
    promptText = promptText.replace(new RegExp(`{{${varName}}}`, 'g'), value);
  });

  // 2. Fetch Schema
  const schema = SCHEMAS[config.schemaType];

  try {
    // 3. Call Gemini
    const response = await ai.models.generateContent({
      model: config.model,
      contents: promptText,
      config: {
        systemInstruction: config.system,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    // 4. Parse Response
    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("Empty response from LLM");

  } catch (error) {
    console.error(`LLM Error [${String(key)}]:`, error);
    throw error;
  }
};