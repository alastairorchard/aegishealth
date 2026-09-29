// ==============================================================================
// AEGISHEALTH - FRONTEND APPLICATION & CLIENT-SIDE ARCHITECTURE
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Application State
  const state = {
    user: {
      id: 'demo-user-alastair',
      email: 'alastairorchard@icloud.com',
      fullName: 'Alastair Orchard',
      onboardingCompleted: true
    },
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
    charts: {}
  };

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
    
    // Update button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active', 'text-white', 'bg-brand-500/20', 'border-brand-500/40');
        btn.classList.remove('text-slate-400');
      } else {
        btn.classList.remove('active', 'text-white', 'bg-brand-500/20', 'border-brand-500/40');
        btn.classList.add('text-slate-400');
      }
    });

    // Update section visibility
    document.querySelectorAll('.tab-content').forEach(section => {
      if (section.id === `tab-${tabId}`) {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
      }
    });

    // Re-render chart if switching to trends or overview
    if (tabId === 'overview') {
      renderOverviewChart();
    } else if (tabId === 'trends') {
      renderDetailedTrendChart('APOB');
    }
  }

  // ----------------------------------------------------------------------------
  // DATA FETCHING & INITIALIZATION
  // ----------------------------------------------------------------------------
  async function loadData() {
    try {
      const res = await fetch(`/api/data/bundle?userId=${state.user.id}`);
      if (res.ok) {
        const data = await res.json();
        state.biomarkers = data.biomarkers || [];
        state.wearableMetrics = data.wearableMetrics || [];
        state.labDocuments = data.labDocuments || [];
        state.conditions = data.conditions || [];
        state.conditionTags = data.conditionTags || [];
        state.insights = data.insights || [];
        state.messages = data.messages || [];
        state.reports = data.reports || [];

        renderAll();
      }
    } catch (err) {
      console.error('Error fetching data bundle:', err);
    }
  }

  function renderAll() {
    renderOverviewInsights();
    renderOverviewConditions();
    renderOverviewChart();
    renderDetailedTrendChart('APOB');
    renderBiomarkerTable();
    renderConditionsGrid();
    renderLabDocsGrid();
    renderDocChatMessages();
    renderReportsView();
  }

  // ----------------------------------------------------------------------------
  // OVERVIEW RENDERING
  // ----------------------------------------------------------------------------
  function renderOverviewInsights() {
    const container = document.getElementById('overviewInsightsList');
    if (!container) return;

    if (state.insights.length === 0) {
      container.innerHTML = `<p class="text-xs text-slate-400">No active insights logged by Doc.</p>`;
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
      container.innerHTML = `<p class="text-xs text-slate-400">No conditions recorded.</p>`;
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
  // CHARTS RENDERING (Overview & Detailed Trends)
  // ----------------------------------------------------------------------------
  function renderOverviewChart() {
    const canvas = document.getElementById('overviewTrajectoryChart');
    if (!canvas) return;

    if (state.charts.overview) {
      state.charts.overview.destroy();
    }

    const selectEl = document.getElementById('quickChartMetric');
    const selectedMetric = selectEl ? selectEl.value : 'APOB';

    let labels = [];
    let dataPoints = [];
    let label = 'ApoB (mg/dL)';
    let borderColor = '#10b981';
    let targetZone = 60;

    if (selectedMetric === 'APOB') {
      const records = state.biomarkers.filter(b => b.biomarker_code === 'APOB').sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
      labels = records.map(r => r.test_date);
      dataPoints = records.map(r => r.value);
      label = 'Apolipoprotein B (mg/dL) - Goal < 60';
      borderColor = '#10b981';
    } else if (selectedMetric === 'TESTOSTERONE_TOTAL') {
      const records = state.biomarkers.filter(b => b.biomarker_code === 'TESTOSTERONE_TOTAL').sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
      labels = records.map(r => r.test_date);
      dataPoints = records.map(r => r.value);
      label = 'Total Testosterone (ng/dL)';
      borderColor = '#06b6d4';
    } else if (selectedMetric === 'MACULAR_THICKNESS_OS') {
      const records = state.biomarkers.filter(b => b.biomarker_code.includes('MACULAR')).sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
      labels = records.map(r => `${r.test_date} (${r.biomarker_code.endsWith('OS') ? 'OS' : 'OD'})`);
      dataPoints = records.map(r => r.value);
      label = 'Macular Subfield Thickness (µm)';
      borderColor = '#f59e0b';
    } else if (selectedMetric === 'HRV_SDNN') {
      const records = state.wearableMetrics.filter(w => w.metric_type === 'hrv_sdnn').slice(-15);
      labels = records.map(r => r.recorded_at.split('T')[0].substring(5));
      dataPoints = records.map(r => r.value);
      label = 'Apple Watch Ultra 4 HRV (ms)';
      borderColor = '#a855f7';
    } else if (selectedMetric === 'RESTING_HR') {
      const records = state.wearableMetrics.filter(w => w.metric_type === 'resting_heart_rate').slice(-15);
      labels = records.map(r => r.recorded_at.split('T')[0].substring(5));
      dataPoints = records.map(r => r.value);
      label = 'Resting Heart Rate (bpm)';
      borderColor = '#f43f5e';
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
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { size: 11, family: 'Plus Jakarta Sans' } }
          }
        },
        scales: {
          x: {
            grid: { color: '#1f2937' },
            ticks: { color: '#94a3b8', font: { size: 10 } }
          },
          y: {
            grid: { color: '#1f2937' },
            ticks: { color: '#94a3b8', font: { size: 10 } }
          }
        }
      }
    });
  }

  const quickChartSelect = document.getElementById('quickChartMetric');
  if (quickChartSelect) {
    quickChartSelect.addEventListener('change', renderOverviewChart);
  }

  // Detailed Trends Tab Filtering
  function renderDetailedTrendChart(metricType) {
    const canvas = document.getElementById('detailedTrendChart');
    const titleEl = document.getElementById('trendChartTitle');
    if (!canvas) return;

    if (state.charts.detailed) {
      state.charts.detailed.destroy();
    }

    let datasets = [];
    let labels = [];

    if (metricType === 'APOB') {
      if (titleEl) titleEl.textContent = 'Apolipoprotein B (ApoB) & Cardiovascular Risk Trajectory';
      const records = state.biomarkers.filter(b => b.biomarker_code === 'APOB').sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
      labels = records.map(r => r.test_date);
      datasets.push({
        label: 'ApoB Measured (mg/dL)',
        data: records.map(r => r.value),
        borderColor: '#10b981',
        backgroundColor: '#10b98120',
        fill: true,
        tension: 0.3,
        borderWidth: 3
      });
      // Target reference zone
      datasets.push({
        label: 'Longevity Aggressive Target (<60 mg/dL)',
        data: labels.map(() => 60),
        borderColor: '#f59e0b',
        borderDash: [5, 5],
        borderWidth: 1.5,
        fill: false,
        pointRadius: 0
      });
    } else if (metricType === 'TESTOSTERONE') {
      if (titleEl) titleEl.textContent = 'Total & Free Testosterone Endocrine Dynamics';
      const tot = state.biomarkers.filter(b => b.biomarker_code === 'TESTOSTERONE_TOTAL').sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
      labels = tot.map(r => r.test_date);
      datasets.push({
        label: 'Total Testosterone (ng/dL)',
        data: tot.map(r => r.value),
        borderColor: '#06b6d4',
        backgroundColor: '#06b6d420',
        tension: 0.3,
        borderWidth: 3
      });
    } else if (metricType === 'MACULAR') {
      if (titleEl) titleEl.textContent = 'Optical Coherence Tomography (OCT) - Central Macular Subfield Thickness';
      const od = state.biomarkers.filter(b => b.biomarker_code === 'MACULAR_THICKNESS_OD').sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
      const os = state.biomarkers.filter(b => b.biomarker_code === 'MACULAR_THICKNESS_OS').sort((a, b) => new Date(a.test_date) - new Date(b.test_date));
      labels = ['2025-04-12', '2026-04-18'];
      datasets.push({
        label: 'Right Eye OD (µm)',
        data: od.map(r => r.value),
        borderColor: '#34d399',
        borderWidth: 2.5
      });
      datasets.push({
        label: 'Left Eye OS (µm) - Edema Resolved',
        data: os.map(r => r.value),
        borderColor: '#f43f5e',
        borderWidth: 2.5
      });
    } else if (metricType === 'HRV_SLEEP') {
      if (titleEl) titleEl.textContent = 'Apple Watch Ultra 4 - 30-Day Autonomic Stream (HRV & Deep Sleep)';
      const hrv = state.wearableMetrics.filter(w => w.metric_type === 'hrv_sdnn').slice(-20);
      const sleep = state.wearableMetrics.filter(w => w.metric_type === 'sleep_deep_min').slice(-20);
      labels = hrv.map(r => r.recorded_at.split('T')[0].substring(5));
      datasets.push({
        label: 'HRV SDNN (ms)',
        data: hrv.map(r => r.value),
        borderColor: '#a855f7',
        borderWidth: 2.5,
        tension: 0.35
      });
      datasets.push({
        label: 'Deep Sleep (min)',
        data: sleep.map(r => r.value),
        borderColor: '#06b6d4',
        borderWidth: 2,
        tension: 0.35
      });
    } else if (metricType === 'VO2_EXERCISE') {
      if (titleEl) titleEl.textContent = 'Cardiorespiratory Fitness & VO2 Max Trajectory';
      const vo2 = state.wearableMetrics.filter(w => w.metric_type === 'vo2_max');
      labels = vo2.map(r => r.recorded_at.split('T')[0].substring(5));
      datasets.push({
        label: 'VO2 Max (mL/kg/min)',
        data: vo2.map(r => r.value),
        borderColor: '#10b981',
        backgroundColor: '#10b98120',
        fill: true,
        borderWidth: 3
      });
    }

    state.charts.detailed = new Chart(canvas, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#cbd5e1', font: { size: 11 } } }
        },
        scales: {
          x: { grid: { color: '#1f2937' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: '#1f2937' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  document.querySelectorAll('.trend-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.trend-filter-btn').forEach(b => {
        b.classList.remove('active', 'border-brand-500/40', 'bg-brand-500/20', 'text-white');
        b.classList.add('border-surface-border', 'bg-surface-dark', 'text-slate-400');
      });
      btn.classList.add('active', 'border-brand-500/40', 'bg-brand-500/20', 'text-white');
      btn.classList.remove('border-surface-border', 'bg-surface-dark', 'text-slate-400');
      renderDetailedTrendChart(btn.getAttribute('data-metric'));
    });
  });

  // ----------------------------------------------------------------------------
  // BIOMARKER TABLE RENDERING
  // ----------------------------------------------------------------------------
  function renderBiomarkerTable() {
    const tbody = document.getElementById('biomarkerTableBody');
    if (!tbody) return;

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
          <td class="py-3 px-4 text-slate-400 capitalize">${b.category.replace('_', ' ')}</td>
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
            <p class="text-xs text-slate-300 line-clamp-2 leading-relaxed">${c.clinical_summary}</p>
          </div>

          <div class="pt-3 border-t border-surface-border/70 flex items-center justify-between text-xs">
            <div class="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <i data-lucide="tag" class="w-3.5 h-3.5 text-brand-400"></i>
              <span>${tags.length} Biomarkers & Vitals Tagged</span>
            </div>
            <button class="text-brand-400 font-semibold hover:underline flex items-center gap-1 text-xs">
              Open Section <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Attach click handlers to open condition detail
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
    document.getElementById('condDetailSummary').textContent = cond.clinical_summary;
    document.getElementById('condDetailTreatment').textContent = cond.primary_treatment_plan;
    
    const badge = document.getElementById('condDetailBadge');
    badge.textContent = cond.status.toUpperCase();
    badge.className = `px-2.5 py-1 rounded-full text-[10px] font-bold ${cond.status === 'resolved' ? 'bg-slate-700 text-slate-300' : 'bg-brand-500/20 text-brand-400 border border-brand-500/30'}`;

    // Render tagged data list
    const tagsContainer = document.getElementById('condDetailTagsList');
    const tags = state.conditionTags.filter(t => t.condition_id === cond.id);
    tagsContainer.innerHTML = tags.map(t => `
      <div class="p-2 rounded-lg bg-surface-card border border-surface-border flex items-center justify-between text-[11px]">
        <span class="text-slate-200">${t.relevance_rationale}</span>
        <span class="text-[9px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">Tagged</span>
      </div>
    `).join('');

    // Render condition Doc chat
    renderCondDocChat(cond);

    // Smooth scroll into detail
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
          Clinical thread for <strong>${cond.title}</strong> initialized. All associated lab scans and wearable metrics are tagged to this stream. How would you like to proceed with your protocol?
        </div>
      </div>
    `;
  }

  const condDocChatForm = document.getElementById('condDocChatForm');
  if (condDocChatForm) {
    condDocChatForm.addEventListener('submit', async (e) => {
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

      // Request Doc API
      try {
        const res = await fetch('/api/doc/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: val,
            conditionId: state.selectedCondition?.id,
            userId: state.user.id
          })
        });
        if (res.ok) {
          const data = await res.json();
          chatBox.innerHTML += `
            <div class="flex items-start gap-2.5">
              <div class="w-6 h-6 rounded-lg bg-accent-cyan/20 text-accent-cyan flex items-center justify-center font-bold text-[10px]">Doc</div>
              <div class="bg-surface-card p-3 rounded-xl border border-surface-border text-slate-200 text-xs leading-relaxed max-w-xl">
                ${data.reply}
              </div>
            </div>
          `;
          chatBox.scrollTop = chatBox.scrollHeight;
        }
      } catch (err) {
        console.error('Condition chat error:', err);
      }
    });
  }

  // ----------------------------------------------------------------------------
  // LAB VAULT & DOCUMENT INGESTION
  // ----------------------------------------------------------------------------
  function renderLabDocsGrid() {
    const grid = document.getElementById('labDocsGrid');
    if (!grid) return;

    if (state.labDocuments.length === 0) {
      grid.innerHTML = `<p class="text-xs text-slate-400 col-span-full">No documents in vault. Upload one above.</p>`;
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
          <button class="btn-view-doc text-xs text-brand-400 hover:underline font-semibold flex items-center gap-1" data-id="${doc.id}">
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

  // Upload handler
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('lab_document', file);
      formData.append('userId', state.user.id);
      formData.append('documentTitle', file.name);
      formData.append('testDate', new Date().toISOString().split('T')[0]);

      try {
        const res = await fetch('/api/labs/upload', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          state.labDocuments.unshift(data.document);
          renderLabDocsGrid();
          alert('Document parsed and normalized by AI into biomarker data model!');
        }
      } catch (err) {
        console.error('File upload error:', err);
      }
    });
  }

  function openDocumentViewer(doc) {
    const modal = document.getElementById('docViewerModal');
    const content = document.getElementById('viewerContent');
    const title = document.getElementById('viewerTitle');
    const meta = document.getElementById('viewerMeta');

    title.textContent = doc.document_title;
    meta.textContent = `${doc.lab_provider} • Tested: ${doc.test_date} • Supabase Storage URL: ${doc.file_url}`;
    
    content.innerHTML = `
      <div class="space-y-3">
        <div class="text-brand-400 font-bold">--- ORIGINAL CLINICAL LAB REPORT METADATA ---</div>
        <div>Document Name: ${doc.file_name}</div>
        <div>MIME Type: ${doc.mime_type}</div>
        <div>AI Parsing Summary: ${doc.ai_interpretation_summary}</div>
        <div class="text-slate-400 pt-2 border-t border-surface-border">
          [PDF / Image Rendering Stream from Supabase Storage]
          \nRaw OCR & Extracted Clinical Biomarkers:
          - Apolipoprotein B (ApoB): 54 mg/dL [Target: <60 mg/dL]
          - Total Testosterone: 695 ng/dL
          - Free Testosterone: 16.8 pg/mL
          - Central Macular Subfield Thickness: OD 268 µm / OS 272 µm
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
    docChatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('docInput');
      const val = input.value.trim();
      if (!val) return;

      // Add user message locally
      state.messages.push({
        sender_role: 'user',
        content: val,
        created_at: new Date().toISOString()
      });
      renderDocChatMessages();
      input.value = '';

      try {
        const res = await fetch('/api/doc/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: val,
            userId: state.user.id
          })
        });
        if (res.ok) {
          const data = await res.json();
          state.messages.push(data.message);
          renderDocChatMessages();
        }
      } catch (err) {
        console.error('Doc chat error:', err);
      }
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
    if (!report) return;

    const execEl = document.getElementById('repExecSummary');
    const bioEl = document.getElementById('repBiomarkers');
    const wearEl = document.getElementById('repWearables');
    const riskEl = document.getElementById('repRisk');
    const recEl = document.getElementById('repRecommendations');

    if (execEl) execEl.textContent = report.executive_summary;
    if (bioEl) bioEl.textContent = report.biomarker_analysis;
    if (wearEl) wearEl.textContent = report.wearable_correlations;
    if (riskEl) riskEl.textContent = report.risk_stratification;
    if (recEl) recEl.textContent = report.recommendations;
  }

  const btnQuickReport = document.getElementById('btnQuickReport');
  const btnGenerateNewReport = document.getElementById('btnGenerateNewReport');

  async function triggerReportGeneration() {
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: state.user.id, scope: 'comprehensive_annual' })
      });
      if (res.ok) {
        const data = await res.json();
        state.reports.unshift(data.report);
        renderReportsView();
        switchTab('reports');
      }
    } catch (err) {
      console.error('Report generate error:', err);
    }
  }

  if (btnQuickReport) btnQuickReport.addEventListener('click', triggerReportGeneration);
  if (btnGenerateNewReport) btnGenerateNewReport.addEventListener('click', triggerReportGeneration);

  // ----------------------------------------------------------------------------
  // COPY WEBHOOK / TOKEN HELPERS
  // ----------------------------------------------------------------------------
  const btnCopyWebhook = document.getElementById('btnCopyWebhook');
  if (btnCopyWebhook) {
    btnCopyWebhook.addEventListener('click', () => {
      const input = document.getElementById('webhookUrlInput');
      input.select();
      navigator.clipboard.writeText(input.value);
      alert('Apple Health Webhook URL copied to clipboard!');
    });
  }

  const btnCopyToken = document.getElementById('btnCopyToken');
  if (btnCopyToken) {
    btnCopyToken.addEventListener('click', () => {
      const input = document.getElementById('apiTokenInput');
      input.select();
      navigator.clipboard.writeText(input.value);
      alert('Bearer API token copied to clipboard!');
    });
  }

  // Run initial load
  loadData();
});
