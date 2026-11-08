/* Rz神次元游戏箱 · 安全本地存储（file:// 下 localStorage 可能不可用，自动降级到内存） */
(function () {
  'use strict';

  var Arcade = window.Arcade = window.Arcade || {};
  var PREFIX = 'neon-arcade.';
  var memory = Object.create(null);
  var available = false;

  try {
    var probe = PREFIX + '__probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    available = true;
  } catch (err) {
    available = false;
  }

  function readRaw(key) {
    if (available) {
      try { return window.localStorage.getItem(PREFIX + key); } catch (err) { /* fall through */ }
    }
    return key in memory ? memory[key] : null;
  }

  function writeRaw(key, value) {
    if (available) {
      try { window.localStorage.setItem(PREFIX + key, value); return; } catch (err) { /* fall through */ }
    }
    memory[key] = value;
  }

  function dropRaw(key) {
    if (available) {
      try { window.localStorage.removeItem(PREFIX + key); } catch (err) { /* ignore */ }
    }
    delete memory[key];
  }

  var store = {
    available: available,

    get: function (key, fallback) {
      var raw = readRaw(key);
      if (raw === null || raw === undefined) return fallback;
      try { return JSON.parse(raw); } catch (err) { return fallback; }
    },

    set: function (key, value) {
      try { writeRaw(key, JSON.stringify(value)); return true; } catch (err) { return false; }
    },

    del: function (key) {
      dropRaw(key);
    },

    /* 按游戏隔离的存储，供 rt.storage 使用 */
    scoped: function (gameId) {
      var prefix = 'game.' + gameId + '.';
      return {
        get: function (key, fallback) { return store.get(prefix + key, fallback); },
        set: function (key, value) { return store.set(prefix + key, value); },
        del: function (key) { store.del(prefix + key); }
      };
    }
  };

  Arcade.store = store;
})();
