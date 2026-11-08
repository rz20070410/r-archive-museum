// One perspective camera follows the scroll position down a corridor of photographs.
// Textures use embedded WebP data so WebGL works when the archive is opened from disk.
window.ArchiveProjection = function(host) {
  const T = window.THREE;
  let renderer;
  try { renderer = new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'}); }
  catch { return null; }
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(39,1,.1,50);
  const geometry = new T.PlaneGeometry(3.45,3.45,24,8);
  const textures = new Map();
  const loader = new T.TextureLoader();
  // A sparse field of dust stays in world space, revealing depth as the camera moves.
  const dustGeo=new T.BufferGeometry(),positions=new Float32Array(440*3);
  let seed=71;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<positions.length;i+=3){positions[i]=(random()-.5)*18;positions[i+1]=(random()-.5)*6;positions[i+2]=2-random()*108}
  dustGeo.setAttribute('position',new T.BufferAttribute(positions,3));
  const dustMat=new T.PointsMaterial({color:0xb5b8c8,size:.014,transparent:true,opacity:.34,depthWrite:false});
  const dust=new T.Points(dustGeo,dustMat);scene.add(dust);
  const slots = [];
  let games=[], progress=0, pointerX=0, pointerY=0, active=true, frame=0;
  let width=1,height=1, drawCount=0;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
  renderer.setClearColor(0,0);
  host.append(renderer.domElement);
  for(let i=0;i<5;i++){
    const material=new T.MeshBasicMaterial({transparent:true,side:T.DoubleSide,depthWrite:true});
    const mesh=new T.Mesh(geometry,material);
    scene.add(mesh);slots.push(mesh);
  }
  function texture(id){
    if(!textures.has(id)){
      const tex=loader.load(window.ArchiveTexture[id],()=>requestDraw());
      tex.colorSpace=T.SRGBColorSpace;textures.set(id,tex);
    }
    return textures.get(id);
  }
  function draw(){
    frame=0;if(!active || !games.length)return;
    const fraction=progress-Math.floor(progress),bank=Math.sin(fraction*Math.PI);
    const aspect=width/height;
    camera.position.set(bank*.48+pointerX*.075,.08+bank*.17+pointerY*.05,6.4-progress*4.5);
    camera.lookAt(0,.04,-progress*4.5);
    slots.forEach((mesh,slot)=>{
      const index=Math.floor(progress)+slot-1,g=games[index];
      mesh.visible=!!g;if(!g)return;
      const d=index-progress;
      const tex=texture(g.id);
      if(mesh.material.map!==tex){mesh.material.map=tex;mesh.material.needsUpdate=true}
      // The next photograph emerges edge-first; the previous one passes beside the lens.
      mesh.position.set(aspect*.73+d*2.65,Math.sin(d*1.35)*.48,-index*4.5);
      mesh.rotation.set(.025+pointerY*.016,Math.max(-.9,Math.min(.9,-.12-d*.32+pointerX*.025)),d*-.038);
      mesh.material.opacity=d<0?Math.max(0,1+1.5*d):Math.max(.12,1-d*.23);
      mesh.scale.setScalar(aspect<.85?.86:1);
    });
    dust.rotation.z=Math.sin(progress*.7)*.035;renderer.render(scene,camera);drawCount++;
    if(slots.some(s=>s.visible && s.material.map?.image?.complete))host.classList.add('is-rendered');
  }
  function requestDraw(){if(active&&!frame)frame=requestAnimationFrame(draw)}
  function resize(){
    const r=host.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();requestDraw();
  }
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  renderer.domElement.addEventListener('webglcontextlost',()=>{host.classList.remove('is-rendered');active=false});
  return {
    setGames(next){games=next;requestDraw()},
    move(value){progress=value;requestDraw()},
    look(x,y){pointerX=x;pointerY=y;requestDraw()},
    dispose(){active=false;observer.disconnect();cancelAnimationFrame(frame);dustGeo.dispose();dustMat.dispose();geometry.dispose();slots.forEach(s=>s.material.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()}
  };
};
