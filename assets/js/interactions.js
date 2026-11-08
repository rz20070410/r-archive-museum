(() => {
  const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ink=document.createElement('div');ink.className='peer-traces';ink.setAttribute('aria-hidden','true');document.body.append(ink);
  let connection,identity,last=0;
  const chat=document.createElement('details');
  chat.className='shared-chat';chat.hidden=true;
  chat.innerHTML='<summary>馆内交谈</summary><div role="log" aria-live="polite"></div><form><input aria-label="给一同参观的人留言" maxlength="160" placeholder="给一同参观的人留言"><button>发送</button></form>';
  document.body.append(chat);
  chat.querySelector('form').onsubmit=async e=>{
    e.preventDefault();const input=chat.querySelector('input');
    if(!identity || !input.value.trim())return;
    try{const res=await fetch('/api/message',{method:'POST',body:input.value,headers:{'x-visitor-id':identity.id,'x-visitor-key':identity.key}});
      if(res.ok)input.value='';else Museum.toast('消息未送达，请稍后重试');
    }catch{Museum.toast('连接中断，消息未送达')}
  };
  function join(btn) {
    if(connection){connection.close();connection=null;identity=null;chat.hidden=true;chat.querySelector("[role=log]").replaceChildren();ink.replaceChildren();btn.textContent='共享展厅光标';return}
    connection=new EventSource('/api/visitors');
    connection.addEventListener('hello',e=>{identity=JSON.parse(e.data);chat.hidden=false;btn.textContent='停止共享光标'});
    connection.addEventListener('message',e=>{
      const item=JSON.parse(e.data);
      if(Array.isArray(item))return;
      const log=chat.querySelector('[role=log]'),line=document.createElement('p');
      line.textContent=item.author+' · '+item.message;log.append(line);
      if(log.children.length>30)log.firstChild.remove();log.scrollTop=log.scrollHeight;
    });
    connection.onmessage=e=>{
      const data=JSON.parse(e.data);if(!Array.isArray(data))return;const peers=data.filter(p=>p.id!==identity?.id&&p.route===document.body.dataset.view);
      ink.replaceChildren(...peers.map(p=>{const el=document.createElement('i');el.style.left=(p.x*100)+'%';el.style.top=(p.y*100)+'%';return el}));
    };
    connection.onerror=()=>{connection?.close();connection=null;identity=null;chat.hidden=true;chat.querySelector("[role=log]").replaceChildren();ink.replaceChildren();btn.textContent='共享展厅光标';Museum.toast('请使用随包的本地服务开启共同参观')};
  }
  if(location.protocol.startsWith('http')){
    const btn=document.createElement('button');btn.className='footer-link';btn.textContent='共享展厅光标';btn.onclick=()=>join(btn);document.querySelector('.footer-links').append(btn);
  }
  let seq='';
  document.addEventListener('keydown',e=>{
    if(e.target.closest('input,textarea,dialog') || e.ctrlKey || e.metaKey)return;
    if(e.key.length===1){seq=(seq+e.key.toLowerCase()).slice(-6);if(seq==='aurora'){document.body.classList.toggle('polar-night');Museum.toast('极夜展灯已切换')}}
  });
  document.addEventListener('pointermove',e=>{
    const route=document.body.dataset.view;
    if(identity && ['home','hall','sculptures'].includes(route) && performance.now()-last>150){
      last=performance.now();fetch('/api/position?'+new URLSearchParams({x:e.clientX/innerWidth,y:e.clientY/innerHeight,route}),{method:'POST',headers:{'x-visitor-id':identity.id,'x-visitor-key':identity.key}}).catch(()=>{});
    }
    const title=e.target.closest('.hero__titlewrap');if(title && !reduce())title.style.setProperty('--track',((e.clientX/innerWidth-.5)*.045)+'em');
  },{passive:true});
})();
