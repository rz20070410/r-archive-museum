/* ==========================================================================
   GACHA · 抽一张游戏卡
   ========================================================================== */
(() => {
  'use strict';
  const app = document.getElementById('app');
  if (!app) return;

  function gameCards() {
    return [...document.querySelectorAll('#game-grid .game-card')];
  }

  function coverOf(card) {
    const cover = card && card.querySelector('.edition-cover');
    return cover ? cover.outerHTML : '';
  }

  function iconOf(card) {
    const img = card && card.querySelector('.card-icon img');
    return img ? img.getAttribute('src') : '';
  }

  function mount() {
    const hub = document.querySelector('#view-hub');
    const grid = document.querySelector('#game-grid');
    if (!hub || !grid || document.querySelector('#gacha')) return;

    const section = document.createElement('section');
    section.className = 'gacha-section';
    section.id = 'gacha';
    section.innerHTML =
      '<div class="gacha-head">' +
        '<p class="gacha-kicker">04 / GACHA — LEAVE IT TO FATE</p>' +
        '<h2>下一局，<br><em>交给命运。</em></h2>' +
        '<p class="gacha-note">二十三款游戏太熟悉了？抽一张。让盒子替你决定今天玩什么。</p>' +
      '</div>' +
      '<div class="gacha-machine">' +
        '<div class="gacha-window"><div class="gacha-track" id="gacha-track">' +
          '<div class="gacha-idle"><span>?</span><small>PRESS TO DRAW</small></div>' +
        '</div></div>' +
        '<div class="gacha-controls">' +
          '<button type="button" class="gacha-btn" id="gacha-btn">抽一张游戏卡 <span>↗</span></button>' +
          '<span class="gacha-status" id="gacha-status">随机 · 公平 · 无法反悔</span>' +
        '</div>' +
        '<div class="gacha-result" id="gacha-result" hidden></div>' +
        '<div class="gacha-confetti" id="gacha-confetti" aria-hidden="true"></div>' +
      '</div>';
    grid.after(section);

    const track = section.querySelector('#gacha-track');
    const btn = section.querySelector('#gacha-btn');
    const status = section.querySelector('#gacha-status');
    const result = section.querySelector('#gacha-result');
    const confetti = section.querySelector('#gacha-confetti');
    let busy = false;

    function buildMini(card, i) {
      const cover = coverOf(card);
      const icon = iconOf(card);
      const title = (card.querySelector('.card-title') || {}).textContent || '';
      return '<div class="gacha-mini" style="--i:' + i + '">' +
        (cover || (icon ? '<img src="' + icon + '" alt="">' : '<span class="gacha-mini__emoji">🎮</span>')) +
        '<span class="gacha-mini__name">' + title + '</span>' +
      '</div>';
    }

    function draw() {
      if (busy) return;
      const cards = gameCards();
      if (!cards.length) return;
      busy = true;
      btn.disabled = true;
      result.hidden = true;
      section.classList.add('is-spinning');
      status.textContent = '正在打乱命运…';
      track.innerHTML = cards.slice(0, 12).map(buildMini).join('');
      const pick = cards[Math.floor(Math.random() * cards.length)];
      const id = pick.getAttribute('data-id');
      const title = (pick.querySelector('.card-title') || {}).textContent || '';
      const tags = [...pick.querySelectorAll('.tag')].slice(0, 2).map(t => t.textContent).join(' · ');
      const cover = coverOf(pick);
      const icon = iconOf(pick);

      setTimeout(() => {
        section.classList.remove('is-spinning');
        result.hidden = false;
        result.innerHTML =
          '<div class="gacha-result__inner">' +
            '<div class="gacha-result__art">' + (cover || (icon ? '<img src="' + icon + '" alt="">' : '')) + '</div>' +
            '<div class="gacha-result__copy">' +
              '<span class="gacha-result__kicker">YOUR CARD / 已抽中</span>' +
              '<h3>' + title + '</h3>' +
              '<p>' + tags + '</p>' +
              '<button type="button" class="gacha-play" data-play="' + id + '">开始这一局 <span>→</span></button>' +
            '</div>' +
          '</div>';
        status.textContent = '抽中了「' + title + '」';
        burstConfetti();
        btn.disabled = false;
        btn.innerHTML = '再抽一张 <span>↗</span>';
        busy = false;
      }, 1250);
    }

    function burstConfetti() {
      confetti.innerHTML = '';
      for (let i = 0; i < 18; i++) {
        const s = document.createElement('span');
        s.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
        s.style.setProperty('--dx', (Math.random() * 160 - 80).toFixed(0) + 'px');
        s.style.setProperty('--dy', (90 + Math.random() * 160).toFixed(0) + 'px');
        s.style.setProperty('--r', (Math.random() * 360).toFixed(0) + 'deg');
        s.style.setProperty('--d', (Math.random() * 0.2).toFixed(2) + 's');
        confetti.appendChild(s);
      }
      setTimeout(() => { confetti.innerHTML = ''; }, 1800);
    }

    btn.addEventListener('click', draw);
    result.addEventListener('click', (e) => {
      const play = e.target.closest('[data-play]');
      if (play) location.hash = '#/play/' + play.getAttribute('data-play');
    });
  }

  new MutationObserver(mount).observe(app, { childList: true, subtree: true });
  mount();
})();
