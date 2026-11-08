// Reuse the projection room's camera and texture cache; the reader remains outside the scene.
window.makeBookScreening=(root,read,closeReader)=>{
 const all=ArchiveBooks,esc=Museum.util.esc,order=[9,10,11,12,13,14,15,16,17,6,7,8,0,1,2,3,4,5];
 const filters={all:'全部藏书',romance:'病娇恋爱',web:'热门网文',classic:'古典与现代小说',other:'其他馆藏'};
 const group=i=>i>=12?'web':i>=9?'romance':i>=6?'classic':'other';
 const short=i=>all[i].slug?'读中文全文':all[i].platform?'去正版阅读':'阅读与试读';
 let tag='all',grid=false,active=0,items=[],step=1,shown=-1;
 const abort=new AbortController(),on=(t,event,fn,extra={})=>t.addEventListener(event,fn,{...extra,signal:abort.signal});
 root.innerHTML='<div class="exhibition book-exhibition"><section class="screening book-screening"><div class="film-wash"></div><div class="ghost-type" aria-hidden="true"></div><div class="film-tools"><label>书籍 <select aria-label="书籍分类">'+Object.entries(filters).map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label><input type="search" aria-label="搜索藏书" placeholder="书名或作者"><button data-layout>卡片书架</button></div><div class="projection"><img class="film-still" alt=""></div><div class="film-copy"><small class="film-counter"></small><p class="film-name"></p><h1></h1><p class="film-caption"></p><button class="primary-glass film-open"></button></div><button class="film-target" aria-label="打开当前书籍"></button><div class="reel-controls"><button data-prev aria-label="前一本">←</button><span class="reel-meter"></span><button data-next aria-label="后一本">→</button><span class="scroll-hint">滚动浏览书展</span></div><div class="film-index book-gallery"></div><p class="film-empty" hidden>没有找到这本书。</p></section></div>';
 const q=s=>root.querySelector(s),box=q('.exhibition'),stage=q('.screening'),index=q('.film-index'),input=q('input');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const projector=reduced?null:ArchiveProjection(q('.projection'));let tween=null;const playhead={v:0};
 function scrollToItem(n){
  n=Math.max(0,Math.min(items.length-1,n));window.scrollTo({top:box.getBoundingClientRect().top+scrollY+n*step,behavior:'instant'});
  gsap.killTweensOf(playhead);playhead.v=n;paint(n);
 }
 function open(i){if(i===undefined)return;read(i)}
 function paint(v){
  projector?.move(v);const n=Math.max(0,Math.min(items.length-1,Math.round(v))),i=items[n];if(i===undefined||n===shown)return;
  shown=active=n;const b=all[i],art='assets/art/books/'+i+'.webp';
  q('.film-still').src=art;q('.film-wash').style.backgroundImage='url("'+new URL(art,document.baseURI)+'")';q('.ghost-type').textContent=b.en;
  q('.film-counter').textContent=String(n+1).padStart(2,'0')+' / '+String(items.length).padStart(2,'0')+'　·　'+(b.kind||'世界书架');
  q('.film-name').textContent=b.author;q('h1').textContent=b.title;q('.film-caption').textContent=b.note;
  q('.film-open').textContent=short(i)+'　↗';q('[data-prev]').disabled=n===0;q('[data-next]').disabled=n===items.length-1;
  q('.reel-meter').style.setProperty('--fill',(n+1)/items.length*100+'%');
 }
 function measure(){step=Math.max(210,innerHeight*.55);box.style.height=grid?'auto':'calc(100svh + '+Math.max(0,items.length-1)*step+'px)'}
 function update(){
  items=order.filter(i=>(tag==='all'||tag===group(i))&&(all[i].title+all[i].author+all[i].en).toLowerCase().includes(input.value.trim().toLowerCase()));
  shown=-1;stage.classList.toggle('is-grid',grid);stage.classList.toggle('is-empty',!items.length);
  q('.film-empty').hidden=!!items.length;q('[data-layout]').textContent=grid?'空间展映':'卡片书架';
  index.innerHTML=grid?items.map(i=>'<button class="book-object" data-book="'+i+'"><span class="book-jacket"><img src="assets/art/books/'+i+'.webp" alt=""><span>'+esc(all[i].kind||all[i].en)+'</span></span><span class="book-info"><strong>'+esc(all[i].title)+'</strong><em>'+esc(all[i].author)+'</em><span class="book-read">'+short(i)+' ↗</span></span></button>').join(''):'';
  projector?.setGames(items.map(i=>({id:'book-'+i})));measure();scrollToItem(0);
 }
 on(index,'click',e=>{const b=e.target.closest('[data-book]');if(b)open(+b.dataset.book)});
 on(q('[data-layout]'),'click',()=>{grid=!grid;update()});on(q('select'),'change',e=>{tag=e.target.value;update()});on(input,'input',update);
 on(q('.film-open'),'click',()=>open(items[active]));on(q('.film-target'),'click',()=>open(items[active]));
 on(q('[data-prev]'),'click',()=>scrollToItem(active-1));on(q('[data-next]'),'click',()=>scrollToItem(active+1));
 on(window,'scroll',()=>{if(grid||document.querySelector('dialog[open]')||!items.length)return;
  const v=Math.max(0,Math.min(items.length-1,-box.getBoundingClientRect().top/step));if(reduced)paint(v);else tween=gsap.to(playhead,{v,duration:.36,overwrite:true,onUpdate:()=>paint(playhead.v)});
 },{passive:true});
 on(stage,'pointermove',e=>{if(!reduced)projector?.look(e.clientX/innerWidth-.5,e.clientY/innerHeight-.5)},{passive:true});
 on(window,'keydown',e=>{if(grid||document.querySelector('dialog[open]')||e.target.closest('input,select,[data-vp-root]'))return;if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();scrollToItem(active+(e.key==='ArrowRight'?1:-1))}});
 let start=null;on(stage,'touchstart',e=>{start=[e.touches[0].clientX,e.touches[0].clientY]},{passive:true});
 on(stage,'touchend',e=>{if(!start||grid)return;const t=e.changedTouches[0],dx=t.clientX-start[0],dy=t.clientY-start[1];if(Math.abs(dx)>65&&Math.abs(dx)>1.5*Math.abs(dy))scrollToItem(active+(dx<0?1:-1));start=null},{passive:true});
 const observer=new ResizeObserver(measure);observer.observe(stage);update();
 return ()=>{closeReader();abort.abort();observer.disconnect();gsap.killTweensOf(playhead);projector?.dispose()};
};
