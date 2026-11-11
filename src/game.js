(() => {
'use strict';
const W = 200, H = 120, N = W * H, CELL = 4, CH = 16, CX = Math.ceil(W / CH), CY = Math.ceil(H / CH), SUB = 2;
const AIR = 0, SAND = 1, WATER = 2, FIRE = 3, LAVA = 4, STEAM = 5, WOOD = 6, STONE = 7, METAL = 8,
  OIL = 9, ACID = 10, ICE = 11, SALT = 12, POWDER = 13, SMOKE = 14, ERASE = 15;
const WWID = W * CELL, WHGT = H * CELL, rnd = Math.random;
const g = new Uint8Array(N), life = new Uint8Array(N), st = new Uint8Array(N), temp = new Float32Array(N).fill(22);
let cur = new Uint8Array(CX * CY), nxt = new Uint8Array(CX * CY), fr = 1;

// ---------- chunk simulation ----------
function wk(x, y) {
  const x0 = Math.max(0, x - 1) >> 4, x1 = Math.min(W - 1, x + 1) >> 4;
  const y0 = Math.max(0, y - 1) >> 4, y1 = Math.min(H - 1, y + 1) >> 4;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) nxt[cy * CX + cx] = 1;
}
function wake(i) { wk(i % W, (i / W) | 0); }
function swap(i, j) {
  const t = g[i]; g[i] = g[j]; g[j] = t;
  const l = life[i]; life[i] = life[j]; life[j] = l;
  const z = temp[i]; temp[i] = temp[j]; temp[j] = z;
  st[i] = fr; st[j] = fr; wake(i); wake(j);
}
function put(i, t, l = 0, heat = null) {
  g[i] = t; life[i] = l; if (heat !== null) temp[i] = heat;
  else if (t === FIRE) temp[i] = 500; else if (t === LAVA) temp[i] = 900;
  else if (t === ICE) temp[i] = -5; else if (t === STEAM) temp[i] = 120;
  else if (t === AIR) temp[i] = 22;
  st[i] = fr; wake(i);
}
function nb(i, k) {
  const x = i % W;
  if (k === 0) return x < W - 1 ? i + 1 : -1;
  if (k === 1) return x > 0 ? i - 1 : -1;
  if (k === 2) return i + W < N ? i + W : -1;
  return i >= W ? i - W : -1;
}
function flow(i, x, y) {
  const r = rnd() < .5 ? -1 : 1;
  if (y < H - 1) {
    const d = i + W;
    if (g[d] === AIR) { swap(i, d); return true; }
    for (let q = 0; q < 2; q++) {
      const dx = q ? -r : r, nx = x + dx;
      if (nx >= 0 && nx < W && g[d + dx] === AIR) { swap(i, d + dx); return true; }
    }
  }
  for (let q = 0; q < 2; q++) {
    const dx = q ? -r : r, nx = x + dx;
    if (nx >= 0 && nx < W && g[i + dx] === AIR) { swap(i, i + dx); return true; }
  }
  return false;
}
function upd(i, x, y, t) {
  switch (t) {
    case SAND: {
      if (y >= H - 1) return;
      const d = i + W, c = g[d];
      if (c === AIR || c === WATER || c === STEAM) { swap(i, d); return; }
      const r = rnd() < .5 ? -1 : 1;
      for (let q = 0; q < 2; q++) {
        const dx = q ? -r : r, nx = x + dx;
        if (nx < 0 || nx >= W) continue;
        const cc = g[d + dx];
        if (cc === AIR || cc === WATER || cc === STEAM) { swap(i, d + dx); return; }
      }
      return;
    }
    case WATER: flow(i, x, y); return;
    case LAVA: {
      const k = nb(i, (rnd() * 4) | 0);
      if (k >= 0) {
        const c = g[k];
        if (c === WATER) { put(k, STEAM, 70); put(i, STONE); return; }
        if (c === WOOD) put(k, FIRE, 60 + ((rnd() * 40) | 0));
        else if (c === AIR && k < i && rnd() < .01) put(k, FIRE, 25);
      }
      wk(x, y);
      if (rnd() < .3) flow(i, x, y);
      return;
    }
    case FIRE: {
      if (life[i] <= 1) { put(i, AIR); return; }
      life[i]--;
      const k = nb(i, (rnd() * 4) | 0);
      if (k >= 0) {
        const c = g[k];
        if (c === WOOD && rnd() < .08) put(k, FIRE, 50 + ((rnd() * 40) | 0));
        else if (c === OIL && rnd() < .18) put(k, FIRE, 70);
        else if (c === POWDER) { burstAt(k % W, (k / W) | 0); return; }
        else if (c === ICE) put(k, WATER, 0, 5);
        else if (c === WATER) { put(k, STEAM, 60); put(i, AIR); return; }
      }
      wk(x, y);
      if (y > 0 && rnd() < .5 && g[i - W] === AIR) { swap(i, i - W); return; }
      const dx = rnd() < .5 ? -1 : 1, nx = x + dx;
      if (nx >= 0 && nx < W && g[i + dx] === AIR && rnd() < .3) swap(i, i + dx);
      return;
    }
    case STEAM: {
      if (life[i] <= 1) { put(i, rnd() < .15 ? WATER : AIR); return; }
      life[i]--; wk(x, y);
      const dx = rnd() < .5 ? -1 : 1, nx = x + dx;
      if (y > 0) {
        const u = i - W;
        if (g[u] === AIR) { swap(i, u); return; }
        if (nx >= 0 && nx < W && g[u + dx] === AIR) { swap(i, u + dx); return; }
      }
      if (nx >= 0 && nx < W && g[i + dx] === AIR) swap(i, i + dx);
      return;
    }
    case OIL:
    case ACID: flow(i, x, y); return;
    case POWDER: {
      if (y < H - 1 && (g[i + W] === AIR || g[i + W] === WATER)) { swap(i, i + W); return; }
      const dx = rnd() < .5 ? -1 : 1;
      if (x + dx >= 0 && x + dx < W && g[i + W + dx] === AIR) swap(i, i + W + dx);
      return;
    }
    case SMOKE: {
      if (life[i] <= 1) { put(i, AIR); return; }
      life[i]--; wk(x, y); const dx = rnd() < .5 ? -1 : 1;
      if (y > 0 && g[i - W] === AIR) swap(i, i - W);
      else if (x + dx >= 0 && x + dx < W && g[i + dx] === AIR) swap(i, i + dx);
      return;
    }
  }
}
function step() {
  fr = fr % 255 + 1;
  cur.set(nxt); nxt.fill(0);
  const fl = rnd() < .5;
  for (let cy = CY - 1; cy >= 0; cy--) for (let k = 0; k < CX; k++) {
    const cx = fl ? CX - 1 - k : k;
    if (!cur[cy * CX + cx]) continue;
    const x0 = cx << 4, x1 = Math.min(W, x0 + CH), y0 = cy << 4, y1 = Math.min(H, y0 + CH);
    for (let y = y1 - 1; y >= y0; y--) for (let j = 0; j < x1 - x0; j++) {
      const x = fl ? x1 - 1 - j : x0 + j, i = y * W + x, t = g[i];
      if (t === AIR || t === WOOD || t === STONE || t === METAL || t === ICE || t === SALT || st[i] === fr) continue;
      upd(i, x, y, t);
    }
  }
}

// ---------- painting / undo ----------
function paintAt(gx, gy, r, tool) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const x = gx + dx, y = gy + dy;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x;
    if (tool === ERASE) { g[i] = 0; life[i] = 0; temp[i] = 22; wk(x, y); continue; }
    if (g[i]) continue;
    if (tool <= LAVA && rnd() < .45) continue;
    g[i] = tool; life[i] = (tool === FIRE ? 25 + ((rnd() * 35) | 0) : (tool === SMOKE ? 70 : 0)); if (tool === FIRE) temp[i] = 500; else if (tool === LAVA) temp[i] = 900; else if (tool === ICE) temp[i] = -5; else temp[i] = 22; wk(x, y);
  }
}
function line(x0, y0, x1, y1, r, tool) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let s = 0; s <= n; s++) paintAt(Math.round(x0 + (x1 - x0) * s / n), Math.round(y0 + (y1 - y0) * s / n), r, tool);
}
const hist = [];
function snap() { hist.push([g.slice(), life.slice(), temp.slice()]); if (hist.length > 15) hist.shift(); }
function undo() { const s = hist.pop(); if (!s) return; g.set(s[0]); life.set(s[1]); if (s[2]) temp.set(s[2]); nxt.fill(1); }

