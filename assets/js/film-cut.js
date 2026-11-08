// Adapted from Codrops' MIT Kinetic Type Page Transition: staggered rows, rotation
// and scale on one GSAP timeline. The DOM hand-off happens behind an opaque frame.
(() => {
  let layer=null, motion=null;
  window.cancelFilmCut=()=>{motion?.kill();motion=null;layer?.remove();layer=null};
  window.filmCut=(word,caption,swap,origin)=>{
    cancelFilmCut();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap){swap();return}
    const esc=Museum.util.esc;
    word=String(word||'ARCHIVE').toUpperCase().slice(0,24);
    const coral=!!origin;
    const overlay=document.createElement('div');overlay.setAttribute('aria-hidden','true');
    overlay.className='film-cut'+(coral?' is-feature':'');layer=overlay;
    const ink=coral?'#ffffff':'#000000',stock=coral?'#002fa7':'#ffffff';
    const rows=Array.from({length:7},(_,i)=>'<div class="press-row"><span>'+esc(i%3===0?caption:word)+'</span>　'+esc(word)+'　'+esc(caption)+'　'+esc(word)+'</div>').join('');
    overlay.innerHTML='<div class="film-stock"></div><div class="letterpress">'+rows+'</div><svg class="film-aperture" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice"><defs><mask id="film-letter-hole"><rect width="1200" height="700" fill="white"/><text x="600" y="465" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="435" fill="black">'+esc(word)+'</text></mask></defs><rect width="1200" height="700" fill="'+stock+'" mask="url(#film-letter-hole)"/></svg>';
    overlay.style.setProperty('--stock',stock);overlay.style.setProperty('--print',ink);document.body.append(overlay);
    const stockEl=overlay.querySelector('.film-stock'),press=overlay.querySelector('.letterpress'),lines=overlay.querySelectorAll('.press-row'),ap=overlay.querySelector('svg');
    let dx=0,dy=0;
    if(origin && origin.isConnected){
      const r=origin.getBoundingClientRect();dx=Math.max(-160,Math.min(160,r.left+r.width/2-innerWidth/2));dy=Math.max(-90,Math.min(90,r.top+r.height/2-innerHeight/2));
    }
    let travelling=null;
    if(origin?.matches('.ghost-type') && origin.textContent.trim()===word){
      const rect=origin.getBoundingClientRect(),style=getComputedStyle(origin);
      travelling=document.createElement('div');travelling.className='travelling-word';travelling.textContent=origin.textContent;
      Object.assign(travelling.style,{left:rect.left+'px',top:rect.top+'px',font:style.font,letterSpacing:style.letterSpacing,color:ink});
      overlay.append(travelling);
    }
    const tl=gsap.timeline({onComplete:()=>{overlay.remove();if(layer===overlay){layer=null;motion=null}}});motion=tl;
    tl.set(ap,{autoAlpha:0})
      .fromTo(press,{x:dx,y:dy,rotation:-8,scale:.57,opacity:.1},{x:0,y:0,rotation:-78,scale:1.6,opacity:1,duration:.63,ease:'power2.inOut'},0)
      .fromTo(lines,{xPercent:i=>i%2?-42:26},{xPercent:i=>i%2?2:-15,stagger:.025,duration:.59,ease:'power3.inOut'},0)
      .fromTo(stockEl,{clipPath:'inset(50% 0% 50% 0%)'},{clipPath:'inset(0% 0% 0% 0%)',duration:.39,ease:'power3.inOut'},.13)
      .call(swap,[],.56)
      .set(ap,{autoAlpha:1},.72)
      .set(stockEl,{opacity:0},.72)
      .to(press,{rotation:-90,scale:2.7,opacity:0,duration:.38,ease:'power2.in'},.64)
      .fromTo(ap,{scale:.98,opacity:1},{scale:5.7,opacity:0,transformOrigin:'50% 54%',duration:.63,ease:'power3.inOut'},.75);
    if(travelling)tl.fromTo(travelling,{opacity:.12,scale:1,rotation:0},{opacity:1,scale:1.42,rotation:-18,y:-40,duration:.28,ease:'power2.in'},0)
      .to(travelling,{scale:2.45,rotation:-65,opacity:0,duration:.36},.28);
    if(!coral)tl.timeScale(1.65);
  };
})();
