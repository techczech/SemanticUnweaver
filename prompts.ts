
export const promptsConfig = {
  "segmentation_suggestion": {
    "model": "gemini-2.5-flash",
    "system": "You are a data architect analyzing text structure.",
    "template": "Analyze this text sample:\n\n{{TEXT_SAMPLE}}\n\nDetermine the best way to split this into semantic units (Chunks). \nOptions: PARAGRAPH (prose), SENTENCE (dense logic), LINE (poetry/lyrics), ROW (csv data), SECTION (scientific paper), TURN (interview).\nReturn JSON.",
    "schemaType": "SEGMENTATION_STRATEGY"
  },
  "global_analysis": {
    "model": "gemini-2.5-flash",
    "system": "You are a lead researcher analyzing a corpus of text.",
    "template": "Analyze the following representative text samples from a dataset.\n\n{{TEXT_SAMPLE}}\n\n1. Identify the Genre.\n2. Write a high-level summary.\n3. Identify 5-8 distinct, high-level semantic themes or concepts that permeate this text. These themes will be used to tag individual sections later.\n\nReturn JSON.",
    "schemaType": "GLOBAL_ANALYSIS"
  },
  "local_analysis": {
    "model": "gemini-2.5-flash",
    "system": "You are a meticulous text analyst unweaving meaning from specific segments.",
    "template": "You are analyzing a segment of text within the context of these Global Themes: {{GLOBAL_THEMES}}.\n\nSegment Text:\n\"{{CHUNK_TEXT}}\"\n\nTasks:\n1. Unweave the meaning: Write a 1-sentence analysis of what is happening here implicitly.\n2. Tagging: Assign 1-3 tags. PREFER using the Global Themes provided if applicable, but create specific sub-tags if necessary.\n3. Sentiment: Score -1.0 to 1.0.\n\nReturn JSON.",
    "schemaType": "LOCAL_ANALYSIS"
  },
  "graph_relationship": {
    "model": "gemini-2.5-flash",
    "system": "You are a network scientist building a knowledge graph.",
    "template": "Based on these concepts identified in the text: {{CONCEPTS_LIST}}.\n\nAnd this context summary: {{SUMMARY}}.\n\nIdentify the top 15 strongest semantic relationships (links) between these concepts. Explain the 'label' of the relationship (e.g. 'causes', 'contradicts', 'is a type of').\n\nReturn JSON.",
    "schemaType": "GRAPH_DATA"
  }
};
