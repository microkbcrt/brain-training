window.Brain = window.Brain || {};

(function (B) {
  'use strict';

  // ================= 数小人 =================
  // 黑色小人从左侧进入房子、右侧离开，玩家心算房子里最终人数。
  // 房子落下前会先展示初始人数；房子可遮挡内部，最后打开揭晓。

  const NUM_ROUNDS = 9;

  // 人与房子等比例缩小的系数（房子 SVG viewBox 为 250x300）
  const SCALE = 0.76;

  // 房子在舞台中的摆放
  const HOUSE_TOP = 60;
  const HOUSE_W = Math.round(250 * SCALE);          // 房子元素宽（px）
  const HOUSE_H = Math.round(300 * SCALE);          // 房子元素高（px）
  const BODY_BOTTOM = HOUSE_TOP + 290 * SCALE;      // 主体底边（舞台坐标）
  const CHIMNEY_CX_OFF = 198 * SCALE;               // 烟囱中心相对房子左边的偏移
  const CHIMNEY_TOP_OFF = 8 * SCALE;                // 烟囱顶部相对房子顶部的偏移

  // 小人尺寸：约为房子主体高度的一半；排布压紧，每排最多 5 个
  const FIG_H = Math.round(96 * SCALE);             // 73
  const FIG_W = Math.round(52 * SCALE);             // 40
  const SPACING = 29;            // 相邻小人的水平间距（< FIG_W，略微交叠，保证每排 5 个不超房子）
  const MAX_PER_ROW = 5;
  const ROW_H = Math.round(52 * SCALE);             // 40
  const MAX_ROWS = 5;

  // 临时调试开关：true 时自动输入正确答案
  const AUTO_PASS = false;

  // 标准公共厕所男厕图标（头 + 躯干 + 微张双臂 + 双腿）
  const FIG_SVG =
    '<svg viewBox="0 0 100 180" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="50" cy="22" r="17" fill="currentColor"/>' +
    '<rect x="20" y="44" width="13" height="62" rx="6.5" fill="currentColor" transform="rotate(9 26 50)"/>' +
    '<rect x="67" y="44" width="13" height="62" rx="6.5" fill="currentColor" transform="rotate(-9 74 50)"/>' +
    '<rect x="34" y="42" width="32" height="68" rx="14" fill="currentColor"/>' +
    '<rect x="34" y="106" width="14" height="70" rx="7" fill="currentColor"/>' +
    '<rect x="52" y="106" width="14" height="70" rx="7" fill="currentColor"/>' +
    '</svg>';

  // 黑白房子（含烟囱），viewBox 250x300
  const HOUSE_SVG =
    '<svg viewBox="0 0 250 300" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="185" y="6" width="26" height="70" fill="#ffffff" stroke="#111111" stroke-width="6"/>' +
    '<polygon points="125,6 244,106 6,106" fill="#ffffff" stroke="#111111" stroke-width="6" stroke-linejoin="round"/>' +
    '<rect x="18" y="106" width="214" height="188" fill="#ffffff" stroke="#111111" stroke-width="6"/>' +
    '<rect x="40" y="138" width="44" height="44" fill="#ffffff" stroke="#111111" stroke-width="6"/>' +
    '<line x1="62" y1="138" x2="62" y2="182" stroke="#111111" stroke-width="5"/>' +
    '<line x1="40" y1="160" x2="84" y2="160" stroke="#111111" stroke-width="5"/>' +
    '<rect x="166" y="138" width="44" height="44" fill="#ffffff" stroke="#111111" stroke-width="6"/>' +
    '<line x1="188" y1="138" x2="188" y2="182" stroke="#111111" stroke-width="5"/>' +
    '<line x1="166" y1="160" x2="210" y2="160" stroke="#111111" stroke-width="5"/>' +
    '<rect x="102" y="214" width="46" height="80" fill="#111111"/>' +
    '</svg>';

  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  // ---------- 生成每一轮的事件（模块级，可单测） ----------
  B.buildPeopleRound = function (r) {
    const st = { v: randInt(1, 5) };
    const initial = st.v;
    const ev = [];

    function evIn(lo, hi) { const e = { type: 'in', in: randInt(lo, hi) }; ev.push(e); st.v += e.in; return e; }
    function evOut(lo, hi) {
      const hi2 = Math.min(st.v, hi);
      const n = hi2 <= 0 ? 0 : (hi2 >= lo ? randInt(lo, hi2) : hi2);
      if (n <= 0) return null;
      const e = { type: 'out', out: n }; ev.push(e); st.v -= n; return e;
    }
    function evNormal(inLo, inHi, outLo, outHi) {
      if (st.v > 0 && Math.random() < 0.5) {
        const o = evOut(outLo, outHi);
        if (o) return o;
      }
      return evIn(inLo, inHi);
    }
    function evBoth(inLo, inHi, outLo, outHi) {
      const inN = randInt(inLo, inHi);
      let outN = st.v > 0 ? Math.min(st.v, randInt(outLo, outHi)) : 0;
      const e = { type: 'both', in: inN, out: outN };
      ev.push(e); st.v += inN - outN;
      return e;
    }
    function evRoof(e) {
      if (st.v <= 0) return;
      e.roof = 1;   // 一次只能从烟囱出来 1 人
      st.v -= 1;
    }
    function evDie(e, lo, hi) {
      if (st.v <= 0) return;
      const n = Math.min(st.v, randInt(lo, hi));
      e.die = n; st.v -= n;
    }
    function evBirth(e, lo, hi) { const n = randInt(lo, hi); e.birth = n; st.v += n; }

    if (r === 0) {
      evIn(1, 3);
      for (let i = 0; i < 3; i++) evNormal(1, 3, 1, 3);
    } else if (r === 1) {
      for (let i = 0; i < 5; i++) evNormal(2, 5, 2, 5);
    } else if (r === 2) {
      for (let i = 0; i < 3; i++) evNormal(1, 3, 1, 3);
      for (let i = 0; i < 3; i++) evBoth(1, 2, 1, 2);
    } else if (r === 3) {
      for (let i = 0; i < 4; i++) evNormal(1, 3, 1, 3);
      for (let i = 0; i < 3; i++) evBoth(1, 4, 1, 4);
    } else if (r === 4) {
      for (let i = 0; i < 4; i++) evNormal(1, 3, 1, 3);
      for (let i = 0; i < 4; i++) evBoth(1, 4, 1, 4);
    } else if (r === 5) {
      for (let i = 0; i < 4; i++) evNormal(1, 3, 1, 3);
      for (let i = 0; i < 3; i++) evBoth(1, 4, 1, 4);
      const e = evBoth(1, 4, 1, 4); evRoof(e);
    } else if (r === 6) {
      for (let i = 0; i < 2; i++) evNormal(1, 3, 1, 3);
      for (let i = 0; i < 6; i++) {
        const e = evBoth(1, 4, 1, 4);
        if (i >= 4) evRoof(e);   // 后两次（整体第 7、8 次）从房顶出去 1-2 人
      }
    } else if (r === 7) {
      evNormal(2, 5, 2, 5);
      for (let i = 0; i < 3; i++) evBoth(1, 5, 1, 4);
      evNormal(2, 5, 2, 5);
      const e6 = evNormal(2, 5, 2, 5) || ev[ev.length - 1]; evRoof(e6);
      const e7 = evIn(2, 5); evDie(e7, 1, 3);
      const e8 = evIn(2, 5); evBirth(e8, 1, 3);
    } else if (r === 8) {
      evNormal(1, 3, 1, 3);
      evNormal(1, 3, 1, 3);
      evBoth(1, 4, 1, 4);
      evBoth(1, 4, 1, 4);
      for (let i = 0; i < 2; i++) { const e = evNormal(1, 3, 1, 3) || ev[ev.length - 1]; evRoof(e); }
      for (let i = 0; i < 2; i++) { const e = evIn(2, 5); evDie(e, 1, 3); evBirth(e, 1, 3); }
      for (let i = 0; i < 2; i++) { const e = evBoth(1, 5, 1, 4); evRoof(e); evDie(e, 1, 3); evBirth(e, 1, 3); }
    }
    return { events: ev, initial: initial, answer: st.v };
  };

  B.startCountPeople = function (container, onFinish) {
    let finished = false;
    let startTime = 0;
    let timers = [];
    let phase = '';
    let roundIndex = 0;
    let inside = 0;
    let entered = '';
    let keyHandler = null;
    let moveDur = 2000;
    let gap = 1000;

    // 动态几何（buildPage 时根据舞台实际宽度计算）
    let stageW = 320;
    let centerX = 160;
    let houseLeft = 35;
    let groundY = 220;
    let bodyBottom = 320;

    let stageEl = null, figLayer = null, houseEl = null, controlsEl = null, countEl = null, titleEl = null;

    function later(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function spacing() { return SPACING; }

    // ---------- 页面 ----------
    function buildPage() {
      container.className = 'screen game-screen ppl-game';
      container.innerHTML =
        '<h2 class="game-title" id="pplTitle">请记住人数</h2>' +
        '<div class="ppl-count" id="pplCount"></div>' +
        '<div class="ppl-stage" id="pplStage">' +
        '  <div class="ppl-layer" id="pplFigLayer"></div>' +
        '  <div class="ppl-house" id="pplHouse">' + HOUSE_SVG + '</div>' +
        '</div>' +
        '<div class="ppl-controls" id="pplControls"></div>';

      titleEl = container.querySelector('#pplTitle');
      countEl = container.querySelector('#pplCount');
      stageEl = container.querySelector('#pplStage');
      figLayer = container.querySelector('#pplFigLayer');
      houseEl = container.querySelector('#pplHouse');
      controlsEl = container.querySelector('#pplControls');

      // 量取舞台实际宽度并据此居中房子
      stageW = stageEl.clientWidth || 320;
      centerX = stageW / 2;
      houseLeft = centerX - HOUSE_W / 2;
      bodyBottom = BODY_BOTTOM;
      groundY = bodyBottom - FIG_H - 4;
      houseEl.style.left = houseLeft + 'px';
      houseEl.style.top = HOUSE_TOP + 'px';
      houseEl.style.width = HOUSE_W + 'px';
      houseEl.style.height = HOUSE_H + 'px';

      controlsEl.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-k]');
        if (btn) press(btn.dataset.k);
      });
    }

    function setTitle(t) { titleEl.textContent = t; }
    function setCount(html) { countEl.innerHTML = html; }
    function setControls(html) { controlsEl.innerHTML = html; }

    // ---------- 小人元素与动画 ----------
    function addFigure(x, y) {
      const el = document.createElement('div');
      el.className = 'ppl-fig';
      el.innerHTML = FIG_SVG;
      el.style.width = FIG_W + 'px';
      el.style.height = FIG_H + 'px';
      el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      figLayer.appendChild(el);
      return el;
    }

    function moveTo(el, x, y, dur, ease) {
      el.style.transition = 'transform ' + dur + 'ms ' + (ease || 'linear');
      void el.offsetWidth;
      el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    }

    // 一组的左端 x：让整组（含每个人宽度）在 cx 处居中
    function groupLeft(cx, n) {
      return cx - ((n - 1) * SPACING + FIG_W) / 2;
    }

    function animateIn(n, dur) {
      const sx = groupLeft(centerX, n);
      for (let i = 0; i < n; i++) {
        const tx = sx + i * SPACING;
        const startX = -SPACING * (n - i + 1) - FIG_W;
        const el = addFigure(startX, groundY);
        moveTo(el, tx, groundY, dur);
        later(function () { el.remove(); }, dur + 60);
      }
    }

    function animateOut(n, dur) {
      const sx = groupLeft(centerX, n);
      for (let i = 0; i < n; i++) {
        const startX = sx + i * SPACING;
        const el = addFigure(startX, groundY);
        moveTo(el, stageW + SPACING * (i + 1), groundY, dur);
        later(function () { el.remove(); }, dur + 60);
      }
    }

    function animateRoof(n, dur) {
      const cx = houseLeft + CHIMNEY_CX_OFF;
      for (let i = 0; i < n; i++) {
        const x = groupLeft(cx, n) + i * SPACING;
        const el = addFigure(x, HOUSE_TOP + CHIMNEY_TOP_OFF);
        el.style.zIndex = '4';
        moveTo(el, x, -FIG_H - 24, dur);
        later(function () { el.remove(); }, dur + 60);
      }
    }

    function showPrompt(text, color, y, left) {
      const el = document.createElement('div');
      el.className = 'ppl-prompt';
      el.textContent = text;
      el.style.color = color;
      el.style.top = y + 'px';
      el.style.left = left || '50%';
      stageEl.appendChild(el);
      later(function () { el.style.opacity = '0'; }, 1500);
      later(function () { el.remove(); }, 2000);
    }

    function showDeathBirth(e) {
      const y = HOUSE_TOP + HOUSE_H + 8;
      if (e.die && e.birth) {
        showPrompt('死了' + e.die + '人', '#dc2626', y, 'calc(50% - 86px)');
        showPrompt('生了' + e.birth + '人', '#16a34a', y, 'calc(50% + 86px)');
      } else if (e.die) {
        showPrompt('死了' + e.die + '人', '#dc2626', y);
      } else if (e.birth) {
        showPrompt('生了' + e.birth + '人', '#16a34a', y);
      }
    }

    function runEvent(e, dur, cb) {
      if (e.type === 'in') animateIn(e.in, dur);
      else if (e.type === 'out') animateOut(e.out, dur);
      else if (e.type === 'both') { animateIn(e.in, dur); animateOut(e.out, dur); }
      // 死+生同时出现时不从烟囱出人，避免过于复杂
      if (e.roof && !(e.die && e.birth)) animateRoof(e.roof, dur);
      if (e.die) B.Sound.death();
      if (e.birth) B.Sound.birth();
      if (e.die || e.birth) showDeathBirth(e);
      later(cb, dur);
    }

    function runEvents(events) {
      let i = 0;
      (function next() {
        if (finished) return;
        if (i >= events.length) { toInput(); return; }
        const e = events[i++];
        runEvent(e, moveDur, function () { later(next, gap); });
      })();
    }

    // ---------- 房子动画 ----------
    function dropHouse(cb) {
      houseEl.style.transition = 'none';
      houseEl.style.transform = 'translateY(-' + (HOUSE_TOP + HOUSE_H + 40) + 'px)';
      void houseEl.offsetWidth;
      houseEl.style.transition = 'transform 620ms ease-in';
      houseEl.style.transform = 'translateY(0px)';
      later(cb, 620);
    }

    function openHouse(cb) {
      houseEl.style.transition = 'transform 800ms ease-in';
      houseEl.style.transform = 'translateY(-' + (HOUSE_TOP + HOUSE_H + 40) + 'px)';
      later(cb, 800);
    }

    // ---------- 金字塔布局 ----------
    function layoutInside(n) {
      const sp = spacing();
      // 每排最多 MAX_PER_ROW 个，按 4-3-2-1 金字塔循环叠放
      const rows = [];
      let rem = n, idx = 0;
      while (rem > 0 && rows.length < MAX_ROWS) {
        const cap = MAX_PER_ROW - (idx % MAX_PER_ROW);
        const t = Math.min(rem, cap);
        rows.push(t); rem -= t; idx++;
      }
      while (rem > 0) { rows.push(1); rem--; }

      const baseBottom = bodyBottom - 4;
      const pos = [];
      for (let r = 0; r < rows.length; r++) {
        const count = rows[r];
        const width = (count - 1) * sp + FIG_W;
        const startX = centerX - width / 2;
        const y = baseBottom - FIG_H - r * ROW_H;
        for (let i = 0; i < count; i++) pos.push({ x: startX + i * sp, y: y });
      }
      return pos;
    }

    function renderInitial(n) {
      layoutInside(n).forEach(function (p) { addFigure(p.x, p.y); });
    }

    function runCountdown(n, done) {
      let v = n;
      (function tick() {
        if (v > 0) {
          setCount(v);
          setTitle('请记住人数');
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

    // ---------- 一轮流程 ----------
    function startRound() {
      if (roundIndex >= NUM_ROUNDS) { finish(true); return; }
      const round = B.buildPeopleRound(roundIndex);
      inside = round.answer;
      entered = '';
      phase = 'ready';
      moveDur = 2000;
      gap = 1000;

      figLayer.innerHTML = '';
      houseEl.style.transition = 'none';
      houseEl.style.transform = 'translateY(-' + (HOUSE_TOP + HOUSE_H + 40) + 'px)';
      setControls('');
      setCount('');
      setTitle('请记住人数');
      renderInitial(round.initial);

      runCountdown(B.getCountdown(), function () {
        dropHouse(function () {
          later(function () { runEvents(round.events); }, 2000);
        });
      });
    }

    // ---------- 输入 ----------
    function toInput() {
      phase = 'input';
      setTitle('房子里有几人？');
      setCount('<span class="ppl-entered" id="pplEntered">?</span>');
      setControls(
        '<div class="keypad">' +
        ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(function (n) {
          return '<button class="key" data-k="' + n + '">' + n + '</button>';
        }).join('') +
        '<button class="key key-fn" data-k="clear">C</button>' +
        '<button class="key" data-k="0">0</button>' +
        '<button class="key key-fn" data-k="back">⌫</button>' +
        '</div>' +
        '<button class="btn btn-primary ppl-ok" data-k="ok">确定</button>'
      );
      updateEntered();
      if (AUTO_PASS) {
        entered = String(inside);
        updateEntered();
        later(function () { submit(); }, 500);
      }
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
      const el = container.querySelector('#pplEntered');
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
      const val = parseInt(entered, 10);
      if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
      reveal(val === inside);
    }

    // ---------- 揭晓 ----------
    function reveal(correct) {
      phase = 'reveal';
      setControls('');
      setCount('');
      setTitle(correct ? '正确！' : '答错了…');
      figLayer.innerHTML = '';
      const figs = layoutInside(inside).map(function (p) { return addFigure(p.x, p.y); });

      openHouse(function () {
        let i = 0;
        B.Sound[correct ? 'correct' : 'wrong']();
        (function colorNext() {
          if (i < figs.length) {
            figs[i++].classList.add(correct ? 'green' : 'red');
            later(colorNext, 110);
          } else {
            if (!correct) setTitle('正确答案：' + inside);
            later(function () {
              if (correct) { roundIndex++; startRound(); }
              else { finish(false); }
            }, correct ? 1100 : 1900);
          }
        })();
      });
    }

    // ---------- 结束 ----------
    function finish(success) {
      if (finished) return;
      finished = true;
      clearTimers();
      if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
      onFinish({
        success: success,
        time: (performance.now() - startTime) / 1000,
        total: NUM_ROUNDS,
        reached: success ? NUM_ROUNDS : roundIndex + 1,
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
      startRound();
    }

    showCountdown();
  };
})(window.Brain);
