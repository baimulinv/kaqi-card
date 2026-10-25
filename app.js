(function(){
'use strict';
const L=window.CardLogic;
const STORAGE='kaqi-v1';
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=> {const b=new Uint8Array(18); crypto.getRandomValues(b); return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');};
const fresh=()=>({cards:[],paid:{},overrides:{},amounts:{},deviceKey:uid(),pushEnabled:false});
function load(){try{let s=JSON.parse(localStorage.getItem(STORAGE));if(s&&Array.isArray(s.cards))return {...fresh(),...s,paid:s.paid||{},overrides:s.overrides||{},amounts:s.amounts||{}};}catch(e){}return fresh();}
let storageProblem=false;
let s=load(); let tab=new URLSearchParams(location.search).get('tab')==='due'?'due':'home';let selected=L.iso(L.today()), amountFilter='', serverConfig=null, toastTimer=null,syncTimer=null;
const PUSH_BASE=String(window.KAQI_PUSH_CONFIG?.apiBase||'').replace(/\/$/,'');
const PUSH_CANDIDATES=[...new Set([PUSH_BASE,...(Array.isArray(window.KAQI_PUSH_CONFIG?.fallbackBases)?window.KAQI_PUSH_CONFIG.fallbackBases:[]),'https://kaqi-notify.pages.dev','https://kaqi-push.175805629.workers.dev'].filter(Boolean).map(x=>String(x).replace(/\/$/,'')))];
let activePushBase=PUSH_CANDIDATES[0],pushSyncProblem='',pushBusy=false,pushChecking=false;
function persist(){
 let ok=false;
 try{
  const serialized=JSON.stringify(s);
  localStorage.setItem(STORAGE, serialized);
  if(localStorage.getItem(STORAGE)!==serialized)throw new Error('浏览器未确认写入');
  ok=true;storageProblem=false;
 }catch(e){storageProblem=true;console.warn('Kaqi storage unavailable',e);}
 render();
 if(ok&&s.pushEnabled){clearTimeout(syncTimer);syncTimer=setTimeout(syncSchedule,600);}
 return ok;
}
function storageError(){return '保存失败：当前打开方式不允许存储数据。请改用支持本地存储的浏览器访问 HTTPS 站点，或检查浏览器的隐私/存储设置。';}
function cardError(message){const el=$('#cardFormError');el.textContent=message;el.hidden=false;}
function clearCardError(){const el=$('#cardFormError');el.hidden=true;el.textContent='';}

function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3400);}
function dueLabel(c){return c.dueMode==='fixed'?`账单${Number(c.fixedMonth)===0?'当月':'次月'}${c.fixedDay}日还款`:`账单日后${c.offsetDays}天还款`;}
function pretty(c){return `${esc(c.bank)}${c.name && c.name!==c.bank?' · '+esc(c.name):''}`;}
function displayName(c){return `${c.bank}${c.name && c.name!==c.bank?' · '+c.name:''}`;}
function todayDate(){return L.today();}
function labelDay(days){return days<0?`已过${-days}天`:days===0?'今天到期':days===1?'明天到期':`还有${days}天`;}
function activeTab(which){tab=which;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));render();}
function emptyCards(){return `<div class="paper empty"><div class="empty-icon">▣</div><h2>还没有添加信用卡</h2><p>只需录入每张卡的账单日和还款规则，<br>系统就能自动比较最佳刷卡日期。</p><button class="primary full" data-action="add">＋ 添加第一张信用卡</button><button class="linkbtn" data-action="demo">先用3张演示卡体验功能</button></div>`;}
function cardLine(r,i,valid){const c=r.card;return `<div class="paper result"><div class="rank ${i===0&&valid?'first':''}">${i+1}</div><div class="grow"><div class="result-title">${pretty(c)}${c.last4?' · '+esc(c.last4):''}</div><div class="result-sub">预计还款 ${L.zh(r.due)} ${r.ambiguous?' · 账单日边界':''}${!valid?' · 额度不足':''}</div></div><div class="number"><strong>${r.days}</strong><small>天后还款</small></div></div>`;}
function renderHome(){
 const d=L.fromISO(selected);
 let content=`<div class="eyebrow">${esc(new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(d))}</div><h1 class="headline">今天刷哪张卡？</h1><p class="subhead">自动比较账单周期，优先推荐预计还款最晚的信用卡。</p>`;
 if(!s.cards.length)return content+emptyCards();
 const spending=amountFilter!==''&&Number(amountFilter)>0?Number(amountFilter):0;
 const rows=s.cards.map(c=>L.spend(c,d,s.overrides)).map(r=>({...r,eligible:!(spending>0&&r.card.available!==''&&r.card.available!=null&&Number(r.card.available)<spending)})).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.days-a.days);
 const winner=rows.find(r=>r.eligible);
 if(winner){
  content+=`<div class="recommend"><div class="rec-top"><span class="rec-label">最佳用卡推荐 · 预计</span><span class="tag">TOP 1</span></div><div class="rec-bank">${esc(winner.card.bank)}</div><div class="rec-name">${esc(winner.card.name)}${winner.card.last4?'　尾号 '+esc(winner.card.last4):''}</div><div class="rec-days"><strong>${winner.days}</strong><span>天后还款</span></div><div class="rec-foot"><div><small>预计入账所属账单日</small><strong>${L.fullZh(winner.statement)}</strong></div><div><small>预计最后还款日</small><strong>${L.fullZh(winner.due)}</strong></div></div></div>`;
 } else {content+=`<div class="paper empty"><h2>当前额度条件下无可推荐卡片</h2><p>请降低本次消费金额，或更新信用卡可用额度。</p></div>`;}
 content+=`<div class="paper date-card"><label for="selectedDate">选择刷卡日期</label><input id="selectedDate" type="date" value="${esc(selected)}"><div class="quickdates"><button class="pill ${selected===L.iso(todayDate())?'selected':''}" data-action="jump-date" data-days="0">今天</button><button class="pill ${selected===L.iso(L.addDays(todayDate(),1))?'selected':''}" data-action="jump-date" data-days="1">明天</button><button class="pill ${selected===L.iso(L.addDays(todayDate(),7))?'selected':''}" data-action="jump-date" data-days="7">7天后</button><button class="pill" data-action="jump-date" data-days="30">30天后</button></div><label for="spending" style="margin-top:15px">本次预计消费金额（可选）</label><input id="spending" type="number" min="0" inputmode="decimal" placeholder="填金额后筛选额度不足的卡" value="${esc(amountFilter)}"></div>`;
 content+=`<div class="section-head"><h2>信用卡免息期排名</h2><button class="linkbtn" data-tab-target="cards">管理卡片 ›</button></div>`;
 rows.forEach((r,i)=>content+=cardLine(r,i,r.eligible));
 const borderline=rows.some(r=>r.ambiguous);
 content+=`<p class="tip">* 按刷卡日期估算，并非银行承诺的免息期。${borderline?'所选日期存在账单日当天消费，可能计入不同账期。':''}实际入账与最后还款日以银行账单为准。按期全额还款等条件满足时才可能享受免息。</p>`;
 return content;
}
function renderDue(){
 let rows=L.upcoming(s.cards,todayDate(),s.overrides,s.paid);
 let soon=rows.filter(x=>x.days>=0&&x.days<=3).length, overdue=rows.filter(x=>x.days<0).length;
 let html=`<div class="eyebrow">还款事项</div><h1 class="headline">还款日程</h1><p class="subhead">提前3天、1天和到期当天提醒；已还款后自动停发该期提醒。</p>`;
 html+=`<div class="due-summary"><div class="paper metric"><strong>${rows.length}</strong><small>待核对账期</small></div><div class="paper metric"><strong style="color:#c88a35">${soon}</strong><small>3天内临期</small></div><div class="paper metric"><strong style="color:#c4515c">${overdue}</strong><small>日期已过</small></div></div>`;
 if(!s.cards.length)return html+emptyCards();
 if(!rows.length)return html+`<div class="paper empty"><div class="empty-icon">✓</div><h2>当前没有待核对事项</h2><p>添加信用卡后会自动生成还款日期。</p></div>`;
 rows.forEach(r=>{
  const changed=Boolean(s.overrides[r.cycleId]);const amt=s.amounts[r.cycleId];
  html+=`<div class="paper due-item"><div class="due-line"><div><div class="due-title">${pretty(r.card)}</div><div class="due-sub">${L.fullZh(r.due)} · ${changed?'实际日期已校正':'系统预计日期'}</div></div><span class="due-badge ${r.days<0?'over':r.days<=3?'close':''}">${labelDay(r.days)}</span></div>${amt!==undefined&&amt!==''?`<div class="smallinfo">本期登记应还：¥ ${Number(amt).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>`:''}<div class="due-actions"><button class="outline" data-action="edit-due" data-cycle="${esc(r.cycleId)}">核对 / 改日期</button><button class="primary" data-action="mark-paid" data-cycle="${esc(r.cycleId)}">✓ 已还款</button></div></div>`;
 });
 html+=`<p class="notice">⚠ 尚未与银行连接。这里显示的是“待核对账期”，不代表实际存在欠款；账单金额、还款日期及是否已还清，均请以银行记录为准。</p>`;
 html+=`<div class="section-head"><h2>最近已确认还款</h2></div>`;
 const paidKeys=Object.keys(s.paid).filter(x=>s.paid[x]).slice(-5).reverse();
 if(!paidKeys.length)html+=`<p class="tip">暂无已确认记录。</p>`;
 paidKeys.forEach(key=>{const c=s.cards.find(c=>key.startsWith(c.id+'|'));if(!c)return;html+=`<div class="paper result"><span class="status ok">●</span><div class="grow"><div class="result-title">${pretty(c)}</div><div class="result-sub">${esc(key.split('|')[1])} 账期</div></div><button class="linkbtn" data-action="undo-paid" data-cycle="${esc(key)}">撤销</button></div>`;});
 return html;
}
function renderCards(){let html=`<div class="eyebrow">个人卡片资料</div><h1 class="headline">我的信用卡</h1><p class="subhead">账单日与还款日规则录入一次，之后每天自动计算。</p>`;
 html+=`<button class="primary full" data-action="add">＋ 新增一张信用卡</button><div class="section-head"><h2>已添加 ${s.cards.length} 张卡</h2></div>`;
 if(!s.cards.length) return html+emptyCards();
 s.cards.forEach(c=>{
  html+=`<div class="paper card-entry"><div class="card-entry-head"><div class="card-glyph">▣</div><div class="grow"><strong>${pretty(c)}</strong><small>${c.last4?'尾号 '+esc(c.last4)+' · ':''}${c.isDemo?'演示数据 · ':''}本机存储</small></div></div><div class="card-grid"><div><small>每月账单日</small><span>${c.billingDay}日</span></div><div><small>最后还款规则</small><span>${esc(dueLabel(c))}</span></div></div><div class="entry-buttons"><button class="outline" data-action="edit-card" data-id="${esc(c.id)}">编辑信息</button><button class="destructive" data-action="delete-card" data-id="${esc(c.id)}">删除卡片</button></div></div>`;
 });
 html+=`<p class="tip">仅建议录入卡片昵称和尾号，不要输入完整卡号、安全码、密码、验证码。</p>`;
 return html;
}
function render(){const main=$('#app'); main.innerHTML=(storageProblem?'<p class="storage-banner" role="alert">⚠ 当前浏览器不允许保存，修改不会保留。请换用支持存储的浏览器或 HTTPS 网站访问。</p>':'')+(tab==='due'?renderDue():tab==='cards'?renderCards():renderHome());document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));}
function populateSelect(id){let el=$(id);for(let n=1;n<=31;n++)el.add(new Option(`${n}日`,String(n)));}
populateSelect('#billingDay');populateSelect('#fixedDay');
function toggleDueFields(){const isFixed=$('#dueMode').value==='fixed';$('#offsetGroup').hidden=isFixed;$('#fixedGroup').hidden=!isFixed;$('#cardForm [name=offsetDays]').required=!isFixed;}
function openCard(id){
 const c=s.cards.find(x=>x.id===id);$('#cardForm').reset();clearCardError();$('#cardDialogTitle').textContent=c?'编辑信用卡':'新增信用卡';
 const f=$('#cardForm'); const defs={id:'',bank:'',name:'',last4:'',billingDay:5,dueMode:'offset',offsetDays:20,fixedMonth:1,fixedDay:10,available:''};
 Object.entries({...defs,...c}).forEach(([key,val])=>{if(f.elements.namedItem(key))f.elements.namedItem(key).value=val??'';});toggleDueFields();$('#cardDialog').showModal();
}
function handleCardSubmit(e){
 e.preventDefault();clearCardError();
 const f=e.target, fd=new FormData(f), val=k=>String(fd.get(k)??'').trim();
 try{
  const old=s.cards.find(x=>x.id===val('id'));
  let c={id:val('id')||uid(),bank:val('bank'),name:val('name')||val('bank'),last4:val('last4'),billingDay:Number(val('billingDay')),dueMode:val('dueMode'),offsetDays:Number(val('offsetDays')||20),fixedMonth:Number(val('fixedMonth')||0),fixedDay:Number(val('fixedDay')||10),available:val('available')};
  if(!c.bank)throw Error('请填写银行名称');
  if(c.last4&&!/^\d{4}$/.test(c.last4))throw Error('卡号尾号必须为4位数字，或者留空');
  if(c.available!==''&&(!Number.isFinite(Number(c.available))||Number(c.available)<0))throw Error('可用额度格式不正确');
  if(!Number.isInteger(c.billingDay)||c.billingDay<1||c.billingDay>31)throw Error('请选择1—31日之间的账单日');
  if(c.dueMode==='offset'&&(!Number.isInteger(c.offsetDays)||c.offsetDays<1||c.offsetDays>65))throw Error('还款间隔天数请填写1—65');
  const stmt=L.statementFor(c,2026,1),rep=L.repaymentFor(c,stmt);
  if(L.dayDiff(stmt,rep)<=0)throw Error('还款日期不能早于或等于账单日，请检查银行规则');
  if(c.dueMode==='fixed'&&[1,2,3,4,5,6,7,8,9,10,11,12].some(m=>{const y=2027;return L.dayDiff(L.statementFor(c,y,m),L.repaymentFor(c,L.statementFor(c,y,m)))<=0;}))throw Error('部分月份还款日早于账单日，请调整规则');
  if(!old&&s.cards.length>=30)throw Error('最多可添加30张卡');
  const priorCards=s.cards;
  c.isDemo=Boolean(old&&old.isDemo);
  s.cards=old?s.cards.map(x=>x.id===c.id?c:x):[...s.cards,c];
  if(!persist()){
   s.cards=priorCards;render();
   cardError(storageError());return;
  }
  $('#cardDialog').close();toast(old?'信用卡已更新并保存到本机':'信用卡已添加并保存到本机');
 }catch(err){cardError(err.message||'保存失败，请检查填写的信息');}
}

