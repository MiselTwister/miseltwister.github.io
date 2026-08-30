(function () {
  'use strict';

  var FAVOURITE_TRACK = {
    title: 'Whiskey Roll - GBX & Outforce Remix',
    artist: 'Cammy Barnes, GBX, Outforce',
    url: 'https://open.spotify.com/track/6jcSzPfu5nhvcovTjdb3eu'
  };

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  function reveal() {
    var items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || reduced) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('is-in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  function unfold() {
    var stack = document.querySelector('.hero__stack');
    if (!stack || reduced) return;
    if (window.matchMedia('(max-width: 40em)').matches) return;

    var MAX = 15;
    var ticking = false;

    function apply() {
      ticking = false;
      var rect = stack.getBoundingClientRect();
      var start = window.innerHeight * 0.95;
      var end = window.innerHeight * 0.28;
      var p = (start - rect.top) / (start - end);
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      var eased = 1 - Math.pow(1 - p, 3);
      stack.style.setProperty('--unfold', (MAX * (1 - eased)).toFixed(2) + 'deg');
      stack.style.setProperty('--unfold-scale', (0.965 + 0.035 * eased).toFixed(4));
    }

    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  function spotlight() {
    if (!fine) return;
    document.querySelectorAll('.project, .card, .stack__group, .contact').forEach(function (el) {
      el.classList.add('spotlight');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  function tilt() {
    if (!fine || reduced) return;
    var MAX = 3.5;
    document.querySelectorAll('.project:not(.project--off)').forEach(function (card) {
      var raf = null, nx = 0, ny = 0;

      function paint() {
        raf = null;
        card.style.setProperty('--rx', (-ny * MAX).toFixed(2) + 'deg');
        card.style.setProperty('--ry', (nx * MAX).toFixed(2) + 'deg');
      }

      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        nx = (e.clientX - r.left) / r.width - 0.5;
        ny = (e.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(paint);
      });

      card.addEventListener('pointerleave', function () {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  function telemetry() {
    var el = document.getElementById('siteHud');
    if (!el) return;
    if (window.matchMedia('(max-width: 40em)').matches) return;
    if (store('tomas.hud') === 'off') return;

    var SEGMENTS = 20;
    var IDLE_MS = 3500;

    var out = {
      scroll: el.querySelector('[data-hud="scroll"]'),
      fps: el.querySelector('[data-hud="fps"]'),
      session: el.querySelector('[data-hud="session"]'),
      viewport: el.querySelector('[data-hud="viewport"]')
    };

    var barHost = el.querySelector('[data-hud="bar"]');
    var segs = [];
    for (var i = 0; i < SEGMENTS; i++) {
      var seg = document.createElement('span');
      seg.className = 'hud__seg';
      barHost.appendChild(seg);
      segs.push(seg);
    }

    var began = Date.now();
    var running = false;
    var frames = 0;
    var mark = 0;
    var idleTimer = null;
    var scrollTicking = false;
    var lastLit = -1;

    function depth() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return 100;
      var p = (window.pageYOffset || doc.scrollTop) / max * 100;
      return p < 0 ? 0 : p > 100 ? 100 : p;
    }

    function paintScroll() {
      scrollTicking = false;
      var p = depth();
      out.scroll.textContent = Math.round(p);
      var lit = Math.round(p / 100 * SEGMENTS);
      if (lit === lastLit) return;
      lastLit = lit;
      for (var i = 0; i < SEGMENTS; i++) segs[i].classList.toggle('is-lit', i < lit);
    }

    function paintSession() {
      var s = Math.floor((Date.now() - began) / 1000);
      var m = Math.floor(s / 60);
      out.session.textContent = m + ':' + String(s % 60).padStart(2, '0');
    }

    function paintViewport() {
      out.viewport.textContent = window.innerWidth + '×' + window.innerHeight;
    }

    function loop(now) {
      if (!running) return;
      frames++;
      if (now - mark >= 500) {
        out.fps.textContent = Math.round(frames * 1000 / (now - mark));
        frames = 0;
        mark = now;
        paintSession();
      }
      requestAnimationFrame(loop);
    }

    function sleep() {
      if (playerOpen && playerOpen()) return;
      running = false;
      el.classList.add('is-idle');
    }

    function wake() {
      el.classList.remove('is-idle');
      if (!running && !document.hidden) {
        running = true;
        frames = 0;
        mark = performance.now();
        requestAnimationFrame(loop);
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(sleep, IDLE_MS);
    }

    function onScroll() {
      if (!scrollTicking) { scrollTicking = true; requestAnimationFrame(paintScroll); }
      wake();
    }

    el.querySelector('[data-hud-close]').addEventListener('click', function () {
      sleep();
      clearTimeout(idleTimer);
      store('tomas.hud', 'off');
      setTimeout(function () { el.hidden = true; }, 500);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) sleep(); else wake();
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('keydown', wake);
    window.addEventListener('resize', function () { paintViewport(); paintScroll(); wake(); }, { passive: true });

    paintViewport();
    paintScroll();
    paintSession();

    var playerOpen = favourite();

    setTimeout(function () { el.hidden = false; wake(); }, 900);
  }

  function favourite() {
    var el = document.querySelector('[data-hud="now"]');
    var panel = document.querySelector('[data-hud="player"]');
    if (!el || !panel) return function () { return false; };

    var track = FAVOURITE_TRACK || {};
    if (!track.title) return function () { return false; };

    el.querySelector('[data-hud="now-title"]').textContent = track.title;
    el.querySelector('[data-hud="now-artist"]').textContent = track.artist || '';

    var full = track.title + (track.artist ? ' by ' + track.artist : '');
    el.setAttribute('aria-label', 'On repeat: ' + full + '. Play it here.');
    el.setAttribute('title', 'On repeat: ' + full);
    el.hidden = false;

    var id = null;
    var match = /\/track\/([A-Za-z0-9]+)/.exec(track.url || '');
    if (match) id = match[1];

    if (!id) {
      el.setAttribute('aria-expanded', 'false');
      el.removeAttribute('aria-controls');
      el.disabled = true;
      return function () { return false; };
    }

    var open = false;
    var built = false;

    function build() {
      if (built) return;
      built = true;
      var frame = document.createElement('iframe');
      frame.src = 'https://open.spotify.com/embed/track/' + id + '?theme=0';
      frame.width = '100%';
      frame.height = '80';
      frame.loading = 'lazy';
      frame.setAttribute('frameborder', '0');
      frame.setAttribute('title', 'Spotify player: ' + full);
      frame.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
      panel.appendChild(frame);

      var out = document.createElement('a');
      out.className = 'hud__out';
      out.href = track.url;
      out.target = '_blank';
      out.rel = 'noopener noreferrer';
      out.textContent = 'Open in Spotify';
      panel.appendChild(out);
    }

    function toggle() {
      open = !open;
      el.setAttribute('aria-expanded', String(open));
      el.setAttribute('aria-label', open
        ? 'Hide the player for ' + full
        : 'On repeat: ' + full + '. Play it here.');
      el.setAttribute('title', open ? 'Hide player' : 'On repeat: ' + full);
      if (open) {
        build();
        panel.hidden = false;
      } else {
        panel.hidden = true;
      }
    }

    el.addEventListener('click', toggle);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) { toggle(); el.focus(); }
    });

    return function () { return open; };
  }

  function start() { reveal(); unfold(); spotlight(); tilt(); telemetry(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
