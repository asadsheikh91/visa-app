# VisaScore - Project Documentation & Analysis

**Author:** Senior Software Engineer
**Date:** May 12, 2026
**Status:** Internal Review

---

## What is this project?

**VisaScore** is essentially a high-margin AI wrapper designed to monetize the anxiety of Pakistani Schengen visa applicants. 

**The Purpose:** 
It serves as a risk assessment tool that uses Anthropic's Claude Opus 4.5 model to evaluate a user's likelihood of getting a visa based on a 15-question form. It follows a "Freemium" model:
1. **The Hook:** A free "Risk Score" (e.g., "High Risk") to grab the user's attention.
2. **The Paywall:** A detailed breakdown and "actionable fixes" hidden behind a $12 payment.
3. **The Business:** Low overhead (AI costs ~$0.05 per run) and high profit margin (~$11.95 per sale).

---

## Folder & Directory Breakdown

### 📂 `visa/` (Root)
The project root. It's a standard monorepo structure separating the client and server.
*   **`README.md`**: The marketing-friendly overview and quickstart guide.
*   **`INTEGRATION_GUIDE.md`**: Technical instructions on how the backend and frontend talk to each other, specifically focused on payment and email flows.

### 📂 `backend/`
A FastAPI-based Python backend. It handles the "brain" (AI) and the "bank" (Payments).
*   **`main.py`**: The entry point. Bootstraps the FastAPI app and includes the routers.
*   **`database.py`**: Handles the SQLAlchemy async connection to PostgreSQL.
*   **`models.py`**: Defines the database schema (User, Report). It tracks what the user answered and whether they've paid.
*   **`schemas.py`**: Pydantic models for request/response validation. Ensures the frontend doesn't send garbage data.
*   **📂 `alembic/`**: Database migration scripts. Used to keep the DB schema in sync as the code evolves.
*   **📂 `routers/`**:
    *   `reports.py`: The core API logic. Handles creating a report, submitting answers, and fetching results.
    *   `webhooks.py`: The LemonSqueezy listener. When a user pays, this script gets a ping and unlocks the "Paid" status in the database.
*   **📂 `services/`**:
    *   `ai_scorer.py`: The heart of the product. It constructs the prompt for Claude Opus 4.5, sends it, and parses the response into scores.
    *   `email_service.py`: Sends the final report to the user via Resend after a successful payment.
*   **`requirements.txt`**: List of Python dependencies.

### 📂 `frontend/`
A modern Next.js 14 frontend. It’s built to be fast, dark-themed, and trustworthy (to justify the $12).
*   **📂 `app/`**: Using the Next.js App Router.
    *   `page.tsx`: The landing page. Its only job is to sell the service.
    *   📂 `assess/`: The multi-step form where users enter their data.
    *   📂 `results/`: Displays the risk score. Dynamically toggles between the "Free teaser" and the "Paid breakdown."
*   **📂 `components/`**: Reusable UI blocks like `ScoreCircle.tsx` (the "wow" factor animated score) and `BreakdownCard.tsx`.
*   **📂 `types/`**: TypeScript definitions to ensure the frontend doesn't break when handling backend responses.
*   **`package.json`**: NPM dependencies (Tailwind, Framer Motion for animations, etc.).

### 📂 `.claude/`
Contains IDE-specific settings or history for the Claude AI assistant. Irrelevant to the production app but useful for development.

---

## Engineering Truths & Blunt Observations

1.  **AI Wrapper Dependency:** The entire value proposition rests on a single prompt to Claude. If Anthropic changes their API or the prompt starts hallucinating, the product breaks.
2.  **Payment Logic Security:** The system relies on LemonSqueezy webhooks. If the `webhooks.py` is not properly secured with secrets (which are mentioned in the `.env.example`), people could spoof payments and get free reports.
3.  **Scalability:** It's built on FastAPI and PostgreSQL with async support, which is good. It can handle thousands of concurrent users easily, provided the AI API rate limits allow it.
4.  **UX Focus:** The project puts a lot of effort into the "Score" visualization. This is a psychological play—making the "Risk" feel scientific and calculated to increase the perceived value of the $12 fix.
5.  **Legal/Compliance:** There's no mention of a "Disclaimer" in the file list. Charging $12 for visa advice without a clear "We are not lawyers" disclaimer is a liability waiting to happen.

---
