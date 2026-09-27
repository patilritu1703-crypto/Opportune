# 🎯 OpporTune

**Your skills. Your interests. Your next opportunity.**

A Student Opportunity Discovery Platform built for **FIT FEST Hackathon 2026**. OpporTune brings internships, hackathons, scholarships, courses, competitions, certifications and workshops into one place, and ranks every listing with a transparent, explainable **Match Score** — no external AI API required.

---

## Why this stack

The brief suggested React + Vite + Express. Instead, OpporTune ships as **one Node.js server (built-in `http` module, zero npm dependencies) serving a single-file vanilla JS SPA** styled with the Tailwind CDN. That decision was made specifically to guarantee the app **builds and deploys with zero install/build-step risk** in a 4‑hour hackathon window:

- No `npm install` required to run it — just `node server/server.js`.
- No bundler, no build step, no version drift between dev and prod.
- Docker image is a single `COPY` + `CMD node`, so it builds in seconds.
- The matching algorithm still lives in its own module (`server/matching.js`) so it's easy to swap for an ML model later, exactly as the brief asked for.

Everything else in the brief (profile, search, filters, recommendations, bookmarks, dashboard, opportunity details, external application links) is fully implemented.

## Hackathon demo features added

- **Skill-Gap → Course Loop:** every scored opportunity can recommend courses from the existing catalog that add missing required skills, then shows the exact before → after match improvement using the same scoring engine.
- **Visual Match Breakdown:** opportunity details show a donut visualization plus the five weighted components: Skills (40), Interests (25), Education (15), Category (10), Deadline (10).
- **Application Tracker:** a persistent Kanban board with Interested → Applied → Interview → Result. Cards can be moved by dropdown or drag-and-drop; clicking Apply automatically moves the opportunity to Applied.
- **Resume Skill Extractor:** paste resume text in Profile and scan it against the app's known skill/interest catalog. It uses local keyword matching, so no external AI API or API key is required.

---

## Project Structure

```text
opportune/
├── server/
│   ├── server.js              # HTTP server: static file serving + REST API
│   ├── matching.js            # Transparent, modular match-score algorithm
│   └── data/
│       └── opportunities.json # 33 seeded demo opportunities
├── public/
│   ├── index.html             # App shell (Tailwind CDN + Lucide icons)
│   ├── app.js                 # Full SPA: routing, views, state, matching UI
│   └── styles.css             # Small CSS extras Tailwind utilities don't cover
├── scripts/
│   └── gen-data.mjs           # Regenerates server/data/opportunities.json
├── Dockerfile
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Run locally

Requires Node.js 18+ (no other dependencies).

```bash
cd opportune
npm start
# → OpporTune server running on http://localhost:8080
```

Open **http://localhost:8080** in your browser.

---

## Demo profile

Click **"Try Demo Profile"** on the landing page or onboarding form to instantly load:

| Field | Value |
|---|---|
| Name | Mihir |
| Education | Diploma in Artificial Intelligence & Machine Learning |
| Skills | Python, Machine Learning, Pandas, NumPy, SQL, HTML, CSS, JavaScript |
| Interests | AI/ML, Data Science, Web Development |
| Preferred categories | Internship, Hackathon, Competition, Course |

This profile matches the **AI for Good Hackathon** at ~94% — reproducing the exact example from the brief.

---

## How the matching algorithm works

Implemented in `server/matching.js`, fully transparent and dependency-free:

```
matchScore = (skillMatch    × 0.40)
           + (interestMatch × 0.25)
           + (educationMatch× 0.15)
           + (categoryMatch × 0.10)
           + (deadlineScore × 0.10)
