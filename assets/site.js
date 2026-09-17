/**
 * ConSentinel Shared Motion & Interaction Runtime
 */
window.ConSentinel = (() => {
  const d = document.documentElement;
  const isReduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const EXPO = 'cubic-bezier(.16,1,.3,1)';
  const SOFT = 'cubic-bezier(.22,.7,.25,1)';
  const GLASS = 'cubic-bezier(.2,.75,.28,1)';

  const s = matchMedia('(max-width: 640px)').matches ? 0.86 : 1;
  const running = [];

  const getEl = (el) => {
    if (typeof el === 'string') return document.querySelector(el);
    return el;
  };

  const animate = (el, keyframes, delay, dur, easing) => {
    const element = getEl(el);
    if (!element) return null;
    const a = element.animate(keyframes, {
      delay: delay * s,
      duration: dur * s,
      easing: easing,
      fill: 'both'
    });
    running.push(a);
    return a;
  };

  const rise = (el, delay, dur) => animate(el, [
    { clipPath: 'inset(100% 0 -14% 0)', translate: '0 .16em' },
    { clipPath: 'inset(-18% 0 -14% 0)', translate: '0 0' }
  ], delay, dur, EXPO);

  const lift = (el, delay, dist = '.7em', dur = 560) => animate(el, [
    { opacity: 0, translate: '0 ' + dist },
    { opacity: 1, translate: '0 0' }
  ], delay, dur, SOFT);

  const settle = (el, delay, dur = 760, from = 0.985, dist = '1.1em') => animate(el, [
    { opacity: 0, scale: from, translate: '0 ' + dist },
    { opacity: 1, scale: 1, translate: '0 0' }
  ], delay, dur, GLASS);

  const startTimeline = (timelineFn) => {
    if (!d.classList.contains('pre')) return;
    if (typeof timelineFn === 'function') {
      timelineFn({ animate, rise, lift, settle, EXPO, SOFT, GLASS, s });
    }
    Promise.all(running.map(a => (a ? a.finished.catch(() => {}) : Promise.resolve()))).then(() => {
      d.classList.remove('pre');
      running.forEach(a => a && a.cancel());
      running.length = 0;
    });
  };

  /**
   * splitReveal(el, opts) — word-by-word rise-in for section headlines/titles
   */
  const splitReveal = (target, opts = {}) => {
    const el = getEl(target);
    if (!el) return;
    if (isReduced) return;

    const text = el.textContent.trim();
    if (!text) return;

    const words = text.split(/\s+/);
    el.innerHTML = words.map(word => `<span class="w"><span class="wi">${word}</span></span>`).join(' ');

    const wis = el.querySelectorAll('.wi');
    wis.forEach(wi => {
      wi.style.clipPath = 'inset(100% 0 -14% 0)';
      wi.style.translate = '0 .16em';
    });

    const threshold = opts.threshold ?? 0.4;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          observer.unobserve(el);
          const anims = [];
          wis.forEach((wi, i) => {
            const a = wi.animate([
              { clipPath: 'inset(100% 0 -14% 0)', translate: '0 .16em' },
              { clipPath: 'inset(-18% 0 -14% 0)', translate: '0 0' }
            ], {
              duration: (opts.duration ?? 820) * s,
              delay: i * (opts.stagger ?? 40) * s,
              easing: EXPO,
              fill: 'both'
            });
            anims.push(a);
          });

          Promise.all(anims.map(a => a.finished.catch(() => {}))).then(() => {
            wis.forEach(wi => {
              wi.style.clipPath = '';
              wi.style.translate = '';
            });
          });
        }
      });
    }, { threshold });

    observer.observe(el);
  };

  /**
   * countUp(el, opts) — number roll-up for stat elements outside the hero
   */
  const countUp = (target, opts = {}) => {
    const el = getEl(target);
    if (!el) return;
    const originalText = el.textContent.trim();
    if (isReduced) return;

    const match = originalText.match(/^([0-9.,]+)(.*)$/);
    if (!match) return;

    const numStr = match[1];
    const suffix = match[2] || '';
    const hasDecimals = numStr.includes('.');
    const decimals = hasDecimals ? numStr.split('.')[1].length : 0;
    const targetVal = parseFloat(numStr.replace(/,/g, ''));
    if (isNaN(targetVal)) return;

    const duration = opts.duration ?? 1100;
    const threshold = opts.threshold ?? 0.6;

    const formatVal = (v) => {
      if (hasDecimals) {
        return v.toFixed(decimals) + suffix;
      }
      const rounded = Math.round(v);
      return (rounded >= 1000 ? rounded.toLocaleString('en-US') : rounded) + suffix;
    };

    el.textContent = formatVal(0);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          observer.unobserve(el);
          let startTime = null;

          const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const t = Math.min(1, elapsed / duration);
            const progress = 1 - Math.pow(1 - t, 3); // Eased progress curve: 1 - (1-t)^3
            const current = targetVal * progress;

            el.textContent = formatVal(current);

            if (t < 1) {
              requestAnimationFrame(step);
            } else {
              el.textContent = originalText;
            }
          };

          requestAnimationFrame(step);
        }
      });
    }, { threshold });

    observer.observe(el);
  };

  const initScrollReveals = () => {
    // Apply splitReveal to all section headings and titles outside hero
    const titles = document.querySelectorAll('main .sec-title, main .sub-title, .cta-banner-title, .split-reveal');
    titles.forEach(t => splitReveal(t));

    // Apply countUp to every .num outside the hero
    const nums = document.querySelectorAll('main .num, .about-stats-wrap .num');
    nums.forEach(n => countUp(n));
  };

  return {
    animate,
    rise,
    lift,
    settle,
    startTimeline,
    splitReveal,
    countUp,
    initScrollReveals,
    EXPO,
    SOFT,
    GLASS,
    s
  };
})();

/* Burger Menu Controller */
(() => {
  const initBurger = () => {
    const burger = document.querySelector('.burger');
    const menu = document.getElementById('site-menu');
    if (!burger || !menu) return;

    const openMenu = () => {
      burger.setAttribute('aria-expanded', 'true');
      menu.setAttribute('data-open', '');
    };

    const closeMenu = (returnFocus = false) => {
      burger.setAttribute('aria-expanded', 'false');
      menu.removeAttribute('data-open');
      if (returnFocus) burger.focus();
    };

    burger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = burger.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => closeMenu());
    });

    document.addEventListener('click', (e) => {
      if (!burger.contains(e.target) && !menu.contains(e.target)) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        closeMenu(true);
      }
    });

    const mq = matchMedia('(min-aspect-ratio: 1/1)');
    mq.addEventListener('change', (e) => {
      if (e.matches) {
        closeMenu();
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBurger);
  } else {
    initBurger();
  }
})();

/* Video Sync Controller */
(() => {
  const initVideo = () => {
    const v = document.querySelector('video.bg');
    if (!v) return;
    const q = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (q.matches) {
        v.pause();
        v.currentTime = 0;
      } else {
        v.play().catch(() => {});
      }
    };
    q.addEventListener('change', sync);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) sync();
    });
    v.addEventListener('canplay', sync);
    sync();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideo);
  } else {
    initVideo();
  }
})();

/* Auto-initialize Scroll Reveals */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.ConSentinel) window.ConSentinel.initScrollReveals();
  });
} else {
  if (window.ConSentinel) window.ConSentinel.initScrollReveals();
}