// ---------- thermal simulation (stylized game model) ----------
let thermalClock = 0;
const conductivity = { [WOOD]: 0.035, [STONE]: 0.10, [METAL]: 0.32, [WATER]: 0.12, [OIL]: 0.045, [ICE]: 0.16, [SAND]: 0.055, [SALT]: 0.08 };
function thermalStep() {
  // Heat exchange is deliberately simplified for gameplay, not a real-world material model.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, t = g[i]; if (!t) continue;
    if (t === FIRE) temp[i] = Math.max(temp[i], 500);
    if (t === LAVA) temp[i] = Math.max(temp[i], 900);
    const k = conductivity[t] || 0.025;
    const ns = [x ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of ns) if (j >= 0 && g[j] !== AIR) {
      const other = g[j], rate = Math.min(k, conductivity[other] || 0.025) * 0.12;
      const delta = (temp[i] - temp[j]) * rate;
      temp[i] -= delta * 0.5; temp[j] += delta * 0.5;
    }
    if (t === WOOD && temp[i] > 170) put(i, FIRE, 65, 500);
    else if (t === ICE && temp[i] > 2) put(i, WATER, 0, 3);
    else if (t === WATER && temp[i] > 105) put(i, STEAM, 80, 115);
    else if (t === STEAM && temp[i] < 45) put(i, WATER, 0, 35);
    else if (t === OIL && temp[i] > 180) put(i, FIRE, 70, 500);
  }
}

