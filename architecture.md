
# Semantic Text Unweaver - Modular Architecture

## Overview
This application follows a strict 5-step sequential pipeline for semantic text analysis. It separates the "Prompt Engineering" from the "Software Engineering" by externalizing all LLM prompts into a JSON configuration. A key feature is "Evidence-Based Analysis," allowing users to trace themes back to specific source quotes and refine the data manually.

## Data Flow
The state flows uni-directionally through these stages, but now allows user intervention at key checkpoints:

1.  **Ingestion:** Raw Files -> Source Documents (with metadata detection for CSVs).
2.  **Segmentation:** Source Documents + Strategy -> Raw Chunks.
    *   *New:* Supports Column splitting for structured data.
3.  **Global Analysis (Evidence Gathering):** Raw Chunks -> Global Themes & Quotes.
    *   *Process:* Uses a large sample to identify themes and extract supporting quotes.
    *   *Intervention:* User ("Wendy Waddle") can edit theme definitions and remove/refine evidence before applying to the full corpus.
4.  **Segment Analysis:** Raw Chunks + Global Themes -> Annotated Chunks.
    *   *Intervention:* User can correct AI annotations (Sentiment/Tags) on a per-chunk basis.
5.  **Synthesis Dashboard:** Annotated Chunks -> Aggregate Stats & Network Graph.
    *   *Intervention:* Users can drill down into any chart bar or graph node to see the underlying "Evidence" (segments).
    *   *Realignment:* Users can move evidence from one theme to another directly in the dashboard, updating the underlying dataset.

## Component Structure

### Configuration
*   **`prompts.json`**: The **Single Source of Truth** for all AI personality, instructions, and schemas.

### Core Services
*   **`services/llm_core.ts`**: Generic Gemini engine.

### Pipeline Modules
*   **`services/step1_ingest.ts`**: Handles file reading and CSV Header parsing.
*   **`services/step2_segment.ts`**: Advanced splitting logic (Regex or CSV Column mapping).
*   **`services/step3_global.ts`**: Identifies the "Forest" (Themes, Genre, Tone) with Evidence.
*   **`services/step4_local.ts`**: Iterates through chunks for granular analysis.
*   **`services/step5_graph.ts`**: Aggregates tags for the knowledge graph.

### UI
*   **`App.tsx`**: Main wizard controller.
*   **`Visualizer.tsx`**: Comprehensive dashboard for the final step.
*   **`ChunkViewer.tsx`**: Interactive list for reviewing text segments.
*   **`EvidenceViewer.tsx`**: Detailed modal for viewing specific chunks associated with a theme and realigning them.
