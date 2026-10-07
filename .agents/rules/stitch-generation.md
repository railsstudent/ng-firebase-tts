---
trigger: model_decision
description: Best practices and invariants for generating UI screens and variants with Stitch MCP.
---

# Stitch UI MCP Generation Rules

## Project Metadata & Identifiers

- **Default Stitch Project Resource**: `projects/12801462651512192530`
- **Default Stitch Project ID**: `12801462651512192530`
- **Project Title**: `Firebase Image Anaylsis and TTS`

## Core Operating Invariant: Single-Shot Execution

1. **Strictly No Retries on 60s Timeout**:
   - High-fidelity screens and variant generation take 75–90 seconds to render on the Stitch generative backend.
   - The MCP client may encounter an HTTP fetch timeout (`Network failure connecting to Stitch API: fetch failed`) at 60 seconds.
   - **This timeout is a client-side wait limit, NOT a backend failure.** The generation process continues and will finish successfully.
   - **NEVER** re-issue `generate_screen_from_text`, `generate_variants`, or `edit_screens` when a timeout error occurs. Doing so floods the project with duplicate screen copies.

2. **Deterministic Polling Loop**:
   - Call the generation tool (`generate_screen_from_text` or `generate_variants`) **EXACTLY ONCE** targeting `projectId: "12801462651512192530"`.
   - If the call times out or returns a connection error, wait 25–30 seconds.
   - Call `list_screens` or `get_screen` with resource name `projects/12801462651512192530/screens/{screenId}` to retrieve the finished screen details.
   - Extract and report the completed Screen ID, Title, Screenshot URL, and HTML Artifact download URL to the user.
