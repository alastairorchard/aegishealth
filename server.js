const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON & URL-encoded parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration for lab documents
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  }
});
const upload = multer({ storage });

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// In-memory data store for standalone/demo execution (mirrors Supabase schema)
const db = {
  profiles: {},
  tokens: {},
  labDocuments: [],
  biomarkers: [],
  wearableMetrics: [],
  conditions: [],
  conditionTags: [],
  docConsultations: [],
  docMessages: [],
  insights: [],
  reports: []
};

// Seed initial demo data
function seedInitialData() {
  const demoUserId = 'demo-user-alastair';
  
  db.profiles[demoUserId] = {
    id: demoUserId,
    email: 'alastairorchard@icloud.com',
    full_name: 'Alastair Orchard',
    date_of_birth: '1982-06-15',
    biological_sex: 'male',
    height_cm: 184,
    weight_kg: 81.5,
    blood_type: 'O+',
    primary_health_goals: ['Longevity & Cardiovascular Optimization', 'Ophthalmology / Macular Protection', 'Metabolic & Hormonal Peak Performance'],
    onboarding_completed: true
  };

  // Biomarker historical trends (ApoB, Testosterone, Macular Thickness, etc.)
  const biomarkerSeeds = [
    // ApoB (mg/dL) - Goal < 60 mg/dL for longevity
    { biomarker_code: 'APOB', biomarker_name: 'Apolipoprotein B', category: 'lipids_cardio', value: 88, unit: 'mg/dL', standard_range_low: 50, standard_range_high: 90, optimal_longevity_low: 40, optimal_longevity_high: 60, clinical_flag: 'borderline', test_date: '2025-03-10', notes: 'Baseline annual checkup.' },
    { biomarker_code: 'APOB', biomarker_name: 'Apolipoprotein B', category: 'lipids_cardio', value: 74, unit: 'mg/dL', standard_range_low: 50, standard_range_high: 90, optimal_longevity_low: 40, optimal_longevity_high: 60, clinical_flag: 'borderline', test_date: '2025-09-15', notes: 'Post-dietary modification.' },
    { biomarker_code: 'APOB', biomarker_name: 'Apolipoprotein B', category: 'lipids_cardio', value: 58, unit: 'mg/dL', standard_range_low: 50, standard_range_high: 90, optimal_longevity_low: 40, optimal_longevity_high: 60, clinical_flag: 'optimal', test_date: '2026-03-20', notes: 'Optimal longevity target achieved with Ezetimibe + lifestyle.' },
    { biomarker_code: 'APOB', biomarker_name: 'Apolipoprotein B', category: 'lipids_cardio', value: 54, unit: 'mg/dL', standard_range_low: 50, standard_range_high: 90, optimal_longevity_low: 40, optimal_longevity_high: 60, clinical_flag: 'optimal', test_date: '2026-09-10', notes: 'Stable in optimal zone.' },

    // Total Testosterone (ng/dL)
    { biomarker_code: 'TESTOSTERONE_TOTAL', biomarker_name: 'Total Testosterone', category: 'hormones', value: 580, unit: 'ng/dL', standard_range_low: 264, standard_range_high: 916, optimal_longevity_low: 600, optimal_longevity_high: 850, clinical_flag: 'normal', test_date: '2025-03-10', notes: 'Routine hormone assessment.' },
    { biomarker_code: 'TESTOSTERONE_TOTAL', biomarker_name: 'Total Testosterone', category: 'hormones', value: 640, unit: 'ng/dL', standard_range_low: 264, standard_range_high: 916, optimal_longevity_low: 600, optimal_longevity_high: 850, clinical_flag: 'optimal', test_date: '2025-09-15', notes: 'Improved with sleep quality & resistance protocol.' },
    { biomarker_code: 'TESTOSTERONE_TOTAL', biomarker_name: 'Total Testosterone', category: 'hormones', value: 710, unit: 'ng/dL', standard_range_low: 264, standard_range_high: 916, optimal_longevity_low: 600, optimal_longevity_high: 850, clinical_flag: 'optimal', test_date: '2026-03-20', notes: 'Optimal androgen status.' },
    { biomarker_code: 'TESTOSTERONE_TOTAL', biomarker_name: 'Total Testosterone', category: 'hormones', value: 695, unit: 'ng/dL', standard_range_low: 264, standard_range_high: 916, optimal_longevity_low: 600, optimal_longevity_high: 850, clinical_flag: 'optimal', test_date: '2026-09-10', notes: 'Well-regulated circadian recovery.' },

    // Free Testosterone (pg/mL)
    { biomarker_code: 'TESTOSTERONE_FREE', biomarker_name: 'Free Testosterone', category: 'hormones', value: 14.2, unit: 'pg/mL', standard_range_low: 8.7, standard_range_high: 25.1, optimal_longevity_low: 15.0, optimal_longevity_high: 22.0, clinical_flag: 'normal', test_date: '2026-03-20', notes: 'Good bioavailable fraction.' },
    { biomarker_code: 'TESTOSTERONE_FREE', biomarker_name: 'Free Testosterone', category: 'hormones', value: 16.8, unit: 'pg/mL', standard_range_low: 8.7, standard_range_high: 25.1, optimal_longevity_low: 15.0, optimal_longevity_high: 22.0, clinical_flag: 'optimal', test_date: '2026-09-10', notes: 'Optimal free hormone ratio.' },

    // Macular Thickness (OCT - Central Subfield Thickness in µm)
    { biomarker_code: 'MACULAR_THICKNESS_OD', biomarker_name: 'Central Macular Thickness (OD - Right Eye)', category: 'ophthalmology', value: 265, unit: 'µm', standard_range_low: 240, standard_range_high: 290, optimal_longevity_low: 250, optimal_longevity_high: 275, clinical_flag: 'optimal', test_date: '2025-04-12', notes: 'Annual OCT scan - Foveal contour preserved.' },
    { biomarker_code: 'MACULAR_THICKNESS_OD', biomarker_name: 'Central Macular Thickness (OD - Right Eye)', category: 'ophthalmology', value: 268, unit: 'µm', standard_range_low: 240, standard_range_high: 290, optimal_longevity_low: 250, optimal_longevity_high: 275, clinical_flag: 'optimal', test_date: '2026-04-18', notes: 'Follow-up OCT - Stable micro-architecture.' },
    { biomarker_code: 'MACULAR_THICKNESS_OS', biomarker_name: 'Central Macular Thickness (OS - Left Eye)', category: 'ophthalmology', value: 298, unit: 'µm', standard_range_low: 240, standard_range_high: 290, optimal_longevity_low: 250, optimal_longevity_high: 275, clinical_flag: 'borderline', test_date: '2025-04-12', notes: 'Mild subfoveal fluid/edema noted in left eye.' },
    { biomarker_code: 'MACULAR_THICKNESS_OS', biomarker_name: 'Central Macular Thickness (OS - Left Eye)', category: 'ophthalmology', value: 272, unit: 'µm', standard_range_low: 240, standard_range_high: 290, optimal_longevity_low: 250, optimal_longevity_high: 275, clinical_flag: 'optimal', test_date: '2026-04-18', notes: 'Edema resolved following targeted anti-inflammatory protocol.' },

    // hs-CRP (High-Sensitivity C-Reactive Protein - mg/L)
    { biomarker_code: 'HS_CRP', biomarker_name: 'High-Sensitivity CRP', category: 'inflammation', value: 0.85, unit: 'mg/L', standard_range_low: 0, standard_range_high: 3.0, optimal_longevity_low: 0.1, optimal_longevity_high: 0.5, clinical_flag: 'normal', test_date: '2026-09-10', notes: 'Low systemic vascular inflammation.' },

    // HbA1c (%)
    { biomarker_code: 'HBA1C', biomarker_name: 'Hemoglobin A1c', category: 'metabolic', value: 5.1, unit: '%', standard_range_low: 4.0, standard_range_high: 5.6, optimal_longevity_low: 4.6, optimal_longevity_high: 5.2, clinical_flag: 'optimal', test_date: '2026-09-10', notes: 'Excellent glycemic control.' }
  ];

  biomarkerSeeds.forEach((b, i) => {
    db.biomarkers.push({
      id: 'bm-' + (i + 1),
      user_id: demoUserId,
      ...b
    });
  });

  // Apple Watch Ultra 4 Continuous Stream (Wearable Metrics - last 30 days)
  const now = new Date();
  for (let d = 30; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];

    // HRV (SDNN - ms)
    db.wearableMetrics.push({
      id: `wm-hrv-${d}`,
      user_id: demoUserId,
      recorded_at: `${dateStr}T07:00:00Z`,
      metric_type: 'hrv_sdnn',
      value: Math.round(62 + Math.sin(d / 3) * 14 + (Math.random() * 6 - 3)),
      unit: 'ms',
      device_source: 'Apple Watch Ultra 4'
    });

    // Resting Heart Rate (bpm)
    db.wearableMetrics.push({
      id: `wm-rhr-${d}`,
      user_id: demoUserId,
      recorded_at: `${dateStr}T07:00:00Z`,
      metric_type: 'resting_heart_rate',
      value: Math.round(49 + Math.cos(d / 4) * 4 + (Math.random() * 3 - 1.5)),
      unit: 'bpm',
      device_source: 'Apple Watch Ultra 4'
    });

    // Sleep Total, REM, Deep
    const totalSleep = Math.round(440 + Math.sin(d / 2) * 35 + (Math.random() * 20 - 10)); // ~7.3 hrs
    const deepSleep = Math.round(85 + Math.cos(d / 3) * 15 + (Math.random() * 10 - 5));
    const remSleep = Math.round(105 + Math.sin(d / 4) * 20 + (Math.random() * 10 - 5));

    db.wearableMetrics.push({
      id: `wm-st-${d}`,
      user_id: demoUserId,
      recorded_at: `${dateStr}T06:30:00Z`,
      metric_type: 'sleep_total_min',
      value: totalSleep,
      unit: 'min',
      device_source: 'Apple Watch Ultra 4'
    });
    db.wearableMetrics.push({
      id: `wm-sd-${d}`,
      user_id: demoUserId,
      recorded_at: `${dateStr}T06:30:00Z`,
      metric_type: 'sleep_deep_min',
      value: deepSleep,
      unit: 'min',
      device_source: 'Apple Watch Ultra 4'
    });
    db.wearableMetrics.push({
      id: `wm-srem-${d}`,
      user_id: demoUserId,
      recorded_at: `${dateStr}T06:30:00Z`,
      metric_type: 'sleep_rem_min',
      value: remSleep,
      unit: 'min',
      device_source: 'Apple Watch Ultra 4'
    });

    // VO2 Max (mL/kg/min)
    if (d % 3 === 0) {
      db.wearableMetrics.push({
        id: `wm-vo2-${d}`,
        user_id: demoUserId,
        recorded_at: `${dateStr}T17:00:00Z`,
        metric_type: 'vo2_max',
        value: Number((48.5 + (30 - d) * 0.08 + (Math.random() * 0.4 - 0.2)).toFixed(1)),
        unit: 'mL/kg/min',
        device_source: 'Apple Watch Ultra 4'
      });
    }

    // Active Energy (kcal)
    db.wearableMetrics.push({
      id: `wm-kcal-${d}`,
      user_id: demoUserId,
      recorded_at: `${dateStr}T22:00:00Z`,
      metric_type: 'active_energy_kcal',
      value: Math.round(720 + Math.sin(d) * 180 + (Math.random() * 80)),
      unit: 'kcal',
      device_source: 'Apple Watch Ultra 4'
    });
  }

  // Conditions (Acute & Chronic with Lifecycle)
  const cond1 = {
    id: 'cond-1',
    user_id: demoUserId,
    title: 'ApoB & Atherogenic Particle Optimization',
    condition_type: 'chronic',
    status: 'managing',
    severity: 'mild',
    diagnosis_date: '2025-03-10',
    clinical_summary: 'Targeting aggressive reduction of ApoB < 60 mg/dL to halt subclinical endothelial plaque progression.',
    primary_treatment_plan: 'Low saturated fat, Mediterranean dietary base, daily Zone-2 cardio, low-dose Ezetimibe.'
  };
  const cond2 = {
    id: 'cond-2',
    user_id: demoUserId,
    title: 'Left Macular Micro-Edema (Resolved)',
    condition_type: 'acute',
    status: 'resolved',
    severity: 'moderate',
    diagnosis_date: '2025-04-12',
    resolved_date: '2026-04-18',
    clinical_summary: 'Central subfield thickness in left eye (OS) reached 298 µm with mild transient fluid. Normalized back to 272 µm on 2026 OCT.',
    primary_treatment_plan: 'High-dose lutein/zeaxanthin, astaxanthin, omega-3 EPA/DHA index optimization, and blue-light moderation.'
  };

  db.conditions.push(cond1, cond2);

  // Condition data tag links
  db.conditionTags.push(
    { id: 'tag-1', condition_id: 'cond-1', entity_type: 'biomarker_record', entity_id: 'bm-1', tagged_by: 'doc_ai', relevance_rationale: 'Baseline ApoB elevation (88 mg/dL)' },
    { id: 'tag-2', condition_id: 'cond-1', entity_type: 'biomarker_record', entity_id: 'bm-3', tagged_by: 'doc_ai', relevance_rationale: 'Target reached: ApoB 58 mg/dL' },
    { id: 'tag-3', condition_id: 'cond-2', entity_type: 'biomarker_record', entity_id: 'bm-10', tagged_by: 'doc_ai', relevance_rationale: 'Left eye OCT elevation (298 µm)' },
    { id: 'tag-4', condition_id: 'cond-2', entity_type: 'biomarker_record', entity_id: 'bm-11', tagged_by: 'doc_ai', relevance_rationale: 'Follow-up OCT normalization (272 µm)' }
  );

  // Doc Insights
  db.insights.push(
    {
      id: 'ins-1',
      user_id: demoUserId,
      condition_id: 'cond-1',
      insight_type: 'biomarker_trend',
      title: 'ApoB Longevity Target Sustained',
      summary: 'Your ApoB trajectory has dropped 38.6% from 88 mg/dL down to 54 mg/dL. This places you in the top 5th percentile for 10-year atherogenic risk mitigation.',
      evidence_biomarkers: ['APOB (54 mg/dL)', 'HS_CRP (0.85 mg/L)'],
      confidence_score: 0.98,
      urgency: 'routine'
    },
    {
      id: 'ins-2',
      user_id: demoUserId,
      condition_id: 'cond-2',
      insight_type: 'prediction',
      title: 'Macular Architecture Fully Stabilized',
      summary: 'The 26 µm resolution in left eye OCT thickness demonstrates full resolution of the transient acute edema episode. No further immediate intervention required; maintain standard annual OCT surveillance.',
      evidence_biomarkers: ['MACULAR_THICKNESS_OS (272 µm)'],
      confidence_score: 0.96,
      urgency: 'routine'
    },
    {
      id: 'ins-3',
      user_id: demoUserId,
      insight_type: 'test_recommendation',
      title: 'Suggested Diagnostic: LP(a) & Calcium Score (CAC)',
      summary: 'Given your optimal ApoB stabilization, completing a one-time Lipoprotein(a) baseline and a zero-contrast Coronary Artery Calcium (CAC) scan will solidify your 15-year cardiovascular roadmap.',
      evidence_biomarkers: ['APOB'],
      confidence_score: 0.94,
      urgency: 'medium'
    },
    {
      id: 'ins-4',
      user_id: demoUserId,
      insight_type: 'lifestyle_protocol',
      title: 'HRV & Deep Sleep Circadian Synchronization',
      summary: 'Apple Watch Ultra 4 telemetry indicates your HRV peaks at 76ms on days where last caloric intake is >= 3 hours before bed and deep sleep exceeds 85 minutes. Maintain this evening cutoff.',
      evidence_biomarkers: ['HRV_SDNN (76ms)', 'SLEEP_DEEP (85min)'],
      confidence_score: 0.92,
      urgency: 'routine'
    }
  );

  // Doc Chat Thread
  const consultId = 'consult-main';
  db.docConsultations.push({
    id: consultId,
    user_id: demoUserId,
    title: 'Comprehensive Health & Longevity Review'
  });
  db.docMessages.push(
    {
      id: 'msg-1',
      consultation_id: consultId,
      sender_role: 'doc_agent',
      content: 'Hello Alastair! I have integrated your latest lab results from September 2026 along with your continuous Apple Watch Ultra 4 telemetry. Your ApoB is holding exceptionally well at 54 mg/dL, testosterone is in an optimal longevity band (695 ng/dL), and your left macular thickness has completely normalized to 272 µm. How can I assist you with your health protocols today?',
      created_at: '2026-09-29T04:30:00Z'
    }
  );
}

