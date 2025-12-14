
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Chunk, Granularity, ConceptMapData, TimelineEvent, GlobalAnalysisResult, AnalysisLens, AnalysisProvenance } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_FAST = 'gemini-2.5-flash';
const MODEL_REASONING = 'gemini-3-pro-preview'; 

// Lens Definitions
const LENS_PROMPTS: Record<AnalysisLens, string> = {
    [AnalysisLens.THEMATIC]: "Analyze the text for key themes, recurring concepts, and subject matter.",
    [AnalysisLens.SENTIMENT]: "Analyze the text for emotional tone, speaker sentiment, frustration, joy, and affective language. Assign a sentiment score based on emotional intensity.",
    [AnalysisLens.ARGUMENT]: "Analyze the text for claims, premises, evidence, logical fallacies, and rhetorical structure. Identify the core argument being made.",
    [AnalysisLens.SOCIOLOGICAL]: "Analyze the text for power dynamics, social roles, interpersonal relationships, and cultural implications.",
    [AnalysisLens.CUSTOM]: "" // Will be filled by user
};

export const analyzeCollectionStructure = async (textSample: string): Promise<GlobalAnalysisResult | null> => {
  const prompt = `
    Analyze the following text sample (which may be a concatenation of multiple documents).
    1. Identify the Genre (e.g., Interview Transcript, Academic Article, Survey Responses, Fiction, News).
    2. Summarize the content in one sentence.
    3. Suggest the best Granularity for semantic analysis (PARAGRAPH, SENTENCE, TURN, RESPONSE, WHOLE, HEADING).
    4. Suggest the best Analysis Lens (THEMATIC, SENTIMENT, ARGUMENT, SOCIOLOGICAL).
       - 'SENTIMENT' for reviews, interviews, diaries.
       - 'ARGUMENT' for papers, essays, debates.
       - 'SOCIOLOGICAL' for transcripts, interactions.
       - 'THEMATIC' for general content.
    5. Explain the reasoning.
    6. List 5 potential semantic themes.

    Text Sample:
    ${textSample.substring(0, 10000)}
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      genre: { type: Type.STRING },
      summary: { type: Type.STRING },
      suggestedGranularity: { 
        type: Type.STRING, 
        enum: ['PARAGRAPH', 'SENTENCE', 'TURN', 'RESPONSE', 'WHOLE', 'PHRASE', 'HEADING'] 
      },
      suggestedLens: {
          type: Type.STRING,
          enum: ['THEMATIC', 'SENTIMENT', 'ARGUMENT', 'SOCIOLOGICAL']
      },
      reasoning: { type: Type.STRING },
      potentialThemes: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING } 
      }
    },
    required: ["genre", "summary", "suggestedGranularity", "reasoning", "potentialThemes"]
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });
    return JSON.parse(response.text || "null");
  } catch (error) {
    console.error("Error analyzing collection structure:", error);
    return null;
  }
};

export const structureText = async (text: string): Promise<string> => {
  const prompt = `
    Reformat the following text by inserting Markdown headings (e.g. "## Introduction", "## Topic Name") to divide it into logical semantic sections. 
    
    Rules:
    1. Do NOT summarize or rewrite the body text. Keep the original text exactly as is.
    2. Only insert headers between paragraphs where a clear topic shift occurs.
    3. Ensure the headers are descriptive of the content that follows.
    4. Return the full text with the new headers inserted.

    Text:
    ${text}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
    });

    return response.text || text;
  } catch (error) {
    console.error("Error structuring text:", error);
    return text; // Fallback to original
  }
};

