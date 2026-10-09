window.Brain = window.Brain || {};

(function (B) {
  'use strict';

  const TOTAL = 20;          // 总题数
  const MIRROR_FROM = 15;    // 第 15 题起，选项中出现镜像图片

  // 各阶段选项数量
  function optionCount(q) {
    if (q <= 2) return 2;    // 第 1-2 题：2 选 1
    if (q <= 4) return 4;    // 第 3-4 题：4 选 1
    return 6;                // 之后：6 选 1
  }

  // 构造选项：correctPic 为正确答案，currentPic 为当前展示图。
  // 返回 [{ pic, mirrored }, ...] 已打乱。正确答案只会出现一次（非镜像）。
  B.buildPictureOptions = function (pool, correctPic, currentPic, count, useMirror) {
    const opts = [];
    const seenKeys = {};
    const seenPics = {};
    function add(pic, mir) {
      const k = pic.id + (mir ? 'm' : '');
      if (seenKeys[k]) return false;
      opts.push({ pic: pic, mirrored: mir });
      seenKeys[k] = true;
      seenPics[pic.id] = true;
      return true;
    }
    add(correctPic, false);
    if (useMirror) add(correctPic, true); // 正确答案的镜像，强干扰项

    let guard = 0;
    while (opts.length < count && guard < 800) {
      guard++;
      const pic = pool[Math.floor(Math.random() * pool.length)];
      if (pic === correctPic || pic === currentPic || seenPics[pic.id]) continue;
      const mir = useMirror && Math.random() < 0.45;
      add(pic, mir);
    }
    return B.shuffle(opts);
  };

  B.startPreviousImage = function (container, onFinish) {
    // ---- 图片池：优先必应每日一图，缺失时回退程序化图形 ----
    const pool = B.getPicturePool();

    let order = B.shuffle(pool);
    let orderIndex = 0;
    function nextPic() {
      if (orderIndex >= order.length) {
        order = B.shuffle(pool);
        orderIndex = 0;
      }
      return order[orderIndex++];
    }

    // ---- 状态 ----
    let prev = null;        // 上一张（要被选择的图片）
    let cur = null;         // 当前展示的图片
    let question = 0;       // 0 = 记忆页，1..TOTAL = 选择题
    let startTime = 0;
    let finished = false;
    let timers = [];

    function later(fn, ms) {
      const t = setTimeout(fn, ms);
      timers.push(t);
      return t;
    }
    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
    }

    // ---- 倒计时（秒数由设置决定，0 表示直接开始） ----
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

    function showLoading() {
      container.className = 'screen game-screen';
      container.innerHTML =
        '<div class="game-top"><span>准备</span><span></span></div>' +
        '<h2 class="game-title small">正在加载图片…</h2>' +
        '<div class="pic-loading"><div class="pic-spinner"></div>' +
        '  <div class="pic-progress" id="picProgress"></div>' +
        '</div>';
      updateProgress();
    }

    function updateProgress() {
      const el = container.querySelector('#picProgress');
      if (!el) return;
      const p = B.getPictureProgress();
      el.textContent = p.total ? (p.done + ' / ' + p.total) : '';
    }

    function startGame() {
      container.className = 'screen game-screen';
      // 开始前必须等整个图片库全部加载并解码完成，避免按加载快慢作弊、也避免边玩边加载
      let loaded = false;
      let progressTimer = null;
      const loadingTimer = setTimeout(function () {
        if (loaded) return;
        showLoading();
        progressTimer = setInterval(updateProgress, 100);
      }, 120);
      B.preloadPictureLibrary().then(function () {
        loaded = true;
        clearTimeout(loadingTimer);
        if (progressTimer) clearInterval(progressTimer);
        startTime = performance.now();
        question = 0;
        cur = nextPic();
        renderMemorize();
      });
    }

    // ---- 记忆页：请记住 + 图片 + 记住了 ----
    function renderMemorize() {
      container.innerHTML =
        '<div class="game-top"><span>准备</span><span>记住这张图片</span></div>' +
        '<h2 class="game-title">请记住</h2>' +
        '<div class="picture-frame" id="frame"></div>' +
        '<div class="game-actions">' +
        '  <button class="btn btn-primary" id="rememberBtn">记住了</button>' +
        '</div>';
      container.querySelector('#frame').innerHTML = B.pictureHTML(cur, false);
      container.querySelector('#rememberBtn').addEventListener('click', function () {
        prev = cur;
        cur = nextPic();
        question = 1;
        renderQuestion();
      });
    }

    // ---- 选择题：请记住 + 新图片 + 上一张的选择 ----
    function renderQuestion() {
      const count = optionCount(question);
      const useMirror = question >= MIRROR_FROM;
      const options = B.buildPictureOptions(pool, prev, cur, count, useMirror);

      let optsHTML = '';
      options.forEach(function (o, i) {
        optsHTML += '<button class="option-btn" data-index="' + i + '">' +
          B.pictureHTML(o.pic, o.mirrored) + '</button>';
      });

      container.innerHTML =
        '<div class="game-top"><span>第 ' + question + ' / ' + TOTAL + ' 题</span>' +
        '<span>' + (useMirror ? '小心镜像' : '记住上一张') + '</span></div>' +
        '<h2 class="game-title small">请记住</h2>' +
        '<div class="picture-frame" id="frame"></div>' +
        '<div class="game-actions">' +
        '  <div class="choice-prompt">上一张图片是哪一张？</div>' +
        '  <div class="options" data-count="' + count + '">' + optsHTML + '</div>' +
        '</div>';
      container.querySelector('#frame').innerHTML = B.pictureHTML(cur, false);

      const btns = Array.prototype.slice.call(container.querySelectorAll('.option-btn'));
      let answered = false;
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (answered) return;
          answered = true;
          const chosen = options[+btn.dataset.index];
          const isCorrect = chosen.pic === prev && !chosen.mirrored;

          btns.forEach(function (b) { b.classList.add('locked'); });

          if (isCorrect) {
            B.Sound.correct();
            btn.classList.add('correct');
            later(function () {
              if (question >= TOTAL) {
                finish(true);
              } else {
                prev = cur;
                cur = nextPic();
                question++;
                renderQuestion();
              }
            }, 450);
          } else {
            B.Sound.wrong();
            btn.classList.add('wrong');
            btns.forEach(function (b) {
              const o = options[+b.dataset.index];
              if (o.pic === prev && !o.mirrored) b.classList.add('correct');
            });
            later(function () { finish(false); }, 750);
          }
        });
      });
    }

    function finish(success) {
      if (finished) return;
      finished = true;
      clearTimers();
      const elapsed = (performance.now() - startTime) / 1000;
      onFinish({
        success: success,
        time: elapsed,
        total: TOTAL,
        reached: question
      });
    }

    showCountdown();
  };
})(window.Brain);
