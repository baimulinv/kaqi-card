(function(){
'use strict';
const select=document.querySelector('#barkSound'),button=document.querySelector('#barkPreviewButton'),audio=document.querySelector('#barkPreviewAudio'),status=document.querySelector('#barkPreviewStatus');
if(!select||!button||!audio||!status)return;
const sounds=new Set(['alarm','minuet','bell','birdsong','chime','electronic','glass','horn','telegraph','typewriters','multiwayinvitation']);
let playing=false,request=0;
function stop(){
 request++;audio.pause();audio.currentTime=0;playing=false;button.textContent='▶ 试听所选铃声';
}
function update(){
 stop();button.disabled=!sounds.has(select.value);status.className='muted';
 status.textContent=select.value==='custom'?'自己导入的声音请在Bark中试听，网页无法读取Bark里的音频文件。':select.value==='default'?'默认通知音由Bark和系统决定，请用下方“测试Bark铃声”确认。':'试听只播放一次，不发送通知、不保存设置；实际提醒请保存后再测试。';
}
button.addEventListener('click',async()=>{
 if(playing){stop();status.textContent='已停止试听。';return;}
 if(!sounds.has(select.value)){update();return;}
 const id=++request;
 audio.src='./sound-'+select.value+'-v1.mp3';audio.loop=false;
 playing=true;button.textContent='■ 停止试听';status.className='muted';status.textContent='正在加载试听……';
 try{
  await audio.play();
  if(id===request)status.textContent='正在试听。网页媒体音量与实际通知音量可能不同。';
 }catch(_){
  if(id!==request)return;
  stop();status.className='form-error';status.textContent='暂时无法试听，请检查网络和手机媒体音量后重试，也可打开Bark试听。';
 }
});
audio.addEventListener('ended',()=>{stop();status.textContent='试听结束。喜欢这个声音请点“保存Bark设置”。';});
audio.addEventListener('error',()=>{if(playing){stop();status.className='form-error';status.textContent='试听音频加载失败，请联网后重试。';}});
select.addEventListener('change',update);
document.querySelector('#settingsDialog')?.addEventListener('close',()=>{stop();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')stop();});
window.addEventListener('pagehide',stop);
update();
})();
