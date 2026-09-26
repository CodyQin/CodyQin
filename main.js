// Theme: follow system preference, allow manual toggle, persist choice
(function () {
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);

  const toggle = document.getElementById("themeToggle");
  const setIcon = (t) => (toggle.textContent = t === "dark" ? "☀️" : "🌙");
  setIcon(theme);

  toggle.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setIcon(next);
  });
})();

// Reveal cards on scroll
(function () {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.08 }
  );
  els.forEach((el) => io.observe(el));
})();

// Scroll-spy for nav highlighting
(function () {
  const links = [...document.querySelectorAll(".nav-links a")];
  const sections = links
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  if (!sections.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((a) =>
            a.classList.toggle(
              "active",
              a.getAttribute("href") === "#" + e.target.id
            )
          );
        }
      });
    },
    { rootMargin: "-30% 0px -60% 0px" }
  );
  sections.forEach((s) => io.observe(s));
})();

// Lightbox: every .lb element (button or link) opens an enlargable overlay
// with keyboard + prev/next navigation across all .lb items on the page.
// Uses event delegation so elements added later (filmstrip clones) work too.
(function () {
  const box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Image viewer");
  box.innerHTML =
    '<button class="lb-btn lb-close" aria-label="Close">&times;</button>' +
    '<button class="lb-btn lb-prev" aria-label="Previous image">&lsaquo;</button>' +
    '<button class="lb-btn lb-next" aria-label="Next image">&rsaquo;</button>' +
    "<figure><img alt=''><figcaption></figcaption></figure>";
  document.body.appendChild(box);

  const img = box.querySelector("img");
  const cap = box.querySelector("figcaption");
  const items = () => [...document.querySelectorAll(".lb")];
  let cur = -1;

  const src = (t) => t.dataset.full || t.getAttribute("href");
  const alt = (t) =>
    (t.querySelector("img") && t.querySelector("img").alt) || t.dataset.caption || "";

  function show(i) {
    const list = items();
    cur = ((i % list.length) + list.length) % list.length;
    const t = list[cur];
    img.src = src(t);
    img.alt = alt(t);
    cap.textContent = t.dataset.caption || "";
    box.classList.add("open");
    document.documentElement.classList.add("lb-open");
    document.body.style.overflow = "hidden";
    box.querySelector(".lb-close").focus();
  }
  function close() {
    box.classList.remove("open");
    document.documentElement.classList.remove("lb-open");
    img.src = "";
    document.body.style.overflow = "";
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest(".lb");
    if (!t) return;
    e.preventDefault();
    show(items().indexOf(t));
  });
  box.querySelector(".lb-close").addEventListener("click", close);
  box.querySelector(".lb-prev").addEventListener("click", () => show(cur - 1));
  box.querySelector(".lb-next").addEventListener("click", () => show(cur + 1));
  box.addEventListener("click", (e) => {
    if (e.target === box) close();
  });
  document.addEventListener("keydown", (e) => {
    if (!box.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(cur - 1);
    else if (e.key === "ArrowRight") show(cur + 1);
  });
})();