seedInitialData();

// ------------------------------------------------------------------------------
// REST API ROUTES
// ------------------------------------------------------------------------------

// 1. Apple Health Ingestion Webhook (for Apple Watch Ultra 4 / Health Auto Export / Shortcuts)
app.post('/api/apple-health/ingest', (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    // In production, verify bearer token against public.api_tokens table
    const payload = req.body;
    const userId = req.query.userId || 'demo-user-alastair';

    let metricsCount = 0;
    const items = Array.isArray(payload) ? payload : (payload.data?.metrics || payload.metrics || [payload]);

    items.forEach(item => {
      const metricType = item.name || item.metric_type || item.type || 'unknown';
      const value = Number(item.value || item.qty || (item.data && item.data[0]?.qty) || 0);
      const unit = item.units || item.unit || 'unit';
      const date = item.date || item.recorded_at || new Date().toISOString();

      if (value) {
        db.wearableMetrics.push({
          id: 'wm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          user_id: userId,
          recorded_at: date,
          metric_type: metricType,
          value: value,
          unit: unit,
          device_source: item.device || 'Apple Watch Ultra 4',
          raw_payload: item
        });
        metricsCount++;
      }
    });

    return res.status(200).json({
      status: 'success',
      message: `Successfully ingested ${metricsCount} wearable telemetry metrics from Apple Watch Ultra 4.`,
      metricsCount: metricsCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error ingesting Apple Health data:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 2. Lab Document Upload & AI Normalization Engine
app.post('/api/labs/upload', upload.single('lab_document'), async (req, res) => {
  try {
    const file = req.file;
    const userId = req.body.userId || 'demo-user-alastair';
    const testDate = req.body.testDate || new Date().toISOString().split('T')[0];
    const labProvider = req.body.labProvider || 'Clinical Diagnostic Laboratory';
    const documentTitle = req.body.documentTitle || (file ? file.originalname : 'Comprehensive Lab Panel');

    const fileUrl = file ? `/uploads/${file.filename}` : '/uploads/sample_lab_report.pdf';

    // AI Lab Extraction Simulation & Normalization
    // Parses biomarkers e.g. ApoB, Testosterone, Macular Thickness, CMP, Lipids
    const newDoc = {
      id: 'doc-' + Date.now(),
      user_id: userId,
      document_title: documentTitle,
      document_type: req.body.documentType || 'blood_panel',
      lab_provider: labProvider,
      test_date: testDate,
      file_url: fileUrl,
      file_name: file ? file.originalname : 'Uploaded_Lab_Report.pdf',
      file_size_bytes: file ? file.size : 1048576,
      mime_type: file ? file.mimetype : 'application/pdf',
      parsing_status: 'completed',
      ai_interpretation_summary: `AI analyzed document: Extracted 8 normalized clinical biomarkers. Atherogenic ApoB verified against optimal longevity thresholds (<60 mg/dL). Hormone & metabolic markers mapped to longitudinal time series.`
    };
    db.labDocuments.unshift(newDoc);

    // If custom parsed biomarkers were supplied or auto-extracted:
    if (req.body.biomarkersJson) {
      try {
        const parsed = JSON.parse(req.body.biomarkersJson);
        parsed.forEach(b => {
          db.biomarkers.push({
            id: 'bm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            user_id: userId,
            document_id: newDoc.id,
            ...b,
            test_date: testDate
          });
        });
      } catch (e) {
        console.error('Error parsing custom biomarkers:', e);
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Lab document uploaded and normalized successfully by AI.',
      document: newDoc
    });
  } catch (err) {
    console.error('Lab upload error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 3. Doc Agent In-App Medical Consultant Chat Endpoint
app.post('/api/doc/chat', async (req, res) => {
  try {
    const { message, consultationId, conditionId, userId } = req.body;
    const targetUserId = userId || 'demo-user-alastair';

    // Fetch user context (biomarkers, conditions, wearable metrics)
    const userBiomarkers = db.biomarkers.filter(b => b.user_id === targetUserId);
    const userConditions = db.conditions.filter(c => c.user_id === targetUserId);
    const recentWearables = db.wearableMetrics.filter(w => w.user_id === targetUserId).slice(-20);

    // Save user message
    const userMsgObj = {
      id: 'msg-' + Date.now(),
      consultation_id: consultationId || 'consult-main',
      sender_role: 'user',
      content: message,
      created_at: new Date().toISOString()
    };
    db.docMessages.push(userMsgObj);

    // Generate Doc's expert response
    let docResponseText = '';
    const lower = message.toLowerCase();

    if (lower.includes('apob') || lower.includes('cholesterol') || lower.includes('lipid') || lower.includes('heart')) {
      docResponseText = `Based on your longitudinal lipid telemetry, your ApoB has transitioned remarkably from a baseline of 88 mg/dL down to **54 mg/dL** as of September 2026. \n\n### Clinical Interpretation:\n1. **Cardiovascular Risk:** An ApoB of 54 mg/dL places you firmly below the aggressive preventive threshold of < 60 mg/dL, essentially arresting the accumulation of atherogenic particles in the vascular endothelium.\n2. **Next Steps:** Maintain your current nutritional and exercise protocol. I recommend an annual ApoB check alongside a one-time Lipoprotein(a) and hs-CRP test to ensure systemic vascular inflammation remains < 0.5 mg/L.`;
    } else if (lower.includes('testosterone') || lower.includes('hormone') || lower.includes('energy') || lower.includes('libido')) {
      docResponseText = `Reviewing your endocrine panels: your Total Testosterone is currently **695 ng/dL** with Free Testosterone at **16.8 pg/mL**.\n\n### Clinical Analysis:\n- This reflects a healthy androgenic status well within the optimal physiological longevity band (600–850 ng/dL).\n- Wearable correlation: Your deep sleep (avg 82 min/night on Apple Watch Ultra 4) is providing adequate LH pulse secretion during nocturnal slow-wave sleep. Keep resistance training in Zone 3/4 and avoid late-night alcohol or elevated core body temperatures.`;
    } else if (lower.includes('eye') || lower.includes('macular') || lower.includes('oct') || lower.includes('vision')) {
      docResponseText = `Regarding your ophthalmology records: Your Left Eye (OS) Central Macular Thickness was previously elevated at 298 µm (with acute subfoveal fluid) in April 2025, but normalized back to **272 µm** in April 2026. The Right Eye (OD) is stable at **268 µm**.\n\n### Clinical Status:\n- The acute micro-edema is classified as **Fully Resolved**.\n- Retinal foveal architecture is intact. Continue daily antioxidant support (Lutein 20mg, Zeaxanthin 4mg, Astaxanthin 6mg, EPA/DHA > 2g/day) and blue-light moderation for continuous macular pigment optical density (MPOD) protection.`;
    } else if (lower.includes('sleep') || lower.includes('hrv') || lower.includes('watch') || lower.includes('apple health')) {
      docResponseText = `Your Apple Watch Ultra 4 telemetry over the past 30 days reveals:\n- **Resting Heart Rate:** Avg 48–51 bpm (Athletic/Longevity baseline)\n- **HRV (SDNN):** Avg 68–74 ms with steady parasympathetic tone\n- **Sleep Total:** 7h 24m average with 1h 22m Deep Sleep and 1h 45m REM\n- **VO2 Max:** 50.9 mL/kg/min (Superior for age bracket)\n\nOverall autonomic nervous system balance is strong. Continue zone-2 polarized training to nudge VO2 Max above 52 mL/kg/min.`;
    } else {
      docResponseText = `Thank you for your inquiry. Analyzing your consolidated health data (ApoB: 54 mg/dL, Testosterone: 695 ng/dL, Macular thickness: 268/272 µm, HRV: 72 ms, RHR: 49 bpm):\n\nYour metabolic, cardiovascular, and autonomic markers demonstrate excellent longevity optimization. If you have specific symptoms, new lab reports to upload, or questions about acute/chronic conditions, I am ready to deep-dive into the physiological data.`;
    }

    const docMsgObj = {
      id: 'msg-' + (Date.now() + 1),
      consultation_id: consultationId || 'consult-main',
      sender_role: 'doc_agent',
      content: docResponseText,
      created_at: new Date().toISOString()
    };
    db.docMessages.push(docMsgObj);

    return res.status(200).json({
      status: 'success',
      reply: docResponseText,
      message: docMsgObj
    });
  } catch (err) {
    console.error('Doc chat error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 4. Generate Diagnostic Executive Report Endpoint
app.post('/api/reports/generate', (req, res) => {
  try {
    const { userId, scope, conditionId } = req.body;
    const targetUserId = userId || 'demo-user-alastair';
    const profile = db.profiles[targetUserId] || { full_name: 'Alastair Orchard', date_of_birth: '1982-06-15' };

    const report = {
      id: 'rep-' + Date.now(),
      user_id: targetUserId,
      condition_id: conditionId || null,
      report_title: scope === 'acute_condition' ? 'Acute Condition Clinical Summary' : 'Executive Longevity & Biomarker Diagnostic Assessment',
      scope: scope || 'comprehensive_annual',
      report_date: new Date().toISOString().split('T')[0],
      executive_summary: `Patient demonstrates stellar longevity biomarker profiles. Cardiovascular atherogenic risk has been drastically attenuated with ApoB reduced to 54 mg/dL (target < 60). Left macular OCT micro-edema is clinically resolved (272 µm). Autonomic wearable telemetry via Apple Watch Ultra 4 indicates superior aerobic capacity (VO2 Max 50.9 mL/kg/min) and robust nocturnal parasympathetic recovery (HRV 72ms, RHR 49 bpm).`,
      biomarker_analysis: `• ApoB: 54 mg/dL (Optimal longevity zone)\n• Total Testosterone: 695 ng/dL (High-normal, balanced)\n• Free Testosterone: 16.8 pg/mL (Optimal)\n• Macular Thickness: OD 268 µm / OS 272 µm (Within normal limits, edema resolved)\n• HbA1c: 5.1% (Low glycemic variability)\n• hs-CRP: 0.85 mg/L (Low systemic inflammation)`,
      wearable_correlations: `Wearable telemetry from Apple Watch Ultra 4 demonstrates steady 30-day circadian cadence: 7.4 hrs total sleep, 85 min deep restorative sleep, resting heart rate of 49 bpm, and high HRV baseline.`,
      risk_stratification: `Overall 10-Year Cardiovascular & Metabolic Risk: Tier 1 (Lowest Risk Cohort, < 2.5%). Foveal micro-architecture: Low risk of recurrence under current antioxidant protocol.`,
      recommendations: `1. Maintain current ApoB protocol; recheck ApoB and complete one-time Lp(a) assay.\n2. Schedule next annual ophthalmology OCT scan in April 2027.\n3. Continue Zone-2 polarized cardio (3x 45 min/wk) + resistance training (3x/wk).\n4. Maintain 3-hour evening caloric fast to preserve deep sleep architecture.`,
      full_markdown_payload: `# Executive Longevity & Biomarker Diagnostic Assessment\n**Patient:** ${profile.full_name} | **Date:** ${new Date().toISOString().split('T')[0]}\n\n[Diagnostic Summary Generated by AegisHealth Clinical AI & Doc]`
    };

    db.reports.unshift(report);

    return res.status(200).json({
      status: 'success',
      report: report
    });
  } catch (err) {
    console.error('Report generation error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// 5. Query Full Data Bundle for Frontend / Doc Agent Token Queries
app.get('/api/data/bundle', (req, res) => {
  const userId = req.query.userId || 'demo-user-alastair';
  return res.status(200).json({
    status: 'success',
    profile: db.profiles[userId],
    biomarkers: db.biomarkers.filter(b => b.user_id === userId),
    wearableMetrics: db.wearableMetrics.filter(w => w.user_id === userId),
    labDocuments: db.labDocuments.filter(d => d.user_id === userId),
    conditions: db.conditions.filter(c => c.user_id === userId),
    conditionTags: db.conditionTags,
    insights: db.insights.filter(i => i.user_id === userId),
    messages: db.docMessages,
    reports: db.reports.filter(r => r.user_id === userId)
  });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[AegisHealth] Server active on http://0.0.0.0:${PORT}`);
});
