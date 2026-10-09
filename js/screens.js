window.Brain = window.Brain || {};

(function (B) {
  'use strict';

  // ---------------- 开始界面 ----------------
  B.renderStart = function () {
    const node = B.htmlToNode(
      '<div class="screen start-screen">' +
      '  <div class="logo">' +
      '    <div class="logo-icon">🧠</div>' +
      '    <h1>脑锻炼</h1>' +
      '    <p class="tagline">每天动动脑，越活越年轻</p>' +
      '  </div>' +
      '  <button class="btn btn-primary btn-large" id="startBtn">开始</button>' +
      '</div>'
    );
    node.querySelector('#startBtn').addEventListener('click', function () {
      B.goSelect();
    });
    return node;
  };

  // ---------------- 选择游戏界面 ----------------
  B.renderSelect = function () {
    const cards = B.games.map(function (g) {
      const cls = g.available ? 'game-card' : 'game-card disabled';
      const badge = g.available ? '' : '<div class="game-badge">即将推出</div>';
      return (
        '<button class="' + cls + '" data-id="' + g.id + '"' + (g.available ? '' : ' disabled') + '>' +
        badge +
        '  <div class="game-icon">' + g.icon + '</div>' +
        '  <div class="game-name">' + g.name + '</div>' +
        '  <div class="game-desc">' + g.desc + '</div>' +
        '</button>'
      );
    }).join('');

    const node = B.htmlToNode(
      '<div class="screen select-screen">' +
      '  <div class="topbar">' +
      '    <button class="btn btn-ghost" id="backBtn">‹ 返回</button>' +
      '    <h2>选择游戏</h2>' +
      '    <div class="spacer"></div>' +
      '  </div>' +
      '  <div class="game-grid">' + cards + '</div>' +
      '</div>'
    );

    node.querySelector('#backBtn').addEventListener('click', function () {
      B.goStart();
    });
    node.querySelectorAll('.game-card').forEach(function (card) {
      card.addEventListener('click', function () {
        if (card.disabled) return;
        const game = B.games.filter(function (g) { return g.id === card.dataset.id; })[0];
        if (game) B.goGame(game);
      });
    });
    return node;
  };

  // ---------------- 结算界面 ----------------
  B.renderResult = function (game, result) {
    const success = result.success;
    const unit = result.unit || '题';
    const icon = success ? '🎉' : '😵';
    const title = success ? '训练完成！' : '游戏失败';
    const timeBlock = success
      ? '<div class="result-time">' + B.formatTime(result.time) + '<span class="unit">秒</span></div>' +
        '<div class="result-detail">' + game.name + ' · 全部 ' + result.total + ' ' + unit + '完成</div>'
      : '<div class="result-detail">坚持了 ' + B.formatTime(result.time) + ' 秒 · 完成 ' +
        (result.reached - 1) + '/' + result.total + ' ' + unit + '</div>' +
        '<div class="result-detail">再试一次，你可以做得更好！</div>';

    const node = B.htmlToNode(
      '<div class="screen result-screen">' +
      '  <div class="result-icon">' + icon + '</div>' +
      '  <div class="result-title ' + (success ? 'success' : 'fail') + '">' + title + '</div>' +
      timeBlock +
      '  <div class="result-actions">' +
      '    <button class="btn btn-primary" id="retryBtn">再玩一次</button>' +
      '    <button class="btn" id="backBtn">返回选择</button>' +
      '  </div>' +
      '</div>'
    );

    node.querySelector('#retryBtn').addEventListener('click', function () {
      B.goGame(game);
    });
    node.querySelector('#backBtn').addEventListener('click', function () {
      B.goSelect();
    });
    return node;
  };
})(window.Brain);
