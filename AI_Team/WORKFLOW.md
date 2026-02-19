# AI Team Workflow

This document establishes the strict operational flow for the AI agents in this project.

## The Cycle

1.  **🔍 Auditor (The Truth)**
    *   **Input**: Current Codebase, Database Schema, Logs.
    *   **Action**: Analyzes state, identifies history, detects errors.
    *   **Output**: `DOCUMENTO_RECTOR.md` (The source of truth).

2.  **📐 Architect (The Method)**
    *   **Input**: `DOCUMENTO_RECTOR.md`.
    *   **Action**: Validates logic, breaks down into strict steps.
    *   **Output**: `IMPLEMENTATION_METHOD.md` (Step-by-step plan).

3.  **⚙️ Engineer (The Hand)**
    *   **Input**: `IMPLEMENTATION_METHOD.md`.
    *   **Action**: Modifies code *strictly* following the steps.
    *   **Constraint**: Cannot deviate from the method.
    *   **Output**: Code Changes.

4.  **🛡️ QA (The Shield)**
    *   **Input**: Code Changes vs `DOCUMENTO_RECTOR.md` & `IMPLEMENTATION_METHOD.md`.
    *   **Action**: Validates, tests, authorizes.
    *   **Output**: `VALIDATION_REPORT.md` (Pass/Stop).

## Core Rules

*   **No jumping steps.**
*   **The Auditor's word is law regarding the *current state*.**
*   **The Architect's word is law regarding the *future path*.**
*   **The Engineer is the only one who touches code.**
*   **The QA has veto power.**
