
# Implementation Plan: Modern Semantic Text Unweaver

## Phase 1: Enhanced Ingestion & Data Structure
- [x] Update `SourceDocument` to hold CSV header info.
- [x] Improve Step 1 UI to show file cards with status.

## Phase 2: Advanced Segmentation
- [x] Create `CsvConfig` type for column mapping.
- [x] Implement logic to split CSVs by "Row (Combined)" or "Column (Distinct)".
- [x] Build UI for selecting columns in Step 2.

## Phase 3: Interactive Analysis (The "Wendy Waddle" Workflow)
- [x] Allow users to add/delete/rename "Global Themes" in Step 3.
- [x] **New:** Extract supporting quotes for themes in Step 3.
- [x] **New:** Allow users to view and remove quote evidence in Step 3.
- [x] Allow users to edit "Local Analysis" (Sentiment/Tags) in Step 4.

## Phase 4: Synthesis Dashboard & Realignment
- [x] Create a Dashboard component replacing the simple Graph.
- [x] Add Theme Frequency Chart.
- [x] Add Sentiment Distribution Chart.
- [x] Integrate Concept Map into the dashboard tabs.
- [x] **New:** Implement `EvidenceViewer` modal.
- [x] **New:** Connect Dashboard clicks to Evidence Viewer.
- [x] **New:** Allow manual realignment (moving chunks between themes) in the Viewer.

## Phase 5: Persistence
- [x] **New:** Add JSON Export functionality to save the entire project state.
