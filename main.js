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
  let setW = 0, x = 0, paused = false, dragging = false;
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
    dragging = true; moved = 0;
    startX = e.clientX; startOffset = x;
    track.classList.add("dragging");
    try { track.setPointerCapture(e.pointerId); } catch (_) {}
  });
  track.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    x = wrap(startOffset + dx);
    render();
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("dragging");
    try { track.releasePointerCapture(e.pointerId); } catch (_) {}
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
