window.Brain = window.Brain || {};

(function (B) {
  'use strict';

  function mount(node) {
    const root = B.root;
    root.innerHTML = '';
    root.appendChild(node);
  }

  B.goStart = function () {
    mount(B.renderStart());
  };

  B.goSelect = function () {
    // 进入选择界面就开始预热整个图片库，尽量在开始游戏前加载完
    if (B.preloadPictureLibrary) B.preloadPictureLibrary();
    mount(B.renderSelect());
  };

  B.goSettings = function () {
    mount(B.renderSettings());
  };

  B.goGame = function (game) {
    const container = document.createElement('div');
    container.className = 'screen game-screen';
    mount(container);
    game.start(container, function (result) {
      B.goResult(game, result);
    });
  };

  B.goResult = function (game, result) {
    mount(B.renderResult(game, result));
  };

  B.init = function () {
    B.root = document.getElementById('app');
    B.loadSettings();
    // 首次用户交互时解锁音频（浏览器自动播放策略）
    document.addEventListener('pointerdown', function onFirst() {
      if (B.Sound) B.Sound.unlock();
      document.removeEventListener('pointerdown', onFirst);
    });
    B.goStart();
  };

  document.addEventListener('DOMContentLoaded', B.init);
})(window.Brain);