// Cartoon energy burst: an abstract in-game effect, not a real explosive simulation.
function burstAt(gx, gy) {
  const wx = gx * CELL, wy = gy * CELL, radius = 15;
  for (const b of [...balls, ...ragdolls.flatMap(r => r.parts)]) {
    const dx = b.position.x - wx, dy = b.position.y - wy, d = Math.hypot(dx, dy);
    if (d < radius * CELL && d > 0.01) {
      const strength = (1 - d / (radius * CELL)) * 0.045;
      Body.applyForce(b, b.position, { x: dx / d * strength * b.mass, y: dy / d * strength * b.mass });
    }
  }
  for (let y = Math.max(0, gy - radius); y <= Math.min(H - 1, gy + radius); y++)
    for (let x = Math.max(0, gx - radius); x <= Math.min(W - 1, gx + radius); x++) {
      const d = Math.hypot(x - gx, y - gy), i = y * W + x;
      if (d < radius && g[i] !== METAL && g[i] !== STONE) {
        if (d < 5 && rnd() < .45) put(i, FIRE, 35, 500);
        else if (rnd() < .7) put(i, SMOKE, 55, 80);
        else put(i, AIR);
      }
    }
}

// ---------- physics (Matter.js ragdoll) ----------
const { Engine, Bodies, Body, Composite, Constraint } = Matter;
const engine = Engine.create(), world = engine.world;
Composite.add(world, [
  Bodies.rectangle(WWID / 2, WHGT + 50, WWID + 400, 100, { isStatic: true }),
  Bodies.rectangle(-50, WHGT / 2, 100, WHGT * 2, { isStatic: true }),
  Bodies.rectangle(WWID + 50, WHGT / 2, 100, WHGT * 2, { isStatic: true })
]);
const ragdolls = [], balls = [];
const BALL_MATERIALS = {
  steel: { name: 'เหล็ก', density: 0.012, restitution: 0.18, friction: 0.55, color: '#aeb8c4', heat: 0.32 },
  wood: { name: 'ไม้', density: 0.004, restitution: 0.32, friction: 0.7, color: '#a66b3f', heat: 0.035 },
  rubber: { name: 'ยาง', density: 0.003, restitution: 0.88, friction: 0.85, color: '#e0c84b', heat: 0.025 },
  glass: { name: 'แก้ว', density: 0.006, restitution: 0.42, friction: 0.25, color: '#8ddde8', heat: 0.12 },
  stone: { name: 'หิน', density: 0.009, restitution: 0.12, friction: 0.75, color: '#858b95', heat: 0.10 }
};
function spawnBall(kind) {
  const m = BALL_MATERIALS[kind]; if (!m) return;
  if (balls.length >= 35) Composite.remove(world, balls.shift());
  const b = Bodies.circle(WWID * 0.5 + (rnd() - .5) * 150, 45, 9, {
    density: m.density, restitution: m.restitution, friction: m.friction, frictionAir: 0.008
  });
  b.materialName = m.name; b.materialColor = m.color; b.heat = 22; b.heatConductivity = m.heat;
  balls.push(b); Composite.add(world, b);
}
function spawn(x, y) {
  if (ragdolls.length >= 8) removeRag(ragdolls.shift());
  const G = Body.nextGroup(true), o = { collisionFilter: { group: G }, friction: .6, frictionAir: .02 };
  const head = Bodies.circle(x, y - 17, 5, o), torso = Bodies.rectangle(x, y - 5, 10, 16, o),
    aL = Bodies.rectangle(x - 7, y - 8, 4, 12, o), aR = Bodies.rectangle(x + 7, y - 8, 4, 12, o),
    lL = Bodies.rectangle(x - 3, y + 9, 4, 14, o), lR = Bodies.rectangle(x + 3, y + 9, 4, 14, o);
  head.R = 5; torso.R = 6; [aL, aR, lL, lR].forEach(b => b.R = 3.5);
  const J = (a, b, pa, pb) => Constraint.create({ bodyA: a, bodyB: b, pointA: { x: pa[0], y: pa[1] }, pointB: { x: pb[0], y: pb[1] }, stiffness: .9, length: 0 });
  const cons = [J(head, torso, [0, 5], [0, -7]), J(torso, aL, [-5, -6], [2, -3]), J(torso, aR, [5, -6], [-2, -3]),
    J(torso, lL, [-3, 8], [0, -6]), J(torso, lR, [3, 8], [0, -6])];
  const parts = [head, torso, aL, aR, lL, lR];
  Composite.add(world, parts); Composite.add(world, cons);
  ragdolls.push({ parts, cons, burn: 0, flame: 0 });
}
function removeRag(r) { r.cons.forEach(c => Composite.remove(world, c)); r.parts.forEach(b => Composite.remove(world, b)); }
function clearAll() { snap(); g.fill(0); life.fill(0); temp.fill(22); ragdolls.forEach(removeRag); balls.forEach(b => Composite.remove(world, b)); balls.length = 0; ragdolls.length = 0; nxt.fill(1); }

