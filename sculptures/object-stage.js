(async()=>{
const catalog={
 mako:['茉子','真人照片参考 · 黑棉半身像','mako'],
 bailong:['白龙娘','银白树脂 · 角色雕像','bailong'],
 arabesque:['黄金藤蔓','AK-47 · GOLD ARABESQUE','arabesque'],
 AntiqueCamera:['大画幅相机','Maximillan Kamps · UX3D','AntiqueCamera'],
 IridescenceAbalone:['珠母贝','Abby Crawford · Eric Chadwick','IridescenceAbalone'],
 DragonAttenuation:['扫描龙','Stanford Computer Graphics Laboratory','DragonAttenuation']
};
let id=new URLSearchParams(location.search).get('work');if(!catalog[id])id='mako';
const [name,credit,asset]=catalog[id],$=s=>document.querySelector(s),host=$('main');
$('.caption h1').textContent=name;$('.caption p').textContent=credit;document.title=name+' · R-数字藏馆';
function script(path){return new Promise((yes,no)=>{const s=document.createElement('script');s.src=path;s.onload=yes;s.onerror=no;document.head.append(s)})}
let render,group;
try{
 render=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 render.setPixelRatio(Math.min(devicePixelRatio,1.65));render.outputColorSpace=THREE.SRGBColorSpace;render.toneMapping=THREE.ACESFilmicToneMapping;host.append(render.domElement);
 const scene=new THREE.Scene(),cam=new THREE.OrthographicCamera(-3,3,3,-3,.03,80);
 const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');
 ctx.fillStyle='#35373c';ctx.fillRect(0,0,1024,512);ctx.fillStyle='#ffffff';ctx.fillRect(120,66,155,270);ctx.fillRect(660,110,100,132);ctx.fillStyle='#808baf';ctx.fillRect(430,360,270,60);
 const tex=new THREE.CanvasTexture(c);tex.mapping=THREE.EquirectangularReflectionMapping;tex.colorSpace=THREE.SRGBColorSpace;
 const gen=new THREE.PMREMGenerator(render);const env=gen.fromEquirectangular(tex);scene.environment=env.texture;tex.dispose();gen.dispose();
 scene.add(new THREE.HemisphereLight(0xffffff,0x56525a,1.25));
 const light=new THREE.DirectionalLight(0xfff7ee,2.0);light.position.set(-3,5,4);scene.add(light);
 const rim=new THREE.DirectionalLight(0x9fb8ff,1.5);rim.position.set(2,3,-4);scene.add(rim);
 $('.notice').textContent='正在装入展品…';
 await script('assets/'+asset+'.js');
 {const buf=Uint8Array.from(atob(window.AssetBuffer),v=>v.charCodeAt(0));window.AssetBuffer=null;
 const gltf=await new Promise((ok,no)=>new ArchiveGLTFLoader().parse(buf.buffer,'',ok,no));group=gltf.scene;
 if(id==='DragonAttenuation')group.traverse(obj=>{if(obj.isMesh&&/cloth|drape|plane|backdrop/i.test(obj.name))obj.visible=false});
 }
 group.updateMatrixWorld(true);const box=new THREE.Box3();group.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))}});const bounds=box,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const pivot=new THREE.Group();pivot.add(group);group.position.sub(center);pivot.scale.setScalar(3.65/Math.max(size.x,size.y,size.z));scene.add(pivot);
 const hero=id==='arabesque',portrait=id==='mako'||id==='bailong';
 const initialYaw=hero?0:portrait?0:.36,initialPitch=hero||portrait?0:.16;
 let yaw=initialYaw,pitch=initialPitch,dist=6.9,auto=false,frame=0,then=0;
 const gray=new THREE.MeshStandardMaterial({color:0x969da3,roughness:.69,metalness:.08});
 const materials=new Map();group.traverse(o=>{
  if(!o.isMesh)return;
  materials.set(o,o.material);
  if(portrait||hero)o.material.toneMapped=false;
  if(hero){
   o.material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
     'outgoingLight=mix(diffuseColor.rgb,outgoingLight,.20);\n#include <opaque_fragment>');
   };
   o.material.needsUpdate=true;
  }
 });
 let updatePortrait=null;
 if(id==='mako'){
  await Promise.all([script('assets/mako-views.js'),script('assets/mako-diagonals.js'),script('portrait-surface.js')]);
  updatePortrait=await window.portraitSurface(group,window.MakoViews,window.MakoDiagonals);
  window.MakoViews=null;window.MakoDiagonals=null;
 }
 const inspection=$('.inspect');inspection.hidden=!hero;
 if(hero){
  const clay=$('[data-clay]');clay.onclick=()=>{const on=clay.getAttribute('aria-pressed')!=='true';clay.setAttribute('aria-pressed',String(on));materials.forEach((mat,obj)=>obj.material=on?gray:mat);request()};
  const ref=$('[data-ref]'),panel=$('.reference');ref.onclick=()=>panel.showModal();$('[data-close-ref]').onclick=()=>panel.close();
  inspection.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{const a=b.dataset.angle;auto=false;spin.textContent='自动旋转';yaw=a==='end'?-Math.PI/2:0;pitch=a==='top'?Math.PI/2-.00001:0;dist=6.9;request()});
 }
 function draw(time=0){frame=0;if(auto){yaw+=Math.min(.04,(time-then)/1000)*.29}then=time;
 const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight),asp=w/h;
 const half=(hero?Math.max(1.02,2.13/asp):Math.max(2.05,2.02*Math.min(1,size.x/size.y)/asp))*dist/6.9;
 cam.top=half;cam.bottom=-half;cam.left=-half*asp;cam.right=half*asp;cam.updateProjectionMatrix();render.setSize(w,h,false);
 const d=9;cam.position.set(d*Math.sin(yaw)*Math.cos(pitch),d*Math.sin(pitch),d*Math.cos(yaw)*Math.cos(pitch));cam.lookAt(0,0,0);if(updatePortrait)updatePortrait(yaw);render.render(scene,cam);if(auto&&!document.hidden)request()}
 function request(){if(!frame)frame=requestAnimationFrame(draw)}
 const canvas=render.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label',name+'，方向键旋转，滚轮缩放');
 const fingers=new Map();let span=0;
 canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);fingers.set(e.pointerId,[e.clientX,e.clientY]);span=0};
 canvas.onpointermove=e=>{const old=fingers.get(e.pointerId);if(!old)return;
 fingers.set(e.pointerId,[e.clientX,e.clientY]);
 if(fingers.size===2){const [a,b]=[...fingers.values()],s=Math.hypot(a[0]-b[0],a[1]-b[1]);if(span>0)dist=Math.max(3,Math.min(12,dist*span/Math.max(1,s)));span=s}
 else{yaw-=(e.clientX-old[0])*.009;pitch=Math.max(-1.569,Math.min(1.569,pitch+(e.clientY-old[1])*.007))}request()};
 canvas.onlostpointercapture=e=>{fingers.delete(e.pointerId);span=0};
 const zoom=n=>{dist=Math.max(3,Math.min(12,dist*n));request()};
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-160,Math.min(160,e.deltaY))*.0017))},{passive:false});
 const spin=$('[data-spin]');spin.onclick=()=>{auto=!auto;spin.textContent=auto?'暂停旋转':'自动旋转';request()};
 $('[data-plus]').onclick=()=>zoom(.86);$('[data-minus]').onclick=()=>zoom(1.16);
 $('[data-home]').onclick=()=>{yaw=initialYaw;pitch=initialPitch;dist=6.9;auto=false;spin.textContent='自动旋转';request()};
 canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home')$('[data-home]').click();else{yaw+=e.key==='ArrowLeft'?-.16:e.key==='ArrowRight'?.16:0;pitch=Math.max(-1.569,Math.min(1.569,pitch+(e.key==='ArrowUp'?.12:e.key==='ArrowDown'?-.12:0)));request()}};
 new ResizeObserver(request).observe(host);document.addEventListener('visibilitychange',()=>{if(!document.hidden)request()});
 document.querySelector('.notice').remove();request();
 // A texture may finish after the first demand-rendered frame.
 THREE.DefaultLoadingManager.onLoad=request;
 window.__objectState=()=>({id,yaw,pitch,dist,triangles:render.info.render.triangles});
}catch(err){console.error(err);$('.notice').textContent='当前设备未能载入三维视图。';const img=new Image();img.className='poster';img.src='../assets/plates/'+id+'.webp';host.replaceChildren(img);$('.tools').hidden=true}
})();

