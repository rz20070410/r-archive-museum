(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const small = matchMedia('(max-width: 700px)');
  const read = k => { try { return localStorage.getItem('rgb.' + k); } catch { return null; } };
  const write = (k,v) => { try { localStorage.setItem('rgb.' + k,v); } catch {} };
  let cleanup = () => {};
  function mount(grid) {
    cleanup();
    const controller = new AbortController(), signal = controller.signal;
    const mobile = document.documentElement.classList.contains('is-mobile');
    let mode = read('view') || (reduced.matches || mobile ? 'grid' : 'ring');
    let overlay, restoreFocus, selected = 0, cards = [], animations = [], timer, dragging = false, startX = 0, lastX = 0, suppress = false;
    const bar = document.createElement('div');
    bar.className = 'rgb-controls';
    bar.innerHTML = '<button type="button" data-view></button><button type="button" data-prev aria-label="上一个游戏">←</button><button type="button" data-next aria-label="下一个游戏">→</button><label><input type="checkbox" data-intro> 启用首次开场</label><button type="button" data-skip hidden>跳过开场</button><span role="status" aria-live="polite"></span>';
    grid.before(bar);
    const button = bar.querySelector('[data-view]'), status = bar.querySelector('[role=status]'), skip = bar.querySelector('[data-skip]');
    const preference = bar.querySelector('[data-intro]');
    preference.checked = read('intro') !== 'off';
    function finish() { if(overlay) { overlay.remove(); overlay=null; document.body.classList.remove('rgb-intro-active'); if(restoreFocus?.isConnected) restoreFocus.focus({preventScroll:true}); } clearTimeout(timer); animations.forEach(a => a.cancel()); animations = []; grid.classList.remove('rgb-opening'); skip.hidden = true; }
    let position=0, target=0, frame=0, lastTime=0, velocity=0;
    function paint() {
      const n=cards.length;if(!n)return;
      cards.forEach((card,i)=>{
        const d=((i-position+n/2)%n+n)%n-n/2;
        const angle=d*Math.PI*2/Math.max(12,n),radius=small.matches?Math.max(410,n*31):Math.max(590,n*48);
        card.style.transform=`translate(-50%,-50%) translate3d(${Math.sin(angle)*radius}px,${Math.abs(d)*5}px,${(Math.cos(angle)-1)*radius}px) rotateY(${-angle*180/Math.PI*.65}deg)`;
        card.style.opacity=String(Math.max(0,1-Math.abs(d)*.21));
        card.style.zIndex=String(100-Math.round(Math.abs(d)*10));
        card.toggleAttribute('inert',Math.abs(d)>3.5);
      });
    }
    function tick(now){frame=0;const dt=Math.min(32,now-(lastTime||now-16));lastTime=now;
      position+=(target-position)*(1-Math.exp(-dt/105));
      if(Math.abs(target-position)<.001)position=target;
      paint();if(position!==target)frame=requestAnimationFrame(tick);
    }
    function animateTo(value){target=value;if(reduced.matches){position=target;paint();}else if(!frame){lastTime=0;frame=requestAnimationFrame(tick);}}
    function layout() {
      cancelAnimationFrame(frame);frame=0;
      cards = [...grid.querySelectorAll('.game-card:not(.is-hidden)')];
      selected = cards.length ? ((selected % cards.length) + cards.length) % cards.length : 0;
      const ring = mode === 'ring' && !mobile && CSS.supports('perspective','1000px');
      grid.classList.toggle('rgb-ring', ring);
      grid.dataset.lenisPrevent = ''; 
      button.textContent = ring ? '切换 2D 网格' : '切换 3D 圆环';
      button.disabled = mobile;
      bar.querySelector('[data-prev]').hidden = !ring;
      bar.querySelector('[data-next]').hidden = !ring;
      grid.setAttribute('aria-label',ring ? '游戏圆环：拖动、滚轮或左右方向键选择' : '游戏网格');
      grid.querySelectorAll('.game-card').forEach(c => { c.style.removeProperty('transform'); c.style.removeProperty('opacity'); c.style.removeProperty('z-index'); c.classList.remove('is-active'); c.removeAttribute('inert'); });
      if(ring){cards.forEach((c,i)=>c.classList.toggle("is-active",i===selected));position=selected;target=selected;paint();}
      status.textContent = cards.length ? `${selected+1} / ${cards.length} · ${cards[selected].querySelector('.card-title')?.textContent || ''}` : '暂无匹配游戏';
    }
    function move(n) { finish();if(!cards.length)return; selected=((selected+n)%cards.length+cards.length)%cards.length;cards.forEach((c,i)=>c.classList.toggle('is-active',i===selected));status.textContent=`${selected+1} / ${cards.length} · ${cards[selected].querySelector('.card-title')?.textContent||''}`;animateTo(Math.round(target)+n); }
    bar.querySelector('[data-prev]').onclick = () => move(-1);
    bar.querySelector('[data-next]').onclick = () => move(1);
    button.onclick = () => { finish(); const before = new Map([...grid.children].map(c=>[c,c.getBoundingClientRect()])); mode = mode === 'ring' ? 'grid' : 'ring'; write('view',mode); layout(); if(!reduced.matches) cards.forEach(c=>{ const a=before.get(c), b=c.getBoundingClientRect(); if(!a || !b.width || !a.width || c.hasAttribute('inert')) return; c.animate([{translate:`${a.left-b.left}px ${a.top-b.top}px`,scale:`${a.width/b.width} ${a.height/b.height}`},{translate:'0px 0px',scale:'1 1'}],{duration:480,easing:'cubic-bezier(.2,.7,.2,1)'}); }); };
    preference.onchange = () => { write('intro',preference.checked ? 'on' : 'off'); if(preference.checked) write('seen',''); };
    skip.onclick = finish;
    grid.addEventListener('pointerdown',e => { if (!grid.classList.contains('rgb-ring') || e.button !== 0 || e.target.closest('button,a,input')) return; finish();startX = lastX = e.clientX; dragging = true; suppress = false; velocity=0; },{signal});
    window.addEventListener('pointermove',e => { if (!dragging) return; if (Math.abs(e.clientX-startX)>10) suppress = true; const delta=(lastX-e.clientX)/(small.matches?220:300);velocity=delta;target+=delta;position=target;paint();lastX=e.clientX; },{signal});
    window.addEventListener('pointerup',() => { if(dragging && suppress){const snap=Math.round(target+Math.max(-1.2,Math.min(1.2,velocity*5))); selected=((snap%cards.length)+cards.length)%cards.length;target=snap;move(0);} dragging=false; setTimeout(()=>{suppress=false;},0); },{signal});
    window.addEventListener('pointercancel',() => { dragging=false; suppress=false; },{signal});
    grid.addEventListener('click',e => { if(suppress) {e.preventDefault();e.stopImmediatePropagation();} },{capture:true,signal});
    let wheelAt=0;
    grid.addEventListener('wheel',e => { if(!grid.classList.contains('rgb-ring') || e.ctrlKey) return; e.preventDefault(); if(Date.now()-wheelAt>140) {move((Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)>0?1:-1);wheelAt=Date.now();} },{passive:false,signal});
    grid.addEventListener('keydown',e => { if(mode==='ring' && ['ArrowLeft','ArrowRight'].includes(e.key)) {e.preventDefault();move(e.key==='ArrowRight'?1:-1);cards[selected]?.focus({preventScroll:true});} if(e.key==='Escape') finish(); },{capture:true,signal});
    const filters = new MutationObserver(records => { if(records.some(r=>r.attributeName==='class' && r.target.matches('.game-card') && ((r.oldValue || '').split(' ').includes('is-hidden') !== r.target.classList.contains('is-hidden')))) {finish();layout();} });
    filters.observe(grid,{subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});
    let lastWidth=grid.clientWidth; const resize = new ResizeObserver(()=>{if(lastWidth!==grid.clientWidth){lastWidth=grid.clientWidth;layout();}}); resize.observe(grid);
    reduced.addEventListener('change',finish,{signal}); small.addEventListener('change',()=>{finish();layout();},{signal});
    layout();
    if(mode==='ring' && !mobile && !reduced.matches && read('intro')!=='off' && !read('seen')) {
      write('seen','1');
      grid.scrollIntoView({block:'center',behavior:'instant'});
      overlay=document.createElement('div'); overlay.className='rgb-intro';
      overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-label','游戏记忆长河开场'); overlay.setAttribute('aria-modal','true');
      const sky=document.createElement('div'); sky.className='rgb-intro-sky'; overlay.append(sky);
      const exit=document.createElement('button'); exit.className='rgb-intro-skip'; exit.textContent='跳过开场 · Esc'; exit.onclick=finish; overlay.append(exit);
      restoreFocus=document.activeElement; document.body.append(overlay); document.body.classList.add('rgb-intro-active'); exit.focus({preventScroll:true});
      overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish();} if(e.key==='Tab'){e.preventDefault();exit.focus();}},{signal});
      const stage=grid.getBoundingClientRect();
      sky.style.cssText=`position:fixed;left:${stage.left}px;top:${stage.top}px;width:${stage.width}px;height:${stage.height}px;perspective:1100px`;
      cards.filter(c=>!c.hasAttribute('inert')).slice(0,7).forEach((card,i)=>{
        const rect=card.getBoundingClientRect(), fragment=card.cloneNode(true);
        fragment.removeAttribute('id'); fragment.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
        fragment.setAttribute('aria-hidden','true'); fragment.setAttribute('inert',''); fragment.removeAttribute('data-id'); fragment.className='rgb-fragment';
        fragment.style.cssText='position:absolute;left:50%;top:50%;width:'+card.offsetWidth+'px;height:'+card.offsetHeight+'px;margin:0;animation:none;pointer-events:none;';
        sky.append(fragment);
        animations.push(fragment.animate([
          {transform:'translate(-50%,-50%) translate3d('+(i-3)*80+'px,'+(i%2?100:-100)+'px,-2200px) rotateZ('+(i%2?22:-22)+'deg)',opacity:0},
          {offset:.3,opacity:.8},
          {offset:.64,transform:'translate(-50%,-50%) translate3d('+((i-3)*100)+'px,'+(i%2?60:-60)+'px,-150px) rotateZ('+(i%2?8:-8)+'deg)',opacity:1},
          {transform:card.style.transform,opacity:Number(card.style.opacity)}
        ],{duration:1850-i*45,delay:i*45,easing:'cubic-bezier(.2,.6,.2,1)',fill:'both'}));
      });
      animations.push(overlay.animate([{backgroundColor:'#000'},{offset:.7,backgroundColor:'#000'},{backgroundColor:'transparent'}],{duration:2000,fill:'forwards'}));
      timer=setTimeout(finish,2000);
    }
    cleanup = () => {cancelAnimationFrame(frame);finish();controller.abort();filters.disconnect();resize.disconnect();bar.remove();};
  }
  let current;
  const observer = new MutationObserver(()=>{const grid=document.getElementById('game-grid');if(grid!==current){current=grid;if(grid)mount(grid);else cleanup();}});
  observer.observe(document.getElementById('app') || document.body,{childList:true,subtree:true});
  current=document.getElementById('game-grid');if(current)mount(current);
})();



