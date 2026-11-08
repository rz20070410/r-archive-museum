/* Rz神次元游戏箱 · 程序化音效（WebAudio 合成，无外部音频资源） */
(function () {
  'use strict';

  var Arcade = window.Arcade = window.Arcade || {};
  var ctx = null;
  var master = null;
  var muted = false;

  try {
    muted = Arcade.store ? Arcade.store.get('muted', false) === true : false;
  } catch (err) {
    muted = false;
  }

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (err) { /* ignore */ } }
      return ctx;
    }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  function env(node, start, attack, duration, peak) {
    var g = node.gain;
    g.setValueAtTime(0.0001, start);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
    g.exponentialRampToValueAtTime(0.0001, start + duration);
  }

  /* 单音：可滑音、可锯齿/方波 */
  function tone(opt) {
    var ac = ensure();
    if (!ac || muted) return;
    var now = ac.currentTime + (opt.delay || 0);
    var dur = opt.dur || 0.12;
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.type = opt.type || 'sine';
    osc.frequency.setValueAtTime(opt.freq || 440, now);
    if (opt.freq2) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.freq2), now + dur);
    }
    env(gain, now, opt.attack || 0.006, dur, (opt.gain || 0.25) * (opt.volume || 1));
    if (opt.filter) {
      var f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(opt.filter, now);
      osc.connect(f);
      f.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.03);
  }

  /* 噪声：爆炸、撞击、沙沙声 */
  function noise(opt) {
    var ac = ensure();
    if (!ac || muted) return;
    var now = ac.currentTime + (opt.delay || 0);
    var dur = opt.dur || 0.2;
    var size = Math.max(1, Math.floor(ac.sampleRate * dur));
    var buffer = ac.createBuffer(1, size, ac.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < size; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / size, opt.decay || 1.8);
    }
    var src = ac.createBufferSource();
    src.buffer = buffer;
    var filter = ac.createBiquadFilter();
    filter.type = opt.highpass ? 'highpass' : 'lowpass';
    filter.frequency.setValueAtTime(opt.cutoff || 900, now);
    if (opt.cutoff2) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(60, opt.cutoff2), now + dur);
    }
    var gain = ac.createGain();
    gain.gain.value = (opt.gain || 0.3) * (opt.volume || 1);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  var presets = {
    click: function (v) { tone({ freq: 620, freq2: 880, dur: 0.06, type: 'triangle', gain: 0.16, volume: v }); },
    blip: function (v) { tone({ freq: 780, dur: 0.05, type: 'square', gain: 0.1, volume: v }); },
    pop: function (v) { tone({ freq: 340, freq2: 760, dur: 0.09, type: 'sine', gain: 0.24, volume: v }); },
    toggle: function (v) { tone({ freq: 520, dur: 0.07, type: 'triangle', gain: 0.15, volume: v }); },
    step: function (v) { tone({ freq: 220, dur: 0.045, type: 'square', gain: 0.06, volume: v }); },
    eat: function (v) {
      tone({ freq: 520, freq2: 900, dur: 0.09, type: 'triangle', gain: 0.3, volume: v });
      tone({ freq: 900, freq2: 1320, dur: 0.08, type: 'sine', gain: 0.18, volume: v, delay: 0.045 });
    },
    score: function (v) {
      tone({ freq: 660, dur: 0.09, type: 'triangle', gain: 0.24, volume: v });
      tone({ freq: 990, dur: 0.12, type: 'triangle', gain: 0.2, volume: v, delay: 0.07 });
    },
    flip: function (v) { tone({ freq: 460, freq2: 640, dur: 0.07, type: 'sine', gain: 0.2, volume: v }); },
    merge: function (v) { tone({ freq: 300, freq2: 620, dur: 0.13, type: 'sawtooth', gain: 0.12, filter: 2200, volume: v }); },
    hit: function (v) {
      noise({ dur: 0.09, gain: 0.22, cutoff: 2600, cutoff2: 700, volume: v });
      tone({ freq: 180, freq2: 90, dur: 0.1, type: 'square', gain: 0.14, volume: v });
    },
    shoot: function (v) {
      tone({ freq: 1200, freq2: 340, dur: 0.1, type: 'square', gain: 0.09, volume: v });
      tone({ freq: 700, freq2: 200, dur: 0.08, type: 'sine', gain: 0.08, volume: v });
    },
    jump: function (v) { tone({ freq: 320, freq2: 780, dur: 0.12, type: 'triangle', gain: 0.2, volume: v }); },
    explode: function (v) {
      noise({ dur: 0.36, gain: 0.34, cutoff: 1800, cutoff2: 120, decay: 2.2, volume: v });
      tone({ freq: 120, freq2: 42, dur: 0.32, type: 'sawtooth', gain: 0.16, volume: v });
    },
    level: function (v) {
      [523, 659, 784, 1046].forEach(function (f, i) {
        tone({ freq: f, dur: 0.14, type: 'triangle', gain: 0.16, delay: i * 0.06, volume: v });
      });
    },
    power: function (v) {
      [392, 523, 659, 880, 1046].forEach(function (f, i) {
        tone({ freq: f, dur: 0.16, type: 'sine', gain: 0.14, delay: i * 0.045, volume: v });
      });
    },
    win: function (v) {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) {
        tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.18, delay: i * 0.09, volume: v });
      });
    },
    lose: function (v) {
      [440, 349, 262, 196].forEach(function (f, i) {
        tone({ freq: f, dur: 0.24, type: 'sawtooth', gain: 0.12, filter: 1200, delay: i * 0.11, volume: v });
      });
    },
    error: function (v) {
      tone({ freq: 180, dur: 0.12, type: 'square', gain: 0.16, volume: v });
      tone({ freq: 150, dur: 0.16, type: 'square', gain: 0.14, delay: 0.12, volume: v });
    }
  };

  var audio = {
    play: function (name, volume) {
      if (muted) return;
      var preset = presets[name] || presets.blip;
      try { preset(typeof volume === 'number' ? volume : 1); } catch (err) { /* 音频不可用时静默 */ }
    },

    /* 浏览器要求用户手势后才能出声，首次点击时调用一次 */
    unlock: function () {
      ensure();
    },

    isMuted: function () { return muted; },

    setMuted: function (value) {
      muted = !!value;
      if (master) master.gain.value = muted ? 0 : 0.55;
      if (Arcade.store) Arcade.store.set('muted', muted);
      return muted;
    },

    toggleMuted: function () { return audio.setMuted(!muted); }
  };

  Arcade.audio = audio;
})();
