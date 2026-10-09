window.Brain = window.Brain || {};

(function (B) {
  'use strict';

  // ================= 数箱子 =================
  // 正交（等距）投影的 5x5 网格，箱子上可叠层。
  // 玩法：记住箱子的总数 -> 输入数量。

  const GRID = 5;
  const TOTAL_ROUNDS = 15;

  // ---- 投影几何（模块级，生成与绘制共用） ----
  // 正交投影：绕竖轴 45° + 俯角 DEPRESSION。三条世界轴用同一尺度 S，
  // 因此画出来的是等长的正方体。
  const S = 38;                                   // 世界单位对应的屏幕尺度
  const DEPRESSION = 40 * Math.PI / 180;          // 俯角（越大越接近俯视）
  const RS2 = Math.SQRT1_2;
  const A = RS2 * S;                              // 水平轴投影半宽（c-r 方向）
  const BH = RS2 * S * Math.sin(DEPRESSION);      // 水平轴投影半高（c+r 方向）
  const HGT = S * Math.cos(DEPRESSION);           // 竖直边（z 方向）投影高度
  const MAX_LAYERS = 4;                           // 最多叠加层数
  const CW = 360;                                 // 画布逻辑宽
  const CH = 340;                                 // 画布逻辑高
  const ORIGIN_X = CW / 2;
  const ORIGIN_Y = CH / 2 - (8 * BH - MAX_LAYERS * HGT) / 2;

  const GRAY = { top: '#ccd3dd', left: '#a9b1bf', right: '#8b94a3' };
  const GREEN = { top: '#8ee89a', left: '#4fca63', right: '#33a949' };
  const RED = { top: '#f2a0a0', left: '#db6464', right: '#bd4444' };

  // 第 1~10 轮的类型定义
  // count: 箱子数量范围；fill: 留空数（几乎填满）；layers: 1 或 'multi'
  // memory: 记忆时间(ms)；move: null | 'c'(左上->右下) | 'r'(右上->左下) | 'random'
  const ROUND_TYPES = {
    1:  { count: [2, 5],  layers: 1,       memory: 1000, move: null },
    2:  { count: [4, 8],  layers: 1,       memory: 1000, move: null },
    3:  { count: [5, 9],  layers: 'multi', memory: 1000, move: null },
    4:  { count: [3, 6],  layers: 1,       memory: 1000, move: 'c' },
    5:  { count: [4, 8],  layers: 1,       memory: 1000, move: null },
    6:  { count: [5, 7],  layers: 'multi', memory: 1000, move: 'r' },
    7:  { count: [4, 10], layers: 1,       memory: 1000, move: null },
    8:  { count: [2, 5],  layers: 1,       memory: 300,  move: null },
    9:  { count: [5, 7],  layers: 'multi', memory: 1000, move: 'random' },
    10: { fill: [3, 5],   layers: 1,       memory: 300,  move: null }
  };

  // 前十轮 + 后五轮（随机 1~10）
  const ROUND_PLAN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'r', 'r', 'r', 'r', 'r'];

  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function allCells() {
    const out = [];
    for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) out.push([r, c]);
    return out;
  }

  function tileCenter(r, c, off) {
    return {
      x: ORIGIN_X + (c - r) * A + (off ? off.x : 0),
      y: ORIGIN_Y + (c + r) * BH + (off ? off.y : 0)
    };
  }

  // 单个箱子的屏幕投影六边形（顶面 + 两个侧面）
  function silhouette(cube) {
    const tc = tileCenter(cube.r, cube.c, null);
    const topY = tc.y - (cube.z + 1) * HGT;
    const botY = tc.y - cube.z * HGT;
    return [
      [tc.x, topY - BH], [tc.x + A, topY], [tc.x + A, botY],
      [tc.x, botY + BH], [tc.x - A, botY], [tc.x - A, topY]
    ];
  }

  function pointInPoly(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // 是否被其它列（更靠近视点）的箱子挡住
  function hiddenByOther(cube, cubes) {
    const tc = tileCenter(cube.r, cube.c, null);
    const topY = tc.y - (cube.z + 1) * HGT;
    for (let i = 0; i < cubes.length; i++) {
      const o = cubes[i];
      if (o === cube) continue;
      if (o.r === cube.r && o.c === cube.c) continue;  // 同列（叠层）不算遮挡
      if (o.r + o.c <= cube.r + cube.c) continue;      // 只有更靠近视点的箱子能挡
      if (pointInPoly(tc.x, topY, silhouette(o))) return true;
    }
    return false;
  }

  function tryMulti(count) {
    const minK = Math.max(1, Math.ceil(count / MAX_LAYERS));
    const kMax = Math.min(count - 1, 25);
    if (kMax < minK) return null;
    const k = randInt(minK, kMax);
    const heights = new Array(k).fill(1);
    let rem = count - k;
    let guard = 0;
    while (rem > 0 && guard++ < 2000) {
      const i = Math.floor(Math.random() * k);
      if (heights[i] < MAX_LAYERS) { heights[i]++; rem--; }
    }
    if (rem > 0) return null;
    const cells = B.shuffle(allCells()).slice(0, k);
    const cubes = [];
    for (let i = 0; i < k; i++) {
      for (let z = 0; z < heights[i]; z++) cubes.push({ r: cells[i][0], c: cells[i][1], z: z });
    }
    for (let i = 0; i < cubes.length; i++) {
      if (hiddenByOther(cubes[i], cubes)) return null;
    }
    return cubes;
  }

  // 生成某一轮的箱子（可单测）
  B.generateBoxRound = function (type) {
    if (type.fill) {
      const gaps = randInt(type.fill[0], type.fill[1]);
      const cells = B.shuffle(allCells()).slice(0, GRID * GRID - gaps);
      return cells.map(function (cc) { return { r: cc[0], c: cc[1], z: 0 }; });
    }
    const count = randInt(type.count[0], type.count[1]);
    if (type.layers !== 'multi') {
      const cells = B.shuffle(allCells()).slice(0, count);
      return cells.map(function (cc) { return { r: cc[0], c: cc[1], z: 0 }; });
    }
    for (let attempt = 0; attempt < 300; attempt++) {
      const res = tryMulti(count);
      if (res) return res;
    }
    const cells = B.shuffle(allCells()).slice(0, count);
    return cells.map(function (cc) { return { r: cc[0], c: cc[1], z: 0 }; });
  };

  B.boxRoundTypes = ROUND_TYPES;
  B.boxRoundPlan = ROUND_PLAN;
  B.boxRoundVisible = function (cubes) {
    for (let i = 0; i < cubes.length; i++) {
      if (hiddenByOther(cubes[i], cubes)) return false;
    }
    return true;
  };

  B.startCountBoxes = function (container, onFinish) {
    let ctx = null;
    let canvas = null;
    let startTime = 0;
    let finished = false;
    let timers = [];
    let rafId = null;

    let placements = [];
    let answer = 0;
    let entered = '';
    let roundIndex = 0;
    let phase = '';
    let keyHandler = null;

    const plan = ROUND_PLAN.slice();
    for (let i = 10; i < plan.length; i++) plan[i] = randInt(1, 10);

    function later(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; }
    function clearTimers() {
      timers.forEach(clearTimeout); timers = [];
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    function drawTile(cx, cy) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - BH);
      ctx.lineTo(cx + A, cy);
      ctx.lineTo(cx, cy + BH);
      ctx.lineTo(cx - A, cy);
      ctx.closePath();
      ctx.fillStyle = '#f2f5fa';
      ctx.fill();
      ctx.strokeStyle = '#dbe1ea';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    function drawCube(cx, cy, z, col) {
      const topY = cy - (z + 1) * HGT;
      const botY = cy - z * HGT;
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#000';
      // 左面
      ctx.beginPath();
      ctx.moveTo(cx - A, topY);
      ctx.lineTo(cx, topY + BH);
      ctx.lineTo(cx, botY + BH);
      ctx.lineTo(cx - A, botY);
      ctx.closePath();
      ctx.fillStyle = col.left;
      ctx.fill();
      ctx.stroke();
      // 右面
      ctx.beginPath();
      ctx.moveTo(cx, topY + BH);
      ctx.lineTo(cx + A, topY);
      ctx.lineTo(cx + A, botY);
      ctx.lineTo(cx, botY + BH);
      ctx.closePath();
      ctx.fillStyle = col.right;
      ctx.fill();
      ctx.stroke();
      // 顶面
      ctx.beginPath();
      ctx.moveTo(cx, topY - BH);
      ctx.lineTo(cx + A, topY);
      ctx.lineTo(cx, topY + BH);
      ctx.lineTo(cx - A, topY);
      ctx.closePath();
      ctx.fillStyle = col.top;
      ctx.fill();
      ctx.stroke();
    }

    function render(opt) {
      opt = opt || {};
      const off = opt.offset || null;
      ctx.clearRect(0, 0, CW, CH);
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          const tc = tileCenter(r, c, off);
          drawTile(tc.x, tc.y);
        }
      }
      if (opt.boxes !== false && placements.length) {
        const list = placements.slice().sort(function (p, q) {
          return (p.r + p.c) - (q.r + q.c) || p.z - q.z;
        });
        const reveal = opt.reveal == null ? list.length : opt.reveal;
        const col = opt.colors || GRAY;
        for (let i = 0; i < reveal && i < list.length; i++) {
          const p = list[i];
          const tc = tileCenter(p.r, p.c, off);
          drawCube(tc.x, tc.y, p.z, col);
        }
      }
    }

    // ---------- 页面骨架 ----------
    function buildPage() {
      container.className = 'screen game-screen box-game';
      container.innerHTML =
        '<h2 class="game-title" id="boxTitle">请记住</h2>' +
        '<div class="box-count" id="boxCount"></div>' +
        '<canvas id="boxCanvas" class="box-canvas"></canvas>' +
        '<div class="box-controls" id="boxControls"></div>';

      canvas = container.querySelector('#boxCanvas');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = CW * dpr;
      canvas.height = CH * dpr;
      ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render({ boxes: false });

      // 事件委托只绑定一次（#boxControls 元素常驻，仅其内容变化）
      container.querySelector('#boxControls').addEventListener('click', function (e) {
        const btn = e.target.closest('[data-k]');
        if (btn) press(btn.dataset.k);
      });
    }

    function setTitle(t) { container.querySelector('#boxTitle').textContent = t; }
    function setCount(html) { container.querySelector('#boxCount').innerHTML = html; }
    function setControls(html) { container.querySelector('#boxControls').innerHTML = html; }

    // ---------- 一轮流程 ----------
    function nextRound() {
      if (roundIndex >= TOTAL_ROUNDS) { finish(true); return; }
      const type = ROUND_TYPES[plan[roundIndex]];
      placements = B.generateBoxRound(type);
      answer = placements.length;
      entered = '';
      phase = 'ready';
      setTitle('请记住');
      setControls('');
      render({ boxes: false });
      // 每轮开始前的倒计时缓冲（秒数由设置决定）
      runCountdown(B.getCountdown(), function () { showPhase(type); });
    }

    function showPhase(type) {
      phase = 'show';
      setCount('');
      setTitle('请记住');
      let dir = type.move;
      if (dir === 'random') dir = Math.random() < 0.5 ? 'c' : 'r';
      if (dir) {
        animateMove(dir, type.memory, function () { toInput(); });
      } else {
        render({ colors: GRAY });
        later(function () { toInput(); }, type.memory);
      }
    }

    function animateMove(dir, duration, done) {
      const L = Math.sqrt(A * A + BH * BH);
      const ux = (dir === 'c' ? A : -A) / L;
      const uy = BH / L;
      const T = CW + CH;
      const sx = -ux * T / 2, sy = -uy * T / 2;
      const ex = ux * T / 2, ey = uy * T / 2;
      const steps = Math.max(1, Math.round(duration / 16));
      let i = 0;
      function frame() {
        i++;
        const t = Math.min(1, i / steps);
        render({ offset: { x: sx + (ex - sx) * t, y: sy + (ey - sy) * t }, colors: GRAY });
        if (i < steps) later(frame, 16);
        else done();
      }
      frame();
    }

    function toInput() {
      phase = 'input';
      render({ boxes: false });
      setTitle('共有几个箱子？');
      setCount('<span class="box-entered" id="boxEntered">?</span>');
      setControls(
        '<div class="keypad">' +
        ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(function (n) {
          return '<button class="key" data-k="' + n + '">' + n + '</button>';
        }).join('') +
        '<button class="key key-fn" data-k="clear">C</button>' +
        '<button class="key" data-k="0">0</button>' +
        '<button class="key key-fn" data-k="back">⌫</button>' +
        '</div>' +
        '<button class="btn btn-primary box-ok" data-k="ok">确定</button>'
      );
      updateEntered();
      keyHandler = function (e) {
        if (phase !== 'input') return;
        if (e.key >= '0' && e.key <= '9') press(e.key);
        else if (e.key === 'Backspace') press('back');
        else if (e.key === 'Enter') press('ok');
        else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') press('clear');
      };
      document.addEventListener('keydown', keyHandler);
    }

    function updateEntered() {
      const el = container.querySelector('#boxEntered');
      if (el) el.textContent = entered === '' ? '?' : entered;
    }

    function press(k) {
      if (phase !== 'input') return;
      if (k === 'clear') entered = '';
      else if (k === 'back') entered = entered.slice(0, -1);
      else if (k === 'ok') { submit(); return; }
      else if (/^[0-9]$/.test(k)) { if (entered.length < 3) entered += k; }
      updateEntered();
    }

    function submit() {
      if (entered === '') return;
      if (parseInt(entered, 10) === answer) reveal();
      else failReveal();
    }

    function reveal() {
      phase = 'reveal';
      if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
      setTitle('正确！');
      setControls('');
      setCount('');
      const list = placements.slice().sort(function (p, q) {
        return (p.r + p.c) - (q.r + q.c) || p.z - q.z;
      });
      let k = 0;
      function step() {
        k++;
        render({ colors: GRAY, reveal: k });
        if (k < list.length) later(step, 130);
        else {
          later(function () {
            render({ colors: GREEN });
            B.Sound.correct();
            later(function () { roundIndex++; nextRound(); }, 1000);
          }, 150);
        }
      }
      step();
    }

    // 答错：箱子逐个重现 -> 全部变红 -> 显示正确答案 + 失败音效 -> 结束
    function failReveal() {
      phase = 'reveal';
      if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
      setTitle('答错了…');
      setControls('');
      setCount('');
      const list = placements.slice().sort(function (p, q) {
        return (p.r + p.c) - (q.r + q.c) || p.z - q.z;
      });
      let k = 0;
      function step() {
        k++;
        render({ colors: GRAY, reveal: k });
        if (k < list.length) later(step, 130);
        else {
          later(function () {
            render({ colors: RED });
            setTitle('正确答案：' + answer);
            B.Sound.wrong();
            later(function () { finish(false); }, 1900);
          }, 150);
        }
      }
      step();
    }

    // ---------- 倒计时与结束 ----------
    function runCountdown(n, done) {
      let v = n;
      (function tick() {
        if (v > 0) {
          setCount(v);
          setTitle('请记住');
          B.Sound.countdownTick();
          v--;
          later(tick, 1000);
        } else {
          setCount('');
          B.Sound.countdownGo();
          done();
        }
      })();
    }

    function finish(success) {
      if (finished) return;
      finished = true;
      clearTimers();
      if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
      onFinish({
        success: success,
        time: (performance.now() - startTime) / 1000,
        total: TOTAL_ROUNDS,
        reached: success ? TOTAL_ROUNDS : roundIndex + 1,
        unit: '轮'
      });
    }

    // ---------- 启动 ----------
    function showCountdown() {
      const steps = B.countdownSteps(B.getCountdown());
      if (!steps.length) { startGame(); return; }
      container.className = 'screen countdown-screen';
      container.innerHTML = '<div class="countdown-number" id="cdNum">' + steps[0] + '</div>';
      const numEl = container.querySelector('#cdNum');
      let i = 0;
      B.Sound.countdownTick();
      function tick() {
        i++;
        if (i < steps.length) {
          numEl.textContent = steps[i];
          numEl.style.animation = 'none';
          void numEl.offsetWidth;
          numEl.style.animation = '';
          B.Sound.countdownTick();
          later(tick, 1000);
        } else {
          B.Sound.countdownGo();
          startGame();
        }
      }
      later(tick, 1000);
    }

    function startGame() {
      startTime = performance.now();
      roundIndex = 0;
      buildPage();
      nextRound();
    }

    showCountdown();
  };
})(window.Brain);
