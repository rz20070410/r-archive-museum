/* Individually composed vector covers. No external image requests. */
window.CardArt = (() => {
 const line=(d)=>`<path d="${d}" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
 const circle=(x,y,r,fill='currentColor')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
 const rect=(x,y,w,h,fill='currentColor')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${fill}"/>`;
 const text=(x,y,t,size=45)=>`<text x="${x}" y="${y}" text-anchor="middle" fill="currentColor" font-family="sans-serif" font-size="${size}" font-weight="700">${t}</text>`;
 const designs={
 snake:['01','NEON CIRCUIT','追逐 · 生长','#a8ddca',line('M60 196H168V152H110V104H215V65')+circle(215,65,13)+circle(236,180,7,'#fff')],
 breakout:['02','AFTER IMPACT','反弹 · 突破','#ecc9a8',Array.from({length:12},(_,i)=>rect(40+i%4*57,45+Math.floor(i/4)*26,48,16)).join('')+line('M80 210L183 130L232 170')+rect(112,223,86,9)+circle(232,170,7,'#fff')],
 tetris:['03','FALLING ORDER','旋转 · 消除','#b9bbeb',[[90,55],[120,55],[150,55],[120,85],[60,175],[60,205],[90,205],[120,205],[180,175],[210,175],[210,205]].map(([x,y])=>rect(x,y,26,26)).join('')],
 g2048:['04','POWERS OF TWO','合并 · 倍增','#dfd3b2',rect(65,57,155,155,'#ffffff10')+text(142,156,'2048',47)+line('M40 108V35H112M244 165V239H172')],
 minesweeper:['05','SILENT FIELD','推理 · 排雷','#b9d6e6',Array.from({length:25},(_,i)=>rect(55+i%5*39,43+Math.floor(i/5)*39,32,32,'#ffffff12')).join('')+circle(149,138,21)+line('M149 102V174M113 138H185M124 113L174 163M124 163L174 113')],
 space:['06','DEEP ORBIT','闪避 · 反击','#a8c9f2',line('M150 52L196 200L150 177L104 200Z')+line('M139 210V244M161 210V232')+circle(60,65,3)+circle(232,115,4)],
 flappy:['07','BETWEEN CLOUDS','轻触 · 飞行','#c3dcd8',rect(48,0,40,95)+rect(215,180,40,90)+circle(144,128,30)+line('M127 128L148 112L161 138')+circle(155,119,4,'#071018')],
 memory:['08','AFTERIMAGE','翻转 · 记忆','#d1bfde',rect(55,65,80,125,'#ffffff12')+rect(160,85,80,125,'#ffffff1c')+text(95,145,'✦',42)+text(200,165,'✦',42)],
 gomoku:['09','FIFTH MOVE','落子 · 连珠','#d2d7d7',Array.from({length:7},(_,i)=>`<path d="M45 ${35+i*32}H255M${45+i*35} 35V227" stroke="#ffffff20"/>`).join('')+[[80,67],[115,99],[150,131],[185,163]].map(([x,y])=>circle(x,y,13)).join('')+circle(220,195,13,'#fff')],
 xiangqi:['10','RIVER & REALM','楚河 · 汉界','#e2c8b2',line('M60 40V235M240 40V235M60 95H240M60 175H240')+circle(150,133,48,'#ffffff10')+text(150,150,'帥',48)+text(150,66,'楚 河',15)+text(150,219,'漢 界',15)],
 suika:['11','GRAVITY GARDEN','碰撞 · 合成','#b6d5b0',circle(149,158,67)+circle(87,75,25,'#dfe4c3')+circle(216,60,16,'#fff')+line('M123 108Q93 160 123 207M150 96Q119 160 150 223M178 108Q147 160 178 207')],
 sheep:['12','LAYER BY LAYER','匹配 · 解层','#d6d6bc',rect(64,75,140,140,'#ffffff15')+rect(82,57,140,140,'#ffffff25')+rect(100,39,140,140,'#ffffff25')+circle(158,104,23)+circle(180,104,23)+circle(169,91,23)+circle(169,124,20,'#18232c')],
 pool:['13','THE PERFECT ANGLE','瞄准 · 入袋','#9ec8be',circle(174,113,57)+circle(174,113,25,'#15252d')+text(174,124,'8',31)+circle(92,214,19,'#fff')+line('M40 246L118 150')],
 tower:['14','ABOVE THE CITY','堆叠 · 登高','#a9c4dc',Array.from({length:7},(_,i)=>rect(60+i*8,225-i*25,150-i*9,18,i===6?'#fff':'currentColor')).join('')],
 solitaire:['15','HOUSE OF ACES','排序 · 归位','#d5c4cf',rect(65,50,130,172,'#ffffff13')+rect(90,38,130,172,'#ffffff16')+text(155,147,'♠',75)+text(112,70,'A',20)],
 survivor:['16','LAST LIGHT','生存 · 突围','#bdc3e5',`<circle cx="150" cy="137" r="83" fill="none" stroke="currentColor" stroke-dasharray="3 16" stroke-width="5"/>`+circle(150,137,39,'#ffffff12')+line('M150 95V177M108 137H192')+circle(150,137,10,'#fff')],
 hextris:['17','SIX DIMENSIONS','旋转 · 六面','#b7cbdf',`<path d="M150 45L230 91V183L150 229L70 183V91Z M150 80L200 109V165L150 194L100 165V109Z" fill="none" stroke="currentColor" stroke-width="12"/>`+circle(150,137,9,'#fff')],
 'minesweeper-master':['18','MINEFIELD 36','36 × 36 · 40 MINES','#b9d6e6',Array.from({length:36},(_,i)=>`<rect x="${55+(i%6)*33}" y="${43+Math.floor(i/6)*33}" width="27" height="27" rx="3" fill="${i===8||i===20?'#f2b6c0':'#ffffff10'}"/>`).join('')+circle(149,137,15)],
 'xiangqi-master':['19','GRANDMASTER','楚河 · 汉界','#e2c8b2',line('M58 38V238M242 38V238M58 96H242M58 178H242')+circle(150,137,46,'#ffffff10')+text(150,154,'帅',46)+text(150,66,'楚 河',13)+text(150,219,'汉 界',13)+`<path d="M118 28L150 8L182 28" fill="none" stroke="currentColor" stroke-width="7"/>`],
 'gomoku-master':['20','FIVE IN A ROW','连珠 · 大师','#d2d7d7',Array.from({length:7},(_,i)=>`<path d="M45 ${35+i*32}H255M${45+i*35} 35V227" stroke="#ffffff18"/>`).join('')+[[78,67],[107,94],[136,121],[165,148],[194,175]].map(([x,y],i)=>circle(x,y,13,i===4?'#fff':'currentColor')).join('')],
 'sonar':['21','SONAR MAZE','回声 · 迷宫','#a5f3fc',line('M45 45H255V225H45Z')+line('M75 75H155V145H225')+circle(150,135,42,'#ffffff0a')+`<path d="M150 93A42 42 0 0 1 150 177M150 60A75 75 0 0 1 150 210" fill="none" stroke="currentColor" stroke-width="3" opacity=".5"/>`+circle(150,135,8,'#fff')],
 'syncrings':['22','SYNC RINGS','旋转 · 同步','#ddd6fe',`<circle cx="150" cy="137" r="85" fill="none" stroke="currentColor" stroke-width="6" opacity=".35"/><circle cx="150" cy="137" r="58" fill="none" stroke="currentColor" stroke-width="6" opacity=".55"/><circle cx="150" cy="137" r="32" fill="none" stroke="currentColor" stroke-width="6"/><path d="M150 52V222M65 137H235" stroke="#ffffff35" stroke-width="2"/><circle cx="150" cy="52" r="7" fill="#fff"/>`],
 'mirror':['23','MIRROR TWIN','同步 · 双生','#f5d0fe',line('M45 45H255V225H45Z')+line('M150 45V225')+circle(94,137,17,'#ffffff20')+circle(206,137,17,'#ffffff60')+line('M114 137H186')+`<path d="M138 122L150 137L138 152M162 122L150 137L162 152" fill="none" stroke="currentColor" stroke-width="4"/>`]
 };
 return {render(id){const d=designs[id];if(!d)return '';return `<div class="edition-cover" style="--ink:${d[3]}" aria-hidden="true"><span class="edition-number">${d[0]} / COLLECTION</span><svg viewBox="0 0 300 270"><g class="edition-symbol">${d[4]}</g></svg><span class="edition-name">${d[1]}</span><span class="edition-caption">${d[2]}</span></div>`;}};
})();
