#!/usr/bin/env node
/**
 * extract-registry.mjs — 从旧版 arcade 注册表生成新版展厅数据。
 *
 * 旧站 `arcade/src/games/*.js` 与 `arcade/src/external-games.js` 通过
 * `Arcade.register(def)` 声明游戏元数据；本脚本在 Node vm 中只执行这些
 * 注册声明，导出 JSON 安全字段，供新展厅 `assets/js/data/games.js` 使用。
 * 不复制、不修改任何游戏实现（游戏仍由 arcade/ 原样运行）。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arcade = path.join(root, 'arcade');

const defs = new Map();
const sandbox = {
  console,
  window: {},
  Arcade: {
    register(def) {
      if (def && def.id) defs.set(def.id, def);
    },
    getGame(id) { return defs.get(id) || null; }
  }
};
sandbox.window.Arcade = sandbox.Arcade;
sandbox.window.CardArt = null;
const context = vm.createContext(sandbox);

const registryFiles = [
  ...fs.readdirSync(path.join(arcade, 'src', 'games'))
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => path.join(arcade, 'src', 'games', f)),
  path.join(arcade, 'src', 'external-games.js')
];

for (const file of registryFiles) {
  const code = fs.readFileSync(file, 'utf8');
  try {
    vm.runInContext(code, context, { filename: file, timeout: 2000 });
  } catch (err) {
    console.warn('skip (top-level error):', path.basename(file), '—', err.message);
  }
}

/* GAME_ART: 旧版 app.js 内的美术路径表（运行旧 app.js 需要 DOM，故截取对象字面量） */
const appSrc = fs.readFileSync(path.join(arcade, 'src', 'app.js'), 'utf8');
const artStart = appSrc.indexOf('var GAME_ART = {');
const artEnd = appSrc.indexOf('};', artStart) + 2;
const artSrc = appSrc.slice(artStart, artEnd);
let GAME_ART = {};
try {
  const literal = artSrc.slice(artSrc.indexOf('{'), artSrc.lastIndexOf('}') + 1);
  GAME_ART = vm.runInNewContext('(' + literal + ')', {});
} catch (err) {
  console.warn('GAME_ART parse failed:', err.message);
}

function normalizeArt(p) {
  if (!p) return '';
  let s = String(p).replace(/^\/+/, '');
  if (s.startsWith('arcade/')) return s;
  return 'arcade/' + s;
}

const KEEP = ['id', 'title', 'subtitle', 'description', 'icon', 'accent', 'accent2',
  'tags', 'difficulty', 'width', 'height', 'controls', 'tips', 'order', 'url',
  'source', 'license', 'help'];

const games = [];
for (const [id, def] of defs) {
  const art = GAME_ART[id] || {};
  const out = { id };
  for (const key of KEEP) {
    if (def[key] !== undefined) out[key] = def[key];
  }
  out.external = !!def.url;
  out.playUrl = 'arcade/index.html?embed=1#/play/' + encodeURIComponent(id);
  out.iconArt = normalizeArt(art.icon);
  out.bgArt = normalizeArt(art.bg);
  out.cover = 'svg'; /* 复用 arcade/src/card-art.js 的单色藏品封面 */
  games.push(out);
}

games.sort((a, b) => {
  const oa = typeof a.order === 'number' ? a.order : 100;
  const ob = typeof b.order === 'number' ? b.order : 100;
  return oa - ob || String(a.title).localeCompare(String(b.title), 'zh-CN');
});

const tags = [];
for (const g of games) for (const t of g.tags || []) if (!tags.includes(t)) tags.push(t);

const header = `/* 新版游戏展厅数据 · 由 tools/extract-registry.mjs 从旧版 arcade 注册表提取。
 * 游戏实现与运行仍在 arcade/ 内完整保留；本文件只保存展示用元数据。
 * 重新生成：node tools/extract-registry.mjs
 */
window.MUSEUM_GAMES = `;
const payload = {
  generatedAt: new Date().toISOString().slice(0, 10),
  source: 'arcade/src/games/*.js + arcade/src/external-games.js',
  count: games.length,
  tags,
  games
};

fs.mkdirSync(path.join(root, 'assets', 'js', 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets', 'js', 'data', 'games.js'),
  header + JSON.stringify(payload, null, 2) + ';\n', 'utf8');
console.log(`games: ${games.length} | tags: ${tags.join(' / ')}`);
console.log(games.map((g) => `${g.id}(${g.title}${g.external ? ',iframe' : ''})`).join(' '));
