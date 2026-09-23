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
(function () {
  const items = [...document.querySelectorAll(".lb")];
  if (!items.length) return;

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
  const prevBtn = box.querySelector(".lb-prev");
  const nextBtn = box.querySelector(".lb-next");
  let cur = -1;

  const src = (t) => t.dataset.full || t.getAttribute("href");
  const alt = (t) =>
    (t.querySelector("img") && t.querySelector("img").alt) || t.dataset.caption || "";

  function show(i) {
    cur = ((i % items.length) + items.length) % items.length;
    const t = items[cur];
    img.src = src(t);
    img.alt = alt(t);
    cap.textContent = t.dataset.caption || "";
    box.classList.add("open");
    document.body.style.overflow = "hidden";
    box.querySelector(".lb-close").focus();
  }
  function close() {
    box.classList.remove("open");
    img.src = "";
    document.body.style.overflow = "";
  }

  items.forEach((t, i) =>
    t.addEventListener("click", (e) => {
      e.preventDefault();
      show(i);
    })
  );
  box.querySelector(".lb-close").addEventListener("click", close);
  prevBtn.addEventListener("click", () => show(cur - 1));
  nextBtn.addEventListener("click", () => show(cur + 1));
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