const DIRS = Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)]);
function cellAt(wx, wy) {
  const x = Math.floor(wx / CELL), y = Math.floor(wy / CELL);
  return (x < 0 || y < 0 || x >= W || y >= H) ? 0 : g[y * W + x];
}
const solid = t => t === SAND || (t >= WOOD && t <= METAL) || t === ICE || t === SALT;
function ballTick(b) {
  const p = b.position, radius = b.circleRadius || 9;
  let pushX = 0, pushY = 0, contacts = 0;
  for (const d of DIRS) {
    const x = p.x + d[0] * (radius + 2), y = p.y + d[1] * (radius + 2);
    const t = cellAt(x, y);
    if (solid(t)) { pushX -= d[0]; pushY -= d[1]; contacts++; }
    else if (t === WATER) Body.applyForce(b, p, { x: 0, y: -b.mass * 0.0007 });
  }
  if (contacts) {
    const len = Math.hypot(pushX, pushY) || 1; pushX /= len; pushY /= len;
    Body.setPosition(b, { x: p.x + pushX * Math.min(2.5, contacts * .6), y: p.y + pushY * Math.min(2.5, contacts * .6) });
    const v = b.velocity, vn = v.x * pushX + v.y * pushY;
    if (vn < 0) Body.setVelocity(b, { x: (v.x - vn * pushX) * .88, y: (v.y - vn * pushY) * .88 });
  }
  const gx = Math.floor(p.x / CELL), gy = Math.floor(p.y / CELL);
  if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
    const i = gy * W + gx, t = g[i], conductivity = b.heatConductivity || .08;
    b.heat = (b.heat || 22) + (temp[i] - (b.heat || 22)) * conductivity * .08;
    if (t === FIRE || t === LAVA) b.heat += t === LAVA ? 2 : .8;
    if (t === WATER) b.heat -= .35;
  }
}

