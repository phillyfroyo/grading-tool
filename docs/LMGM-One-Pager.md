# LMGM — AI-Powered Essay Grading for University Language Departments

## What It Does

LMGM is a web-based tool that uses AI to grade student essays for university language courses. Teachers paste student essays into the platform, select a class profile with the grading criteria, and receive detailed, rubric-aligned feedback in minutes — not hours.

A single teacher can grade an entire class of 30 essays in one session. Each essay receives:

- **Scored rubric breakdown** (grammar, vocabulary, spelling, mechanics, fluency, layout, content) with per-category scores, rationale, and editable teacher feedback
- **Color-coded inline corrections** highlighting specific errors in the student text with correction suggestions and explanations
- **Teacher notes and encouragement** section with AI-generated next steps for the student
- **Individual PDF export** for each student, ready to print or share

Every score, correction, and piece of feedback is fully editable by the teacher before export. The AI does the heavy lifting; the teacher refines and approves.

## Key Features

- **Batch grading** — grade up to 30+ essays at once with real-time streaming progress
- **Class profiles** — define CEFR level, grammar points, vocabulary, and grading criteria per class; reuse across semesters
- **Dual AI engine** — choose between Claude (Anthropic) or GPT (OpenAI) per grading run
- **Auto-save** — grading sessions persist across page refreshes and browser closures; teachers can leave and come back the next day without losing work
- **Inline highlighting system** — click any text in the student essay to add, edit, or remove error highlights by category
- **PDF export** — export individual or batch essays with color-coded corrections and category legends
- **Saved essays** — teachers can save graded essays to their account for future reference

## Who Uses It

Currently used by ~20-25 language teachers across two university campuses for grading student essays in English, French, and other foreign language courses. Teachers grade real student work with it weekly.

## How It Works (Technical)

| Component | Technology |
|-----------|-----------|
| Backend | Node.js + Express, REST API, modular MVC architecture |
| Frontend | Vanilla JavaScript (modular), HTML/CSS, no framework dependency |
| Database | PostgreSQL via Prisma ORM |
| AI | Anthropic Claude API + OpenAI API (configurable per request) |
| Auth | Email-based login, session + cookie authentication |
| Hosting | Vercel (serverless) |
| Streaming | Server-Sent Events for real-time batch grading progress |

The application is a single deployable unit — one Express server handles API routes, serves the frontend, and manages sessions. No microservices, no complex infrastructure. The codebase is clean, modular, and well-structured for handoff or integration.

## Integration Readiness

- Clean REST API layer — grading, profiles, sessions, and auth are separate API endpoints
- AI provider is abstracted — adding new models or providers requires minimal changes
- Class profiles are stored as structured data (CEFR level, grammar points, vocabulary lists) — portable to any system
- No vendor lock-in on the frontend — vanilla JS integrates into any wrapper or iframe
- Database schema is simple and well-defined via Prisma migrations

## Built By

Philip Woolery-Price — university language instructor and software developer. Built as a working tool to solve a real problem in his own classroom, now used daily by colleagues across two campuses.

---

*April 2026*