export const analyzeChunks = async (
  chunks: Chunk[], 
  granularity: Granularity,
  lens: AnalysisLens,
  focusContext: string = "",
  customLensPrompt: string = ""
): Promise<Chunk[]> => {
  
  const contentToAnalyze = chunks.map(c => `ID: ${c.id}\nText: ${c.text}`).join('\n---\n');

  // Determine the core instruction based on Lens
  let coreInstruction = LENS_PROMPTS[lens];
  if (lens === AnalysisLens.CUSTOM) {
      coreInstruction = customLensPrompt || "Analyze the text for key meaning and hidden subtext.";
  }

  const prompt = `
    You are a Semantic Text Unweaver. 
    Your Lens Strategy is: ${lens}
    
    Instruction: ${coreInstruction}
    
    ${focusContext ? `Additional User Focus: "${focusContext}". Prioritize this in your tags and analysis.` : ''}
    
    ${granularity === Granularity.HEADING ? 'NOTE: These chunks represent sections of a document (Headings). Consider the hierarchy and structure in your analysis.' : ''}

    For each chunk:
    1. Identify 2-3 key semantic tags/concepts derived from the Lens Strategy.
    2. Provide a 'sentiment' score (-1 to 1) relevant to the lens (e.g. Agreement strength for ARGUMENT, Emotion for SENTIMENT).
    3. Provide a short 'analysis' string (max 20 words) unweaving the meaning according to the Lens.
    
    Input Text Chunks:
    ${contentToAnalyze}
  `;

  const responseSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        sentiment: { type: Type.NUMBER },
        analysis: { type: Type.STRING }
      },
      required: ["id", "tags", "sentiment", "analysis"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const data = JSON.parse(response.text || "[]");
    const timestamp = new Date().toISOString();
    
    // Merge analysis back into chunks AND attach provenance
    return chunks.map(chunk => {
      const result = data.find((d: any) => d.id === chunk.id);
      if (result) {
        return { 
            ...chunk, 
            tags: result.tags, 
            sentiment: result.sentiment, 
            analysis: result.analysis,
            provenance: {
                model: MODEL_FAST,
                prompt: prompt,
                timestamp: timestamp,
                lens: lens
            }
        };
      }
      return chunk;
    });
  } catch (error) {
    console.error("Error analyzing chunks:", error);
    return chunks;
  }
};

export const generateConceptMap = async (text: string): Promise<ConceptMapData> => {
  const prompt = `
    Analyze the text and create a concept map (knowledge graph).
    Limit to the top 15 most important nodes and links.
    Focus on abstract concepts and their relationships rather than just simple entity occurrences.
    
    Text:
    ${text.substring(0, 10000)} 
  `;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      nodes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            label: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['concept', 'entity', 'event'] },
            value: { type: Type.NUMBER, description: "Importance 1-10" }
          },
          required: ["id", "label", "type", "value"]
        }
      },
      links: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            source: { type: Type.STRING },
            target: { type: Type.STRING },
            label: { type: Type.STRING },
            strength: { type: Type.NUMBER, description: "Strength 1-5" }
          },
          required: ["source", "target", "label"]
        }
      }
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    return JSON.parse(response.text || '{"nodes": [], "links": []}');
  } catch (error) {
    console.error("Error generating concept map:", error);
    return { nodes: [], links: [] };
  }
};

export const generateTimeline = async (text: string): Promise<TimelineEvent[]> => {
  const prompt = `
    Extract a chronological timeline of events from the text.
    Limit to 10 key events.
    
    Text:
    ${text.substring(0, 10000)}
  `;

  const responseSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        time: { type: Type.STRING },
        description: { type: Type.STRING },
        significance: { type: Type.STRING }
      },
      required: ["time", "description"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Timeline generation error:", error);
    return [];
  }
};

export const unweaveText = async (text: string, focus: string): Promise<{text: string, provenance: AnalysisProvenance}> => {
  const prompt = `Unweave the meanings in this specific text chunk. 
  
  Focus specifically on: ${focus}.
  
  Explain the subtext, implications, or hidden connections.
  
  Text: "${text}"`;

  const response = await ai.models.generateContent({
    model: MODEL_FAST,
    contents: prompt,
  });
  
  return {
      text: response.text || "No analysis available.",
      provenance: {
          model: MODEL_FAST,
          prompt: prompt,
          timestamp: new Date().toISOString(),
          lens: 'SINGLE_CHUNK_DEEP_DIVE'
      }
  };
};
