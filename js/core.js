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
})(window.Brain);
