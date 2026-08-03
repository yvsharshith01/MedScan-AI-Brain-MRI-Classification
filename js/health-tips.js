/* ============================================
   MediScan AI — Health & Wellness Module
   ============================================ */

import { $, $$, showToast, escapeHTML, storage } from './utils.js';

export class HealthTips {
  constructor() {
    this.categories = [];
    this.dailyFacts = [];
    this.bmiData = null;
    this.waterGlassCount = storage.get('hydration_count', 0);
  }

  async init() {
    try {
      const res = await fetch('./data/health-tips.json');
      const data = await res.json();
      this.categories = data.categories || [];
      this.dailyFacts = data.dailyFacts || [];
      this.bmiData = data.bmiData || null;

      this.renderDailyFact();
      this.renderHydrationTracker();
      this.renderTips();
      this.bindEvents();
    } catch (e) {
      console.error('Failed to load health tips', e);
    }
  }

  bindEvents() {
    const bmiForm = $('#bmi-calculator-form');
    if (bmiForm) {
      bmiForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.calculateBMI();
      });
    }

    const addWaterBtn = $('#add-water-btn');
    const resetWaterBtn = $('#reset-water-btn');

    if (addWaterBtn) {
      addWaterBtn.addEventListener('click', () => {
        this.waterGlassCount++;
        storage.set('hydration_count', this.waterGlassCount);
        this.renderHydrationTracker();
      });
    }

    if (resetWaterBtn) {
      resetWaterBtn.addEventListener('click', () => {
        this.waterGlassCount = 0;
        storage.set('hydration_count', 0);
        this.renderHydrationTracker();
      });
    }
  }

  renderDailyFact() {
    const factText = $('#daily-fact-text');
    if (!factText || this.dailyFacts.length === 0) return;

    const todayIdx = new Date().getDate() % this.dailyFacts.length;
    factText.textContent = `"${this.dailyFacts[todayIdx]}"`;
  }

  renderHydrationTracker() {
    const countEl = $('#water-count-display');
    const progressFill = $('#hydration-progress-fill');
    const target = 8;

    if (countEl) countEl.textContent = `${this.waterGlassCount} / ${target} Glasses (${this.waterGlassCount * 250} ml)`;
    if (progressFill) {
      const pct = Math.min(100, (this.waterGlassCount / target) * 100);
      progressFill.style.width = `${pct}%`;
    }
  }

  calculateBMI() {
    const weight = parseFloat($('#bmi-weight-input')?.value);
    const heightCm = parseFloat($('#bmi-height-input')?.value);

    if (!weight || !heightCm || weight <= 0 || heightCm <= 0) {
      showToast('Please enter valid height and weight values.', 'warning');
      return;
    }

    const heightM = heightCm / 100;
    const bmi = weight / (heightM * heightM);

    let catObj = { label: 'Unknown', color: '#fff', description: '' };
    if (this.bmiData && this.bmiData.categories) {
      catObj = this.bmiData.categories.find(c => bmi >= c.range[0] && bmi <= c.range[1]) || catObj;
    }

    const resultBox = $('#bmi-result-display');
    if (resultBox) {
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `
        <div style="font-size: var(--text-4xl); font-weight: 800; font-family: var(--font-family-heading); color: ${catObj.color};">
          ${bmi.toFixed(1)}
        </div>
        <div style="font-size: var(--text-lg); font-weight: 700; color: ${catObj.color}; margin-bottom: 4px;">
          ${escapeHTML(catObj.label)}
        </div>
        <p style="font-size: var(--text-xs); color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
          ${escapeHTML(catObj.description)}
        </p>
      `;
    }

    showToast(`BMI Calculated: ${bmi.toFixed(1)} (${catObj.label})`, 'info');
  }

  renderTips() {
    const grid = $('#health-tips-grid');
    if (!grid) return;

    let allTips = [];
    this.categories.forEach(cat => {
      cat.tips.forEach(t => {
        allTips.push({ ...t, categoryName: cat.name, color: cat.color });
      });
    });

    grid.innerHTML = allTips.map(tip => `
      <div class="card hover-lift">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
          <span class="badge" style="background: ${tip.color}20; color: ${tip.color}; border: 1px solid ${tip.color}40;">
            ${escapeHTML(tip.categoryName)}
          </span>
        </div>
        <h3 style="font-size: var(--text-lg); font-weight: 700; margin-bottom: var(--space-2);">${escapeHTML(tip.title)}</h3>
        <p style="font-size: var(--text-sm); color: var(--text-secondary); line-height: var(--leading-relaxed);">
          ${escapeHTML(tip.content)}
        </p>
      </div>
    `).join('');
  }
}