// Life filmstrip: auto-scrolls to the right in a seamless loop, pauses on
// hover and while the lightbox is open, and can be dragged to browse.
(function () {
  const reel = document.getElementById("lifeReel");
  if (!reel) return;
  const track = reel.querySelector(".reel-track");
  const set = reel.querySelector(".reel-set");
  if (!track || !set) return;

  // duplicate the set for a seamless loop; clones stay out of tab order
  const clone = set.cloneNode(true);
  clone.setAttribute("aria-hidden", "true");
  clone.querySelectorAll("button").forEach((b) => b.setAttribute("tabindex", "-1"));
  track.appendChild(clone);

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const speed = 0.5; // px per frame (~30px/s)
  let setW = 0, x = 0, paused = false, dragging = false, captured = false;
  let startX = 0, startOffset = 0, moved = 0;

  const measure = () => {
    setW = set.getBoundingClientRect().width;
    x = wrap(x);
    render();
  };
  const wrap = (v) => {
    if (!setW) return v;
    while (v > 0) v -= setW;
    while (v <= -setW) v += setW;
    return v;
  };
  const render = () => { track.style.transform = "translate3d(" + x + "px,0,0)"; };

  // x lives in (-setW, 0]: the duplicate set feeds in from the left as the
  // track travels right, so the loop never shows an empty edge.
  const init = () => { setW = set.getBoundingClientRect().width; x = -setW; render(); };
  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
  set.querySelectorAll("img").forEach((im) => {
    if (!im.complete) im.addEventListener("load", init, { once: true });
  });
  window.addEventListener("resize", measure);

  const blocked = () =>
    dragging || paused || reduce ||
    document.documentElement.classList.contains("lb-open");

  (function tick() {
    if (!blocked()) { x = wrap(x + speed); render(); }
    requestAnimationFrame(tick);
  })();

  reel.addEventListener("mouseenter", () => { paused = true; });
  reel.addEventListener("mouseleave", () => { paused = false; });

  track.addEventListener("pointerdown", (e) => {
    dragging = true; captured = false; moved = 0;
    startX = e.clientX; startOffset = x;
    track.classList.add("dragging");
  });
  track.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    // capture only once this is clearly a drag — capturing at pointerdown
    // would retarget the click to the track and break lightbox opening
    if (moved > 6 && !captured) {
      captured = true;
      try { track.setPointerCapture(e.pointerId); } catch (_) {}
    }
    x = wrap(startOffset + dx);
    render();
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("dragging");
    if (captured) {
      try { track.releasePointerCapture(e.pointerId); } catch (_) {}
      captured = false;
    }
  };
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  // a drag should not end up as a click on a photo
  reel.addEventListener("click", (e) => {
    if (moved > 6) {
      e.stopPropagation();
      e.preventDefault();
      moved = 0;
    }
  }, true);
})();

// Travel map tooltip: hovering / tapping / focusing a visited country shows its name.
// Delegates on the SVG — pointerover/out bubble, unlike pointerenter/leave.
(function () {
  const svg = document.querySelector(".world-map");
  if (!svg) return;
  const tip = document.createElement("div");
  tip.className = "map-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.appendChild(tip);

  const move = (e) => {
    let x = e.clientX + 14;
    let y = e.clientY - tip.offsetHeight - 12;
    if (x + tip.offsetWidth > window.innerWidth - 8) x = e.clientX - tip.offsetWidth - 14;
    if (y < 8) y = e.clientY + 18;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  };
  const show = (path, e) => {
    tip.textContent = path.getAttribute("data-name");
    // the native <title> is the no-JS fallback; drop it so both never show at once
    const t = path.querySelector("title");
    if (t) t.remove();
    if (e) move(e);
    else {
      const r = path.getBoundingClientRect(); // keyboard focus: above the shape
      tip.style.left = Math.min(Math.max(8, r.left + r.width / 2 - 30), window.innerWidth - 60) + "px";
      tip.style.top = Math.max(8, r.top - 30) + "px";
    }
    tip.hidden = false;
  };

  svg.addEventListener("pointerover", (e) => {
    const p = e.target.closest("[data-name]");
    if (p) show(p, e);
  });
  svg.addEventListener("pointermove", (e) => {
    if (!tip.hidden) move(e);
  });
  svg.addEventListener("pointerout", (e) => {
    // touch lift fires pointerout immediately — let the click path own touch
    if (e.pointerType !== "touch" && e.target.closest("[data-name]")) tip.hidden = true;
  });
  svg.addEventListener("click", (e) => {
    const p = e.target.closest("[data-name]");
    if (p) {
      show(p, e);
      e.stopPropagation();
    }
  });
  document.addEventListener("click", () => {
    tip.hidden = true;
  });
  svg.addEventListener("focusin", (e) => {
    const p = e.target.closest("[data-name]");
    if (p) show(p, null);
  });
  svg.addEventListener("focusout", () => {
    tip.hidden = true;
  });
})();

// busuanzi page views: reveal the sidebar pill once a value lands. The pill
// (not the inner span) is gated so ad-block or a dead service = no empty pill.
(function () {
  const val = document.getElementById("busuanzi_value_site_pv");
  const pill = document.querySelector(".side-pv");
  if (!val || !pill) return;
  const BASE = 800; // display base added to the raw count
  let done = false;
  const render = () => {
    if (done) return;
    const n = parseInt(val.textContent.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(n)) return;
    done = true;
    val.textContent = String(n + BASE);
    pill.classList.add("pv-on");
  };
  if (val.textContent.trim()) {
    render();
    return;
  }
  const mo = new MutationObserver(render);
  mo.observe(val, { childList: true, characterData: true, subtree: true });
})();