```

- **skillMatch** — fraction of an opportunity's required skills present in the student's profile.
- **interestMatch** — fraction of an opportunity's tagged interests present in the student's profile.
- **educationMatch** — 1.0 if the opportunity accepts "Any" education or the student's education string overlaps an accepted value; 0.2 otherwise (still surfaced, just ranked lower).
- **categoryMatch** — 1.0 if the opportunity's category is one of the student's preferred categories.
- **deadlineScore** — urgency boost: closing today scores highest, 90+ days out scores lowest, so time-sensitive opportunities float upward.

Each opportunity also gets a human-readable **"Why this matches you"** list (matched skills, matched interests, education fit, category fit, deadline urgency) and an urgency badge:

- 🔴 Closing today · 🟠 1–2 days left · 🟡 3–5 days left · 🟢 6+ days left

Because scoring is isolated in one module (`scoreOpportunity` / `scoreAll`), it can be swapped for an ML ranking model later without touching the API contract, the frontend, or the rest of the codebase.

### Built-in AI Opportunity Assistant

A small rule-based assistant (bottom-right chat bubble) answers questions like *"which opportunities fit my Python skills?"*, *"why should I apply to this?"* and *"what skills am I missing?"* by reasoning directly over the same match data — **no external API key required**, and the app works identically with or without it.

---

## Build the Docker image

```bash
cd opportune
docker build -t opportune:latest .
docker run -p 8080:8080 opportune:latest
```

Then open http://localhost:8080.

---

## Deploy to Google Cloud Run

Replace `YOUR_PROJECT_ID` and pick a region close to your judges.

```bash
# 1. Authenticate & set your project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Enable required APIs (one-time)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# 3. Build and submit the container image via Cloud Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/opportune

# 4. Deploy to Cloud Run
gcloud run deploy opportune \
  --image gcr.io/YOUR_PROJECT_ID/opportune \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --port 8080

# 5. Cloud Run prints a public HTTPS URL — that's what you share with judges.
```

No environment variables are required for the deployment to work.

---

## Push to GitHub

```bash
cd opportune
git init
git add .
git commit -m "OpporTune — FIT FEST Hackathon 2026 MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/opportune.git
git push -u origin main
```

---

## 2-minute demo script

1. **(0:00–0:15)** Land on the homepage — read the hero line, point out the sample match cards.
2. **(0:15–0:30)** Click **"Try Demo Profile"** → instantly populated skills/interests/categories → submit.
3. **(0:30–1:00)** Dashboard: call out the stat cards (Recommended / High Match / Closing Soon / Saved), then the **Top Match** card showing **94% — AI for Good Hackathon** with the match ring and matched skills.
4. **(1:00–1:20)** Open an opportunity card → show the **"Why this matches you"** checklist in the detail modal → click **Save**.
5. **(1:20–1:40)** Go to **Explore** → filter by category "Hackathon" and a skill → show live-updating results and match %.
6. **(1:40–1:55)** Open the **AI Opportunity Assistant** → ask *"what skills am I missing?"* → show the instant, dependency-free answer.
7. **(1:55–2:00)** Close on **Saved** page and the deployed Cloud Run URL on screen.

---

## What makes it innovative

- **Explainable, not a black box.** Every match percentage comes with a plain-language "why," so students trust the recommendation instead of guessing at it.
- **Deadline-aware ranking.** The same opportunity ranks higher as its deadline approaches, so urgent, relevant opportunities never get buried under older, static listings.
- **Zero-dependency, zero-API-key architecture.** Both the matching engine and the assistant work fully offline from any paid AI service — cheap to run, easy to judge, easy to deploy.
- **Modular scoring.** The weighted formula is one small, readable function — a natural seam for swapping in an ML ranker post-hackathon without a rewrite.

---

## Suggested poster content

**Headline:** OpporTune — Your skills. Your interests. Your next opportunity.

**Problem:** Students miss internships, hackathons, scholarships and courses because information is scattered across dozens of sources.

**Solution:** One platform. One profile. A transparent Match Score for every opportunity — explained, not guessed.

**Key visual:** The 94% Match ring + "Why this matches you" checklist screenshot.

**Footer stats:** 33+ live opportunities · 7 categories · 0% guesswork · Built in one Node.js service, deployed on Cloud Run.

---

## Hackathon requirements checklist

- [x] Runs locally with a single command (`npm start`)
- [x] Clean README (this file)
- [x] `.env.example` included
- [x] `.gitignore` included
- [x] `Dockerfile` included
- [x] Deployable to Google Cloud Run
- [x] Core functionality works with no external API keys
- [x] 33 realistic, demo-safe seed opportunities
- [x] No broken buttons, no placeholder screens
- [x] Responsive UI (mobile bottom nav + desktop sidebar)
- [x] Empty states (no matches, no saved items) and loading states handled
- [x] Basic input validation on the profile API
