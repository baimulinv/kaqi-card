const CACHE='kaqi-static-pages-v1.1.2';
const ASSETS=['./','./index.html','./style.css','./logic.js','./push-config.js?v=1.1.2','./app.js?v=1.1.2','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x.startsWith('kaqi-static-')&&x!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin||new URL(e.request.url).pathname.startsWith(new URL('./api/', self.registration.scope).pathname))return;
 e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
self.addEventListener('push',e=>{
 let payload={title:'信用卡还款提醒',body:'有信用卡即将到期，请打开应用核对。'};
 try{payload=e.data?JSON.parse(e.data.text()):payload;}catch(_){}
 e.waitUntil(self.registration.showNotification(payload.title||'信用卡还款提醒',{
  body:payload.body||'请核对还款日期',icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag:payload.tag||'card-reminder',renotify:true,silent:false,data:{url:new URL('./?tab=due',self.registration.scope).href}
 }));
});
self.addEventListener('notificationclick',e=>{
 e.notification.close();
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async cs=>{
  const url=new URL('./?tab=due',self.registration.scope).href;
  for(const c of cs){if(c.url.startsWith(self.registration.scope)&&'focus' in c){await c.navigate(url);await c.focus();return;}}
  return self.clients.openWindow(url);
 }));
});