function ragTick(r) {
  let wet = false, hot = false;
  for (const b of r.parts) {
    const p = b.position, c = cellAt(p.x, p.y);
    const gx = Math.floor(p.x / CELL), gy = Math.floor(p.y / CELL);
    if (gx >= 0 && gx < W && gy >= 0 && gy < H) {
      const ci = gy * W + gx, conduct = b.heatConductivity || 0.08;
      b.heat = (b.heat || 22) + (temp[ci] - (b.heat || 22)) * conduct * 0.08;
      if (b.heat > 160 && b.materialName === 'ไม้') { Body.setVelocity(b, { x: b.velocity.x * 0.98, y: b.velocity.y * 0.98 }); }
    }
    if (c === WATER) {
      wet = true;
      Body.applyForce(b, p, { x: 0, y: -b.mass * 0.0017 });
      Body.setVelocity(b, { x: b.velocity.x * .94, y: b.velocity.y * .94 });
    } else if (c === SAND) Body.setVelocity(b, { x: b.velocity.x * .85, y: b.velocity.y * .85 });
    if (c === FIRE || c === LAVA) hot = true;
    let px = 0, py = 0, n = 0;
    for (const d of DIRS) if (solid(cellAt(p.x + d[0] * b.R, p.y + d[1] * b.R))) { px -= d[0]; py -= d[1]; n++; }
    if (n) {
      const l = Math.hypot(px, py) || 1; px /= l; py /= l;
      const a = Math.min(3, .8 + .5 * n);
      Body.setPosition(b, { x: p.x + px * a, y: p.y + py * a });
      const v = b.velocity, vn = v.x * px + v.y * py;
      if (vn < 0) Body.setVelocity(b, { x: (v.x - vn * px) * .92, y: (v.y - vn * py) * .92 });
    }
  }
  if (hot) r.flame = 120;
  if (wet) r.flame = 0;
  if (r.flame > 0) {
    r.flame--; r.burn = Math.min(100, r.burn + .1);
    if (rnd() < .25) {
      const b = r.parts[(rnd() * 6) | 0], x = Math.floor(b.position.x / CELL), y = Math.floor(b.position.y / CELL) - 2;
      if (x >= 0 && x < W && y >= 0 && y < H && g[y * W + x] === AIR) { g[y * W + x] = FIRE; life[y * W + x] = 20; wk(x, y); }
    }
  }
}

