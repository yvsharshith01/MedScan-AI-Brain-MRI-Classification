/* ============================================
   MediScan AI — Symptom Checker Engine
   ============================================ */

import { $, $$, showToast, getSeverityBadge, escapeHTML } from './utils.js';

export class SymptomChecker {
  constructor() {
    this.symptomsData = [];
    this.selectedSymptoms = new Set();
    this.answers = {};
    this.currentStep = 1;
  }

  async init() {
    try {
      const res = await fetch('./data/symptoms.json');
      const data = await res.json();
      this.symptomsData = data.symptoms || [];
      this.renderBodyRegions(data.bodyRegions || []);
      this.renderSymptomOptions();
      this.bindEvents();
    } catch (e) {
      console.error('Failed to load symptoms data', e);
    }
  }

  bindEvents() {
    const searchInput = $('#symptom-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        this.filterSymptoms(query);
      });
    }

    const resetBtn = $('#reset-symptom-checker');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetChecker());
    }

    const proceedBtn = $('#proceed-to-questions');
    if (proceedBtn) {
      proceedBtn.addEventListener('click', () => this.startQuestionnaire());
    }
  }

  renderBodyRegions(regions) {
    const list = $('#body-region-list');
    if (!list) return;

    list.innerHTML = `
      <button class="body-region-btn active" data-region="all">
        <i data-lucide="grid"></i> All Body Regions
      </button>
      ${regions.map(r => `
        <button class="body-region-btn" data-region="${r.id}">
          <i data-lucide="${r.icon}"></i> ${r.name}
        </button>
      `).join('')}
    `;

    if (window.lucide) window.lucide.createIcons({ targets: [list] });

    $$('.body-region-btn', list).forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.body-region-btn', list).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const region = btn.dataset.region;
        this.filterSymptomsByRegion(region);
      });
    });
  }

  renderSymptomOptions(items = this.symptomsData) {
    const grid = $('#symptoms-selector-grid');
    if (!grid) return;

    grid.innerHTML = items.map(s => {
      const isSelected = this.selectedSymptoms.has(s.id);
      return `
        <div class="symptom-card-option ${isSelected ? 'selected' : ''}" data-id="${s.id}">
          <i data-lucide="${s.icon || 'activity'}" style="color: var(--primary-400);"></i>
          <span style="font-weight: 500; font-size: var(--text-sm);">${escapeHTML(s.name)}</span>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons({ targets: [grid] });

    $$('.symptom-card-option', grid).forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        if (this.selectedSymptoms.has(id)) {
          this.selectedSymptoms.delete(id);
          card.classList.remove('selected');
        } else {
          this.selectedSymptoms.add(id);
          card.classList.add('selected');
        }
        this.updateSelectedCounter();
      });
    });
  }

  filterSymptomsByRegion(region) {
    if (region === 'all') {
      this.renderSymptomOptions(this.symptomsData);
    } else {
      const filtered = this.symptomsData.filter(s => s.bodyRegion === region || s.bodyRegion === 'general');
      this.renderSymptomOptions(filtered);
    }
  }

  filterSymptoms(query) {
    if (!query) {
      this.renderSymptomOptions(this.symptomsData);
      return;
    }
    const filtered = this.symptomsData.filter(s => 
      s.name.toLowerCase().includes(query) || 
      s.id.toLowerCase().includes(query)
    );
    this.renderSymptomOptions(filtered);
  }

  updateSelectedCounter() {
    const badge = $('#selected-symptoms-count');
    const proceedBtn = $('#proceed-to-questions');

    if (badge) badge.textContent = `${this.selectedSymptoms.size} Selected`;
    if (proceedBtn) proceedBtn.disabled = this.selectedSymptoms.size === 0;

    const chipsContainer = $('#selected-symptoms-chips');
    if (chipsContainer) {
      const selectedList = this.symptomsData.filter(s => this.selectedSymptoms.has(s.id));
      chipsContainer.innerHTML = selectedList.map(s => `
        <span class="chip">
          ${escapeHTML(s.name)}
          <i data-lucide="x" class="chip-remove" data-id="${s.id}"></i>
        </span>
      `).join('');

      if (window.lucide) window.lucide.createIcons({ targets: [chipsContainer] });

      $$('.chip-remove', chipsContainer).forEach(icon => {
        icon.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = icon.dataset.id;
          this.selectedSymptoms.delete(id);
          this.renderSymptomOptions();
          this.updateSelectedCounter();
        });
      });
    }
  }

  startQuestionnaire() {
    if (this.selectedSymptoms.size === 0) return;

    this.currentStep = 2;
    this.renderQuestionsStep();
  }

  renderQuestionsStep() {
    const step1El = $('#checker-step-1');
    const step2El = $('#checker-step-2');
    const step3El = $('#checker-step-3');

    if (step1El) step1El.classList.add('hidden');
    if (step3El) step3El.classList.add('hidden');
    if (step2El) step2El.classList.remove('hidden');

    this.updateWizardBar(2);

    const questionsContainer = $('#questions-accordion-container');
    if (!questionsContainer) return;

    const selectedList = this.symptomsData.filter(s => this.selectedSymptoms.has(s.id));

    questionsContainer.innerHTML = selectedList.map(s => `
      <div class="card" style="margin-bottom: var(--space-6);">
        <h4 style="margin-bottom: var(--space-4); color: var(--primary-300); display: flex; align-items: center; gap: 8px;">
          <i data-lucide="${s.icon || 'activity'}"></i> ${escapeHTML(s.name)} Questions
        </h4>
        ${s.followUpQuestions.map((fq, qIdx) => `
          <div style="margin-bottom: var(--space-4);">
            <p style="font-weight: 600; font-size: var(--text-sm); margin-bottom: var(--space-2); color: var(--text-primary);">${qIdx + 1}. ${escapeHTML(fq.q)}</p>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${fq.options.map(opt => `
                <button class="chip option-btn" data-sym="${s.id}" data-q="${qIdx}" data-val="${escapeHTML(opt)}">
                  ${escapeHTML(opt)}
                </button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `).join('') + `
      <div style="display: flex; justify-content: space-between; margin-top: var(--space-6);">
        <button class="btn btn-secondary" id="back-to-step-1">Back</button>
        <button class="btn btn-accent btn-lg" id="generate-diagnosis-btn">Analyze Symptoms & Generate Guidance</button>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons({ targets: [questionsContainer] });

    $$('.option-btn', questionsContainer).forEach(btn => {
      btn.addEventListener('click', () => {
        const sym = btn.dataset.sym;
        const q = btn.dataset.q;
        const parent = btn.parentElement;
        $$('.option-btn', parent).forEach(b => b.classList.remove('active', 'selected'));
        btn.classList.add('active', 'selected');

        if (!this.answers[sym]) this.answers[sym] = {};
        this.answers[sym][q] = btn.dataset.val;
      });
    });

    $('#back-to-step-1').addEventListener('click', () => {
      if (step2El) step2El.classList.add('hidden');
      if (step1El) step1El.classList.remove('hidden');
      this.updateWizardBar(1);
    });

    $('#generate-diagnosis-btn').addEventListener('click', () => this.generateResults());
  }

  generateResults() {
    this.currentStep = 3;
    this.updateWizardBar(3);

    const step2El = $('#checker-step-2');
    const step3El = $('#checker-step-3');

    if (step2El) step2El.classList.add('hidden');
    if (step3El) step3El.classList.remove('hidden');

    const selectedList = this.symptomsData.filter(s => this.selectedSymptoms.has(s.id));
    
    // Check emergency triggers
    let emergencyAlerts = [];
    selectedList.forEach(s => {
      if (s.emergencyTriggers) {
        emergencyAlerts.push(...s.emergencyTriggers);
      }
    });

    const emergencyBox = $('#emergency-warning-box');
    if (emergencyBox) {
      if (emergencyAlerts.length > 0) {
        emergencyBox.classList.remove('hidden');
        $('#emergency-triggers-list').innerHTML = emergencyAlerts.map(e => `<li>${escapeHTML(e)}</li>`).join('');
      } else {
        emergencyBox.classList.add('hidden');
      }
    }

    // Collect condition possibilities
    let conditionMap = new Map();
    selectedList.forEach(s => {
      s.conditions.forEach(c => {
        if (conditionMap.has(c.name)) {
          const existing = conditionMap.get(c.name);
          existing.probability = Math.min(0.95, existing.probability + 0.2);
        } else {
          conditionMap.set(c.name, { ...c });
        }
      });
    });

    const results = [...conditionMap.values()].sort((a, b) => b.probability - a.probability);

    const resultsContainer = $('#differential-results-list');
    if (resultsContainer) {
      resultsContainer.innerHTML = results.map(res => `
        <div class="condition-result-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3);">
            <div>
              <h4 style="font-size: var(--text-lg); font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">${escapeHTML(res.name)}</h4>
              <div>${getSeverityBadge(res.severity)}</div>
            </div>
            <span style="font-size: var(--text-xl); font-weight: 800; color: var(--primary-300); font-family: var(--font-family-heading);">
              ~${Math.round(res.probability * 100)}% Match
            </span>
          </div>
          <p style="color: var(--text-secondary); font-size: var(--text-sm); line-height: var(--leading-relaxed); margin-bottom: var(--space-4);">
            ${escapeHTML(res.description)}
          </p>
          <div style="background: rgba(13, 139, 212, 0.08); border-left: 3px solid var(--primary-400); padding: var(--space-3) var(--space-4); border-radius: 4px; font-size: var(--text-xs); color: var(--text-primary);">
            <strong>Recommended Action:</strong> ${escapeHTML(res.action)}
          </div>
        </div>
      `).join('');
    }

    showToast('Differential diagnosis guidance generated.', 'success');
  }

  updateWizardBar(step) {
    $$('.wizard-step').forEach((el, idx) => {
      if (idx + 1 === step) {
        el.className = 'wizard-step active';
      } else if (idx + 1 < step) {
        el.className = 'wizard-step completed';
      } else {
        el.className = 'wizard-step';
      }
    });
  }

  resetChecker() {
    this.selectedSymptoms.clear();
    this.answers = {};
    this.currentStep = 1;

    const step1 = $('#checker-step-1');
    const step2 = $('#checker-step-2');
    const step3 = $('#checker-step-3');

    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');
    if (step3) step3.classList.add('hidden');

    this.updateWizardBar(1);
    this.renderSymptomOptions();
    this.updateSelectedCounter();
    showToast('Symptom Checker reset.', 'info');
  }
}
