/* ============================================
   MediScan AI — First Aid & Emergency Guide Module
   ============================================ */

import { $, $$, showToast, escapeHTML } from './utils.js';

export class FirstAidGuide {
  constructor() {
    this.scenarios = [];
    this.categories = [];
    this.cprTimer = null;
    this.isBeating = false;
  }

  async init() {
    try {
      const res = await fetch('./data/first-aid.json');
      const data = await res.json();
      this.scenarios = data.scenarios || [];
      this.categories = data.categories || [];
      
      this.renderScenarios(this.scenarios);
      this.bindEvents();
    } catch (e) {
      console.error('Failed to load first aid data', e);
    }
  }

  bindEvents() {
    const searchInput = $('#first-aid-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        this.filterScenarios(q);
      });
    }

    const cprBtn = $('#toggle-cpr-metronome');
    if (cprBtn) {
      cprBtn.addEventListener('click', () => this.toggleCPRMetronome());
    }
  }

  filterScenarios(query) {
    if (!query) {
      this.renderScenarios(this.scenarios);
      return;
    }
    const filtered = this.scenarios.filter(s => 
      s.name.toLowerCase().includes(query) || 
      s.description.toLowerCase().includes(query) ||
      s.category.toLowerCase().includes(query)
    );
    this.renderScenarios(filtered);
  }

  renderScenarios(list) {
    const grid = $('#first-aid-grid');
    if (!grid) return;

    if (list.length === 0) {
      grid.innerHTML = `<div class="card text-center" style="grid-column: 1/-1; padding: 40px;">No first aid protocols found matching your query.</div>`;
      return;
    }

    grid.innerHTML = list.map(sc => `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="icon-box" style="background: ${sc.severity === 'emergency' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}; color: ${sc.severity === 'emergency' ? 'var(--danger)' : 'var(--warning)'};">
              <i data-lucide="${sc.icon || 'alert-circle'}"></i>
            </div>
            <div>
              <h3 style="font-size: var(--text-lg); font-weight: 700;">${escapeHTML(sc.name)}</h3>
              <span class="badge ${sc.severity === 'emergency' ? 'badge-danger' : 'badge-warning'}">${sc.severity.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <p style="font-size: var(--text-sm); color: var(--text-secondary); line-height: var(--leading-relaxed); margin-bottom: var(--space-4);">
          ${escapeHTML(sc.description)}
        </p>

        ${sc.id === 'cpr' ? `
          <div class="cpr-timer-box">
            <h5 style="margin-bottom: 4px;">CPR Metronome (110 BPM)</h5>
            <p style="font-size: var(--text-xs); color: var(--text-tertiary);">Push hard and fast to the beat of "Stayin' Alive"</p>
            <div class="metronome-pulse" id="cpr-pulse-indicator">110</div>
            <button class="btn btn-danger btn-sm" id="toggle-cpr-metronome">
              ${this.isBeating ? 'Stop Metronome' : 'Start CPR Beat'}
            </button>
          </div>
        ` : ''}

        <div style="margin-top: var(--space-4);">
          <h4 style="font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); margin-bottom: var(--space-2);">Action Steps:</h4>
          <div class="scenario-steps-list">
            ${sc.steps.map((st, i) => `
              <div class="scenario-step-item">
                <span class="step-num-badge">${i + 1}</span>
                <span>${escapeHTML(st)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        ${sc.doNot ? `
          <div style="margin-top: var(--space-4); background: rgba(239, 68, 68, 0.08); border-left: 3px solid var(--danger); padding: var(--space-3); border-radius: 4px;">
            <h5 style="font-size: var(--text-xs); color: var(--danger); text-transform: uppercase; margin-bottom: 4px;">DO NOT:</h5>
            <ul style="font-size: var(--text-xs); color: var(--text-secondary); padding-left: 16px; list-style-type: disc;">
              ${sc.doNot.map(dn => `<li>${escapeHTML(dn)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons({ targets: [grid] });

    const cprBtn = $('#toggle-cpr-metronome');
    if (cprBtn) {
      cprBtn.addEventListener('click', () => this.toggleCPRMetronome());
    }
  }

  toggleCPRMetronome() {
    this.isBeating = !this.isBeating;
    const pulseEl = $('#cpr-pulse-indicator');
    const btn = $('#toggle-cpr-metronome');

    if (this.isBeating) {
      if (pulseEl) pulseEl.classList.add('beating');
      if (btn) btn.textContent = 'Stop Metronome';
      showToast('CPR Metronome Started (110 compressions/min rhythm)', 'info');
    } else {
      if (pulseEl) pulseEl.classList.remove('beating');
      if (btn) btn.textContent = 'Start CPR Beat';
      showToast('CPR Metronome Stopped', 'info');
    }
  }
}
