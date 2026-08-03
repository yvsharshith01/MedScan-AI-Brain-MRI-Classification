/* ============================================
   MediScan AI — Main App Controller & Router
   ============================================ */

import { $, $$, showToast, initAmbientParticleCanvas } from './utils.js';
import { ImageAnalyzer } from './image-analyzer.js';
import { SymptomChecker } from './symptom-checker.js';
import { MedicationDB } from './medication-db.js';
import { FirstAidGuide } from './first-aid.js';
import { HealthTips } from './health-tips.js';

class App {
  constructor() {
    this.analyzer = new ImageAnalyzer();
    this.symptomChecker = new SymptomChecker();
    this.medicationDB = new MedicationDB();
    this.firstAid = new FirstAidGuide();
    this.healthTips = new HealthTips();

    this.currentView = 'dashboard';
  }

  async init() {
    console.log('🏥 Initializing MediScan AI Medical Assistant...');

    // Initialize ambient particle canvas
    initAmbientParticleCanvas();

    // Initialize sub-modules
    await this.analyzer.init();
    await this.symptomChecker.init();
    await this.medicationDB.init();
    await this.firstAid.init();
    await this.healthTips.init();

    // Bind navigation & hash routing
    this.bindNavigation();
    this.handleRoute();

    // Initialize Lucide Icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  bindNavigation() {
    // Hash change handler
    window.addEventListener('hashchange', () => this.handleRoute());

    // Nav links click
    $$('.nav-link, [data-navigate]').forEach(el => {
      el.addEventListener('click', (e) => {
        const targetView = el.dataset.navigate || el.getAttribute('href')?.replace('#', '');
        if (targetView) {
          e.preventDefault();
          window.location.hash = targetView;
        }
      });
    });
  }

  handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.switchView(hash);
  }

  switchView(viewId) {
    const views = $$('.page-view');
    const links = $$('.nav-link');

    let targetView = $(`#view-${viewId}`);
    if (!targetView) {
      viewId = 'dashboard';
      targetView = $('#view-dashboard');
    }

    views.forEach(v => v.classList.remove('active'));
    links.forEach(l => l.classList.remove('active'));

    if (targetView) {
      targetView.classList.add('active');
    }

    const activeLink = $(`[data-navigate="${viewId}"], .nav-link[href="#${viewId}"]`);
    if (activeLink) activeLink.classList.add('active');

    this.currentView = viewId;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh lucide icons on view change
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

// Instantiate and initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
