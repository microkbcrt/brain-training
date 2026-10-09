window.Brain = window.Brain || {};

(function (B) {
  'use strict';

  // 种子随机数生成器（mulberry32）
  B.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  B.randInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  B.pick = function (arr, rand) {
    const r = rand ? rand() : Math.random();
    return arr[Math.floor(r * arr.length)];
  };

  B.shuffle = function (arr, rand) {
    const rnd = rand || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  };

  B.el = function (tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  };

  // 把一段 HTML 渲染成 DOM 节点
  B.htmlToNode = function (html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    return wrapper.firstElementChild;
  };

  B.formatTime = function (seconds) {
    return seconds.toFixed(2);
  };

  // ---------- 设置（本地持久化） ----------
  const SETTINGS_KEY = 'brain.settings';
  B.settings = { countdown: 3 };   // 开始前的倒计时秒数：0-5

  B.loadSettings = function () {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.countdown === 'number') {
          B.settings.countdown = Math.max(0, Math.min(5, Math.round(s.countdown)));
        }
      }
    } catch (e) { /* 忽略（如 file:// 下 localStorage 不可用） */ }
  };

  B.saveSettings = function () {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(B.settings)); } catch (e) { /* 忽略 */ }
  };

  B.getCountdown = function () { return B.settings.countdown; };
  B.setCountdown = function (secs) {
    B.settings.countdown = Math.max(0, Math.min(5, Math.round(secs)));
    B.saveSettings();
  };

  // 生成倒计时的秒序列（如 3 -> [3,2,1]；0 -> []），供各游戏统一使用
  B.countdownSteps = function (secs) {
    const out = [];
    for (let v = secs; v >= 1; v--) out.push(v);
    return out;
  };
})(window.Brain);
