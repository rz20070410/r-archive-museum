/* OSS composition: Lenis 1.3.11 + Vanilla Tilt 1.8.1 (MIT). */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let lenis;
  function syncScroll() {
    lenis?.destroy(); lenis = null;
    const mobile = document.documentElement.classList.contains('is-mobile');
    if (!reduced.matches && !mobile && window.Lenis && document.querySelector('#game-grid')) {
      lenis = new Lenis({autoRaf:true, smoothWheel:true, syncTouch:true, lerp:.085,
        prevent:node => node.closest?.('.rgb-ring,.music-player,input,canvas,iframe')});
    }
  }
  function mount() {
    const grid = document.querySelector('#game-grid');
    document.querySelectorAll('.game-card').forEach(card => {
      const enabled = grid && !grid.classList.contains('rgb-ring') && !reduced.matches && !document.documentElement.classList.contains('is-mobile');
      if (!enabled) card.vanillaTilt?.destroy();
      else if (!card.vanillaTilt && window.VanillaTilt) VanillaTilt.init(card, {
        max:8, speed:650, perspective:1100, glare:true, 'max-glare':.18, gyroscope:false
      });
    });
    const title=document.querySelector('.hero-title');
    if(title && !title.dataset.universe) {
      title.dataset.universe='1';
      if(!reduced.matches) title.animate([{opacity:0,filter:'blur(15px)',letterSpacing:'.18em'},{opacity:1,filter:'blur(0px)',letterSpacing:'0em'}],{duration:1100,easing:'cubic-bezier(.16,1,.3,1)'});
    }
  }
  let scheduled=false, oldGrid;
  function refresh() {
    if(scheduled)return; scheduled=true;
    requestAnimationFrame(()=>{scheduled=false; const grid=document.querySelector('#game-grid'); if(grid!==oldGrid){oldGrid=grid;syncScroll();} mount();});
  }
  new MutationObserver(refresh).observe(document.querySelector('#app'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  reduced.addEventListener('change',()=>{syncScroll();mount();});
  // Touch coordinates drive the same library tilt and reflection as pointer motion.
  document.addEventListener('pointermove',e=>{
    const card=e.target.closest?.('.game-card'); if(!card || reduced.matches)return;
    const r=card.getBoundingClientRect();
    card.style.setProperty('--mx',((e.clientX-r.left)/r.width*100)+'%');
    card.style.setProperty('--my',((e.clientY-r.top)/r.height*100)+'%');
    if(e.pointerType==='touch' && card.vanillaTilt) card.dispatchEvent(new MouseEvent('mousemove',{clientX:e.clientX,clientY:e.clientY}));
  },{passive:true});
  document.addEventListener('pointerdown',e=>{
    const title=e.target.closest?.('.hero-title');
    if(title && !reduced.matches) title.animate([{filter:'blur(0)'},{filter:'blur(5px)',letterSpacing:'.07em'},{filter:'blur(0)'}],{duration:650});
  },{passive:true});
  refresh();
})();
