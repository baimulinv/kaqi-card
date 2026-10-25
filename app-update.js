(function(){
'use strict';
let registration=null,checkJob=null,lastCheck=0,pending=false,reloading=false,retryTimer=null;
const status=message=>{const el=document.querySelector('#appUpdateStatus');if(el)el.textContent=message;};
const editing=()=>Boolean(document.querySelector('#cardDialog[open],#dueDialog[open]')||document.activeElement?.matches('input,textarea,select'));
function applyUpdate(){
 if(!pending||reloading||document.visibilityState!=='visible')return;
 if(editing()){status('新版本已就绪，结束当前编辑后自动载入。');return;}
 if(!document.dispatchEvent(new CustomEvent('kaqi:before-update',{cancelable:true}))){clearTimeout(retryTimer);retryTimer=setTimeout(applyUpdate,500);return;}
 reloading=true;location.reload();
}
async function check(force=false){
 if(checkJob)return checkJob;
 if(!force&&Date.now()-lastCheck<60000)return;
 if(!('serviceWorker' in navigator)||location.protocol==='file:'){if(force)status('当前打开方式不支持自动更新，请使用网站地址打开卡期。');return;}
 if(navigator.onLine===false){if(force)status('当前离线，联网后会自动检查更新。');return;}
 checkJob=(async()=>{
  const button=document.querySelector('[data-action="check-web-update"]');if(button)button.disabled=true;
  if(force)status('正在检查网页更新……');
  try{
   registration=registration||await navigator.serviceWorker.getRegistration('./');
   if(!registration)registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
   await registration.update();lastCheck=Date.now();
   if(pending)applyUpdate();
   else if(force)status(registration.installing?'正在下载网页新版本，完成后会自动载入。':'已检查网页更新。桌面图标仍由 iOS 管理，无法在此强制刷新。');
  }catch(_){if(force)status('暂时无法连接更新服务，请联网后重试。');}
  finally{if(button)button.disabled=false;}
 })();
 try{return await checkJob;}finally{checkJob=null;}
}
window.KaqiUpdates={check};
if('serviceWorker' in navigator&&location.protocol!=='file:'){
 let controlled=Boolean(navigator.serviceWorker.controller);
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!controlled){controlled=true;return;}
  pending=true;applyUpdate();
 });
 window.addEventListener('load',async()=>{
  try{registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await check();}
  catch(_){status('网页更新组件暂未连接，联网后请点“检查网页更新”。');}
 });
 window.addEventListener('online',()=>check());
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){applyUpdate();check();}});
 document.addEventListener('close',applyUpdate,true);
 document.addEventListener('focusout',()=>{if(pending)setTimeout(applyUpdate,0);});
}
})();
