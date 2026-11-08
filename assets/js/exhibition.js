(() => {
  const U=Museum.util, A=window.MUSEUM_GAMES, all=A.games;
  const english=['Serpentine','Falling Form','Impact','Still Life','Powers of Two','The Flock','Deep Orbit','The Bastion','Silent Field','Fault Lines','Green Room','Afterimage','Solitaire','Paper Wings','Five Stones','River Crossing','The General','Night Match','Last Light','Echo Chamber','In Phase','Mirror World','Hexagon'];
  const words={全部:'COLLECTION',街机:'ARCADE',益智:'PUZZLE',经典:'CLASSICS',休闲:'LEISURE',挑战:'TRIAL',策略:'STRATEGY',卡牌:'CARDS',对战:'DUEL',收藏:'SAVED'};
  const title=g=>english[all.indexOf(g)]||g.title;
  window.ArchiveFilmTitle=title;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let memory={tag:'全部',query:'',index:0,grid:false}, cleanup=()=>{};
  function favorites(){
    let list=Museum.store.get('favorites',null);
    if(!Array.isArray(list)){try{list=JSON.parse(localStorage.getItem('neon-arcade.favorites'))}catch{}}
    return Array.isArray(list)?list:[];
  }
  function favorite(g){
    const list=favorites(),has=list.includes(g.id);
    Museum.store.set('favorites',has?list.filter(i=>i!==g.id):list.concat(g.id));
    Museum.events.emit('favorites:change',{id:g.id,added:!has});
  }
  function split(text){return Array.from(text,c=>'<i>'+U.esc(c)+'</i>').join('')}
  function detail(root,id){
    const g=all.find(x=>x.id===id);
    if(!g){root.innerHTML='<section class="film-detail"><h1>未找到这款游戏</h1><a href="#/hall">返回游戏展厅</a></section>';return}
    let score=0;try{score=Number(JSON.parse(localStorage.getItem('neon-arcade.best.'+g.id)))||0}catch{}
    document.title=g.title+' · R-数字藏馆';
    root.innerHTML='<article class="film-detail"><div class="detail-wash" aria-hidden="true"></div><a class="return-link" href="#/hall">← 返回展厅</a><div class="film-detail-layout"><div class="detail-portrait">'+Museum.coverHtml(g)+'</div><div class="detail-text"><small>'+U.esc(g.tags.join('　/　'))+'</small><p class="latin-title">'+title(g)+'</p><h1 aria-label="'+U.esc(g.title)+'">'+split(g.title)+'</h1><p>'+U.esc(g.description||g.subtitle)+'</p><div class="film-actions"><a class="primary-glass" href="#/play/'+g.id+'">开始游戏　↗</a><button data-fav></button></div></div></div><section class="detail-notes"><div><h2>操作</h2>'+(g.controls||[]).map(c=>'<p><kbd>'+U.esc(c.keys)+'</kbd> '+U.esc(c.action)+'</p>').join('')+'</div><div><h2>玩法提示</h2><p>'+U.esc(g.tips||g.subtitle)+'</p></div><div><h2>最高分</h2><p>'+score+'</p></div></section></article>';
    root.querySelector('.detail-wash').style.backgroundImage='url(assets/art/'+g.id+'.webp)';
    const fav=root.querySelector('[data-fav]');
    const sync=()=>{const yes=favorites().includes(id);fav.textContent=yes?'★ 已收藏':'☆ 收藏';fav.setAttribute('aria-pressed',yes)};
    sync();fav.onclick=()=>{favorite(g);sync()};
    const controller=new AbortController();
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]'))location.hash='/hall'},{signal:controller.signal});
    if(!reduced())gsap.from(root.querySelectorAll('.detail-text h1 i'),{yPercent:70,rotation:8,opacity:0,stagger:.045,duration:.62,delay:.18,clearProps:'all'});
    cleanup=()=>controller.abort();
  }
  function gallery(root){
    const controller=new AbortController(),listen=(el,type,fn,options={})=>el.addEventListener(type,fn,{...options,signal:controller.signal});
    root.innerHTML='<div class="exhibition"><section class="screening"><div class="film-wash" aria-hidden="true"></div><div class="ghost-type" aria-hidden="true"></div><div class="film-tools"><label>分类 <select aria-label="游戏分类">'+['全部',...A.tags,'收藏'].map(t=>'<option>'+U.esc(t)+'</option>').join('')+'</select></label><input type="search" aria-label="搜索游戏" placeholder="搜索游戏"><button data-layout></button></div><div class="projection"><img class="film-still" alt=""></div><div class="film-copy"><small class="film-counter"></small><p class="film-name"></p><h1></h1><p class="film-caption"></p><a class="primary-glass film-open">查看展品　↗</a></div><a class="film-target" aria-label="查看当前展品"></a><div class="reel-controls"><button data-prev aria-label="上一件">←</button><span class="reel-meter"></span><button data-next aria-label="下一件">→</button><span class="scroll-hint">滚动浏览</span></div><div class="film-index"></div><p class="film-empty" hidden>没有匹配的游戏。</p></section></div>';
    const q=s=>root.querySelector(s),box=q('.exhibition'),stage=q('.screening'),search=q('input'),select=q('select'),index=q('.film-index');
    select.value=memory.tag;search.value=memory.query;
    let list=[],selected=-1,step=1,projection=null,tween=null,resizeObserver=null,touch=null;
    const obj={position:0};
    if(!reduced())projection=ArchiveProjection(q('.projection'));
    function draw(value){
      const n=Math.min(list.length-1,Math.max(0,Math.round(value))),g=list[n];if(!g)return;
      projection?.move(value);if(n===selected)return;
      selected=n;memory.index=n;
      q('.film-wash').style.backgroundImage='url("'+new URL('assets/art/'+g.id+'.webp',document.baseURI).href+'")';
      q('.film-still').src='assets/art/'+g.id+'.webp';q('.film-name').textContent=title(g);
      q('.ghost-type').textContent=title(g).toUpperCase();q('h1').textContent=g.title;
      q('.film-counter').textContent=String(n+1).padStart(2,'0')+' / '+String(list.length).padStart(2,'0')+'　·　'+g.tags[0];
      q('.film-caption').textContent=g.subtitle;
      for(const a of root.querySelectorAll('.film-open,.film-target'))a.href='#/game/'+g.id;
      q('.reel-meter').style.setProperty('--fill',((n+1)/list.length*100)+'%');
      q('[data-prev]').disabled=n===0;q('[data-next]').disabled=n===list.length-1;
      if(!reduced())gsap.fromTo(q('h1'),{y:13,opacity:.35},{y:0,opacity:1,duration:.32,overwrite:true});
    }
    function bounds(){
      step=Math.max(210,Math.round(innerHeight*.57));
      box.style.height=memory.grid?'auto':('calc(100svh + '+Math.max(0,list.length-1)*step+'px)');
    }
    function go(n){if(!list.length)return;n=Math.max(0,Math.min(n,list.length-1));window.scrollTo({top:box.getBoundingClientRect().top+scrollY+n*step,behavior:'instant'});tween?.kill();obj.position=n;draw(n)}
    function update(reset){
      list=all.filter(g=>(memory.tag==='全部'||(memory.tag==='收藏'?favorites().includes(g.id):g.tags.includes(memory.tag)))&&(g.title+' '+title(g)+' '+g.tags.join(' ')+' '+g.subtitle).toLowerCase().includes(memory.query.toLowerCase().trim()));
      selected=-1;stage.classList.toggle('is-grid',memory.grid);stage.classList.toggle('is-empty',!list.length);
      q('.film-empty').hidden=!!list.length;q('[data-layout]').textContent=memory.grid?'空间展映':'全部封面';
      index.innerHTML=memory.grid?list.map(g=>'<a href="#/game/'+g.id+'">'+Museum.coverHtml(g)+'<strong>'+U.esc(g.title)+'</strong><small>'+title(g)+'</small></a>').join(''):'';
      bounds();projection?.setGames(list);const n=reset?0:Math.min(memory.index,Math.max(0,list.length-1));
      if(memory.grid||!list.length){window.scrollTo({top:0,behavior:'instant'});obj.position=n;draw(n)}else go(n);
    }
    update(false);
    listen(window,'scroll',()=>{if(!stage.isConnected||memory.grid||!list.length)return;
      const pos=Math.max(0,Math.min(list.length-1,-box.getBoundingClientRect().top/step));
      if(reduced()){draw(pos);return}
      tween=gsap.to(obj,{position:pos,duration:.42,ease:'power2.out',overwrite:true,onUpdate:()=>draw(obj.position)});
    },{passive:true});
    resizeObserver=new ResizeObserver(bounds);resizeObserver.observe(stage);
    listen(search,'input',()=>{memory.query=search.value;update(true)});
    listen(select,'change',()=>{const tag=select.value;window.filmCut(words[tag]||'ARCADE',tag,()=>{memory.tag=tag;update(true)},stage)});
    listen(q('[data-layout]'),'click',()=>{memory.grid=!memory.grid;update(false)});
    listen(q('[data-prev]'),'click',()=>go(selected-1));listen(q('[data-next]'),'click',()=>go(selected+1));
    listen(window,'keydown',e=>{if(e.target.closest('input,select,textarea,dialog,[data-vp-root]'))return;
      if(e.key==='/'){e.preventDefault();search.focus();return}
      if(!memory.grid && ['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();go(selected+(e.key==='ArrowRight'?1:-1))}
    });
    listen(stage,'pointermove',e=>{const x=e.clientX/innerWidth-.5,y=e.clientY/innerHeight-.5;
      if(!reduced()){stage.style.setProperty('--spacing',(.02+x*.065)+'em');projection?.look(x,y)}
    },{passive:true});
    listen(stage,'touchstart',e=>{const t=e.changedTouches[0];touch=[t.clientX,t.clientY]},{passive:true});
    listen(stage,'touchend',e=>{if(!touch||memory.grid)return;const t=e.changedTouches[0],dx=t.clientX-touch[0];if(Math.abs(dx)>65&&Math.abs(dx)>1.5*Math.abs(t.clientY-touch[1]))go(selected+(dx<0?1:-1));touch=null},{passive:true});
    cleanup=()=>{controller.abort();resizeObserver?.disconnect();tween?.kill();gsap.killTweensOf(obj);projection?.dispose()};
  }
  window.CinemaView={mount(root,params){if(params?.id)detail(root,params.id);else gallery(root)},unmount(){cleanup();cleanup=()=>{}}};
})();
