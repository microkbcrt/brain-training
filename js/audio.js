window.Brain = window.Brain || {};

(function (B) {
  'use strict';

  let ctx = null;

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, startAt, dur, opts) {
    const c = audio();
    if (!c) return;
    opts = opts || {};
    const t0 = c.currentTime + startAt;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const vol = opts.vol == null ? 0.18 : opts.vol;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  B.Sound = {
    // 需在用户手势后调用一次以解锁音频
    unlock: function () {
      audio();
    },
    countdownTick: function () {
      tone(660, 0, 0.12, { type: 'triangle', vol: 0.16 });
    },
    countdownGo: function () {
      tone(880, 0, 0.18, { type: 'triangle', vol: 0.22 });
    },
    correct: function () {
      tone(784, 0, 0.12, { type: 'sine', vol: 0.22 });
      tone(1046, 0.1, 0.18, { type: 'sine', vol: 0.22 });
    },
    wrong: function () {
      tone(220, 0, 0.28, { type: 'sawtooth', to: 110, vol: 0.22 });
      tone(150, 0.14, 0.32, { type: 'square', to: 80, vol: 0.14 });
    },
    // 有人死亡：低沉的下降音
    death: function () {
      tone(360, 0, 0.22, { type: 'triangle', to: 200, vol: 0.24 });
      tone(200, 0.16, 0.32, { type: 'triangle', to: 110, vol: 0.2 });
    },
    // 有人出生：明亮的上行琶音
    birth: function () {
      tone(587, 0, 0.12, { type: 'sine', vol: 0.2 });
      tone(784, 0.1, 0.12, { type: 'sine', vol: 0.2 });
      tone(1046, 0.2, 0.2, { type: 'sine', vol: 0.22 });
    }
  };
})(window.Brain);
