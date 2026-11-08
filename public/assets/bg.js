// Drifting ember wisps for the home page background.
(function () {
  "use strict";
  const canvas = document.getElementById("bg");
  if (!canvas) return;

  let enabled = true;
  try {
    enabled = (window.parent.Ember ? window.parent.Ember.settings : EmberStore.loadSettings()).background;
  } catch {
    /* default on */
  }
  if (!enabled) {
    canvas.remove();
    return;
  }

  const ctx = canvas.getContext("2d");
  const SCALE = 0.5; // draw at half resolution; the glow hides it and it's much cheaper
  const TRAIL = 70;
  const COUNT = 7;
  const WARM = [
    [255, 84, 40],
    [255, 128, 36],
    [255, 58, 52],
    [255, 170, 60],
    [255, 66, 96],
  ];
  const COOL = [
    [40, 190, 175],
    [96, 210, 120],
  ];

  function makeSprite([r, g, b], core) {
    const size = 64;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g2 = c.getContext("2d");
    const grad = g2.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    if (core) {
      grad.addColorStop(0, "rgba(255,250,225,1)");
      grad.addColorStop(0.3, `rgba(${r},${g},${b},0.9)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    } else {
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},0.35)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    }
    g2.fillStyle = grad;
    g2.fillRect(0, 0, size, size);
    return c;
  }

  const sprites = new Map();
  function spritesFor(color) {
    const key = color.join(",");
    if (!sprites.has(key)) sprites.set(key, { glow: makeSprite(color, false), core: makeSprite(color, true) });
    return sprites.get(key);
  }

  let w = 0;
  let h = 0;
  function resize() {
    w = canvas.width = Math.max(1, Math.ceil(innerWidth * SCALE));
    h = canvas.height = Math.max(1, Math.ceil(innerHeight * SCALE));
  }

  class Wisp {
    constructor(first) {
      this.reset(first);
    }

    reset(first) {
      this.seed = Math.random() * 1000;
      this.speed = 0.9 + Math.random() * 1.1;
      this.size = 10 + Math.random() * 12;
      this.color = Math.random() < 0.2 ? COOL[(Math.random() * COOL.length) | 0] : WARM[(Math.random() * WARM.length) | 0];
      this.sprite = spritesFor(this.color);
      this.trail = [];
      this.age = 0;
      if (first) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.angle = Math.random() * Math.PI * 2;
      } else {
        // come in from a random edge, pointing roughly inward
        const edge = (Math.random() * 4) | 0;
        const m = 30;
        this.x = edge === 0 ? -m : edge === 1 ? w + m : Math.random() * w;
        this.y = edge === 2 ? -m : edge === 3 ? h + m : Math.random() * h;
        this.angle = Math.atan2(h / 2 - this.y, w / 2 - this.x) + (Math.random() - 0.5) * 1.2;
      }
    }

    step(t) {
      const s = this.seed;
      const turn =
        Math.sin(this.x * 0.011 + t * 0.00045 + s) * 0.022 +
        Math.cos(this.y * 0.009 - t * 0.0003 + s * 1.7) * 0.022 +
        Math.sin(t * 0.0011 + s) * 0.012;
      this.angle += turn;
      this.x += Math.cos(this.angle) * this.speed;
      this.y += Math.sin(this.angle) * this.speed;
      this.trail.push(this.x, this.y);
      if (this.trail.length > TRAIL * 2) this.trail.splice(0, 2);
      this.age++;
      const m = 80;
      if (this.x < -m || this.x > w + m || this.y < -m || this.y > h + m) this.reset(false);
    }

    draw() {
      const fade = Math.min(1, this.age / 90);
      const pts = this.trail;
      const n = pts.length / 2;
      for (let i = 0; i < n; i++) {
        const k = (i + 1) / n;
        const size = this.size * (0.3 + 0.9 * k);
        ctx.globalAlpha = k * k * 0.16 * fade;
        ctx.drawImage(this.sprite.glow, pts[i * 2] - size, pts[i * 2 + 1] - size, size * 2, size * 2);
      }
      const big = this.size * 2.4;
      ctx.globalAlpha = 0.35 * fade;
      ctx.drawImage(this.sprite.glow, this.x - big, this.y - big, big * 2, big * 2);
      const core = this.size * 0.9;
      ctx.globalAlpha = 0.9 * fade;
      ctx.drawImage(this.sprite.core, this.x - core, this.y - core, core * 2, core * 2);
    }
  }

  resize();
  const wisps = Array.from({ length: COUNT }, () => new Wisp(true));

  function frame(t) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    for (const wisp of wisps) {
      wisp.step(t);
      wisp.draw();
    }
  }

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    for (let t = 0; t < 4000; t += 16) wisps.forEach((wp) => wp.step(t));
    frame(4000);
    addEventListener("resize", () => {
      resize();
      frame(4000);
    });
    return;
  }

  addEventListener("resize", resize);
  function loop(t) {
    const hidden = (window.frameElement && window.frameElement.hidden) || !canvas.isConnected;
    if (!hidden) frame(t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
