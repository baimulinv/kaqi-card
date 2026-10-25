(function(){
'use strict';
let lastTap=null,multiTouch=false;
const stop=e=>{if(e.cancelable)e.preventDefault();};
const options={passive:false};
for(const name of ['gesturestart','gesturechange','gestureend'])document.addEventListener(name,stop,options);
document.addEventListener('touchstart',e=>{
 if(e.touches.length>1){multiTouch=true;lastTap=null;stop(e);}
},options);
document.addEventListener('touchmove',e=>{if(e.touches.length>1||multiTouch)stop(e);},options);
document.addEventListener('touchend',e=>{
 if(multiTouch){stop(e);if(!e.touches.length)multiTouch=false;lastTap=null;return;}
 const touch=e.changedTouches[0];
 if(!touch||e.target.closest('input,textarea,select')){lastTap=null;return;}
 const current={at:e.timeStamp,x:touch.clientX,y:touch.clientY,target:e.target};
 if(lastTap&&current.at-lastTap.at<320&&Math.hypot(current.x-lastTap.x,current.y-lastTap.y)<24){stop(e);lastTap=null;}
 else lastTap=current;
},options);
document.addEventListener('touchcancel',()=>{lastTap=null;multiTouch=false;});
document.addEventListener('dblclick',stop,options);
})();
