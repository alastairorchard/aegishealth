# AegisHealth - Clinical Biomarker, Wearable & Condition Intelligence Platform

## Overview
**AegisHealth** is a clinical longevity and precision medicine dashboard engineered for continuous physiological telemetry, multi-modal lab ingestion, Apple Watch Ultra 4 integration, and AI-driven clinical consultation powered by **Doc** (OpenClaw `google/gemini-3.7-flash` agent).

---

## Key Features & Architecture

### 1. Multi-Modal Lab & Annual Checkup Ingestion
- Upload blood tests, OCT ophthalmology scans, and checkup PDFs/images.
- AI OCR and normalization maps metrics (ApoB, Total/Free Testosterone, Macular Thickness, CMP, CBC, hs-CRP, HbA1c) into structured time-series data.
- Stores original documents in Supabase Storage with on-demand retrieval.

### 2. Apple Watch Ultra 4 Autonomic Telemetry API
- Ingestion endpoint (`/api/apple-health/ingest`) for continuous streaming via **Health Auto Export** or native **iOS Shortcuts**.
- Real-time tracking of HRV (SDNN), Resting Heart Rate, Sleep Stages (Deep, REM, Core, Total), VO2 Max, Active Energy, and Wrist Temperature.

### 3. User Management & Onboarding Wizard
- Supabase Authentication (mandatory login/registration).
- Interactive onboarding wizard to capture biological baseline, anthropometrics, and primary health goals.
- Per-user API token management with fine-grained permissions.

### 4. Longitudinal Biomarker Trends & Longevity Zone Overlays
- Multi-metric time series visualizer with optimal longevity target bands (e.g. ApoB < 60 mg/dL) vs standard reference ranges.
- Dual-eye retinal macular thickness tracking (OD / OS).

### 5. Doc - AI Personal Medical Consultant
- Dedicated OpenClaw agent (`doc`, model: `google/gemini-3.7-flash`).
- In-app interactive Q&A interface (no OpenClaw dashboard login required).
- Logs clinical insights, predictions, test suggestions, and lifestyle protocols to the user's database profile.

### 6. Acute & Chronic Conditions Hub
- Full condition lifecycle management: `Active` &rarr; `Managing` &rarr; `Resolved / Closed`.
- Cross-tagging of biomarkers, wearable vitals, and lab scans across multiple conditions.
- Dedicated Doc consultation threads per condition.

### 7. Diagnostic Executive Reports
- One-click diagnostic assessment generator summarizing health status, longitudinal trajectories, risk stratification, and actionable recommendations.
- Print and PDF export layout ready for physician reviews.

---

## Directory Structure
```
aegishealth/
├── package.json
├── server.js                     # Express API & proxy server
├── supabase_schema.sql           # Complete Supabase PostgreSQL DDL & RLS policies
├── APPLE_HEALTH_SETUP.md         # Apple Watch Ultra 4 sync guide
├── DOC_AGENT_GUIDE.md            # Doc agent configuration & specs
├── public/
│   ├── index.html                # Single-page dashboard UI
│   ├── app.js                    # Core application logic & Chart.js engine
│   └── style.css                 # Custom themes, glassmorphism & print CSS
└── uploads/                      # Local document vault buffer
```

---

## Quick Start
```bash
cd /home/ubuntu/.openclaw/workspace/apps/aegishealth
npm install
npm start
```
App runs at `http://localhost:3000`.
