// A bounded, low-resolution velocity field in the crystal viewing window.
// Scroll speed stirs the liquid. The pointer never draws onto the page.
(() => {
  let stop=null;
  Museum.events.on('route:mounted',({name})=>{
    stop?.();stop=null;
    if(name!=='home'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const lens=document.querySelector('.chapter__window');if(!lens)return;
    const canvas=document.createElement('canvas');canvas.className='glass-current';canvas.setAttribute('aria-hidden','true');
    const w=76,h=48,size=w*h;canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');if(!ctx)return;lens.prepend(canvas);
    let u=new Float32Array(size),v=new Float32Array(size),d=new Float32Array(size);
    let u2=u.slice(),v2=v.slice(),d2=d.slice(),p=d.slice(),p2=d.slice(),div=d.slice();
    let raf=0,last=0,lastY=scrollY,visible=false,t=0;
    const pixels=ctx.createImageData(w,h);
    function sample(a,x,y){
      x=Math.max(0,Math.min(w-1.001,x));y=Math.max(0,Math.min(h-1.001,y));
      const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,k=iy*w+ix;
      return (a[k]*(1-fx)+a[k+1]*fx)*(1-fy)+(a[k+w]*(1-fx)+a[k+w+1]*fx)*fy;
    }
    function tick(now){
      if(!visible||document.hidden)return;
      raf=requestAnimationFrame(tick);if(now-last<50)return;last=now;t+=.05;
      const wind=Math.min(1.5,Math.abs(scrollY-lastY)/60);lastY=scrollY;
      for(let j=0;j<2;j++){
        const x=Math.round(w*(.49+.32*Math.sin(t*.61+j*2.8))),y=Math.round(h*(.5+.3*Math.cos(t*.42+j*3)));
        for(let yy=-2;yy<=2;yy++)for(let xx=-2;xx<=2;xx++){const k=(y+yy)*w+x+xx;
          u[k]+=.24*Math.cos(t*.61+j*2.8)-yy*.07;v[k]+=(.14+wind)*Math.sin(t*.45+j*3)+xx*.07;d[k]=Math.min(2,d[k]+.24);}
      }
      for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
        const k=y*w+x,px=x-u[k],py=y-v[k];
        u2[k]=sample(u,px,py)*.982;v2[k]=sample(v,px,py)*.982;d2[k]=sample(d,px,py)*.972;
      }
      [u,u2]=[u2,u];[v,v2]=[v2,v];[d,d2]=[d2,d];
      for(let k=w+1;k<size-w-1;k++)div[k]=-.5*(u[k+1]-u[k-1]+v[k+w]-v[k-w]);
      for(let iter=0;iter<6;iter++){for(let k=w+1;k<size-w-1;k++)p2[k]=(div[k]+p[k-1]+p[k+1]+p[k-w]+p[k+w])*.25;[p,p2]=[p2,p]}
      for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
        const k=y*w+x;u[k]-=.5*(p[k+1]-p[k-1]);v[k]-=.5*(p[k+w]-p[k-w]);
        const l=Math.min(1,Math.abs(d[k+1]-d[k-1])*2.2+d[k]*.13),a=k*4;
        pixels.data[a]=139+l*108;pixels.data[a+1]=193+l*60;pixels.data[a+2]=173+l*73;pixels.data[a+3]=Math.min(105,l*120);
      }ctx.putImageData(pixels,0,0);
    }
    function resume(){cancelAnimationFrame(raf);if(visible&&!document.hidden)raf=requestAnimationFrame(tick)}
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;resume()});observer.observe(lens);
    document.addEventListener('visibilitychange',resume);
    stop=()=>{visible=false;observer.disconnect();cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',resume);canvas.remove()};
  });
})();
