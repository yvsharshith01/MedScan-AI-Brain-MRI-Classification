/* ============================================
   MediScan AI — Medication Database & Interaction Checker
   ============================================ */

import { $, $$, showToast, escapeHTML, fuzzyMatch } from './utils.js';

export class MedicationDB {
  constructor() {
    this.medications = [];
    this.interactionPairs = [];
    this.categories = [];
    this.selectedForInteraction = new Set();
  }

  async init() {
    try {
      const res = await fetch('./data/medications.json');
      const data = await res.json();
      this.medications = data.medications || [];
      this.interactionPairs = data.interactionPairs || [];
      this.categories = data.categories || [];
      
      this.renderCategories();
      this.renderMedications(this.medications);
      this.bindEvents();
    } catch (e) {
      console.error('Failed to load medications database', e);
    }
  }

  bindEvents() {
    const searchInput = $('#med-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        this.searchMedications(q);
      });
    }

    const checkBtn = $('#check-interactions-btn');
    if (checkBtn) {
      checkBtn.addEventListener('click', () => this.checkInteractions());
    }

    const clearBtn = $('#clear-interaction-list');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.selectedForInteraction.clear();
        this.updateInteractionChips();
      });
    }
  }

  renderCategories() {
    const container = $('#med-categories-bar');
    if (!container) return;

    container.innerHTML = `
      <button class="chip active" data-cat="all">All Categories</button>
      ${this.categories.map(c => `
        <button class="chip" data-cat="${c.id}">${c.name}</button>
      `).join('')}
    `;

    $$('.chip', container).forEach(chip => {
      chip.addEventListener('click', () => {
        $$('.chip', container).forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const cat = chip.dataset.cat;
        this.filterByCategory(cat);
      });
    });
  }

  filterByCategory(catId) {
    if (catId === 'all') {
      this.renderMedications(this.medications);
    } else {
      const filtered = this.medications.filter(m => {
        const catName = this.categories.find(c => c.id === catId)?.name.toLowerCase() || '';
        return m.category.toLowerCase().includes(catName) || m.id.includes(catId);
      });
      this.renderMedications(filtered);
    }
  }

  searchMedications(query) {
    if (!query) {
      this.renderMedications(this.medications);
      return;
    }
    const filtered = this.medications.filter(m => 
      fuzzyMatch(query, m.name) > 0.4 || 
      fuzzyMatch(query, m.genericName) > 0.4 ||
      m.uses.some(u => fuzzyMatch(query, u) > 0.4)
    );
    this.renderMedications(filtered);
  }

  renderMedications(list) {
    const grid = $('#medications-grid');
    if (!grid) return;

    if (list.length === 0) {
      grid.innerHTML = `<div class="card text-center" style="grid-column: 1/-1; padding: 40px;">No medications found matching your search.</div>`;
      return;
    }

    grid.innerHTML = list.map(med => {
      const isSelected = this.selectedForInteraction.has(med.id);
      return `
        <div class="card med-card">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-2);">
              <div>
                <span class="badge ${med.type === 'OTC' ? 'badge-success' : 'badge-info'}">${med.type}</span>
                <h3 style="font-size: var(--text-lg); font-weight: 700; margin-top: 4px;">${escapeHTML(med.name)}</h3>
              </div>
            </div>
            <p style="font-size: var(--text-xs); color: var(--text-tertiary); margin-bottom: var(--space-3);">
              <strong>Generic:</strong> ${escapeHTML(med.genericName)}
            </p>
            <p style="font-size: var(--text-sm); color: var(--text-secondary); line-height: var(--leading-relaxed); margin-bottom: var(--space-4);">
              ${escapeHTML(med.description)}
            </p>

            <div style="margin-bottom: var(--space-4);">
              <span style="font-size: var(--text-xs); font-weight: 600; color: var(--text-tertiary); text-transform: uppercase;">Uses:</span>
              <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
                ${med.uses.map(u => `<span class="badge badge-neutral">${escapeHTML(u)}</span>`).join('')}
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: var(--space-4);">
            <button class="btn btn-secondary btn-sm toggle-interaction-btn ${isSelected ? 'active' : ''}" data-id="${med.id}" style="flex: 1;">
              ${isSelected ? '✓ Added to Compare' : '+ Add to Interaction Check'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    $$('.toggle-interaction-btn', grid).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (this.selectedForInteraction.has(id)) {
          this.selectedForInteraction.delete(id);
        } else {
          this.selectedForInteraction.add(id);
        }
        this.renderMedications(list);
        this.updateInteractionChips();
      });
    });
  }

  updateInteractionChips() {
    const container = $('#selected-interaction-meds');
    if (!container) return;

    const selectedMeds = this.medications.filter(m => this.selectedForInteraction.has(m.id));

    if (selectedMeds.length === 0) {
      container.innerHTML = `<span style="font-size: var(--text-xs); color: var(--text-tertiary);">No medications selected for interaction check. Click '+ Add to Interaction Check' on any drug.</span>`;
      return;
    }

    container.innerHTML = selectedMeds.map(m => `
      <span class="chip">
        ${escapeHTML(m.name)}
        <i data-lucide="x" class="chip-remove" data-id="${m.id}"></i>
      </span>
    `).join('');

    if (window.lucide) window.lucide.createIcons({ targets: [container] });

    $$('.chip-remove', container).forEach(icon => {
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedForInteraction.delete(icon.dataset.id);
        this.updateInteractionChips();
        this.renderMedications(this.medications);
      });
    });
  }

  checkInteractions() {
    if (this.selectedForInteraction.size < 2) {
      showToast('Select at least 2 medications to check for interactions.', 'warning');
      return;
    }

    const selectedIds = [...this.selectedForInteraction];
    let foundInteractions = [];

    for (let i = 0; i < selectedIds.length; i++) {
      for (let j = i + 1; j < selectedIds.length; j++) {
        const d1 = selectedIds[i];
        const d2 = selectedIds[j];
        
        const pair = this.interactionPairs.find(p => 
          (p.drug1 === d1 && p.drug2 === d2) || (p.drug1 === d2 && p.drug2 === d1)
        );

        if (pair) {
          const drug1Obj = this.medications.find(m => m.id === d1);
          const drug2Obj = this.medications.find(m => m.id === d2);
          foundInteractions.push({ ...pair, drug1Name: drug1Obj?.name, drug2Name: drug2Obj?.name });
        }
      }
    }

    const resultsBox = $('#interaction-results-output');
    if (!resultsBox) return;

    if (foundInteractions.length === 0) {
      resultsBox.innerHTML = `
        <div class="disclaimer-banner" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: var(--success);">
          <i data-lucide="check-circle"></i> No known major interactions found between selected drugs. Always confirm with your pharmacist.
        </div>
      `;
    } else {
      resultsBox.innerHTML = foundInteractions.map(inter => `
        <div class="card" style="border-left: 4px solid var(--danger); margin-bottom: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: var(--text-primary);">${escapeHTML(inter.drug1Name)} + ${escapeHTML(inter.drug2Name)}</strong>
            <span class="badge badge-danger">${inter.severity.toUpperCase()} INTERACTION</span>
          </div>
          <p style="font-size: var(--text-sm); color: var(--text-secondary); line-height: var(--leading-relaxed);">${escapeHTML(inter.description)}</p>
        </div>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons({ targets: [resultsBox] });
    showToast(`Found ${foundInteractions.length} potential drug interaction(s).`, foundInteractions.length > 0 ? 'warning' : 'success');
  }
}