// ---------- rendering ----------
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const off = document.createElement('canvas'); off.width = W; off.height = H;
const octx = off.getContext('2d'), img = octx.createImageData(W, H), px32 = new Uint32Array(img.data.buffer);
const BASE = [[17, 21, 28], [222, 190, 110], [50, 110, 230], [255, 160, 30], [255, 90, 20], [190, 205, 220], [130, 85, 45], [120, 124, 132], [170, 185, 200], [184, 151, 45], [110, 220, 75], [150, 225, 250], [238, 235, 220], [190, 150, 130], [110, 118, 130]];
const cl = v => v < 0 ? 0 : v > 255 ? 255 : v;
function render() {
  for (let i = 0; i < N; i++) {
    const t = g[i], c = BASE[t];
    let r = c[0], gg = c[1], b = c[2];
    if (t === FIRE) gg = cl(60 + life[i] * 3);
    else if (temp[i] > 80 && t) { r = cl(r + Math.min(100, (temp[i] - 80) * .12)); gg = cl(gg - Math.min(45, (temp[i] - 80) * .04)); }
    else if (t) { const v = (Math.imul(i, 2654435761) >>> 28) - 8; r = cl(r + v); gg = cl(gg + v); b = cl(b + v); }
    px32[i] = 0xff000000 | (b << 16) | (gg << 8) | r;
  }
  octx.putImageData(img, 0, 0);
}
let dpr = 1; const cam = { s: 1, x: 0, y: 0, init: false };
function resize() {
  dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  cv.width = Math.max(1, w * dpr); cv.height = Math.max(1, h * dpr);
  if (!cam.init) { cam.s = Math.min(w / WWID, h / WHGT); cam.x = (w - WWID * cam.s) / 2; cam.y = (h - WHGT * cam.s) / 2; cam.init = true; }
}
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#07090d'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(cam.s * dpr, 0, 0, cam.s * dpr, cam.x * dpr, cam.y * dpr);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, WWID, WHGT);
  for (const b of balls) {
    ctx.beginPath(); ctx.arc(b.position.x, b.position.y, b.circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = b.materialColor; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#202833'; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(b.position.x - 3, b.position.y - 3, 2, 0, Math.PI * 2); ctx.fill();
  }
  for (const r of ragdolls) {
    const c = r.burn / 100;
    ctx.fillStyle = `rgb(${(240 - 200 * c) | 0},${(190 - 160 * c) | 0},${(150 - 120 * c) | 0})`;
    ctx.strokeStyle = r.flame > 0 ? '#ff8a1f' : 'rgba(0,0,0,.5)'; ctx.lineWidth = r.flame > 0 ? 1.6 : .8;
    for (const b of r.parts) {
      const v = b.vertices; ctx.beginPath(); ctx.moveTo(v[0].x, v[0].y);
      for (let k = 1; k < v.length; k++) ctx.lineTo(v[k].x, v[k].y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
}

// ---------- input ----------
let tool = SAND, mode = 'draw', brush = 3, paused = false, drawing = false, last = null, grabC = null, gest = null;
const ptrs = new Map();
const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const toWorld = p => ({ x: (p.x - cam.x) / cam.s, y: (p.y - cam.y) / cam.s });
const toGrid = p => { const w = toWorld(p); return { x: Math.floor(w.x / CELL), y: Math.floor(w.y / CELL) }; };
function gdata() {
  const [a, b] = [...ptrs.values()], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return { m, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
}
function endStroke() { drawing = false; last = null; if (grabC) { Composite.remove(world, grabC); grabC = null; } }
function beginStroke(p) {
  if (mode === 'grab') {
    const w = toWorld(p); let best = null, bd = 18;
    for (const r of ragdolls) for (const b of r.parts) {
      const d = Math.hypot(b.position.x - w.x, b.position.y - w.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) {
      grabC = Constraint.create({ pointA: { x: w.x, y: w.y }, bodyB: best, pointB: { x: w.x - best.position.x, y: w.y - best.position.y }, stiffness: .25, damping: .1, length: 0 });
      Composite.add(world, grabC);
    }
    return;
  }
  snap(); drawing = true; last = toGrid(p); paintAt(last.x, last.y, brush, tool);
}
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, pos(e));
  if (ptrs.size === 2) {
    endStroke(); const d = gdata(), w = toWorld(d.m);
    gest = { s: cam.s, d: d.d, wx: w.x, wy: w.y };
  } else if (ptrs.size === 1) beginStroke(pos(e));
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const p = pos(e); ptrs.set(e.pointerId, p);
  if (ptrs.size === 2 && gest) {
    const d = gdata(), ns = Math.min(5, Math.max(.4, gest.s * d.d / gest.d));
    cam.s = ns; cam.x = d.m.x - gest.wx * ns; cam.y = d.m.y - gest.wy * ns;
  } else if (ptrs.size === 1) {
    if (grabC) { const w = toWorld(p); grabC.pointA.x = w.x; grabC.pointA.y = w.y; }
    else if (drawing) { const n = toGrid(p); line(last.x, last.y, n.x, n.y, brush, tool); last = n; }
  }
});
const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) gest = null; if (ptrs.size === 0) endStroke(); };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('contextmenu', e => e.preventDefault());

