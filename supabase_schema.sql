-- ==============================================================================
-- AEGISHEALTH - DATABASE SCHEMA & STORAGE SPECIFICATION (SUPABASE POSTGRESQL)
-- ==============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. USER PROFILES & ONBOARDING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    date_of_birth DATE,
    biological_sex TEXT CHECK (biological_sex IN ('male', 'female', 'other')),
    height_cm NUMERIC(5,2),
    weight_kg NUMERIC(5,2),
    blood_type TEXT,
    primary_health_goals TEXT[],
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. API TOKENS (For Apple Health Auto-Sync & Doc OpenClaw Agent Access)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Apple Watch Ultra 4 Sync", "Doc OpenClaw Agent"
    token_hash TEXT NOT NULL UNIQUE,
    token_preview TEXT NOT NULL, -- e.g. "aegis_...f93a"
    permissions TEXT[] DEFAULT ARRAY['read', 'write'], -- 'read_all', 'write_vitals', 'doc_consult'
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. LAB & CHECK-UP DOCUMENTS (Storage & AI Normalization Metadata)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lab_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_title TEXT NOT NULL,
    document_type TEXT NOT NULL, -- 'blood_panel', 'annual_checkup', 'retinal_oct', 'cardiac_echo', 'mri_scan', 'other'
    lab_provider TEXT, -- e.g. 'Quest Diagnostics', 'Labcorp', 'Montallegro Clinic', 'Mayo Clinic'
    test_date DATE NOT NULL,
    file_url TEXT NOT NULL, -- Supabase Storage URL / public path
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type TEXT,
    raw_extracted_text TEXT,
    parsing_status TEXT DEFAULT 'completed' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed')),
    ai_interpretation_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. BIOMARKER RECORDS (Normalized Lab Results, Hormones, Ophthalmology)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.biomarker_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.lab_documents(id) ON DELETE SET NULL,
    biomarker_code TEXT NOT NULL, -- e.g. 'APOB', 'TESTOSTERONE_TOTAL', 'TESTOSTERONE_FREE', 'MACULAR_THICKNESS_OD', 'MACULAR_THICKNESS_OS', 'HBA1C', 'HS_CRP'
    biomarker_name TEXT NOT NULL, -- e.g. 'Apolipoprotein B', 'Total Testosterone', 'Central Macular Subfield Thickness (OD)'
    category TEXT NOT NULL, -- 'lipids_cardio', 'hormones', 'ophthalmology', 'metabolic', 'inflammation', 'hematology', 'renal_hepatic', 'micronutrients'
    value NUMERIC NOT NULL,
    unit TEXT NOT NULL, -- 'mg/dL', 'ng/dL', 'pg/mL', 'µm', '%', 'mg/L'
    standard_range_low NUMERIC,
    standard_range_high NUMERIC,
    optimal_longevity_low NUMERIC,
    optimal_longevity_high NUMERIC,
    clinical_flag TEXT DEFAULT 'optimal' CHECK (clinical_flag IN ('optimal', 'normal', 'borderline', 'critical_low', 'critical_high')),
    test_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. WEARABLE VITALS & APPLE HEALTH METRICS (Apple Watch Ultra 4 Continuous Stream)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wearable_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL,
    metric_type TEXT NOT NULL, -- 'hrv_sdnn', 'resting_heart_rate', 'sleep_total_min', 'sleep_deep_min', 'sleep_rem_min', 'sleep_core_min', 'vo2_max', 'active_energy_kcal', 'exercise_min', 'wrist_temp_c', 'resp_rate', 'spo2'
    value NUMERIC NOT NULL,
    unit TEXT NOT NULL, -- 'ms', 'bpm', 'min', 'mL/kg/min', 'kcal', 'celsius', 'breaths/min', '%'
    device_source TEXT DEFAULT 'Apple Watch Ultra 4',
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. ACUTE & CHRONIC CONDITIONS & LIFECYCLE MANAGEMENT
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL, -- e.g. 'Dyslipidemia / Elevated ApoB', 'Left Eye Macular Edema', 'Acute Lumbar Radiculopathy'
    condition_type TEXT NOT NULL CHECK (condition_type IN ('acute', 'chronic')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'managing', 'resolved', 'in_remission')),
    severity TEXT DEFAULT 'moderate' CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
    diagnosis_date DATE NOT NULL,
    resolved_date DATE,
    icd10_code TEXT,
    clinical_summary TEXT,
    primary_treatment_plan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. CONDITION DATA TAGS (Many-to-Many Association of Labs, Biomarkers, Vitals)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.condition_data_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    condition_id UUID NOT NULL REFERENCES public.conditions(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('biomarker_record', 'lab_document', 'wearable_metric')),
    entity_id UUID NOT NULL,
    tagged_by TEXT DEFAULT 'doc_ai', -- 'doc_ai', 'user', 'physician'
    relevance_rationale TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. DOC AGENT CONSULTATIONS & CHAT THREADS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doc_consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    condition_id UUID REFERENCES public.conditions(id) ON DELETE SET NULL, -- NULL for General Health Overview
    title TEXT NOT NULL DEFAULT 'General Health Consultation',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.doc_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultation_id UUID NOT NULL REFERENCES public.doc_consultations(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'doc_agent', 'system')),
    content TEXT NOT NULL,
    citations JSONB, -- references to specific biomarker IDs, lab IDs, or wearable dates
    suggested_actions JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. AI INSIGHTS, PREDICTIONS & LIFESTYLE PROTOCOLS (Logged by Doc)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinical_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    condition_id UUID REFERENCES public.conditions(id) ON DELETE SET NULL,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('prediction', 'biomarker_trend', 'test_recommendation', 'lifestyle_protocol', 'risk_alert')),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    evidence_biomarkers TEXT[],
    confidence_score NUMERIC(3,2) DEFAULT 0.95,
    urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('routine', 'medium', 'high', 'immediate_action')),
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. DIAGNOSTIC EXECUTIVE REPORTS (Printable & Exportable Summaries)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diagnostic_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    condition_id UUID REFERENCES public.conditions(id) ON DELETE SET NULL,
    report_title TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'comprehensive_annual' CHECK (scope IN ('comprehensive_annual', 'acute_condition', 'chronic_condition', 'longevity_biomarkers')),
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    executive_summary TEXT NOT NULL,
    biomarker_analysis TEXT NOT NULL,
    wearable_correlations TEXT,
    risk_stratification TEXT,
    recommendations TEXT NOT NULL,
    full_markdown_payload TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- INDEXES FOR HIGH-PERFORMANCE TIME-SERIES & TREND QUERYING
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_biomarker_user_code_date ON public.biomarker_records(user_id, biomarker_code, test_date DESC);
CREATE INDEX IF NOT EXISTS idx_wearable_user_type_date ON public.wearable_metrics(user_id, metric_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_condition_tags_cond ON public.condition_data_tags(condition_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_doc_messages_consult ON public.doc_messages(consultation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON public.api_tokens(token_hash);

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biomarker_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condition_data_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_reports ENABLE ROW LEVEL SECURITY;

-- Base RLS Policy per table: Users access their own data
CREATE POLICY "Users can access own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can access own api_tokens" ON public.api_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own lab_documents" ON public.lab_documents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own biomarker_records" ON public.biomarker_records FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own wearable_metrics" ON public.wearable_metrics FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own conditions" ON public.conditions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own condition_data_tags" ON public.condition_data_tags FOR ALL USING (
    condition_id IN (SELECT id FROM public.conditions WHERE user_id = auth.uid())
);
CREATE POLICY "Users can access own doc_consultations" ON public.doc_consultations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own doc_messages" ON public.doc_messages FOR ALL USING (
    consultation_id IN (SELECT id FROM public.doc_consultations WHERE user_id = auth.uid())
);
CREATE POLICY "Users can access own clinical_insights" ON public.clinical_insights FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own diagnostic_reports" ON public.diagnostic_reports FOR ALL USING (auth.uid() = user_id);