function findCycle(key){const card=s.cards.find(c=>key.startsWith(c.id+'|'));if(!card)return null;const [,period]=key.split('|');if(!/^\d{4}-\d{2}$/.test(period))return null;let [y,m]=period.split('-').map(Number);let st=L.statementFor(card,y,m);return {card,statement:st,cycleId:key,due:L.repaymentFor(card,st,s.overrides[key])};}
function openDue(key){let cy=findCycle(key);if(!cy)return;$('#dueForm').reset();$('#dueForm [name=cycleId]').value=key;$('#dueForm [name=actualDue]').value=L.iso(cy.due);$('#dueForm [name=amount]').value=s.amounts[key]??'';$('#dueFormContext').textContent=displayName(cy.card)+` · ${L.fullZh(cy.statement)}账期`;
 $('#dueDialog').showModal();}
function handleDueSubmit(e){e.preventDefault();let f=e.target;let key=f.elements.namedItem('cycleId').value;let cy=findCycle(key);if(!cy)return;let date=f.elements.namedItem('actualDue').value;try{let parsed=L.fromISO(date);if(L.dayDiff(cy.statement,parsed)<0){toast('实际还款日不能早于该期账单日');return;}s.overrides[key]=date;}catch(_){toast('日期无效');return;}
 let amt=f.elements.namedItem('amount').value;if(amt!==''&&Number(amt)<0){toast('金额不能为负数');return;}if(amt==='')delete s.amounts[key];else s.amounts[key]=Number(amt);$('#dueDialog').close();if(persist())toast('本期信息已保存');else toast(storageError());}
