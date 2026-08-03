/* ============================================
   MediScan AI — Shared Utilities
   ============================================ */

export const $ = (selector, context = document) => context.querySelector(selector);
export const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

/**
 * Creates an HTML element from an HTML string
 */
export function createElementFromHTML(htmlString) {
  const div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  return div.firstElementChild;
}

/**
 * Toast Notification System
 */
export function showToast(message, type = 'info', duration = 3000) {
  let container = $('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    info: 'info',
    success: 'check-circle',
    warning: 'alert-triangle',
    danger: 'alert-circle'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i data-lucide="${icons[type] || 'info'}"></i>
    <span>${escapeHTML(message)}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons({ targets: [toast] });

  setTimeout(() => {
    toast.style.animation = 'slideOutToRight 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * HTML Escaper to prevent XSS
 */
export function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Simple Fuzzy Match Score (0 to 1)
 */
export function fuzzyMatch(pattern, str) {
  pattern = pattern.toLowerCase();
  str = str.toLowerCase();
  
  if (str.includes(pattern)) return 1.0;
  
  let patternIdx = 0;
  let strIdx = 0;
  let matches = 0;

  while (patternIdx < pattern.length && strIdx < str.length) {
    if (pattern[patternIdx] === str[strIdx]) {
      matches++;
      patternIdx++;
    }
    strIdx++;
  }

  return matches / pattern.length;
}

/**
 * Debounce Function
 */
export function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Interactive Ambient Particle Canvas Engine
 */
export function initAmbientParticleCanvas() {
  const canvas = document.getElementById('ambient-particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  const particles = [];
  const particleCount = Math.min(Math.floor(width * 0.035), 45);

  let mouse = { x: null, y: null, radius: 160 };

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
  });

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.radius = Math.random() * 2 + 1;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.baseAlpha = Math.random() * 0.4 + 0.2;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0) this.x = width;
      if (this.x > width) this.x = 0;
      if (this.y < 0) this.y = height;
      if (this.y > height) this.y = 0;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(13, 139, 212, ${this.baseAlpha})`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(0, 199, 138, 0.4)';
      ctx.fill();
    }
  }

  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();

      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 130) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(13, 139, 212, ${0.22 * (1 - dist / 130)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      if (mouse.x !== null && mouse.y !== null) {
        const dx = particles[i].x - mouse.x;
        const dy = particles[i].y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(0, 199, 138, ${0.35 * (1 - dist / mouse.radius)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();
}

/**
 * LocalStorage wrapper with fallback
 */
export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }
};

/**
 * Returns HTML badge string for symptom/clinical severity level
 */
export function getSeverityBadge(severity) {
  const map = {
    immediate: '<span class="badge badge-danger">Immediate Care</span>',
    urgent: '<span class="badge badge-warning">Urgent Care</span>',
    routine: '<span class="badge badge-info">Routine Consultation</span>',
    selfcare: '<span class="badge badge-success">Self-Care</span>'
  };
  return map[String(severity).toLowerCase()] || '<span class="badge badge-secondary">Routine</span>';
}

