# Apple Watch Ultra 4 & Apple Health Ingestion Guide

## Overview
**AegisHealth** ingests continuous physiological telemetry from your Apple Watch Ultra 4 and Apple Health repository via authenticated REST API webhooks.

---

## 1. Automated Sync via "Health Auto Export" (iOS App - Recommended)

**Health Auto Export** is the gold-standard iOS utility for continuous, background streaming of Apple Watch telemetry.

### Setup Instructions:
1. Download **Health Auto Export** from the iOS App Store on your iPhone.
2. In the app, navigate to **Automations** &rarr; **REST API**.
3. Configure the endpoint:
   - **URL:** `https://<YOUR_DEPLOYED_AEGIS_DOMAIN>/api/apple-health/ingest?userId=<USER_UUID>`
   - **Method:** `POST`
   - **Authentication:** `Bearer Token`
   - **Token:** Paste your generated API token from the AegisHealth **Devices & API** tab.
4. Select Metrics to Sync:
   - **Heart Rate Variability (SDNN)**
   - **Resting Heart Rate**
   - **Sleep Analysis** (Total, REM, Deep / Slow Wave, Core, Awakenings)
   - **Cardio Fitness / VO2 Max**
   - **Active Energy / Basal Energy**
   - **Wrist Temperature / Respiratory Rate / SpO2**
5. Set Cadence: **Every 1 Hour** (or Background Delivery upon new sample).

---

## 2. iOS Shortcuts Webhook (Zero-App Setup)

You can also use a native iOS Shortcut to push daily health summaries:
1. Open **Shortcuts** app on iPhone.
2. Add Action: `Find Health Samples where Type is HRV / Sleep / RHR`.
3. Add Action: `Get Contents of URL`:
   - URL: `https://<YOUR_DEPLOYED_AEGIS_DOMAIN>/api/apple-health/ingest`
   - Headers: `Authorization: Bearer <YOUR_TOKEN>`, `Content-Type: application/json`
   - Body: JSON payload mapping your vitals.
4. Set an Automation in Shortcuts: *When Sleep Focus turns off &rarr; Run Shortcut*.