function makeDemo(){if(s.cards.length&&!confirm('将增加3张明确标记为演示数据的卡片，确定吗？'))return;
 [{bank:'演示银行 A',name:'日常消费卡',billingDay:24,offsetDays:20},{bank:'演示银行 B',name:'采购卡',billingDay:20,offsetDays:20},{bank:'演示银行 C',name:'备用卡',billingDay:10,offsetDays:20}].forEach(c=>s.cards.push({...c,id:uid(),dueMode:'offset',last4:'',available:'',fixedMonth:1,fixedDay:10,isDemo:true}));if(persist())toast('已添加3张演示卡，可随时删除');else toast(storageError());}
const strBytes=s=>new TextEncoder().encode(s);
function base64(u){return btoa(Array.from(u,b=>String.fromCharCode(b)).join(''));}
function unbase64(t){return Uint8Array.from(atob(t),x=>x.charCodeAt(0));}
async function aesKey(pass,salt){const base=await crypto.subtle.importKey('raw',strBytes(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:220000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
function download(content,filename,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportData(){const data={format:'kaqi-backup-v1',cards:s.cards,paid:s.paid,overrides:s.overrides,amounts:s.amounts};const pass=prompt('设置备份密码可加密文件（建议）。留空则导出明文，请妥善保管。');if(pass===null)return;
 let body;
 if(pass){if(!crypto.subtle){toast('当前浏览器不支持加密；请通过 HTTPS 打开后再试');return;}const salt=crypto.getRandomValues(new Uint8Array(16));const iv=crypto.getRandomValues(new Uint8Array(12));const key=await aesKey(pass,salt);const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,strBytes(JSON.stringify(data)));body=JSON.stringify({format:'kaqi-encrypted-v1',salt:base64(salt),iv:base64(iv),cipher:base64(new Uint8Array(encrypted))},null,2);}else {if(!confirm('未设置密码，导出的文件是明文。仍然导出吗？'))return;body=JSON.stringify(data,null,2);}
 download(body,`卡期_备份_${L.iso(todayDate())}.json`,'application/json');toast('备份已导出');}
async function importData(file){if(!file)return;try{const raw=JSON.parse(await file.text());let data=raw;if(raw.format==='kaqi-encrypted-v1'){
   const pass=prompt('此备份已加密，请输入备份密码：');if(pass===null)return;if(!crypto.subtle)throw Error('当前环境不支持解密，请使用 HTTPS 网站导入');const key=await aesKey(pass,unbase64(raw.salt));const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(raw.iv)},key,unbase64(raw.cipher));data=JSON.parse(new TextDecoder().decode(decrypted));}
 if(data.format!=='kaqi-backup-v1'||!Array.isArray(data.cards)||data.cards.length>30||data.cards.some(c=>!c.id||!c.bank||!c.name||!Number.isInteger(Number(c.billingDay))||Number(c.billingDay)<1||Number(c.billingDay)>31))throw Error('文件格式不正确');
 if(!confirm(`将用备份中的 ${data.cards.length} 张卡替换本机现有的 ${s.cards.length} 张卡及还款记录，确定吗？`))return;
 s.cards=data.cards;s.paid=data.paid||{};s.overrides=data.overrides||{};s.amounts=data.amounts||{};if(persist())toast('数据已恢复');else toast(storageError());
 }catch(e){toast('导入失败：'+(e.message||'请检查文件及密码'));}finally{$('#importFile').value='';}}
function escapeICS(s){return String(s).replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');}
function exportICS(){let entries=L.projectedReminders(s.cards,todayDate(),s.overrides,s.paid).slice(0,400);if(!entries.length){toast('没有可导出的还款日期');return;}
 let lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//KAQI//Credit Card Reminders//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 entries.forEach((x,i)=>{const d=x.due.replace(/-/g,'');lines.push('BEGIN:VEVENT',`UID:${x.cardId}-${x.cycleId.split('|')[1]}@kaqi`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART:${d}T090000`,`DTEND:${d}T091000`,`SUMMARY:${escapeICS('信用卡还款核对 · '+x.label)}`,`DESCRIPTION:${escapeICS('预计还款日。实际还款日及是否有待还金额，以银行账单为准；已还款可忽略。')}`);[4320,1440,0].forEach(m=>lines.push('BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${escapeICS('信用卡还款日期核对 · '+x.label)}`,`TRIGGER:${m===0?'PT0M':'-PT'+m+'M'}`,'END:VALARM'));lines.push('END:VEVENT');});lines.push('END:VCALENDAR');download(lines.join('\r\n'),'卡期_还款提醒日历.ics','text/calendar;charset=utf-8');toast('已导出日历文件。日历通知是否生效取决于导入的日历应用');}
async function getConfig(){
 try{
  const ready=await Promise.any(PUSH_CANDIDATES.map(async base=>{
   const r=await fetch(base+'/api/config',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(7000)});
   if(!r.ok)throw Error('HTTP '+r.status);
   const cfg=await r.json();
   if(typeof cfg.pushAvailable!=='boolean')throw Error('Invalid configuration');
   if(!cfg.pushAvailable){const e=Error('Service is not ready');e.serviceNotReady=true;throw e;}
   if(typeof cfg.vapidPublicKey!=='string'||!cfg.vapidPublicKey)throw Error('Missing public key');
   return {base,cfg};
  }));
  activePushBase=ready.base;return serverConfig=ready.cfg;
 }catch(error){return serverConfig={pushAvailable:false,vapidPublicKey:'',connectionFailed:!(error.errors||[]).some(e=>e.serviceNotReady)};}
}
function updatePushStatus(){
 const e=$('#pushStatus'),help=$('#pushHelp');
 const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const permission=supported?Notification.permission:'unsupported';
 e.textContent=pushBusy?'处理中':pushChecking||!serverConfig?'检查中':!serverConfig.pushAvailable?(serverConfig.connectionFailed?'连接未成功':'通知服务未就绪'):!supported?'当前浏览器不支持':permission==='denied'?'通知权限被拒绝':s.pushEnabled?(pushSyncProblem?'待同步':'已开启'):'待开启';
 help.textContent=!serverConfig?'正在检测通知服务连接，请稍候。':!serverConfig.pushAvailable?(serverConfig.connectionFailed?'当前网络未能连接通知服务。可切换网络后点击“重新检测连接”重试。':'通知服务当前未就绪，请稍后重新检测。'):ios&&!standalone?'请先用 Safari 分享→添加到主屏幕，再从主屏幕打开卡期，点击开启并允许通知。':permission==='denied'?'通知权限已被拒绝，请到设备系统通知设置中允许卡期通知，再重新打开应用。':pushSyncProblem||'通知服务已连接。开启通知后可关闭网页；更改还款日期或标记已还款后，请保持联网完成同步。';
 $('[data-action="retry-push"]').hidden=Boolean(serverConfig?.pushAvailable)&&!pushChecking;
 $('[data-action="retry-push"]').disabled=pushChecking||pushBusy;
 $('[data-action="enable-push"]').disabled=pushBusy||pushChecking||!serverConfig?.pushAvailable||!supported||permission==='denied'||s.pushEnabled;
 $('[data-action="test-push"]').disabled=pushBusy||!serverConfig?.pushAvailable||!s.pushEnabled;
 $('[data-action="disable-push"]').disabled=pushBusy||!s.pushEnabled;
}
function b64ToUint(str){const p='='.repeat((4-str.length%4)%4);return unbase64(str.replace(/-/g,'+').replace(/_/g,'/')+p);}
const privateReminderDates=()=>L.projectedReminders(s.cards,todayDate(),s.overrides,s.paid).map(({due})=>({due}));
async function pushRequest(path,body={}){
 if(!activePushBase)throw Error('通知服务未连接');
 const r=await fetch(activePushBase+'/api/'+path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.deviceKey},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 let result;try{result=await r.json();}catch(_){result={};}
 if(!r.ok){const e=Error(result.error||'推送服务请求失败');e.status=r.status;throw e;}return result;
}
async function syncSchedule(){if(!s.pushEnabled)return false;try{
 await pushRequest('sync',{reminders:privateReminderDates()});pushSyncProblem='';updatePushStatus();return true;
 }catch(err){pushSyncProblem='本机记录已保存，但推送同步未完成：'+err.message+'。联网后重新打开卡期重试。';updatePushStatus();toast('记录已保存，推送同步未完成，请检查设置');return false;}}
async function enablePush(){const conf=serverConfig;if(pushBusy)return;if(!conf?.pushAvailable){toast('网站已上线，推送服务仍未连接');return;}
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){toast('此浏览器不支持推送；iPhone 请将应用加入主屏幕后再试');return;}
 if(!persist()){toast(storageError());return;}
 let subscription,created=false,registered=false;
 pushBusy=true;updatePushStatus();
 try{
  // User gesture → permission; iOS home-screen Web Apps require this direct action.
  const permission=await Notification.requestPermission();if(permission!=='granted'){toast('通知权限未开启，请在手机通知设置中允许');return;}
  const reg=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('通知组件未就绪，请刷新重试')),10000))]);
  subscription=await reg.pushManager.getSubscription();if(!subscription){subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint(conf.vapidPublicKey)});created=true;}
  await pushRequest('subscribe',{subscription:subscription.toJSON(),reminders:privateReminderDates()});registered=true;
  s.pushEnabled=true;if(!persist())throw Error(storageError());pushSyncProblem='';toast('推送已登记。请点“测试手机通知”确认这台设备能收到');
 }catch(e){
  s.pushEnabled=false;persist();
  if(registered)try{await pushRequest('unsubscribe');}catch(_){}
  if(created&&subscription)try{await subscription.unsubscribe();}catch(_){}
  toast('开启失败：'+(e.message||'请检查 HTTPS、设备和通知权限'));
 }finally{pushBusy=false;updatePushStatus();}}
