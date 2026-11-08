(() => {
  'use strict';
  const books = window.ArchiveBooks;
  const esc = Museum.util.esc;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const view = (kicker, title, note) => '<header class="archive-lead"><small>'+kicker+'</small><h1>'+title+'</h1><p>'+note+'</p></header>';
  const link = (url,label) => '<a class="glass-action" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+label+' ↗</a>';
  const scripts = new Map();
  function loadScript(url) {
    if(!scripts.has(url))scripts.set(url,new Promise((yes,no)=>{
      const tag=document.createElement('script');tag.src=url;tag.onload=yes;tag.onerror=()=>{scripts.delete(url);no(Error('阅读组件加载失败'))};document.head.append(tag);
    }));
    return scripts.get(url);
  }
  function savedFile(key, file) {
    return new Promise((resolve,reject)=>{
      const open=indexedDB.open('r-archive-library',1);
      open.onupgradeneeded=()=>open.result.createObjectStore('volumes');
      open.onerror=()=>reject(open.error);
      open.onsuccess=()=>{
        const db=open.result, tx=db.transaction('volumes',file?'readwrite':'readonly');
        const req=file?tx.objectStore('volumes').put(file,key):tx.objectStore('volumes').get(key);
        tx.oncomplete=()=>{resolve(req.result);db.close()};tx.onerror=()=>{reject(tx.error);db.close()};
      };
    });
  }
  let reader=null, epub=null, rendition=null, generation=0;
  function closeReader() {
    generation++;
    if(epub){try{epub.destroy()}catch{}}
    epub=null;rendition=null;
    if(reader){reader.remove();reader=null}
    document.body.classList.remove('reading');
  }
  function readBook(index) {
    closeReader();
    const b=books[index],dialog=document.createElement('dialog');
    reader=dialog;dialog.className='read-dialog';
    dialog.innerHTML='<header><div><small>阅览室</small><h2>'+esc(b.title)+'</h2></div><button data-close aria-label="关闭阅读器">关闭 ×</button></header><div class="reader-actions"><button data-sample>英文原版试读</button><label class="glass-action">导入本书 EPUB<input type="file" accept=".epub,application/epub+zip" hidden></label><button data-local hidden>继续读本机版本</button>'+link(b.source,'中文版阅读')+link(b.borrow,'图书馆借阅')+'</div><p class="reader-status" role="status"></p><div class="reader-body"></div><footer class="reader-nav" hidden><button data-prev>← 上一页</button><button data-mode></button><button data-next>下一页 →</button></footer>';
    if(b.platform)dialog.querySelector('.reader-actions').innerHTML=link(b.source,'在起点阅读')+'<label class="glass-action">导入本书 EPUB<input type="file" accept=".epub" hidden></label><button data-local hidden>继续读本机版本</button>';
    if(b.slug)dialog.querySelector('.reader-actions').innerHTML='<label>目录 <select data-chapter aria-label="章节目录"></select></label><a class="glass-action" href="assets/books/'+b.slug+'/text.txt" download="'+esc(b.title)+'.txt">保存 TXT</a>'+(b.kind?.startsWith('病娇恋爱')?'':link(b.source,'原文出处'));
    document.body.append(dialog);dialog.showModal();document.body.classList.add('reading');
    const q=s=>dialog.querySelector(s),body=q('.reader-body'),status=q('.reader-status'),nav=q('.reader-nav');
    const online=()=>{
      generation++;if(epub){epub.destroy();epub=null;rendition=null}
      nav.hidden=true;
      if(b.platform){
        status.textContent='正版平台阅读 · 章节及订阅以平台为准';
        body.innerHTML='<div class="rights-book"><img src="assets/art/books/'+index+'.webp" alt=""><div><small>'+esc(b.kind)+'</small><h3>'+esc(b.title)+'</h3><p>'+esc(b.note)+'</p>'+link(b.source,'打开正版作品')+'</div></div>';return;
      }
      const frame=document.createElement('iframe');frame.src=b.sample;frame.title=b.title+' · OverDrive 原版试读';
      body.replaceChildren(frame);status.innerHTML='图书馆提供英文样章，插图随原版显示。若内嵌页未能加载，可'+link(b.sample,'在新窗口阅读')+'。';
    };
    let file=null,paged=Museum.store.get('book.layout','page')==='page';
    async function local() {
      const turn=++generation;
      status.textContent='正在打开电子书…';
      try{
        await loadScript('lib/jszip/jszip.min.js');await loadScript('lib/epubjs/epub.min.js');
        const bytes=await file.arrayBuffer();
        if(turn!==generation)return;
        if(epub)epub.destroy();
        body.replaceChildren();nav.hidden=false;
        epub=ePub({replacements:'blobUrl'});
        await epub.open(bytes,'binary');
        await epub.ready;
        if(turn!==generation)return;
        rendition=epub.renderTo(body,{width:'100%',height:'100%',flow:paged?'paginated':'scrolled-doc',manager:paged?'default':'continuous',spread:'none',allowScriptedContent:false});
        rendition.themes.default({body:{color:'#222','background-color':'#f6f1e6','line-height':'1.8'},img:{'max-width':'100%','height':'auto'}});
        const chapter=q('[data-chapter]');
        if(chapter){
          const nav=await epub.loaded.navigation;
          if(turn!==generation)return;
          chapter.replaceChildren(...nav.toc.map(item=>new Option(item.label.trim(),item.href)));
          chapter.onchange=()=>rendition.display(chapter.value);
        }
        const pos=Museum.store.get('book.pos.'+index,null);
        try{await rendition.display(pos||undefined)}catch{await rendition.display()}
        if(turn!==generation)return;
        const remember=loc=>{if(!loc?.start)return;Museum.store.set('book.pos.'+index,loc.start.cfi);if(chapter)chapter.value=loc.start.href};
        rendition.on('relocated',remember);remember(rendition.currentLocation());
        rendition.on('keydown',e=>{if(paged && ['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();rendition[e.key==='ArrowLeft'?'prev':'next']()}});
        rendition.on('rendered',(_,v)=>{
          let start;const doc=v.document;
          doc?.addEventListener('touchstart',e=>{start=e.changedTouches[0].clientX},{passive:true});
          doc?.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-start;if(paged && Math.abs(dx)>70)rendition?.[dx>0?'prev':'next']()},{passive:true});
        });
        q('[data-mode]').textContent=paged?'切换至上下滚动':'切换至左右翻页';
        status.textContent=(paged?'左右翻页':'上下滚动')+(b.slug?' · 中文全文':' · 本机 EPUB · '+file.name);
      }catch(e){if(turn===generation){status.textContent='无法打开这份 EPUB。请选择无加密的有效 EPUB 文件，或使用英文原版试读。';nav.hidden=true}}
    }
    q('[data-close]').onclick=closeReader;dialog.oncancel=e=>{e.preventDefault();closeReader()};
    q('[data-prev]').onclick=()=>rendition?.prev();q('[data-next]').onclick=()=>rendition?.next();
    q('[data-mode]').onclick=()=>{paged=!paged;Museum.store.set('book.layout',paged?'page':'scroll');local()};
    if(b.slug){
      status.textContent='正在打开中文正文…';
      loadScript('assets/books/'+b.slug+'/chapters.js').then(()=>{
        if(reader!==dialog)return;
        const bytes=Uint8Array.from(atob(window.ClassicTexts[b.slug]),c=>c.charCodeAt(0));
        file=new File([bytes],b.title+'.epub',{type:'application/epub+zip'});local();
      }).catch(()=>{if(reader===dialog)status.textContent='正文文件未能加载，请重新解压完整网站。'});
      return;
    }
    if(q('[data-sample]'))q('[data-sample]').onclick=online;q('[data-local]').onclick=local;
    q('input').onchange=async e=>{
      const next=e.target.files[0];if(!next)return;
      file=next;Museum.store.set('book.pos.'+index,null);q('[data-local]').hidden=false;
      try{await savedFile(index,next)}catch{}if(reader===dialog)local();
    };
    status.textContent='正在打开书籍…';
    savedFile(index).then(f=>{
      if(reader!==dialog || file)return;
      if(f){file=f;q('[data-local]').hidden=false;local()}else online();
    }).catch(()=>{if(reader===dialog&&!file)online()});
  }
  let leaveShelf=null;
  window.BooksView={mount(root){leaveShelf=makeBookScreening(root,readBook,closeReader)},unmount(){leaveShelf?.();leaveShelf=null}};
  const works=[['chronos','CHRONOS · 时隙','开普勒环','金属薄片沿着同一条轨道公转。每转一圈，光替它重新刻出时间。'],['tide','潮汐','青瓷与水','青色薄片合拢又舒展。海面有起伏，瓷器也可以记得潮水。'],['loom','织时','铜丝与珐琅','经与纬从未抵达同一刻。暖铜交错，红色的缝隙才显出深度。']];
  works.push(['arabesque','黄金藤蔓 · AK-47','金属与浅木浮雕','以饶智提供的三视图重建展品外形。切到灰模，观察木托下缘、弯曲的金色弹匣与准星留空。'],
    ['mako','茉子','黑棉半身像','依饶智提供的三张照片制作。正面的刘海、眼神和脸部皮肤取自正面照片，侧后发髻与腰部以补绘视图重建。'],
    ['AntiqueCamera','大画幅相机','馆外模型 · UX3D','Maximillan Kamps / UX3D，2018。相机模型采用 CC0，保留原有标志。'],
    ['IridescenceAbalone','珠母贝','馆外模型 · 虹彩','Abby Crawford 的贝壳与 Eric Chadwick 的虹彩材质，CC BY 4.0。'],
    ['DragonAttenuation','扫描龙','馆外模型 · 斯坦福','Stanford Computer Graphics Laboratory 扫描，Morgan McGuire 整理，Adobe 提供布景。仅限符合 Stanford Graphics 条款的用途。'],['bailong','白龙娘','银白树脂习作','以馆内白龙娘立绘为依据，保留紫瞳、盘角、花结、双翼与鳞尾。绕到背面，可见卷发与裙摆的层次。']);
  window.SculptureView={
    mount(root){
      root.innerHTML='<section class="archive-section sculpture-room">'+view('SCULPTURE','数字雕塑','绕到作品的另一侧。改变的也许只是目光，形体却会给出另一种回答。')+'<button class="explore-btn" type="button">步入三维展廊 ↗</button><nav class="work-tabs" aria-label="选择雕塑">'+works.map((w,i)=>'<button data-work="'+i+'"><img src="assets/plates/'+w[0]+'.webp" alt=""><span>'+w[1]+'</span></button>').join('')+'</nav><div class="work-stage"></div><div class="work-caption"></div></section>';
      const show=i=>{
        const w=works[i],frame=document.createElement('iframe');frame.src=i<3?'sculptures/'+w[0]+'.html':'sculptures/object.html?work='+w[0];frame.title=w[1];frame.allowFullscreen=true;
        root.querySelector('.work-stage').replaceChildren(frame);
        root.querySelector('.work-caption').innerHTML='<div><h2>'+w[2]+'</h2><p>'+w[3]+'</p></div>'+link(frame.src,'独立观展')+(i>=5&&i<=7?link('https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/'+w[0],'模型来源'):'')+([3,4,8].includes(i)?'<a class="glass-action" href="sculptures/assets/'+w[0]+'.glb" download>下载模型 · GLB ↓</a>':'');
        root.querySelectorAll('[data-work]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.work===i));
      };
      root.querySelector('.explore-btn').onclick=()=>walkArchive(show);root.querySelectorAll('[data-work]').forEach(b=>b.onclick=()=>show(+b.dataset.work));show(3);
    },unmount(){}
  };
})();
