import { Chunk } from "../types";
import { runPrompt } from "./llm_core";

export const performLocalAnalysis = async (chunks: Chunk[], globalThemes: string[]): Promise<Chunk[]> => {
  const themesString = globalThemes.join(", ");
  
  // In a real app, we would batch this or use a queue. 
  // For this demo, we'll process a subset to avoid hitting rate limits immediately or taking too long.
  // We will map over chunks and execute promises.
  
  const chunksToAnalyze = chunks.slice(0, 15); // Limit to 15 for demo speed

  const analyzedChunks = await Promise.all(chunksToAnalyze.map(async (chunk) => {
    try {
      const result = await runPrompt("local_analysis", { 
        GLOBAL_THEMES: themesString,
        CHUNK_TEXT: chunk.text.substring(0, 1000) // Truncate huge chunks
      });

      return {
        ...chunk,
        analysis: result.analysis,
        sentiment: result.sentiment,
        tags: result.tags,
        isAnalyzed: true
      };
    } catch (e) {
      console.error(`Failed to analyze chunk ${chunk.id}`, e);
      return chunk;
    }
  }));

  // Merge back (preserving unanalyzed chunks if we sliced)
  return [...analyzedChunks, ...chunks.slice(15)];
};