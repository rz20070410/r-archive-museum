window.HistoryView = (() => {
  const entries=[
    ['11.06 — 07','游戏箱','从一局游戏开始','最初收进去的是游戏。蛇向前一步，方块落下一格，胜负和最高分留在自己的设备里。后来，二十三种不同的规则有了一扇共同的门。','assets/art/snake.webp'],
    ['11.08','银弧','一间有纵深的展厅','银白色水晶成了入口，游戏沿圆环展开。饶智发现，离开展厅再回来时水晶会消失。一次小小的往返，成了我们检验这座馆的方式。','assets/plates/chronos.webp'],
    ['11.08','藏馆','书、雕塑与声音','最初六本书加入书架，《时隙》《潮汐》《织时》进入雕塑厅。四十九首歌可以陪着访客从一间展室走到另一间。','assets/plates/loom.webp'],
    ['11.08','展映','让一幅画先开口','这一版为每款游戏重新生成封面。滚动成为镜头的运动，标题从背景走到前景，再从字形之间，显出下一件展品。','assets/art/breakout.webp']
  ];
  return {mount(root){
    root.innerHTML='<article class="folio"><section class="folio-hero"><div><p class="folio-date">2026 年 11 月 · 开发手记</p><h1>藏馆的<br><em>来处。</em></h1><p>先有一只游戏箱，后来才有了展厅。<br>这里记下它是怎样被三位合作者一点点做出来的。</p><button class="folio-down">沿革 ↓</button></div></section><section class="folio-record"><header><small>2026.11</small><h2>沿革</h2></header><div class="folio-tabs" role="group" aria-label="选择历史阶段">'+entries.map((e,i)=>'<button data-era="'+i+'">'+e[1]+'</button>').join('')+'</div><div class="folio-leaf" aria-live="polite"></div></section><section class="folio-makers"><h2>共作者</h2><div class="maker-line"><strong>饶智</strong><small>发起 · 策展</small><p>决定这里收藏什么，也决定什么值得推倒重做。</p></div><div class="maker-line"><strong>GPT 娘茉子</strong><small>视觉设计 · 验收</small><p>把对画面的要求拆成可以实际走过的镜头，再一次次返回现场。</p><img src="assets/people/mako.png" alt="白龙娘形象的茉子"></div><div class="maker-line"><strong>大肥鱼</strong><small>DeepSeek · 开发</small><p>把展厅、唱片机与动力雕塑，做成能在浏览器里运行的作品。</p></div></section></article>';
    const leaf=root.querySelector('.folio-leaf');
    const show=i=>{const e=entries[i];leaf.innerHTML='<div class="folio-photo"><img src="'+e[4]+'" alt="'+e[1]+'阶段的作品图像"></div><div class="folio-story"><time>'+e[0]+'</time><h3>'+e[2]+'</h3><p>'+e[3]+'</p></div>';
      root.querySelectorAll('[data-era]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.era===i));
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches)leaf.animate([{opacity:.35,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:360});
    };
    root.querySelectorAll('[data-era]').forEach(b=>b.onclick=()=>show(+b.dataset.era));
    root.querySelector('.folio-down').onclick=()=>root.querySelector('.folio-record').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    show(0);
  },unmount(){}};
})();
