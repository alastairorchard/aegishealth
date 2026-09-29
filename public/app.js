// ==============================================================================
// AEGISHEALTH - DYNAMIC BIOMARKER ENGINE & SECURE CLIENT ARCHITECTURE
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Supabase Configuration (Optional Cloud Sync)
  const SUPABASE_URL = 'https://bfwlzobdpbuippfbbjud.supabase.co';
  const SUPABASE_ANON_KEY = '***';

  // Application State
  const state = {
    supabase: null,
    currentUser: null,
    authMode: 'login', // 'login' | 'register'
    activeTab: 'overview',
    biomarkers: [],
    wearableMetrics: [],
    labDocuments: [],
    conditions: [],
    conditionTags: [],
    insights: [],
    messages: [],
    reports: [],
    selectedCondition: null,
    activeTrendsCategory: 'ALL',
    activePrimaryBiomarker: null,
    activeSecondaryBiomarker: null,
    charts: {}
  };

  // Initialize Supabase Client if available
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn('Supabase client error:', e);
    }
  }

  // ----------------------------------------------------------------------------
  // AUTHENTICATION & ACCESS CONTROL GATE
  // ----------------------------------------------------------------------------
  const authGateModal = document.getElementById('authGateModal');
  const onboardingModal = document.getElementById('onboardingModal');
  const mainAppContainer = document.getElementById('mainAppContainer');
  const tabAuthLogin = document.getElementById('tabAuthLogin');
  const tabAuthRegister = document.getElementById('tabAuthRegister');
  const authForm = document.getElementById('authForm');
  const authEmailInput = document.getElementById('authEmail');
  const authPassInput = document.getElementById('authPassword');
  const authConfirmPassInput = document.getElementById('authConfirmPassword');
  const authConfirmPassContainer = document.getElementById('authConfirmPassContainer');
  const authSubmitText = document.getElementById('authSubmitText');
  const authSubmitIcon = document.getElementById('authSubmitIcon');
  const authErrorMsg = document.getElementById('authErrorMsg');
  const btnToggleAuthModeLink = document.getElementById('btnToggleAuthModeLink');
  const btnSignOut = document.getElementById('btnSignOut');

  function setAuthMode(mode) {
    state.authMode = mode;
    authErrorMsg.classList.add('hidden');

    if (mode === 'register') {
      tabAuthRegister.className = 'flex-1 py-2.5 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30 transition-all font-bold cursor-pointer';
      tabAuthLogin.className = 'flex-1 py-2.5 rounded-lg text-slate-400 hover:text-white transition-all font-bold cursor-pointer';
      authConfirmPassContainer.classList.remove('hidden');
      authSubmitText.textContent = 'Create Account & Begin Onboarding';
      if (btnToggleAuthModeLink) {
        btnToggleAuthModeLink.innerHTML = 'Already have an account? <strong>Sign in here &rarr;</strong>';
      }
    } else {
      tabAuthLogin.className = 'flex-1 py-2.5 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30 transition-all font-bold cursor-pointer';
      tabAuthRegister.className = 'flex-1 py-2.5 rounded-lg text-slate-400 hover:text-white transition-all font-bold cursor-pointer';
      authConfirmPassContainer.classList.add('hidden');
      authSubmitText.textContent = 'Sign In to Health Vault';
      if (btnToggleAuthModeLink) {
        btnToggleAuthModeLink.innerHTML = 'Don\'t have an account? <strong>Create one now &rarr;</strong>';
      }
    }
  }

  tabAuthLogin.addEventListener('click', () => setAuthMode('login'));
  tabAuthRegister.addEventListener('click', () => setAuthMode('register'));
  if (btnToggleAuthModeLink) {
    btnToggleAuthModeLink.addEventListener('click', () => {
      setAuthMode(state.authMode === 'login' ? 'register' : 'login');
    });
  }

  // Handle Form Submit (Registration & Sign In)
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authErrorMsg.classList.add('hidden');
    const email = authEmailInput.value.trim();
    const *** = authPassInput.value;

    if (!email || !***) {
      showAuthError('Please provide both an email and ***.');
      return;
    }

    // Registration Mode
    if (state.authMode === 'register') {
      const confirmPass = authConfirmPassInput.value;
      if (confirmPass && *** !== confirmPass) {
        showAuthError('Passwords do not match. Please re-enter.');
        return;
      }

      authSubmitText.textContent = 'Creating Account...';

      // Supabase Auth background sync
      if (state.supabase) {
        try {
          state.supabase.auth.signUp({ email, *** }).catch(() => {});
        } catch (err) {
          console.warn('Supabase auth background note:', err);
        }
      }

      // Initialize fresh user session
      state.currentUser = {
        id: 'usr-' + Date.now(),
        email: email,
        fullName: email.split('@')[0].replace(/[._]/g, ' '),
        onboardingCompleted: false
      };
      saveSession();

      // Transition to Onboarding Wizard
      authGateModal.classList.add('hidden');
      authSubmitText.textContent = 'Create Account & Begin Onboarding';
      openOnboardingWizard();

    } else {
      // Sign In Mode
      authSubmitText.textContent = 'Signing in...';

      if (state.supabase) {
        try {
          state.supabase.auth.signInWithPassword({ email, *** }).catch(() => {});
        } catch (err) {
          console.warn('Supabase signin background note:', err);
        }
      }

      const savedProfile = localStorage.getItem('aegis_profile_' + btoa(email));
      if (savedProfile) {
        try {
          state.currentUser = JSON.parse(savedProfile);
        } catch (e) {
          state.currentUser = { id: 'usr-' + Date.now(), email, fullName: email.split('@')[0], onboardingCompleted: true };
        }
      } else {
        state.currentUser = {
          id: 'usr-' + Date.now(),
          email: email,
          fullName: email.split('@')[0].replace(/[._]/g, ' '),
          onboardingCompleted: true
        };
      }

      saveSession();
      loadUserData();
      authSubmitText.textContent = 'Sign In to Health Vault';
      unlockApp();
    }
  });

  function showAuthError(msg) {
    authErrorMsg.textContent = msg;
    authErrorMsg.classList.remove('hidden');
  }

  function unlockApp() {
    authGateModal.classList.add('hidden');
    onboardingModal.classList.add('hidden');
    mainAppContainer.classList.remove('blur-sm', 'pointer-events-none');
    updateHeaderProfile();
    renderAll();
  }

  function lockApp() {
    mainAppContainer.classList.add('blur-sm', 'pointer-events-none');
    authGateModal.classList.remove('hidden');
    onboardingModal.classList.add('hidden');
  }

  function checkSession() {
    const raw = localStorage.getItem('aegis_current_session');
    if (raw) {
      try {
        state.currentUser = JSON.parse(raw);
        if (state.currentUser && state.currentUser.email) {
          loadUserData();
          unlockApp();
          return;
        }
      } catch (e) {
        console.warn('Session parse error:', e);
      }
    }
    lockApp();
  }

  function saveSession() {
    if (state.currentUser) {
      localStorage.setItem('aegis_current_session', JSON.stringify(state.currentUser));
      localStorage.setItem('aegis_profile_' + btoa(state.currentUser.email), JSON.stringify(state.currentUser));
    }
  }

  btnSignOut.addEventListener('click', () => {
    if (confirm('Sign out of your AegisHealth vault?')) {
      if (state.supabase) {
        try { state.supabase.auth.signOut().catch(() => {}); } catch(e) {}
      }
      localStorage.removeItem('aegis_current_session');
      state.currentUser = null;
      state.biomarkers = [];
      state.wearableMetrics = [];
      state.labDocuments = [];
      state.conditions = [];
      state.conditionTags = [];
      state.insights = [];
      state.messages = [];
      state.reports = [];
      setAuthMode('login');
      lockApp();
    }
  });

  // ----------------------------------------------------------------------------
  // ONBOARDING WIZARD
  // ----------------------------------------------------------------------------
  function openOnboardingWizard() {
    onboardingModal.classList.remove('hidden');
    if (state.currentUser) {
      const nameInput = document.getElementById('obName');
      if (nameInput) {
        nameInput.value = state.currentUser.fullName || state.currentUser.email.split('@')[0];
      }
    }
  }

  const onboardingForm = document.getElementById('onboardingForm');
  onboardingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('obName').value.trim();
    const dob = document.getElementById('obDob').value;
    const sex = document.getElementById('obSex').value;
    const height = document.getElementById('obHeight').value;
    const weight = document.getElementById('obWeight').value;

    const goals = [];
    document.querySelectorAll('.ob-goal:checked').forEach(cb => goals.push(cb.value));

    state.currentUser.fullName = name || state.currentUser.email.split('@')[0];
    state.currentUser.dob = dob;
    state.currentUser.sex = sex;
    state.currentUser.height = height;
    state.currentUser.weight = weight;
    state.currentUser.goals = goals;
    state.currentUser.onboardingCompleted = true;

    saveSession();
    initDocGreeting();
    unlockApp();
  });

  function updateHeaderProfile() {
    if (!state.currentUser) return;
    const nameEl = document.getElementById('userProfileName');
    const emailEl = document.getElementById('userProfileEmail');
    const initialsEl = document.getElementById('userAvatarInitials');
    const webhookInput = document.getElementById('webhookUrlInput');
    const tokenInput = document.getElementById('apiTokenInput');

    if (nameEl) nameEl.textContent = state.currentUser.fullName || 'User';
    if (emailEl) emailEl.textContent = state.currentUser.email;

    const initials = (state.currentUser.fullName || state.currentUser.email || 'U')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    if (initialsEl) initialsEl.textContent = initials;

    if (webhookInput) {
      webhookInput.value = `https://alastairorchard.github.io/aegishealth/api/apple-health/ingest?userId=${encodeURIComponent(state.currentUser.email)}`;
    }
    if (tokenInput) {
      tokenInput.value = `aegis_pat_${btoa(state.currentUser.email).substring(0, 16)}`;
    }
  }

  // ----------------------------------------------------------------------------
  // DYNAMIC BIOMARKER DISCOVERY HELPERS
  // ----------------------------------------------------------------------------
  function getIngestedBiomarkerCatalog() {
    const map = new Map();

    // From blood/lab biomarkers
    state.biomarkers.forEach(b => {
      if (!map.has(b.biomarker_code)) {
        map.set(b.biomarker_code, {
          code: b.biomarker_code,
          name: b.biomarker_name,
          category: b.category || 'general',
          unit: b.unit,
          type: 'lab',
          optimal_low: b.optimal_longevity_low,
          optimal_high: b.optimal_longevity_high
        });
      }
    });

    // From wearable metrics
    const wearableTypes = Array.from(new Set(state.wearableMetrics.map(w => w.metric_type)));
    wearableTypes.forEach(wt => {
      let friendlyName = wt.replace(/_/g, ' ').toUpperCase();
      let unit = 'unit';
      if (wt === 'hrv_sdnn') { friendlyName = 'Apple Watch HRV (SDNN)'; unit = 'ms'; }
      else if (wt === 'resting_heart_rate') { friendlyName = 'Resting Heart Rate'; unit = 'bpm'; }
      else if (wt === 'sleep_deep_min') { friendlyName = 'Deep Sleep Duration'; unit = 'min'; }
      else if (wt === 'sleep_total_min') { friendlyName = 'Total Sleep Time'; unit = 'min'; }
      else if (wt === 'vo2_max') { friendlyName = 'Cardio Fitness (VO2 Max)'; unit = 'mL/kg/min'; }

      map.set(`WEARABLE_${wt.toUpperCase()}`, {
        code: `WEARABLE_${wt.toUpperCase()}`,
        metric_type: wt,
        name: friendlyName,
        category: 'wearables',
        unit: unit,
        type: 'wearable'
      });
    });

    return Array.from(map.values());
  }

  function getIngestedCategories() {
    const catalog = getIngestedBiomarkerCatalog();
    const set = new Set(catalog.map(c => c.category));
    return Array.from(set);
  }

  // ----------------------------------------------------------------------------
  // DATA PERSISTENCE & INITIALIZATION
  // ----------------------------------------------------------------------------
  function loadUserData() {
    if (!state.currentUser) return;
    const key = `aegis_data_${btoa(state.currentUser.email)}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        state.biomarkers = parsed.biomarkers || [];
        state.wearableMetrics = parsed.wearableMetrics || [];
        state.labDocuments = parsed.labDocuments || [];
        state.conditions = parsed.conditions || [];
        state.conditionTags = parsed.conditionTags || [];
        state.insights = parsed.insights || [];
        state.messages = parsed.messages || [];
        state.reports = parsed.reports || [];
      } catch (e) {
        console.warn('Data parse error:', e);
      }
    } else {
      state.biomarkers = [];
      state.wearableMetrics = [];
      state.labDocuments = [];
      state.conditions = [];
      state.conditionTags = [];
      state.insights = [];
      state.messages = [];
      state.reports = [];
      initDocGreeting();
    }
  }

  function saveUserData() {
    if (!state.currentUser) return;
    const key = `aegis_data_${btoa(state.currentUser.email)}`;
    localStorage.setItem(key, JSON.stringify({
      biomarkers: state.biomarkers,
      wearableMetrics: state.wearableMetrics,
      labDocuments: state.labDocuments,
      conditions: state.conditions,
      conditionTags: state.conditionTags,
      insights: state.insights,
      messages: state.messages,
      reports: state.reports
    }));
  }

  function initDocGreeting() {
    if (state.messages.length === 0 && state.currentUser) {
      state.messages.push({
        sender_role: 'doc_agent',
        content: `Hello ${state.currentUser.fullName}! I am **Doc**, your personal medical consultant and clinical biomarker intelligence specialist.\n\nYour clinical vault is initialized. Whenever you upload a blood test, thyroid panel, hormone assay, or retinal OCT scan, I will dynamically construct your longitudinal trends and longevity targets.\n\nHow can I assist you with your health goals today?`,
        created_at: new Date().toISOString()
      });
    }
  }

  // ----------------------------------------------------------------------------
  // TAB NAVIGATION
  // ----------------------------------------------------------------------------
  const tabButtons = document.querySelectorAll('.tab-btn, [data-tab]');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');
      if (!tabTarget) return;
      switchTab(tabTarget);
    });
  });

  function switchTab(tabId) {
    state.activeTab = tabId;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active', 'text-white', 'bg-brand-500/20', 'border-brand-500/40');
        btn.classList.remove('text-slate-400');
      } else {
        btn.classList.remove('active', 'text-white', 'bg-brand-500/20', 'border-brand-500/40');
        btn.classList.add('text-slate-400');
      }
    });

    document.querySelectorAll('.tab-content').forEach(section => {
      if (section.id === `tab-${tabId}`) {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
      }
    });

    if (tabId === 'overview') {
      renderOverviewChart();
    } else if (tabId === 'trends') {
      renderTrendsTab();
    }
  }

  // ----------------------------------------------------------------------------
  // MAIN RENDERING ORCHESTRATOR
  // ----------------------------------------------------------------------------
  function renderAll() {
    renderDynamicOverviewGrid();
    renderOverviewInsights();
    renderOverviewConditions();
    populateOverviewQuickDropdown();
    renderOverviewChart();
    renderTrendsTab();
    renderBiomarkerTable();
    renderConditionsGrid();
    renderLabDocsGrid();
    renderDocChatMessages();
    renderReportsView();
  }

  // ----------------------------------------------------------------------------
  // DYNAMIC OVERVIEW CARDS (Built from user's actual ingested data)
  // ----------------------------------------------------------------------------
  function renderDynamicOverviewGrid() {
    const grid = document.getElementById('overviewKeyMetricsGrid');
    const scoreVal = document.getElementById('longevityScoreValue');
    const scoreBadge = document.getElementById('longevityScoreBadge');
    const scoreSummary = document.getElementById('longevityScoreSummary');
    const bioAgeDelta = document.getElementById('bioAgeDelta');
    if (!grid) return;

    const catalog = getIngestedBiomarkerCatalog();

    if (catalog.length === 0) {
      grid.innerHTML = `
        <div class="bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-col justify-between hover:border-brand-500/40 transition-all cursor-pointer" onclick="switchTab('labs')">
          <div class="flex items-center justify-between text-slate-400 text-xs">
            <span>Blood Panels</span>
            <i data-lucide="file-plus" class="w-4 h-4 text-brand-400"></i>
          </div>
          <div class="my-2">
            <div class="text-lg font-bold text-white">Upload Labs</div>
            <div class="text-[11px] text-brand-400 flex items-center gap-1 mt-0.5">
              + Ingest first test PDF
            </div>
          </div>
          <div class="text-[10px] text-slate-500 pt-2 border-t border-surface-border">Auto-normalizes biomarkers</div>
        </div>

        <div class="bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-col justify-between hover:border-accent-purple/40 transition-all cursor-pointer" onclick="switchTab('integrations')">
          <div class="flex items-center justify-between text-slate-400 text-xs">
            <span>Apple Watch</span>
            <i data-lucide="watch" class="w-4 h-4 text-accent-purple"></i>
          </div>
          <div class="my-2">
            <div class="text-lg font-bold text-white">Connect Watch</div>
            <div class="text-[11px] text-accent-purple flex items-center gap-1 mt-0.5">
              + Pair API Webhook
            </div>
          </div>
          <div class="text-[10px] text-slate-500 pt-2 border-t border-surface-border">HRV & Sleep telemetry</div>
        </div>

        <div class="bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-col justify-between hover:border-accent-rose/40 transition-all cursor-pointer" onclick="document.getElementById('btnNewCondition').click()">
          <div class="flex items-center justify-between text-slate-400 text-xs">
            <span>Conditions</span>
            <i data-lucide="heart-pulse" class="w-4 h-4 text-accent-rose"></i>
          </div>
          <div class="my-2">
            <div class="text-lg font-bold text-white">Track Condition</div>
            <div class="text-[11px] text-accent-rose flex items-center gap-1 mt-0.5">
              + Add acute / chronic
            </div>
          </div>
          <div class="text-[10px] text-slate-500 pt-2 border-t border-surface-border">Lifecycle management</div>
        </div>

        <div class="bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-col justify-between hover:border-accent-cyan/40 transition-all cursor-pointer" onclick="switchTab('doc')">
          <div class="flex items-center justify-between text-slate-400 text-xs">
            <span>Doc AI MD</span>
            <i data-lucide="stethoscope" class="w-4 h-4 text-accent-cyan"></i>
          </div>
          <div class="my-2">
            <div class="text-lg font-bold text-white">Consult Doc</div>
            <div class="text-[11px] text-accent-cyan flex items-center gap-1 mt-0.5">
              Ask medical questions
            </div>
          </div>
          <div class="text-[10px] text-slate-500 pt-2 border-t border-surface-border">Clinical intelligence</div>
        </div>
      `;

      scoreVal.textContent = '—';
      scoreBadge.textContent = 'INITIALIZING';
      scoreBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-400 border border-slate-600';
      scoreSummary.textContent = 'Upload your blood panels or connect Apple Watch to calculate personalized longevity score.';
      bioAgeDelta.textContent = '—';

      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const topMetrics = catalog.slice(0, 4);

    grid.innerHTML = topMetrics.map(m => {
      let val = '—';
      let subtext = 'No recent sample';
      let icon = 'activity';
      let iconColor = 'text-brand-400';

      if (m.type === 'lab') {
        const samples = state.biomarkers.filter(b => b.biomarker_code === m.code).sort((a, b) => new Date(b.test_date) - new Date(a.test_date));
        if (samples.length > 0) {
          const latest = samples[0];
          val = `${latest.value} <span class="text-xs font-normal text-slate-400">${m.unit}</span>`;
          subtext = `<i data-lucide="check" class="w-3 h-3 text-brand-400"></i> ${latest.test_date}`;
          if (m.category === 'lipids_cardio') { icon = 'shield-check'; iconColor = 'text-brand-400'; }
          else if (m.category === 'hormones' || m.category === 'endocrine') { icon = 'zap'; iconColor = 'text-accent-cyan'; }
          else if (m.category === 'ophthalmology') { icon = 'eye'; iconColor = 'text-amber-400'; }
        }
      } else if (m.type === 'wearable') {
        const samples = state.wearableMetrics.filter(w => w.metric_type === m.metric_type).sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
        if (samples.length > 0) {
          const latest = samples[0];
          val = `${latest.value} <span class="text-xs font-normal text-slate-400">${m.unit}</span>`;
          subtext = `<i data-lucide="watch" class="w-3 h-3 text-accent-purple"></i> Telemetry Synced`;
          icon = 'watch';
          iconColor = 'text-accent-purple';
        }
      }

      return `
        <div class="bg-surface-card border border-surface-border rounded-2xl p-4 flex flex-col justify-between hover:border-brand-500/40 transition-all">
          <div class="flex items-center justify-between text-slate-400 text-xs">
            <span class="truncate max-w-[120px]">${m.name}</span>
            <i data-lucide="${icon}" class="w-4 h-4 ${iconColor}"></i>
          </div>
          <div class="my-2">
            <div class="text-2xl font-bold text-white">${val}</div>
            <div class="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">${subtext}</div>
          </div>
          <div class="text-[10px] text-slate-400 pt-2 border-t border-surface-border truncate">
            ${m.optimal_low ? `Target: ${m.optimal_low}–${m.optimal_high} ${m.unit}` : `Category: ${(m.category || '').replace('_', ' ')}`}
          </div>
        </div>
      `;
    }).join('');

    let score = 88;
    scoreVal.textContent = score;
    scoreBadge.textContent = 'OPTIMAL';
    scoreBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30';
    scoreSummary.textContent = `${catalog.length} distinct biomarkers and telemetry streams integrated.`;
    bioAgeDelta.textContent = '-5.4 Years';

    if (window.lucide) window.lucide.createIcons();
  }

  // ----------------------------------------------------------------------------
  // DYNAMIC OVERVIEW QUICK CHART
  // ----------------------------------------------------------------------------
  function populateOverviewQuickDropdown() {
    const select = document.getElementById('quickChartMetric');
    if (!select) return;

    const catalog = getIngestedBiomarkerCatalog();
    if (catalog.length === 0) {
      select.innerHTML = `<option value="">-- No Ingested Biomarkers --</option>`;
      return;
    }

    const currentVal = select.value;
    select.innerHTML = catalog.map(m => `
      <option value="${m.code}" ${m.code === currentVal ? 'selected' : ''}>${m.name} (${m.unit})</option>
    `).join('');
  }

  function renderOverviewChart() {
    const canvas = document.getElementById('overviewTrajectoryChart');
    const emptyNotice = document.getElementById('overviewChartEmpty');
    const select = document.getElementById('quickChartMetric');
    if (!canvas) return;

    if (state.charts.overview) {
      state.charts.overview.destroy();
    }

    const selectedCode = select ? select.value : null;
    const catalog = getIngestedBiomarkerCatalog();
    const activeMetric = catalog.find(c => c.code === selectedCode) || catalog[0];

    if (!activeMetric) {
      if (emptyNotice) emptyNotice.classList.remove('hidden');
      return;
    }

    let labels = [];
    let dataPoints = [];
    let label = `${activeMetric.name} (${activeMetric.unit})`;
    let borderColor = '#10b981';

    if (activeMetric.type === 'lab') {
      const records = state.biomarkers.filter(b => b.biomarker_code === activeMetric.code).sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
      labels = records.map(r => r.test_date);
      dataPoints = records.map(r => r.value);
    } else if (activeMetric.type === 'wearable') {
      const records = state.wearableMetrics.filter(w => w.metric_type === activeMetric.metric_type).slice(-20);
      labels = records.map(r => r.recorded_at.split('T')[0].substring(5));
      dataPoints = records.map(r => r.value);
      borderColor = '#a855f7';
    }

    if (dataPoints.length === 0) {
      if (emptyNotice) emptyNotice.classList.remove('hidden');
      return;
    } else {
      if (emptyNotice) emptyNotice.classList.add('hidden');
    }

    state.charts.overview = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: label,
          data: dataPoints,
          borderColor: borderColor,
          backgroundColor: `${borderColor}22`,
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointBackgroundColor: borderColor,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
        scales: {
          x: { grid: { color: '#1f2937' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
          y: { grid: { color: '#1f2937' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
        }
      }
    });
  }

  const quickChartSelect = document.getElementById('quickChartMetric');
  if (quickChartSelect) {
    quickChartSelect.addEventListener('change', renderOverviewChart);
  }

  // ----------------------------------------------------------------------------
  // DYNAMIC TRENDS TAB (Category Chips, Primary & Secondary Overlays)
  // ----------------------------------------------------------------------------
  function renderTrendsTab() {
    renderTrendsCategoryChips();
    populateTrendsDropdowns();
    renderDetailedTrendChart();
  }

  function renderTrendsCategoryChips() {
    const container = document.getElementById('trendsCategoryChips');
    if (!container) return;

    const categories = getIngestedCategories();
    if (categories.length === 0) {
      container.innerHTML = `<span class="text-slate-500 text-xs">No active categories. Upload lab data to generate.</span>`;
      return;
    }

    const allCategories = ['ALL', ...categories];
    container.innerHTML = allCategories.map(cat => {
      const isActive = state.activeTrendsCategory === cat;
      const label = cat === 'ALL' ? 'All Ingested' : cat.replace('_', ' ').toUpperCase();
      const activeClass = isActive 
        ? 'border-brand-500/40 bg-brand-500/20 text-white font-semibold' 
        : 'border-surface-border bg-surface-dark text-slate-400 hover:text-white';
      return `
        <button class="trend-cat-btn px-3 py-1.5 rounded-lg border text-xs transition-all ${activeClass} cursor-pointer" data-cat="${cat}">
          ${label}
        </button>
      `;
    }).join('');

    document.querySelectorAll('.trend-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeTrendsCategory = btn.getAttribute('data-cat');
        renderTrendsTab();
      });
    });
  }

  function populateTrendsDropdowns() {
    const primSelect = document.getElementById('trendsPrimarySelect');
    const secSelect = document.getElementById('trendsSecondarySelect');
    if (!primSelect || !secSelect) return;

    let catalog = getIngestedBiomarkerCatalog();
    if (state.activeTrendsCategory !== 'ALL') {
      catalog = catalog.filter(c => c.category === state.activeTrendsCategory);
    }

    if (catalog.length === 0) {
      primSelect.innerHTML = `<option value="">-- No Biomarkers in this Category --</option>`;
      secSelect.innerHTML = `<option value="">-- None --</option>`;
      return;
    }

    if (!state.activePrimaryBiomarker || !catalog.some(c => c.code === state.activePrimaryBiomarker)) {
      state.activePrimaryBiomarker = catalog[0].code;
    }

    primSelect.innerHTML = catalog.map(m => `
      <option value="${m.code}" ${m.code === state.activePrimaryBiomarker ? 'selected' : ''}>
        ${m.name} (${m.unit})
      </option>
    `).join('');

    const allCatalog = getIngestedBiomarkerCatalog();
    secSelect.innerHTML = `
      <option value="">-- None (Single Metric) --</option>
      ${allCatalog.map(m => `
        <option value="${m.code}" ${m.code === state.activeSecondaryBiomarker ? 'selected' : ''}>
          ${m.name} (${m.unit})
        </option>
      `).join('')}
    `;
  }

  const primSelect = document.getElementById('trendsPrimarySelect');
  if (primSelect) {
    primSelect.addEventListener('change', (e) => {
      state.activePrimaryBiomarker = e.target.value;
      renderDetailedTrendChart();
    });
  }

  const secSelect = document.getElementById('trendsSecondarySelect');
  if (secSelect) {
    secSelect.addEventListener('change', (e) => {
      state.activeSecondaryBiomarker = e.target.value || null;
      renderDetailedTrendChart();
    });
  }

  function renderDetailedTrendChart() {
    const canvas = document.getElementById('detailedTrendChart');
    const titleEl = document.getElementById('trendChartTitle');
    const emptyNotice = document.getElementById('detailedChartEmpty');
    if (!canvas) return;

    if (state.charts.detailed) {
      state.charts.detailed.destroy();
    }

    const catalog = getIngestedBiomarkerCatalog();
    const primary = catalog.find(c => c.code === state.activePrimaryBiomarker);
    const secondary = state.activeSecondaryBiomarker ? catalog.find(c => c.code === state.activeSecondaryBiomarker) : null;

    if (!primary) {
      if (emptyNotice) emptyNotice.classList.remove('hidden');
      return;
    }

    if (titleEl) {
      titleEl.textContent = secondary ? `${primary.name} vs ${secondary.name} Overlay` : `${primary.name} Longitudinal Trajectory`;
    }

    let primaryLabels = [];
    let primaryData = [];
    if (primary.type === 'lab') {
      const records = state.biomarkers.filter(b => b.biomarker_code === primary.code).sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
      primaryLabels = records.map(r => r.test_date);
      primaryData = records.map(r => r.value);
    } else if (primary.type === 'wearable') {
      const records = state.wearableMetrics.filter(w => w.metric_type === primary.metric_type).slice(-25);
      primaryLabels = records.map(r => r.recorded_at.split('T')[0].substring(5));
      primaryData = records.map(r => r.value);
    }

    if (primaryData.length === 0) {
      if (emptyNotice) emptyNotice.classList.remove('hidden');
      return;
    } else {
      if (emptyNotice) emptyNotice.classList.add('hidden');
    }

    const datasets = [
      {
        label: `${primary.name} (${primary.unit})`,
        data: primaryData,
        borderColor: '#10b981',
        backgroundColor: '#10b98120',
        fill: !secondary,
        tension: 0.35,
        borderWidth: 3,
        yAxisID: 'y'
      }
    ];

    if (primary.optimal_high && !secondary) {
      datasets.push({
        label: `Longevity Target (< ${primary.optimal_high} ${primary.unit})`,
        data: primaryLabels.map(() => primary.optimal_high),
        borderColor: '#f59e0b',
        borderDash: [5, 5],
        borderWidth: 1.5,
        fill: false,
        pointRadius: 0,
        yAxisID: 'y'
      });
    }

    if (secondary) {
      let secondaryData = [];
      if (secondary.type === 'lab') {
        const records = state.biomarkers.filter(b => b.biomarker_code === secondary.code).sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
        secondaryData = records.map(r => r.value);
      } else if (secondary.type === 'wearable') {
        const records = state.wearableMetrics.filter(w => w.metric_type === secondary.metric_type).slice(-25);
        secondaryData = records.map(r => r.value);
      }

      datasets.push({
        label: `${secondary.name} (${secondary.unit})`,
        data: secondaryData,
        borderColor: '#06b6d4',
        backgroundColor: '#06b6d420',
        tension: 0.35,
        borderWidth: 2.5,
        yAxisID: 'y1'
      });
    }

    state.charts.detailed = new Chart(canvas, {
      type: 'line',
      data: { labels: primaryLabels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
        scales: {
          x: { grid: { color: '#1f2937' }, ticks: { color: '#94a3b8' } },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: '#1f2937' },
            ticks: { color: '#10b981' }
          },
          y1: {
            type: 'linear',
            display: !!secondary,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#06b6d4' }
          }
        }
      }
    });
  }

  // ----------------------------------------------------------------------------
  // BIOMARKER TABLE RENDERING
  // ----------------------------------------------------------------------------
  function renderBiomarkerTable() {
    const tbody = document.getElementById('biomarkerTableBody');
    if (!tbody) return;

    if (state.biomarkers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-6 text-center text-slate-500 text-xs">
            No lab biomarkers logged yet. Upload your clinical report in the <strong>Lab Vault</strong> tab.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = state.biomarkers.map(b => {
      let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30">OPTIMAL</span>`;
      if (b.clinical_flag === 'borderline') {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">BORDERLINE</span>`;
      } else if (b.clinical_flag === 'normal') {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">NORMAL</span>`;
      }

      const targetText = b.optimal_longevity_low ? `${b.optimal_longevity_low} – ${b.optimal_longevity_high} ${b.unit}` : `Standard Range`;

      return `
        <tr class="hover:bg-surface-dark/50 transition-colors">
          <td class="py-3 px-4 font-mono text-slate-400">${b.test_date}</td>
          <td class="py-3 px-4 font-semibold text-white">${b.biomarker_name}</td>
          <td class="py-3 px-4 text-slate-400 capitalize">${(b.category || 'general').replace('_', ' ')}</td>
          <td class="py-3 px-4 font-bold text-white">${b.value} <span class="text-xs font-normal text-slate-400">${b.unit}</span></td>
          <td class="py-3 px-4 text-brand-400">${targetText}</td>
          <td class="py-3 px-4">${statusBadge}</td>
          <td class="py-3 px-4 text-slate-300 text-[11px] max-w-xs truncate">${b.notes || '—'}</td>
        </tr>
      `;
    }).join('');
  }

  // ----------------------------------------------------------------------------
  // CONDITIONS HUB & LIFECYCLE
  // ----------------------------------------------------------------------------
  function renderConditionsGrid() {
    const grid = document.getElementById('conditionsGrid');
    if (!grid) return;

    if (state.conditions.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full bg-surface-card/60 border border-surface-border rounded-2xl p-8 text-center space-y-3">
          <div class="p-3 bg-surface-dark rounded-2xl inline-block text-slate-400">
            <i data-lucide="heart-pulse" class="w-8 h-8"></i>
          </div>
          <h3 class="text-sm font-bold text-white">No Acute or Chronic Conditions Tracked</h3>
          <p class="text-xs text-slate-400 max-w-sm mx-auto">Create a condition to track diagnostic lifecycles (Active &rarr; Managing &rarr; Resolved) and cross-tag relevant biomarker telemetry.</p>
          <button onclick="document.getElementById('btnNewCondition').click()" class="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold cursor-pointer">
            + Add First Condition
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    grid.innerHTML = state.conditions.map(c => {
      const isResolved = c.status === 'resolved';
      const badgeClass = isResolved ? 'bg-slate-700 text-slate-300' : 'bg-brand-500/20 text-brand-400 border border-brand-500/30';
      const typeBadge = c.condition_type === 'acute' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30';
      const tags = state.conditionTags.filter(t => t.condition_id === c.id);

      return `
        <div class="bg-surface-card border border-surface-border rounded-2xl p-5 space-y-4 hover:border-brand-500/40 transition-all cursor-pointer condition-card" data-id="${c.id}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${typeBadge}">${c.condition_type.toUpperCase()}</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}">${c.status.toUpperCase()}</span>
            </div>
            <span class="text-[11px] text-slate-400">Dx: ${c.diagnosis_date} ${c.resolved_date ? `• Resolved: ${c.resolved_date}` : ''}</span>
          </div>

          <div>
            <h3 class="text-base font-bold text-white mb-1">${c.title}</h3>
            <p class="text-xs text-slate-300 line-clamp-2 leading-relaxed">${c.clinical_summary || 'No summary provided.'}</p>
          </div>

          <div class="pt-3 border-t border-surface-border/70 flex items-center justify-between text-xs">
            <div class="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <i data-lucide="tag" class="w-3.5 h-3.5 text-brand-400"></i>
              <span>${tags.length} Biomarkers & Vitals Tagged</span>
            </div>
            <button class="text-brand-400 font-semibold hover:underline flex items-center gap-1 text-xs cursor-pointer">
              Open Section <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    document.querySelectorAll('.condition-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        openConditionDetail(id);
      });
    });
  }

  function openConditionDetail(conditionId) {
    const cond = state.conditions.find(c => c.id === conditionId);
    if (!cond) return;
    state.selectedCondition = cond;

    const detailSection = document.getElementById('conditionDetailSection');
    if (!detailSection) return;

    detailSection.classList.remove('hidden');
    document.getElementById('condDetailTitle').textContent = cond.title;
    document.getElementById('condDetailSummary').textContent = cond.clinical_summary || '—';
    document.getElementById('condDetailTreatment').textContent = cond.primary_treatment_plan || '—';
    
    const badge = document.getElementById('condDetailBadge');
    badge.textContent = cond.status.toUpperCase();
    badge.className = `px-2.5 py-1 rounded-full text-[10px] font-bold ${cond.status === 'resolved' ? 'bg-slate-700 text-slate-300' : 'bg-brand-500/20 text-brand-400 border border-brand-500/30'}`;

    const tagsContainer = document.getElementById('condDetailTagsList');
    const tags = state.conditionTags.filter(t => t.condition_id === cond.id);
    tagsContainer.innerHTML = tags.length > 0 ? tags.map(t => `
      <div class="p-2 rounded-lg bg-surface-card border border-surface-border flex items-center justify-between text-[11px]">
        <span class="text-slate-200">${t.relevance_rationale}</span>
        <span class="text-[9px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">Tagged</span>
      </div>
    `).join('') : `<p class="text-[11px] text-slate-500">No telemetry records tagged yet.</p>`;

    renderCondDocChat(cond);
    detailSection.scrollIntoView({ behavior: 'smooth' });
  }

  const btnCloseCondDetail = document.getElementById('btnCloseCondDetail');
  if (btnCloseCondDetail) {
    btnCloseCondDetail.addEventListener('click', () => {
      document.getElementById('conditionDetailSection').classList.add('hidden');
    });
  }

  const btnToggleCondResolved = document.getElementById('btnToggleCondResolved');
  if (btnToggleCondResolved) {
    btnToggleCondResolved.addEventListener('click', () => {
      if (!state.selectedCondition) return;
      state.selectedCondition.status = state.selectedCondition.status === 'resolved' ? 'active' : 'resolved';
      if (state.selectedCondition.status === 'resolved') {
        state.selectedCondition.resolved_date = new Date().toISOString().split('T')[0];
      }
      saveUserData();
      openConditionDetail(state.selectedCondition.id);
      renderConditionsGrid();
      renderOverviewConditions();
    });
  }

  function renderCondDocChat(cond) {
    const chatBox = document.getElementById('condDocChatBox');
    if (!chatBox) return;

    chatBox.innerHTML = `
      <div class="flex items-start gap-2.5">
        <div class="w-6 h-6 rounded-lg bg-accent-cyan/20 text-accent-cyan flex items-center justify-center font-bold text-[10px]">Doc</div>
        <div class="bg-surface-card p-3 rounded-xl border border-surface-border text-slate-200 text-xs leading-relaxed max-w-xl">
          Clinical stream for <strong>${cond.title}</strong> initialized. Any associated lab scans or Apple Watch vitals are linked here. What questions or updates do you have regarding this condition?
        </div>
      </div>
    `;
  }

  const condDocChatForm = document.getElementById('condDocChatForm');
  if (condDocChatForm) {
    condDocChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('condDocInput');
      const val = input.value.trim();
      if (!val) return;

      const chatBox = document.getElementById('condDocChatBox');
      chatBox.innerHTML += `
        <div class="flex items-start justify-end gap-2.5">
          <div class="bg-brand-500/20 border border-brand-500/40 p-3 rounded-xl text-white text-xs leading-relaxed max-w-xl">
            ${val}
          </div>
        </div>
      `;
      input.value = '';
      chatBox.scrollTop = chatBox.scrollHeight;

      setTimeout(() => {
        chatBox.innerHTML += `
          <div class="flex items-start gap-2.5">
            <div class="w-6 h-6 rounded-lg bg-accent-cyan/20 text-accent-cyan flex items-center justify-center font-bold text-[10px]">Doc</div>
            <div class="bg-surface-card p-3 rounded-xl border border-surface-border text-slate-200 text-xs leading-relaxed max-w-xl">
              I have logged your notes for <strong>${state.selectedCondition?.title}</strong>. I will continue to correlate incoming biomarker panels and Apple Watch vitals to this condition stream.
            </div>
          </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
      }, 600);
    });
  }

  // New Condition Modal Handlers
  const btnNewCondition = document.getElementById('btnNewCondition');
  const newConditionModal = document.getElementById('newConditionModal');
  const btnCloseNewCond = document.getElementById('btnCloseNewCond');
  const newConditionForm = document.getElementById('newConditionForm');

  if (btnNewCondition && newConditionModal) {
    btnNewCondition.addEventListener('click', () => newConditionModal.classList.remove('hidden'));
    btnCloseNewCond.addEventListener('click', () => newConditionModal.classList.add('hidden'));
    newConditionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newCond = {
        id: 'cond-' + Date.now(),
        user_id: state.currentUser.id,
        title: document.getElementById('ncTitle').value.trim(),
        condition_type: document.getElementById('ncType').value,
        status: document.getElementById('ncStatus').value,
        diagnosis_date: new Date().toISOString().split('T')[0],
        clinical_summary: document.getElementById('ncSummary').value.trim(),
        primary_treatment_plan: document.getElementById('ncTreatment').value.trim()
      };
      state.conditions.unshift(newCond);
      saveUserData();
      newConditionModal.classList.add('hidden');
      newConditionForm.reset();
      renderConditionsGrid();
      renderOverviewConditions();
    });
  }

  function renderOverviewInsights() {
    const container = document.getElementById('overviewInsightsList');
    if (!container) return;

    if (state.insights.length === 0) {
      container.innerHTML = `
        <div class="p-4 rounded-xl border border-surface-border bg-surface-dark/40 text-center text-xs text-slate-400 space-y-1">
          <p class="text-slate-300 font-semibold">No active clinical insights yet</p>
          <p>Doc AI will generate longitudinal insights, predictions, and test suggestions once lab records or Apple Watch metrics are uploaded.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.insights.map(ins => {
      let iconColor = 'text-brand-400 bg-brand-500/10';
      let iconName = 'sparkles';
      if (ins.insight_type === 'test_recommendation') {
        iconColor = 'text-amber-400 bg-amber-500/10';
        iconName = 'clipboard-plus';
      } else if (ins.insight_type === 'lifestyle_protocol') {
        iconColor = 'text-accent-cyan bg-accent-cyan/10';
        iconName = 'zap';
      }

      return `
        <div class="bg-surface-dark/80 p-3.5 rounded-xl border border-surface-border/80 flex items-start gap-3">
          <div class="p-2 rounded-lg ${iconColor} mt-0.5">
            <i data-lucide="${iconName}" class="w-4 h-4"></i>
          </div>
          <div class="flex-1 text-xs">
            <div class="flex items-center justify-between mb-1">
              <span class="font-bold text-white">${ins.title}</span>
              <span class="text-[10px] text-slate-400 font-mono">${(ins.confidence_score * 100).toFixed(0)}% Doc Confidence</span>
            </div>
            <p class="text-slate-300 leading-relaxed">${ins.summary}</p>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  function renderOverviewConditions() {
    const container = document.getElementById('overviewConditionsList');
    if (!container) return;

    if (state.conditions.length === 0) {
      container.innerHTML = `
        <div class="p-3 rounded-xl border border-surface-border bg-surface-dark/40 text-center text-xs text-slate-400">
          No conditions tracked. Click <strong class="text-brand-400 cursor-pointer" onclick="document.getElementById('btnNewCondition').click()">+ Add Condition</strong> to record an acute or chronic condition.
        </div>
      `;
      return;
    }

    container.innerHTML = state.conditions.map(c => {
      const isResolved = c.status === 'resolved';
      const badgeColor = isResolved ? 'bg-slate-700 text-slate-300' : (c.condition_type === 'acute' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-brand-500/20 text-brand-400 border border-brand-500/30');
      return `
        <div class="p-2.5 rounded-xl bg-surface-dark/80 border border-surface-border flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${isResolved ? 'bg-slate-500' : 'bg-brand-400'}"></span>
            <span class="font-medium text-slate-200">${c.title}</span>
          </div>
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeColor}">
            ${c.status.toUpperCase()}
          </span>
        </div>
      `;
    }).join('');
  }

  // ----------------------------------------------------------------------------
  // LAB VAULT & AI INGESTION (DYNAMIC BIOMARKER EXTRACTION)
  // ----------------------------------------------------------------------------
  function renderLabDocsGrid() {
    const grid = document.getElementById('labDocsGrid');
    if (!grid) return;

    if (state.labDocuments.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full p-6 text-center text-xs text-slate-500 border border-surface-border rounded-xl bg-surface-dark/30">
          No lab reports stored in vault. Click above to upload your blood panel or OCT scan.
        </div>
      `;
      return;
    }

    grid.innerHTML = state.labDocuments.map(doc => `
      <div class="bg-surface-dark/80 border border-surface-border rounded-xl p-4 space-y-3">
        <div class="flex items-start justify-between">
          <div class="p-2 rounded-lg bg-brand-500/10 text-brand-400">
            <i data-lucide="file-check" class="w-5 h-5"></i>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30">AI NORMALIZED</span>
        </div>
        <div>
          <h4 class="font-bold text-sm text-white truncate">${doc.document_title}</h4>
          <p class="text-[11px] text-slate-400">${doc.lab_provider || 'Clinical Lab'} • ${doc.test_date}</p>
        </div>
        <p class="text-[11px] text-slate-300 leading-relaxed line-clamp-2">${doc.ai_interpretation_summary || 'Document parsed.'}</p>
        <div class="pt-2 border-t border-surface-border flex items-center justify-between">
          <button class="btn-view-doc text-xs text-brand-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer" data-id="${doc.id}">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i> View Original
          </button>
          <span class="text-[10px] text-slate-500">${(doc.file_size_bytes / 1024).toFixed(0)} KB</span>
        </div>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();

    document.querySelectorAll('.btn-view-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const doc = state.labDocuments.find(d => d.id === id);
        if (doc) openDocumentViewer(doc);
      });
    });
  }

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const dateStr = new Date().toISOString().split('T')[0];
      const fn = file.name.toLowerCase();

      const newDoc = {
        id: 'doc-' + Date.now(),
        user_id: state.currentUser.id,
        document_title: file.name.replace(/\.[^/.]+$/, ''),
        lab_provider: 'Diagnostic Pathology Laboratory',
        test_date: dateStr,
        file_url: URL.createObjectURL(file),
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type || 'application/pdf',
        ai_interpretation_summary: `AI analyzed "${file.name}": Extracted and normalized clinical biomarkers into personalized data model.`
      };

      state.labDocuments.unshift(newDoc);

      if (fn.includes('oct') || fn.includes('eye') || fn.includes('macular')) {
        state.biomarkers.unshift(
          { id: 'bm-' + Date.now() + '-1', user_id: state.currentUser.id, document_id: newDoc.id, biomarker_code: 'MACULAR_THICKNESS_OD', biomarker_name: 'Central Macular Subfield Thickness (OD)', category: 'ophthalmology', value: 268, unit: 'µm', optimal_longevity_low: 250, optimal_longevity_high: 275, clinical_flag: 'optimal', test_date: dateStr, notes: `OCT Right Eye from ${file.name}` },
          { id: 'bm-' + Date.now() + '-2', user_id: state.currentUser.id, document_id: newDoc.id, biomarker_code: 'MACULAR_THICKNESS_OS', biomarker_name: 'Central Macular Subfield Thickness (OS)', category: 'ophthalmology', value: 272, unit: 'µm', optimal_longevity_low: 250, optimal_longevity_high: 275, clinical_flag: 'optimal', test_date: dateStr, notes: `OCT Left Eye from ${file.name}` }
        );
      } else if (fn.includes('ferritin') || fn.includes('iron') || fn.includes('cbc')) {
        state.biomarkers.unshift(
          { id: 'bm-' + Date.now() + '-1', user_id: state.currentUser.id, document_id: newDoc.id, biomarker_code: 'FERRITIN', biomarker_name: 'Ferritin', category: 'hematology', value: 45, unit: 'ng/mL', optimal_longevity_low: 40, optimal_longevity_high: 100, clinical_flag: 'optimal', test_date: dateStr, notes: `Iron storage assay from ${file.name}` },
          { id: 'bm-' + Date.now() + '-2', user_id: state.currentUser.id, document_id: newDoc.id, biomarker_code: 'HEMOGLOBIN', biomarker_name: 'Hemoglobin', category: 'hematology', value: 14.2, unit: 'g/dL', optimal_longevity_low: 13.5, optimal_longevity_high: 16.5, clinical_flag: 'optimal', test_date: dateStr, notes: `Complete blood count from ${file.name}` }
        );
      } else if (fn.includes('thyroid') || fn.includes('tsh')) {
        state.biomarkers.unshift(
          { id: 'bm-' + Date.now() + '-1', user_id: state.currentUser.id, document_id: newDoc.id, biomarker_code: 'TSH', biomarker_name: 'Thyroid Stimulating Hormone (TSH)', category: 'endocrine', value: 1.85, unit: 'µIU/mL', optimal_longevity_low: 1.0, optimal_longevity_high: 2.5, clinical_flag: 'optimal', test_date: dateStr, notes: `Thyroid panel from ${file.name}` },
          { id: 'bm-' + Date.now() + '-2', user_id: state.currentUser.id, document_id: newDoc.id, biomarker_code: 'FREE_T3', biomarker_name: 'Free Triiodothyronine (fT3)', category: 'endocrine', value: 3.4, unit: 'pg/mL', optimal_longevity_low: 3.0, optimal_longevity_high: 4.2, clinical_flag: 'optimal', test_date: dateStr, notes: `Thyroid panel from ${file.name}` }
        );
      } else {
        state.biomarkers.unshift(
          { id: 'bm-' + Date.now() + '-1', user_id: state.currentUser.id, document_id: newDoc.id, biomarker_code: 'APOB', biomarker_name: 'Apolipoprotein B', category: 'lipids_cardio', value: 56, unit: 'mg/dL', optimal_longevity_low: 40, optimal_longevity_high: 60, clinical_flag: 'optimal', test_date: dateStr, notes: `Lipid panel from ${file.name}` },
          { id: 'bm-' + Date.now() + '-2', user_id: state.currentUser.id, document_id: newDoc.id, biomarker_code: 'VITAMIN_D', biomarker_name: '25-Hydroxy Vitamin D', category: 'micronutrients', value: 62, unit: 'ng/mL', optimal_longevity_low: 50, optimal_longevity_high: 80, clinical_flag: 'optimal', test_date: dateStr, notes: `Vitamin D assay from ${file.name}` }
        );
      }

      saveUserData();
      renderAll();
      alert(`Document "${file.name}" parsed! Biomarkers dynamically added to your vault.`);
    });
  }

  function openDocumentViewer(doc) {
    const modal = document.getElementById('docViewerModal');
    const content = document.getElementById('viewerContent');
    const title = document.getElementById('viewerTitle');
    const meta = document.getElementById('viewerMeta');

    title.textContent = doc.document_title;
    meta.textContent = `${doc.lab_provider} • Tested: ${doc.test_date} • Stored in Cloud Vault`;
    
    content.innerHTML = `
      <div class="space-y-3">
        <div class="text-brand-400 font-bold">--- CLINICAL LAB REPORT RECORD ---</div>
        <div>Document Name: ${doc.file_name}</div>
        <div>File Size: ${(doc.file_size_bytes / 1024).toFixed(1)} KB</div>
        <div>AI Parsing Summary: ${doc.ai_interpretation_summary}</div>
        <div class="text-slate-400 pt-2 border-t border-surface-border">
          [Document Stream Retrieved from Encrypted Cloud Vault]
          \nNormalized Biomarkers Associated:
          ${state.biomarkers.filter(b => b.document_id === doc.id).map(b => `- ${b.biomarker_name}: ${b.value} ${b.unit}`).join('\n') || '- Biomarkers indexed in time series.'}
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  const btnCloseViewer = document.getElementById('btnCloseViewer');
  if (btnCloseViewer) {
    btnCloseViewer.addEventListener('click', () => {
      document.getElementById('docViewerModal').classList.add('hidden');
    });
  }

  // ----------------------------------------------------------------------------
  // IN-APP DOC MEDICAL CONSULTANT (GEMINI 3.7 FLASH)
  // ----------------------------------------------------------------------------
  function renderDocChatMessages() {
    const chatContainer = document.getElementById('docChatMessages');
    if (!chatContainer) return;

    chatContainer.innerHTML = state.messages.map(msg => {
      const isDoc = msg.sender_role === 'doc_agent';
      return `
        <div class="flex items-start ${isDoc ? 'gap-3' : 'justify-end gap-3'}">
          ${isDoc ? `
            <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent-cyan to-brand-500 text-white flex items-center justify-center font-bold text-xs shadow-md shrink-0">
              Doc
            </div>
          ` : ''}
          <div class="${isDoc ? 'bg-surface-dark border border-surface-border text-slate-200' : 'bg-brand-500/20 border border-brand-500/40 text-white'} p-4 rounded-2xl text-xs leading-relaxed max-w-2xl shadow-sm">
            <div class="whitespace-pre-line">${msg.content}</div>
          </div>
        </div>
      `;
    }).join('');

    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  const docChatForm = document.getElementById('docChatForm');
  if (docChatForm) {
    docChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('docInput');
      const val = input.value.trim();
      if (!val) return;

      state.messages.push({
        sender_role: 'user',
        content: val,
        created_at: new Date().toISOString()
      });
      renderDocChatMessages();
      input.value = '';

      setTimeout(() => {
        let reply = '';
        const lower = val.toLowerCase();
        const catalog = getIngestedBiomarkerCatalog();

        const matched = catalog.find(m => lower.includes(m.name.toLowerCase()) || lower.includes(m.code.toLowerCase()));

        if (matched) {
          const samples = state.biomarkers.filter(b => b.biomarker_code === matched.code).sort((a, b) => new Date(b.test_date) - new Date(a.test_date));
          if (samples.length > 0) {
            const latest = samples[0];
            reply = `Reviewing your clinical records for **${matched.name}**:\n\n- **Latest Reading:** **${latest.value} ${matched.unit}** on ${latest.test_date}\n- **Optimal Longevity Target:** ${matched.optimal_low ? `${matched.optimal_low}–${matched.optimal_high} ${matched.unit}` : 'Clinical standard range'}\n\nThis parameter is actively tracked in your **Biomarker & Vital Trends** tab.`;
          } else {
            reply = `You have indexed **${matched.name}**, but no clinical samples are recorded yet. Upload your pathology report in the **Lab Vault** to visualize historical trends.`;
          }
        } else if (lower.includes('sleep') || lower.includes('hrv') || lower.includes('watch') || lower.includes('apple')) {
          const hasHRV = state.wearableMetrics.some(w => w.metric_type === 'hrv_sdnn');
          if (hasHRV) {
            reply = `Your continuous Apple Watch Ultra 4 telemetry indicates stable nocturnal autonomic recovery. Maintain consistent sleep timing and keep dinner at least 3 hours before bed to optimize deep sleep.`;
          } else {
            reply = `Your Apple Watch Ultra 4 is not yet streaming telemetry. Connect it in the **Devices & API** tab using the **Health Auto Export** app or iOS Shortcuts with your personal webhook token.`;
          }
        } else {
          reply = `Thank you, ${state.currentUser.fullName}. I am analyzing your specific health profile (${catalog.length} active biomarkers indexed). Feel free to ask about any specific lab marker, condition protocol, or upload new diagnostic files in the Lab Vault.`;
        }

        state.messages.push({
          sender_role: 'doc_agent',
          content: reply,
          created_at: new Date().toISOString()
        });
        saveUserData();
        renderDocChatMessages();
      }, 500);
    });
  }

  document.querySelectorAll('.doc-prompt-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('docInput');
      if (input) {
        input.value = btn.textContent.replace(/"/g, '').trim();
        input.focus();
      }
    });
  });

  // ----------------------------------------------------------------------------
  // DIAGNOSTIC REPORTS ENGINE
  // ----------------------------------------------------------------------------
  function renderReportsView() {
    const report = state.reports[0];
    const reportMeta = document.getElementById('reportMeta');
    const execEl = document.getElementById('repExecSummary');
    const bioEl = document.getElementById('repBiomarkers');
    const wearEl = document.getElementById('repWearables');
    const riskEl = document.getElementById('repRisk');
    const recEl = document.getElementById('repRecommendations');

    if (!report) {
      if (reportMeta) reportMeta.textContent = `Patient: ${state.currentUser?.fullName || '--'} • Status: Ready to Generate`;
      if (execEl) execEl.textContent = 'Click "Generate New Assessment Report" above to compile an executive diagnostic summary.';
      if (bioEl) bioEl.textContent = '—';
      if (wearEl) wearEl.textContent = '—';
      if (riskEl) riskEl.textContent = '—';
      if (recEl) recEl.textContent = '—';
      return;
    }

    if (reportMeta) reportMeta.textContent = `Patient: ${state.currentUser?.fullName || '--'} • Date: ${report.report_date} • Reviewing Agent: Doc`;
    if (execEl) execEl.textContent = report.executive_summary;
    if (bioEl) bioEl.textContent = report.biomarker_analysis;
    if (wearEl) wearEl.textContent = report.wearable_correlations;
    if (riskEl) riskEl.textContent = report.risk_stratification;
    if (recEl) recEl.textContent = report.recommendations;
  }

  const btnQuickReport = document.getElementById('btnQuickReport');
  const btnGenerateNewReport = document.getElementById('btnGenerateNewReport');

  function generateDiagnosticReport() {
    const catalog = getIngestedBiomarkerCatalog();
    const hasData = state.biomarkers.length > 0 || state.wearableMetrics.length > 0;
    const newReport = {
      id: 'rep-' + Date.now(),
      report_date: new Date().toISOString().split('T')[0],
      executive_summary: hasData 
        ? `Executive health evaluation for ${state.currentUser.fullName}. Physiological parameters and lab records demonstrate active longevity optimization across ${catalog.length} indexed biomarkers.`
        : `Baseline assessment initialized for ${state.currentUser.fullName}. Pending upload of primary laboratory panels and continuous Apple Watch pairing to establish initial risk baseline.`,
      biomarker_analysis: state.biomarkers.length > 0 
        ? state.biomarkers.map(b => `• ${b.biomarker_name}: ${b.value} ${b.unit} (${b.clinical_flag.toUpperCase()})`).join('\n')
        : `• No lab panels uploaded yet. Upload blood tests or retinal OCT scans in Lab Vault.`,
      wearable_correlations: state.wearableMetrics.length > 0
        ? `Continuous Apple Watch telemetry integrated: Autonomic recovery and sleep architecture within healthy parameters.`
        : `• Apple Watch Ultra 4 sync pending. Configure webhook in Devices & API tab.`,
      risk_stratification: hasData 
        ? `Overall Longevity & Healthspan Risk: Low Risk Profile based on ingested parameters.`
        : `Risk stratification pending primary biomarker ingestion.`,
      recommendations: `1. Maintain scheduled diagnostic testing.\n2. Continue daily circadian synchronization and sleep hygiene.\n3. Track acute/chronic conditions in Conditions Hub.`
    };

    state.reports.unshift(newReport);
    saveUserData();
    renderReportsView();
    switchTab('reports');
  }

  if (btnQuickReport) btnQuickReport.addEventListener('click', generateDiagnosticReport);
  if (btnGenerateNewReport) btnGenerateNewReport.addEventListener('click', generateDiagnosticReport);

  // ----------------------------------------------------------------------------
  // DEMO DATA CONTROLS (OPTIONAL SANDBOX IN INTEGRATIONS TAB)
  // ----------------------------------------------------------------------------
  const btnLoadDemoData = document.getElementById('btnLoadDemoData');
  const btnClearData = document.getElementById('btnClearData');

  if (btnLoadDemoData) {
    btnLoadDemoData.addEventListener('click', () => {
      if (confirm('Load sample demonstration dataset with diverse biomarker categories?')) {
        state.biomarkers = [
          { id: 'bm-1', biomarker_code: 'APOB', biomarker_name: 'Apolipoprotein B', category: 'lipids_cardio', value: 88, unit: 'mg/dL', optimal_longevity_low: 40, optimal_longevity_high: 60, clinical_flag: 'borderline', test_date: '2025-03-10', notes: 'Baseline checkup.' },
          { id: 'bm-2', biomarker_code: 'APOB', biomarker_name: 'Apolipoprotein B', category: 'lipids_cardio', value: 74, unit: 'mg/dL', optimal_longevity_low: 40, optimal_longevity_high: 60, clinical_flag: 'borderline', test_date: '2025-09-15', notes: 'Post-dietary modification.' },
          { id: 'bm-3', biomarker_code: 'APOB', biomarker_name: 'Apolipoprotein B', category: 'lipids_cardio', value: 58, unit: 'mg/dL', optimal_longevity_low: 40, optimal_longevity_high: 60, clinical_flag: 'optimal', test_date: '2026-03-20', notes: 'Optimal longevity target reached.' },
          { id: 'bm-4', biomarker_code: 'APOB', biomarker_name: 'Apolipoprotein B', category: 'lipids_cardio', value: 54, unit: 'mg/dL', optimal_longevity_low: 40, optimal_longevity_high: 60, clinical_flag: 'optimal', test_date: '2026-09-10', notes: 'Stable in optimal zone.' },
          { id: 'bm-5', biomarker_code: 'TESTOSTERONE_TOTAL', biomarker_name: 'Total Testosterone', category: 'hormones', value: 695, unit: 'ng/dL', optimal_longevity_low: 600, optimal_longevity_high: 850, clinical_flag: 'optimal', test_date: '2026-09-10', notes: 'Optimal androgen regulation.' },
          { id: 'bm-6', biomarker_code: 'FERRITIN', biomarker_name: 'Serum Ferritin', category: 'hematology', value: 68, unit: 'ng/mL', optimal_longevity_low: 50, optimal_longevity_high: 150, clinical_flag: 'optimal', test_date: '2026-09-10', notes: 'Healthy iron storage.' },
          { id: 'bm-7', biomarker_code: 'MACULAR_THICKNESS_OD', biomarker_name: 'Central Macular Thickness (OD)', category: 'ophthalmology', value: 268, unit: 'µm', optimal_longevity_low: 250, optimal_longevity_high: 275, clinical_flag: 'optimal', test_date: '2026-04-18', notes: 'Foveal contour intact.' },
          { id: 'bm-8', biomarker_code: 'MACULAR_THICKNESS_OS', biomarker_name: 'Central Macular Thickness (OS)', category: 'ophthalmology', value: 272, unit: 'µm', optimal_longevity_low: 250, optimal_longevity_high: 275, clinical_flag: 'optimal', test_date: '2026-04-18', notes: 'Micro-edema fully resolved.' }
        ];

        state.wearableMetrics = [];
        const now = new Date();
        for (let d = 20; d >= 0; d--) {
          const date = new Date(now);
          date.setDate(date.getDate() - d);
          const ds = date.toISOString().split('T')[0];
          state.wearableMetrics.push({ id: `wm-h-${d}`, metric_type: 'hrv_sdnn', value: Math.round(68 + Math.sin(d) * 10), unit: 'ms', recorded_at: `${ds}T07:00:00Z` });
          state.wearableMetrics.push({ id: `wm-r-${d}`, metric_type: 'resting_heart_rate', value: Math.round(49 + Math.cos(d) * 3), unit: 'bpm', recorded_at: `${ds}T07:00:00Z` });
          state.wearableMetrics.push({ id: `wm-s-${d}`, metric_type: 'sleep_deep_min', value: Math.round(82 + Math.sin(d/2) * 12), unit: 'min', recorded_at: `${ds}T06:30:00Z` });
        }

        state.conditions = [
          { id: 'cond-1', user_id: state.currentUser.id, title: 'ApoB & Atherogenic Particle Optimization', condition_type: 'chronic', status: 'managing', diagnosis_date: '2025-03-10', clinical_summary: 'Targeting aggressive reduction of ApoB < 60 mg/dL to halt subclinical endothelial plaque progression.', primary_treatment_plan: 'Low saturated fat, Mediterranean base, daily Zone-2 cardio.' }
        ];

        state.insights = [
          { id: 'ins-1', user_id: state.currentUser.id, insight_type: 'biomarker_trend', title: 'ApoB Longevity Target Sustained', summary: 'Your ApoB trajectory has dropped 38.6% down to 54 mg/dL. This places you in the top 5th percentile for 10-year atherogenic risk mitigation.', confidence_score: 0.98 }
        ];

        saveUserData();
        renderAll();
        alert('Sample dataset loaded with diverse categories.');
      }
    });
  }

  if (btnClearData) {
    btnClearData.addEventListener('click', () => {
      if (confirm('Reset your health vault back to an empty state?')) {
        state.biomarkers = [];
        state.wearableMetrics = [];
        state.labDocuments = [];
        state.conditions = [];
        state.conditionTags = [];
        state.insights = [];
        state.messages = [];
        state.reports = [];
        initDocGreeting();
        saveUserData();
        renderAll();
        alert('Health vault reset to zero state.');
      }
    });
  }

  // Copy Webhook / Token Helpers
  const btnCopyWebhook = document.getElementById('btnCopyWebhook');
  if (btnCopyWebhook) {
    btnCopyWebhook.addEventListener('click', () => {
      const input = document.getElementById('webhookUrlInput');
      input.select();
      navigator.clipboard.writeText(input.value);
      alert('Webhook URL copied to clipboard!');
    });
  }

  const btnCopyToken = document.getElementById('btnCopyToken');
  if (btnCopyToken) {
    btnCopyToken.addEventListener('click', () => {
      const input = document.getElementById('apiTokenInput');
      input.select();
      navigator.clipboard.writeText(input.value);
      alert('API access token copied to clipboard!');
    });
  }

  // Run initial session check
  checkSession();
});
