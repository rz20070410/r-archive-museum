// A small walkable gallery. Plinths are selectable with a ray; movement is constrained to the room.
window.walkArchive = function(onSelect) {
  const T=window.THREE,dialog=document.createElement('dialog');
  dialog.className='walk-dialog';
  dialog.innerHTML='<header><strong>漫游展廊</strong><button data-close>退出 ×</button></header><div class="walk-image"></div><footer><span>拖动环顾，点选展台。WASD 或下方按键移动。</span><div><button data-key="a" aria-label="向左">←</button><button data-key="w" aria-label="向前">↑</button><button data-key="s" aria-label="向后">↓</button><button data-key="d" aria-label="向右">→</button><button data-sound aria-pressed="false">开启空间声</button><button data-drop>落下一颗光珠</button></div></footer>';
  document.body.append(dialog);dialog.showModal();
  let renderer,raf=0,audio=null;
  const off=new AbortController(),options={signal:off.signal};
  function close(){
    cancelAnimationFrame(raf);off.abort();
    if(renderer){scene.traverse(obj=>{obj.geometry?.dispose();if(obj.material){obj.material.map?.dispose();obj.material.dispose()}});renderer.dispose();renderer.forceContextLoss()}
    audio?.close();dialog.remove();
  }
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(55,1,.08,80);
  dialog.querySelector('[data-close]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close()};window.addEventListener('hashchange',close,{once:true,signal:off.signal});
  const host=dialog.querySelector('.walk-image');
  try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'})}catch{host.textContent='这台设备无法启动 3D 漫游，退出后可分别浏览展品。';return}
  host.append(renderer.domElement);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));scene.background=new T.Color(0x0a151e);scene.fog=new T.FogExp2(0x122333,.058);
  scene.add(new T.HemisphereLight(0xc8e7ff,0x6b4b3e,1.9));
  const key=new T.DirectionalLight(0xe3f5ff,2);key.position.set(3,7,4);scene.add(key);
  function mesh(geometry,color,metal=.3){
    return new T.Mesh(geometry,new T.MeshStandardMaterial({color,metalness:metal,roughness:.28}));
  }
  const floor=mesh(new T.PlaneGeometry(50,50),0x1b2933);floor.rotation.x=-Math.PI/2;scene.add(floor);
  const grid=new T.GridHelper(40,40,0x778e9c,0x354857);grid.position.y=.01;scene.add(grid);
  const forms=[],plinths=[],names=['时隙','潮汐','织时','黄金藤蔓','茉子','大画幅相机','珠母贝','扫描龙','白龙娘'],ids=['chronos','tide','loom','arabesque','mako','AntiqueCamera','IridescenceAbalone','DragonAttenuation','bailong'];
  [3,4,8,0,1,2,5,6,7].forEach((i,slot)=>{
    const x=(slot%3-1)*4.5,z=-3-Math.floor(slot/3)*6;
    const plinth=mesh(new T.CylinderGeometry(1.55,1.65,.8,64),0x2a3643);
    plinth.position.set(x,.4,z);scene.add(plinth);plinth.userData.index=i;plinths.push(plinth);
    const shape=i<3?mesh(i===0?new T.TorusKnotGeometry(.78,.13,120,12):i===1?new T.TorusGeometry(.85,.22,16,80):new T.IcosahedronGeometry(.98,0),[0xcbd4df,0x75d2be,0xe6a96c][i]):new T.Sprite(new T.SpriteMaterial({map:new T.TextureLoader().load(ExhibitPlates[ids[i]]),color:0xffffff}));
    if(i>=3){shape.scale.set(i===3?3.25:1.75,i===3?1.25:2,1);shape.material.map.colorSpace=T.SRGBColorSpace;}
    shape.position.set(x,2,z);shape.userData.index=i;forms.push(shape);scene.add(shape);
    const canvas=document.createElement('canvas');canvas.width=400;canvas.height=96;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#d8e6ef';ctx.font='40px serif';ctx.textAlign='center';ctx.fillText(names[i],200,65);
    const label=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(canvas),transparent:true}));label.position.set(x,.62,z+1.5);label.scale.set(2,.48,1);scene.add(label);
  });
  camera.position.set(0,2.1,7);let yaw=0,pitch=-.08,drag=null;
  const keys=new Set(),balls=[],ray=new T.Raycaster(),v=new T.Vector2();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  dialog.querySelectorAll('[data-key]').forEach(btn=>{
    btn.onpointerdown=e=>{btn.setPointerCapture(e.pointerId);keys.add(btn.dataset.key)};
    btn.onlostpointercapture=()=>keys.delete(btn.dataset.key);
  });
  dialog.addEventListener('keydown',e=>{if('wasd'.includes(e.key.toLowerCase())&&e.key.length===1)keys.add(e.key.toLowerCase())});
  dialog.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear(),options);
  host.onpointerdown=e=>{host.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,moved:0}};
  host.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved+=Math.abs(dx)+Math.abs(dy);yaw-=dx*.005;pitch=Math.max(-1,Math.min(1,pitch-dy*.004));drag.x=e.clientX;drag.y=e.clientY};
  host.onpointerup=e=>{if(drag&&drag.moved<7){const r=host.getBoundingClientRect();v.set(2*(e.clientX-r.left)/r.width-1,1-2*(e.clientY-r.top)/r.height);ray.setFromCamera(v,camera);const hit=ray.intersectObjects(forms.concat(plinths))[0];if(hit){close();onSelect(hit.object.userData.index)}}drag=null};host.onpointercancel=()=>drag=null;
  const sound=dialog.querySelector('[data-sound]');let audible=false;
  sound.onclick=async()=>{audio??=new AudioContext();await audio.resume();audible=!audible;sound.setAttribute('aria-pressed',audible);sound.textContent=audible?'关闭空间声':'开启空间声'};
  function chime(x,speed){
    if(!audible||speed<.8)return;
    const osc=audio.createOscillator(),gain=audio.createGain(),pan=audio.createStereoPanner();
    pan.pan.value=Math.max(-1,Math.min(1,(x-camera.position.x)/8));osc.frequency.value=270+speed*35;
    gain.gain.setValueAtTime(.045/(1+Math.hypot(x-camera.position.x,camera.position.y)*.08),audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.42);
    osc.connect(gain).connect(pan).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.45);
  }
  dialog.querySelector('[data-drop]').onclick=()=>{
    if(balls.length>=12){const old=balls.shift();scene.remove(old);old.geometry.dispose();old.material.dispose()}
    const ball=mesh(new T.SphereGeometry(.18,18,12),0xf3cf91);ball.material.emissive.setHex(0x665039);
    ball.position.copy(camera.position);ball.position.x+=Math.sin(-yaw)*2;ball.position.z-=Math.cos(yaw)*2;ball.userData.vy=.3;scene.add(ball);balls.push(ball);
  };
  let then=performance.now();
  function draw(now){
    const dt=Math.min(.04,(now-then)/1000);then=now;
    const {width,height}=host.getBoundingClientRect();
    if(renderer.domElement.clientWidth!==Math.round(width)||renderer.domElement.clientHeight!==Math.round(height)||camera.aspect!==width/height){renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix()}
    camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0,'YXZ');
    const forward=(keys.has('w')?1:0)-(keys.has('s')?1:0),right=(keys.has('d')?1:0)-(keys.has('a')?1:0);
    camera.position.x=Math.max(-9,Math.min(9,camera.position.x+(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*dt*3.6));
    camera.position.z=Math.max(-19,Math.min(10,camera.position.z+(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*dt*3.6));
    forms.forEach((obj,i)=>{if(!reduced){obj.rotation.y+=dt*(.14+i*.04);obj.position.y=2+Math.sin(now*.0008+i)*.11}});
    balls.forEach(b=>{if(b.userData.rest)return;b.userData.vy-=dt*8.2;b.position.y+=b.userData.vy*dt;if(b.position.y<.18){b.position.y=.18;chime(b.position.x,-b.userData.vy);b.userData.vy*=-.66;if(b.userData.vy<.15)b.userData.rest=true}});
    renderer.render(scene,camera);raf=requestAnimationFrame(draw);
  }draw(then);
};
