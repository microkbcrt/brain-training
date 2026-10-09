window.Brain = window.Brain || {};

(function (B) {
  'use strict';

  // 游戏注册表：以后新增小游戏，只需在这里加一项
  // id      唯一标识
  // name    显示名称
  // icon    图标（emoji）
  // desc    简介
  // available 是否已开放
  // start   启动函数 (container, onFinish)
  B.games = [
    {
      id: 'previous-image',
      name: '前刻图片',
      icon: '🖼️',
      desc: '记住刚才看到的图片，在后面选出它。',
      available: true,
      start: B.startPreviousImage
    },
    {
      id: 'count-boxes',
      name: '数箱子',
      icon: '📦',
      desc: '看清立体网格里的箱子，数出总数。',
      available: true,
      start: B.startCountBoxes
    },
    {
      id: 'count-people',
      name: '数小人',
      icon: '🚹',
      desc: '你能时刻记住房子里的人数吗',
      available: true,
      start: B.startCountPeople
    }
  ];
})(window.Brain);
