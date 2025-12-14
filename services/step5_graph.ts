import { Chunk, ConceptMapData, GlobalAnalysisResult } from "../types";
import { runPrompt } from "./llm_core";

export const buildGraph = async (chunks: Chunk[], globalData: GlobalAnalysisResult): Promise<ConceptMapData> => {
  // 1. Collect all unique tags (Concepts)
  const tagCounts = new Map<string, number>();
  chunks.forEach(c => {
    c.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  // Top 20 concepts
  const topConcepts = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag]) => tag);

  // 2. Build Nodes
  const nodes = topConcepts.map(tag => ({
    id: tag,
    label: tag,
    type: 'concept' as const,
    value: tagCounts.get(tag) || 1
  }));

  // 3. Ask LLM for Relationships between these concepts based on the text Summary
  try {
    const response = await runPrompt("graph_relationship", {
      CONCEPTS_LIST: topConcepts.join(", "),
      SUMMARY: globalData.summary
    });

    const links = response.links.map((link: any) => ({
      source: link.source,
      target: link.target,
      label: link.label,
      strength: link.weight || 1
    }));

    // Filter links to ensure both source/target exist in our nodes
    const validLinks = links.filter((l: any) => 
      topConcepts.includes(l.source) && topConcepts.includes(l.target)
    );

    return { nodes, links: validLinks };

  } catch (e) {
    console.error("Graph generation failed", e);
    return { nodes, links: [] };
  }
};