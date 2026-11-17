// Motion layer: opening curtain, batik medallion, gold dust and scroll-linked details.
// Everything here is decoration; the page works fully if this file fails.
(function () {
  const root = document.documentElement;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SVG_NS = "http://www.w3.org/2000/svg";

  // ---------- Opening curtain ----------
  function markOpened() {
    root.classList.add("opened");
    try { sessionStorage.setItem("tiraiDibuka", "1"); } catch (e) { /* private mode: replay is fine */ }
  }

  function openCurtain() {
    const curtain = document.getElementById("curtain");
    const showCurtain = root.classList.contains("first-visit") && !prefersReducedMotion;
    if (!showCurtain) {
      markOpened();
      return;
    }
    let finished = false;
    const part = () => {
      if (finished) return;
      finished = true;
      curtain.classList.add("parting");
      setTimeout(markOpened, 350);
      setTimeout(() => curtain.remove(), 1300);
    };
    curtain.addEventListener("click", part);
    document.addEventListener("keydown", part, { once: true });
    setTimeout(part, 1300); // flower finishes drawing, then the cloths part
  }

  // ---------- Batik medallion ----------
  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const name in attrs) el.setAttribute(name, attrs[name]);
    return el;
  }

  function ringOf(count, makeShape) {
    const group = svgEl("g", {});
    for (let i = 0; i < count; i++) {
      const shape = makeShape();
      shape.setAttribute("transform", `rotate(${(360 / count) * i} 200 200)`);
      group.appendChild(shape);
    }
    return group;
  }

  function buildMedallion() {
    const medallion = document.getElementById("medallion");
    if (!medallion) return;
    const stroke = { fill: "none", stroke: "#d6a84e", "stroke-width": "1.4" };

    // Ring A, outermost: pucuk rebung (bamboo shoot) triangles.
    const ringA = svgEl("g", { class: "ring ring-a", ...stroke });
    ringA.appendChild(ringOf(40, () => svgEl("path", { d: "M188 12 L200 34 L212 12 M194 12 L200 24 L206 12" })));
    ringA.appendChild(svgEl("circle", { cx: 200, cy: 200, r: 166 }));
    ringA.appendChild(svgEl("circle", { cx: 200, cy: 200, r: 160, "stroke-dasharray": "2 6" }));

    // Ring B, middle: kawung petals with dots between.
    const ringB = svgEl("g", { class: "ring ring-b", ...stroke });
    ringB.appendChild(ringOf(16, () => svgEl("ellipse", { cx: 200, cy: 68, rx: 10, ry: 26 })));
    ringB.appendChild(ringOf(16, () => svgEl("circle", { cx: 200, cy: 52, r: 2.5, transform: "", fill: "#f2d796" })));
    ringB.lastChild.setAttribute("transform", "rotate(11.25 200 200)");
    ringB.appendChild(svgEl("circle", { cx: 200, cy: 200, r: 112 }));

    // Ring C, core: eight-petal bunga with a sulur curl on each petal.
    const ringC = svgEl("g", { class: "ring ring-c", ...stroke });
    ringC.appendChild(ringOf(8, () => svgEl("path", { d: "M200 200 C185 165 185 125 200 102 C215 125 215 165 200 200 Z" })));
    ringC.appendChild(ringOf(8, () => svgEl("path", { d: "M200 98 C206 90 214 92 212 99 C210 104 204 102 206 98", transform: "" })));
    ringC.lastChild.setAttribute("transform", "rotate(22.5 200 200)");
    ringC.appendChild(svgEl("circle", { cx: 200, cy: 200, r: 14 }));

    medallion.append(ringA, ringB, ringC);
  }

  // ---------- Gold dust ----------
  function startGoldDust() {
    const canvas = document.getElementById("gold-dust");
    if (!canvas || prefersReducedMotion) return;
    const context = canvas.getContext("2d");
    const motes = [];
    const MOTE_COUNT = window.innerWidth < 600 ? 28 : 46;
    let width = 0;
    let height = 0;
    let running = true;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function newMote(startAnywhere) {
      return {
        x: Math.random() * width,
        y: startAnywhere ? Math.random() * height : height + 10,
        radius: 0.6 + Math.random() * 1.8,
        speed: 0.15 + Math.random() * 0.45,
        sway: Math.random() * Math.PI * 2,
        alpha: 0.25 + Math.random() * 0.55,
      };
    }

    function frame() {
      if (!running) return;
      context.clearRect(0, 0, width, height);
      for (const mote of motes) {
        mote.y -= mote.speed;
        mote.sway += 0.01;
        const x = mote.x + Math.sin(mote.sway) * 14;
        if (mote.y < -10) Object.assign(mote, newMote(false));
        context.beginPath();
        context.arc(x, mote.y, mote.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(242, 215, 150, ${mote.alpha})`;
        context.shadowColor = "rgba(242, 215, 150, 0.8)";
        context.shadowBlur = mote.radius * 4;
        context.fill();
      }
      requestAnimationFrame(frame);
    }

    resize();
    for (let i = 0; i < MOTE_COUNT; i++) motes.push(newMote(true));
    window.addEventListener("resize", resize);
    // Stop drawing when the tab is in the background, to save battery.
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(frame);
    });
    requestAnimationFrame(frame);
  }

  // ---------- Section heading rules ----------
  function revealSections() {
    const targets = document.querySelectorAll(".reveal");
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.3 });
    targets.forEach((el) => observer.observe(el));
  }

  // ---------- Scroll-linked: batik drift, parang bands, gold thread ----------
  function linkToScroll() {
    const batikFill = document.getElementById("batik-fill");
    const bands = document.querySelectorAll(".parang-band");
    const thread = document.getElementById("thread");
    const items = thread ? thread.querySelectorAll("li") : [];
    const dress = document.getElementById("dress");

    function update() {
      const scrollY = window.scrollY;
      const viewHeight = window.innerHeight;

      if (!prefersReducedMotion) {
        batikFill.setAttribute("y", String(-scrollY * 0.15));
        bands.forEach((band, index) => {
          const direction = index % 2 === 0 ? 1 : -1;
          band.style.setProperty("--band-x", `${direction * scrollY * 0.4}px`);
        });
      }

      if (thread) {
        // Thread fills as the list passes the middle of the screen.
        const box = thread.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (viewHeight * 0.6 - box.top) / box.height));
        thread.style.setProperty("--progress", progress.toFixed(3));
        items.forEach((item) => {
          const itemTop = item.getBoundingClientRect().top;
          item.classList.toggle("lit", itemTop < viewHeight * 0.6);
        });
      }

      if (dress && !prefersReducedMotion) {
        // Cloth swatch straightens as it reaches the centre of the screen.
        const box = dress.getBoundingClientRect();
        const offset = (box.top + box.height / 2 - viewHeight / 2) / viewHeight;
        dress.style.setProperty("--sway", `${(offset * -6).toFixed(2)}deg`);
      }
    }

    let frameRequested = false;
    window.addEventListener("scroll", () => {
      if (frameRequested) return;
      frameRequested = true;
      requestAnimationFrame(() => {
        update();
        frameRequested = false;
      });
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  buildMedallion();
  openCurtain();
  startGoldDust();
  revealSections();
  linkToScroll();
})();
