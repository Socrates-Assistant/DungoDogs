'use strict';

/* ============================================================
   NAVIGATION
   ============================================================ */

const nav        = document.getElementById('nav');
const hamburger  = document.getElementById('hamburger');
const navMenu    = document.getElementById('nav-menu');
const navLinks   = document.querySelectorAll('.nav__link');

// Sticky nav — add .scrolled class after 80px
function handleNavScroll() {
  nav.classList.toggle('scrolled', window.scrollY > 80);
}
window.addEventListener('scroll', handleNavScroll, { passive: true });
handleNavScroll();

// Mobile hamburger toggle
function openMenu() {
  navMenu.classList.add('open');
  hamburger.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  navMenu.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

hamburger.addEventListener('click', () => {
  const isOpen = navMenu.classList.contains('open');
  isOpen ? closeMenu() : openMenu();
});

// Close menu when a nav link is clicked
navMenu.addEventListener('click', (e) => {
  if (e.target.closest('a')) closeMenu();
});

// Close menu on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navMenu.classList.contains('open')) closeMenu();
});

/* ============================================================
   SMOOTH SCROLL
   ============================================================ */

document.addEventListener('click', (e) => {
  const anchor = e.target.closest('a[href^="#"]');
  if (!anchor) return;

  const target = document.querySelector(anchor.getAttribute('href'));
  if (!target) return;

  e.preventDefault();
  const navHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 72;
  const top = target.getBoundingClientRect().top + window.scrollY - navHeight + 1;

  window.scrollTo({ top, behavior: 'smooth' });
});

/* ============================================================
   SCROLL ANIMATIONS (Intersection Observer)
   ============================================================ */

const animateEls = document.querySelectorAll('.animate-on-scroll');

const animateObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      animateObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px',
});

// Stagger siblings within the same parent
animateEls.forEach((el, i) => {
  // Apply stagger delay if siblings share same parent container
  const siblings = Array.from(el.parentElement.querySelectorAll('.animate-on-scroll'));
  if (siblings.length > 1) {
    const idx = siblings.indexOf(el);
    el.style.transitionDelay = `${idx * 0.1}s`;
  }
  animateObserver.observe(el);
});

// Trigger hero elements immediately on load (already in viewport)
window.addEventListener('load', () => {
  document.querySelectorAll('.hero .animate-on-scroll').forEach((el) => {
    el.classList.add('visible');
  });
});

/* ============================================================
   ACTIVE NAV LINK (Intersection Observer)
   ============================================================ */

const sections = document.querySelectorAll('main section[id]');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const id = entry.target.id;
    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href === `#${id}`) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  });
}, {
  threshold: 0.4,
  rootMargin: `-${72}px 0px 0px 0px`,
});

sections.forEach((s) => sectionObserver.observe(s));