async function disablePush(){if(pushBusy)return;pushBusy=true;updatePushStatus();try{
 const reg=await navigator.serviceWorker.getRegistration('./');const sub=reg&&await reg.pushManager.getSubscription();
 if(sub&&!await sub.unsubscribe())throw Error('设备未确认关闭通知，请重试');
 let removed=true;try{await pushRequest('unsubscribe');}catch(_){removed=false;}
 s.pushEnabled=false;pushSyncProblem='';persist();toast(removed?'已关闭本机推送并清除云端订阅':'已关闭本机通知；云端无效订阅将在后续发送时清理');
 }catch(e){toast('关闭失败：'+e.message);}finally{pushBusy=false;updatePushStatus();}}
async function testPush(){
 if(!s.pushEnabled||pushBusy){toast('请先开启推送');return;}
 let result=$('#pushTestResult');if(!result){result=document.createElement('p');result.id='pushTestResult';result.setAttribute('role','status');$('[data-action="test-push"]').after(result);}result.hidden=false;result.className='helper';result.textContent='正在发送测试通知，请稍候……';
 pushBusy=true;updatePushStatus();
 try{
  const response=await pushRequest('test');
  if(response.accepted!==true)throw Error('通知通道尚未确认接受，请稍后重试');
  result.textContent=`${response.provider||'通知通道'} 已接受测试通知${response.providerStatus?'（HTTP '+response.providerStatus+'）':''}。请在锁屏或通知中心查看。`;
  toast('测试通知已提交，请查看手机通知中心');
 }catch(e){
  if(e.status===404||e.status===410){s.pushEnabled=false;persist();}
  const message=e.name==='TimeoutError'?'请求超时，请重新检测连接后再测试':e instanceof TypeError?'网络连接未完成，请重新检测后再测试':e.message||'请稍后重试';
  result.className='form-error';result.textContent='测试未成功：'+message;toast('测试未成功，详细原因已显示在按钮下方');
 }finally{pushBusy=false;updatePushStatus();}
}
async function refreshPush(){
 if(pushChecking)return;
 pushChecking=true;serverConfig=null;updatePushStatus();
 try{await getConfig();
 if(s.pushEnabled&&serverConfig.pushAvailable){
  try{const reg=await navigator.serviceWorker.getRegistration('./');if(Notification.permission!=='granted'||!reg||!await reg.pushManager.getSubscription()){s.pushEnabled=false;persist();}else{await pushRequest('status');await syncSchedule();}}
  catch(e){if(e.status===404||e.status===410){s.pushEnabled=false;persist();}pushSyncProblem='设备通知登记需要检查：'+e.message;}
 }
 }finally{pushChecking=false;updatePushStatus();}
}
function openSettings(){$('#settingsDialog').showModal();updatePushStatus();refreshPush();}
async function act(action,target){let key=target.dataset.cycle,id=target.dataset.id;
 switch(action){case 'settings':openSettings();break;case 'close-card':$('#cardDialog').close();break;case 'close-due':$('#dueDialog').close();break;case 'close-settings':$('#settingsDialog').close();break;
 case 'add':openCard();break;case 'edit-card':openCard(id);break;case 'delete-card':{const c=s.cards.find(x=>x.id===id);if(c&&confirm(`删除“${displayName(c)}”及其相关还款记录？`)){s.cards=s.cards.filter(x=>x.id!==id);for(const map of [s.paid,s.overrides,s.amounts])Object.keys(map).forEach(k=>{if(k.startsWith(id+'|'))delete map[k];});if(persist())toast('卡片已删除');else toast(storageError());}break;}
 case 'demo':makeDemo();break;case 'jump-date':selected=L.iso(L.addDays(todayDate(),Number(target.dataset.days)));render();break;
 case 'edit-due':openDue(key);break;case 'mark-paid':{let c=findCycle(key);if(c&&confirm(`确认“${displayName(c.card)}”的 ${L.zh(c.due)} 账期已全额还清？`)){s.paid[key]=true;if(persist())toast('已记录还款，本期停止提醒');else toast(storageError());}break;}
 case 'undo-paid':delete s.paid[key];if(persist())toast('已撤销还款确认');else toast(storageError());break;
 case 'enable-push':await enablePush();break;case 'disable-push':await disablePush();break;case 'test-push':await testPush();break;
 case 'retry-push':await refreshPush();break;
 case 'export':await exportData();break;case 'import':$('#importFile').click();break;case 'ics':exportICS();break;
 case 'clear-demo':{const count=s.cards.filter(x=>x.isDemo).length;if(!count){toast('没有演示卡片');break;}if(confirm(`清除 ${count} 张演示卡及其相关记录？`)){const ids=new Set(s.cards.filter(x=>x.isDemo).map(x=>x.id));s.cards=s.cards.filter(x=>!x.isDemo);for(const map of [s.paid,s.overrides,s.amounts])Object.keys(map).forEach(k=>{if(ids.has(k.split('|')[0]))delete map[k];});if(persist())toast('演示卡已清除');else toast(storageError());}break;}
 }
}
document.addEventListener('click',e=>{let n=e.target.closest('[data-tab-target]');if(n){activeTab(n.dataset.tabTarget);return;}n=e.target.closest('[data-tab]');if(n){activeTab(n.dataset.tab);return;}n=e.target.closest('[data-action]');if(n)act(n.dataset.action,n);});
document.addEventListener('change',e=>{if(e.target.id==='dueMode')toggleDueFields();if(e.target.id==='selectedDate'){try{selected=L.iso(L.fromISO(e.target.value));render();}catch(_){toast('请选择有效的日期');}}if(e.target.id==='spending'){amountFilter=e.target.value;render();}});
$('#cardForm').addEventListener('invalid',e=>{
 const t=e.target;
 const labels={bank:'银行名称',name:'卡片昵称',last4:'卡号末四位',billingDay:'账单日',offsetDays:'还款间隔天数',fixedDay:'还款日',available:'当前可用额度'};
 const field=labels[t.name]||'填写内容';
 const msg=t.validity.valueMissing?`请填写${field}`:t.validity.patternMismatch?`${field}需要4位数字，或者留空`:t.validity.rangeUnderflow||t.validity.rangeOverflow?`${field}超出允许范围`:`${field}格式有误，请检查`;
 cardError(msg);
},true);
$('#cardForm').addEventListener('input',()=>clearCardError());
$('#cardForm').addEventListener('change',()=>clearCardError());
$('#cardForm').addEventListener('submit',handleCardSubmit);$('#dueForm').addEventListener('submit',handleDueSubmit);
$('#importFile').addEventListener('change',e=>importData(e.target.files[0]));
render();
if('serviceWorker' in navigator&&location.protocol!=='file:'){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Service worker unavailable',e)));}
if(s.pushEnabled)refreshPush();
window.addEventListener('online',()=>{if(s.pushEnabled)refreshPush();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&s.pushEnabled)refreshPush();});
})();
