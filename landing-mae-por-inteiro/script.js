/* ========== LUCIDE ICONS ========== */
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  /* ========== NAVBAR & FAB SCROLL ========== */
  const navbar = document.getElementById('navbar');
  const backToTop = document.getElementById('backToTop');
  const floatingFab = document.getElementById('floatingFab');
  const ctaSection = document.getElementById('inscricao');

  // Esconde o FAB quando a seção de inscrição estiver visível
  // (evita duplicar o CTA quando o usuário já está olhando para o botão grande)
  let ctaInView = false;
  if (floatingFab && ctaSection && 'IntersectionObserver' in window) {
    const ctaObserver = new IntersectionObserver((entries) => {
      ctaInView = entries[0].isIntersecting;
      floatingFab.classList.toggle('visible', !ctaInView);
    }, { threshold: 0.2 });
    ctaObserver.observe(ctaSection);
  }

  function handleScroll() {
    const y = window.scrollY;
    if (navbar) navbar.classList.toggle('scrolled', y > 60);
    if (backToTop) backToTop.classList.toggle('visible', y > 500);
    // FAB visível durante toda a navegação, exceto quando o CTA já está em tela
    if (floatingFab) floatingFab.classList.toggle('visible', !ctaInView);
  }

  window.addEventListener('scroll', handleScroll);
  handleScroll(); // Checagem inicial (caso já esteja scrollado ao carregar)

  // Mostra o FAB imediatamente ao carregar a página
  if (floatingFab) floatingFab.classList.add('visible');

  /* ========== MOBILE NAV ========== */
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      links.classList.toggle('active');
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      toggle.classList.remove('active');
      links.classList.remove('active');
    }));
  }

  /* ========== BACK TO TOP ========== */
  if (backToTop) {
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ========== SCROLL ANIMATIONS ========== */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = parseFloat(entry.target.dataset.delay || 0);
        setTimeout(() => entry.target.classList.add('animated'), delay * 1000);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

  /* ========== COUNTER ANIMATION ========== */
  const counters = document.querySelectorAll('[data-count]');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count);
        let current = 0;
        const step = Math.max(1, Math.floor(target / 40));
        const timer = setInterval(() => {
          current += step;
          if (current >= target) { current = target; clearInterval(timer); }
          el.textContent = current;
        }, 30);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => counterObserver.observe(c));

  /* ========== COUNTDOWN ========== */
  const countDaysEl = document.getElementById('countDays');
  const countHoursEl = document.getElementById('countHours');
  const countMinutesEl = document.getElementById('countMinutes');
  const countSecondsEl = document.getElementById('countSeconds');

  if (countDaysEl && countHoursEl && countMinutesEl && countSecondsEl) {
    // Encerramento das inscrições: 13/05/2026 às 23:59:59 (horário de Brasília)
    const deadline = new Date('2026-05-13T23:59:59-03:00').getTime();
    function updateCountdown() {
      const now = Date.now();
      const diff = deadline - now;
      if (diff <= 0) {
        // Inscrições encerradas
        countDaysEl.textContent = '00';
        countHoursEl.textContent = '00';
        countMinutesEl.textContent = '00';
        countSecondsEl.textContent = '00';
        const label = document.getElementById('countdownLabel');
        if (label) label.textContent = 'Inscrições encerradas';
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      countDaysEl.textContent = String(d).padStart(2, '0');
      countHoursEl.textContent = String(h).padStart(2, '0');
      countMinutesEl.textContent = String(m).padStart(2, '0');
      countSecondsEl.textContent = String(s).padStart(2, '0');
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  /* ========== PARTICLE CANVAS ========== */
  const canvas = document.getElementById('particleCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let w, h;
    function resize() {
      w = canvas.width = canvas.parentElement.offsetWidth;
      h = canvas.height = canvas.parentElement.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    const symbols = ['🌷', '💛', '✨', '🌸', '💐', '🦋'];
    for (let i = 0; i < 25; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 12 + Math.random() * 16,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        speedY: -0.2 - Math.random() * 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        opacity: 0.15 + Math.random() * 0.35,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.01 + Math.random() * 0.02
      });
    }

    function animate() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => {
        p.y += p.speedY;
        p.wobble += p.wobbleSpeed;
        p.x += Math.sin(p.wobble) * 0.5 + p.speedX;
        if (p.y < -30) { p.y = h + 30; p.x = Math.random() * w; }
        if (p.x < -30) p.x = w + 30;
        if (p.x > w + 30) p.x = -30;
        ctx.globalAlpha = p.opacity;
        ctx.font = p.size + 'px serif';
        ctx.fillText(p.symbol, p.x, p.y);
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(animate);
    }
    animate();
  }

  /* ========== HERO PARALLAX (animações de entrada via [data-animate] no CSS) ========== */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.to('.hero-bg-image', {
      y: 100, scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }

  /* ========== SMOOTH ANCHOR LINKS ========== */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const id = anchor.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