// ---------- UI ----------
const bot = document.getElementById('bot'), grabBtn = document.getElementById('grab'), pauseBtn = document.getElementById('pause');
const ELS = [[SAND, 'ทราย', '#debe6e'], [WATER, 'น้ำ', '#326ee6'], [FIRE, 'ไฟ', '#ff7a1e'], [LAVA, 'ลาวา', '#ff5a14'],
  [STEAM, 'ไอน้ำ', '#c5d0dc'], [OIL, 'น้ำมัน', '#b5a12e'], [ACID, 'กรด', '#70d65a'], [ICE, 'น้ำแข็ง', '#9de8ff'],
  [SALT, 'เกลือ', '#f0eee4'], [POWDER, 'ผงพลังงาน', '#d6b6a0'], [SMOKE, 'ควัน', '#777e89'],
  [WOOD, 'ไม้', '#82552d'], [STONE, 'หิน', '#787c84'], [METAL, 'โลหะ', '#aab9c8'], [ERASE, 'ยางลบ', '#ffffff']];
function mark() {
  [...bot.children].forEach(b => b.classList.toggle('on', mode === 'draw' && +b.dataset.id === tool));
  grabBtn.classList.toggle('on', mode === 'grab');
}
ELS.forEach(([id, name, col]) => {
  const b = document.createElement('button'); b.dataset.id = id;
  b.innerHTML = `<span class="chip" style="background:${col}"></span>${name}`;
  b.onclick = () => { tool = id; mode = 'draw'; mark(); };
  bot.appendChild(b);
});
grabBtn.onclick = () => { mode = mode === 'grab' ? 'draw' : 'grab'; mark(); };
for (const [key, mat] of Object.entries(BALL_MATERIALS)) {
  const b = document.createElement('button'); b.textContent = '⚽ ' + mat.name;
  b.onclick = () => spawnBall(key); document.getElementById('top').appendChild(b);
}
pauseBtn.onclick = () => { paused = !paused; pauseBtn.textContent = paused ? '▶ เล่น' : '⏸ หยุด'; };
document.getElementById('undo').onclick = undo;
document.getElementById('clear').onclick = clearAll;
document.getElementById('spawn').onclick = () => spawn(WWID / 2 + (rnd() - .5) * 120, 50);
document.getElementById('brush').oninput = e => { brush = +e.target.value; };
window.addEventListener('resize', resize);

// ---------- main loop ----------
let tPrev = performance.now(), acc = 0, frames = 0, tFps = tPrev;
const fpsEl = document.getElementById('fps');
function frame(t) {
  requestAnimationFrame(frame);
  acc = Math.min(acc + (t - tPrev), 50); tPrev = t;
  while (acc >= 1000 / 60) {
    acc -= 1000 / 60;
    if (drawing && mode === 'draw' && last) paintAt(last.x, last.y, brush, tool);
    if (!paused) {
      for (let s = 0; s < SUB; s++) step();
      thermalClock++; if (thermalClock % 4 === 0) thermalStep();
      ragdolls.forEach(ragTick); balls.forEach(ballTick);
      Engine.update(engine, 1000 / 60);
    }
  }
  render(); draw();
  frames++;
  if (t - tFps > 500) { fpsEl.textContent = Math.round(frames * 1000 / (t - tFps)) + ' FPS'; frames = 0; tFps = t; }
}
resize(); mark();
for (let x = 20; x < 180; x++) for (let y = 105; y < 109; y++) { g[y * W + x] = STONE; }
nxt.fill(1);
spawn(WWID / 2, 360);
requestAnimationFrame(frame);
})();
