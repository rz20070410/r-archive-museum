import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createReadStream} from 'node:fs';
import {stat,realpath} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const root=await realpath(path.dirname(fileURLToPath(import.meta.url)));
const peers=new Map();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.webm':'video/webm','.mp4':'video/mp4','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/visitors' && req.method==='GET'){
      if(peers.size>=64){res.writeHead(503).end();return}
      const id=randomUUID(),key=randomUUID();
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});
      peers.set(id,{key,res,route:'',x:0,y:0,last:0});res.write('event: hello\ndata: '+JSON.stringify({id,key})+'\n\n');
      res.on('close',()=>peers.delete(id));return;
    }
    if(url.pathname==='/api/message' && req.method==='POST'){
      const peer=peers.get(req.headers['x-visitor-id']);
      if(!peer || peer.key!==req.headers['x-visitor-key']){res.writeHead(403).end();return}
      if(Date.now()-(peer.lastMessage||0)<900){res.writeHead(429).end();return}
      let bytes=0,parts=[];
      for await(const chunk of req){bytes+=chunk.length;if(bytes>800){res.writeHead(413).end();return}parts.push(chunk)}
      const message=Buffer.concat(parts).toString('utf8').trim().slice(0,160);
      if(!message){res.writeHead(400).end();return}
      peer.lastMessage=Date.now();
      const event='event: message\ndata: '+JSON.stringify({author:req.headers['x-visitor-id'].slice(0,4),message})+'\n\n';
      for(const {res:client} of peers.values())client.write(event);
      res.writeHead(204).end();return;
    }
    if(url.pathname==='/api/position' && req.method==='POST'){
      const peer=peers.get(req.headers['x-visitor-id']);
      if(!peer || peer.key!==req.headers['x-visitor-key']){res.writeHead(403).end();return}
      const x=Number(url.searchParams.get('x')), y=Number(url.searchParams.get('y')),route=url.searchParams.get('route');
      if(!(x>=0&&x<=1&&y>=0&&y<=1)||!['home','hall','sculptures'].includes(route)){res.writeHead(400).end();return}
      Object.assign(peer,{x,y,route,last:Date.now()});res.writeHead(204).end();return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
    const file=await realpath(path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)));
    if(!file.startsWith(root+path.sep)||!(await stat(file)).isFile()){res.writeHead(404).end();return}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(404).end()}
});
setInterval(()=>{
  if(!peers.size)return;
  const list=Array.from(peers,([id,p])=>({id,x:p.x,y:p.y,route:p.route,last:p.last})).filter(p=>Date.now()-p.last<4500);
  const data='data: '+JSON.stringify(list)+'\n\n';for(const {res} of peers.values())res.write(data);
},250).unref();
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('R-数字藏馆  http://127.0.0.1:'+server.address().port));

