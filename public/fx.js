/* ============ STACK FX — premium micro-interactions ============ */

(function () {
  'use strict';

  // ============ 1. MAGNETIC BUTTONS (send, btn-primary) ============
  // Кнопка слегка притягивается к курсору — эффект магнита
  function initMagnetic() {
    document.addEventListener('mousemove', (e) => {
      document.querySelectorAll('.send-btn, .btn-primary:not(.no-magnet)').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        const dist = Math.hypot(dx, dy);
        const radius = 120;
        if (dist < radius) {
          const pull = (1 - dist / radius) * 8;
          el.style.transform = `translate(${(dx / dist) * pull}px, ${(dy / dist) * pull}px)`;
        } else {
          el.style.transform = '';
        }
      });
    });

    document.addEventListener('mouseleave', () => {
      document.querySelectorAll('.send-btn, .btn-primary').forEach((el) => {
        el.style.transform = '';
      });
    });
  }

  // ============ 2. 3D TILT на аватарах в профиле ============
  function initTilt() {
    document.addEventListener('mousemove', (e) => {
      document.querySelectorAll('.profile-avatar').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width;
        const dy = (e.clientY - cy) / rect.height;
        const dist = Math.hypot(dx, dy);
        if (dist < 1.5) {
          const rotY = dx * 15;
          const rotX = -dy * 15;
          el.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        } else {
          el.style.transform = '';
        }
      });
    });
  }

  // ============ 3. RIPPLE на клик по menu-item, chat-item, contact-item ============
  function initRipple() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('.menu-item, .chat-item, .contact-item, .radio-item, .card-row');
      if (!target) return;
      // не добавлять ripple если отключён
      if (target.classList.contains('no-ripple')) return;

      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;

      const ripple = document.createElement('span');
      ripple.className = 'fx-ripple';
      ripple.style.cssText = `
        position: absolute;
        left: ${e.clientX - rect.left - size / 2}px;
        top: ${e.clientY - rect.top - size / 2}px;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(25, 255, 0, 0.3) 0%, transparent 70%);
        pointer-events: none;
        transform: scale(0);
        animation: fxRipple 0.7s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 0;
      `;

      const prevPos = getComputedStyle(target).position;
      if (prevPos === 'static') target.style.position = 'relative';
      const prevOverflow = getComputedStyle(target).overflow;
      if (prevOverflow !== 'hidden') target.style.overflow = 'hidden';

      target.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    });
  }

  // ============ 4. SPARKLES при отправке сообщения ============
  function sparkBurst(x, y, color = '#19ff00') {
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      const angle = (Math.PI * 2 * i) / 10;
      const dist = 40 + Math.random() * 30;
      s.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: 6px;
        height: 6px;
        background: ${color};
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        box-shadow: 0 0 8px ${color};
        --dx: ${Math.cos(angle) * dist}px;
        --dy: ${Math.sin(angle) * dist}px;
        animation: fxSparkle 0.8s cubic-bezier(0.2, 0.6, 0.3, 1) forwards;
      `;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 800);
    }
  }

  function initSparkleOnSend() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.send-btn');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      sparkBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
  }

  // ============ 5. SMOOTH SCROLL для messages при новом сообщении ============
  // уже обрабатывается в app.js через scrollTop = scrollHeight

  // ============ 6. CURSOR GLOW (лёгкий шлейф) — только на desktop ============
  function initCursorGlow() {
    if (window.matchMedia('(hover: none)').matches) return;

    const glow = document.createElement('div');
    glow.className = 'fx-cursor-glow';
    glow.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(25, 255, 0, 0.08) 0%, transparent 60%);
      pointer-events: none;
      z-index: 0;
      transform: translate(-50%, -50%);
      transition: opacity 0.3s;
      opacity: 0;
      mix-blend-mode: screen;
    `;
    document.body.appendChild(glow);

    let rafId = null;
    let tx = 0, ty = 0, x = 0, y = 0;

    document.addEventListener('mousemove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
      glow.style.opacity = '1';
      if (!rafId) loop();
    });

    document.addEventListener('mouseleave', () => {
      glow.style.opacity = '0';
    });

    function loop() {
      x += (tx - x) * 0.15;
      y += (ty - y) * 0.15;
      glow.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      if (Math.hypot(tx - x, ty - y) > 0.5) {
        rafId = requestAnimationFrame(loop);
      } else {
        rafId = null;
      }
    }
  }

  // ============ 7. Инжект стилей для анимаций ============
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fxRipple {
      to { transform: scale(1); opacity: 0; }
    }
    @keyframes fxSparkle {
      0% {
        transform: translate(0, 0) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate(var(--dx), var(--dy)) scale(0);
        opacity: 0;
      }
    }
    .send-btn, .btn-primary {
      transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1.2), box-shadow 0.3s !important;
    }
    .profile-avatar {
      transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1.2) !important;
      transform-style: preserve-3d;
    }
    @media (prefers-reduced-motion: reduce) {
      .fx-cursor-glow, .fx-ripple { display: none !important; }
    }
  `;
  document.head.appendChild(style);

  // ============ Инициализация ============
  function init() {
    if (window.matchMedia('(hover: hover)').matches) {
      initMagnetic();
      initTilt();
      initCursorGlow();
    }
    initRipple();
    initSparkleOnSend();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
