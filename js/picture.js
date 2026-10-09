window.Brain = window.Brain || {};

(function (B) {
  'use strict';

  const BG_COLORS = [
    '#FDE68A', '#FCA5A5', '#A7F3D0', '#BFDBFE', '#DDD6FE',
    '#FBCFE8', '#FED7AA', '#BAE6FD', '#D9F99D', '#E9D5FF',
    '#FEF3C7', '#CCFBF1'
  ];

  const SHAPE_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
    '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#3B82F6',
    '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
    '#F43F5E', '#1F2937', '#78350F'
  ];

  const SHAPE_TYPES = ['circle', 'rect', 'triangle', 'diamond', 'star', 'ring', 'cross', 'heart', 'moon'];

  let uid = 0;

  function starPoints(cx, cy, outer, inner) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  }

  function shapeBody(s) {
    const c = s.color;
    switch (s.type) {
      case 'circle': return '<circle r="50" fill="' + c + '"/>';
      case 'rect': return '<rect x="-45" y="-45" width="90" height="90" rx="16" fill="' + c + '"/>';
      case 'triangle': return '<polygon points="0,-52 50,42 -50,42" fill="' + c + '"/>';
      case 'diamond': return '<polygon points="0,-52 52,0 0,52 -52,0" fill="' + c + '"/>';
      case 'star': return '<polygon points="' + starPoints(0, 0, 52, 22) + '" fill="' + c + '"/>';
      case 'ring': return '<circle r="34" fill="none" stroke="' + c + '" stroke-width="18"/>';
      case 'cross': return '<path d="M-16,-52 h32 v36 h36 v32 h-36 v36 h-32 v-36 h-36 v-32 h36 z" fill="' + c + '"/>';
      case 'heart': return '<path d="M0,-6 C-9,-30 -52,-26 -52,-2 C-52,24 -18,40 0,56 C18,40 52,24 52,-2 C52,-26 9,-30 0,-6 Z" fill="' + c + '"/>';
      case 'moon': return '<path d="M22,-50 A50,50 0 1 0 22,50 A40,40 0 1 1 22,-50 Z" fill="' + c + '"/>';
      default: return '<circle r="50" fill="' + c + '"/>';
    }
  }

  function shapeSVG(s) {
    const scale = s.size / 100;
    const t = 'translate(' + s.x.toFixed(1) + ' ' + s.y.toFixed(1) + ') rotate(' +
      s.rot.toFixed(0) + ') scale(' + scale.toFixed(3) + ')';
    return '<g transform="' + t + '">' + shapeBody(s) + '</g>';
  }

  // 生成一张图片的数据（背景 + 若干图形）
  B.createPicture = function (seed) {
    const rand = B.mulberry32(seed);
    const bg = B.pick(BG_COLORS, rand);
    const count = 4 + Math.floor(rand() * 3); // 4 ~ 6 个图形
    const shapes = [];
    for (let i = 0; i < count; i++) {
      shapes.push({
        type: B.pick(SHAPE_TYPES, rand),
        color: B.pick(SHAPE_COLORS, rand),
        x: 38 + rand() * 164,
        y: 38 + rand() * 164,
        size: 34 + rand() * 52,
        rot: rand() * 360
      });
    }
    return { id: 'pic-' + (++uid), kind: 'shape', seed: seed, bg: bg, shapes: shapes };
  };

  // ---- 统一图片抽象 ----
  // 图片对象：kind='image'（本地必应图片）或 kind='shape'（程序化图形）
  // 全部通过 B.pictureHTML(pic, mirrored) 渲染

  // 取图片库：优先使用预下载的必应每日一图，缺失时回退到程序化图形
  B.getPicturePool = function () {
    if (B.bingPictures && B.bingPictures.length) {
      return B.bingPictures.map(function (p) {
        return {
          id: 'bing-' + p.date,
          kind: 'image',
          src: p.file,
          date: p.date,
          title: p.title
        };
      });
    }
    const pool = [];
    for (let i = 0; i < 40; i++) pool.push(B.createPicture((Math.random() * 1e9) | 0));
    return pool;
  };

  B.pictureHTML = function (pic, mirrored) {
    if (pic.kind === 'image') {
      return '<img class="pic-img' + (mirrored ? ' mirrored' : '') +
        '" src="' + pic.src + '" alt="" draggable="false">';
    }
    return B.pictureToSVG(pic, mirrored);
  };

  B.preloadPictures = function (pics) {
    pics.forEach(function (pic) {
      if (pic.kind === 'image') {
        const img = new Image();
        img.src = pic.src;
      }
    });
  };

  // 把图片渲染成 SVG 字符串，mirrored=true 时左右翻转
  B.pictureToSVG = function (pic, mirrored) {
    const inner = pic.shapes.map(shapeSVG).join('');
    const body = mirrored
      ? '<g transform="translate(240,0) scale(-1,1)">' + inner + '</g>'
      : inner;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" ' +
      'preserveAspectRatio="xMidYMid meet">' +
      '<rect width="240" height="240" fill="' + pic.bg + '"/>' + body + '</svg>';
  };
})(window.Brain);
