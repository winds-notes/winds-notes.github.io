/* Frame-batched grab scrolling. No rendering, storage or network operations. */
(function(global){
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function create(api){
    const now=api.now||(()=>performance.now()),request=api.requestFrame||(fn=>requestAnimationFrame(fn)),cancel=api.cancelFrame||(id=>cancelAnimationFrame(id));
    let contact=null,release=null,coast=null,scope=null,frame=0,dx=0,dy=0,overflowY=0;
    function active(){return Boolean(contact||release||coast||frame);}
    function stop(){if(frame)cancel(frame);frame=0;contact=release=coast=scope=null;dx=dy=overflowY=0;}
    function queue(){if(!frame)frame=request(tick);}
    function time(event){const value=event?.timeStamp,current=now();return Number.isFinite(value)&&Math.abs(value-current)<10000?value:current;}
    function sample(event){
      if(!contact||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
      const t=Math.max(contact.time,time(event)),x=event.clientX,y=event.clientY;
      const xDelta=contact.x-x,yDelta=contact.y-y;
      dx+=xDelta;dy+=yDelta;contact.distance+=Math.hypot(xDelta,yDelta);
      if(xDelta||yDelta)contact.movedAt=t;
      contact.x=x;contact.y=y;contact.time=t;
      const samples=contact.samples;
      if(samples.at(-1).time===t)samples[samples.length-1]={x,y,time:t};else samples.push({x,y,time:t});
      while(samples.length>12||samples.length>2&&samples[1].time<t-80)samples.shift();
    }
    function begin(event){
      stop();scope=api.scope?.();const t=time(event);
      contact={id:event.pointerId,type:event.pointerType,x:event.clientX,y:event.clientY,time:t,movedAt:t,distance:0,samples:[{x:event.clientX,y:event.clientY,time:t}]};
    }
    function move(event){if(!contact||contact.id!==event.pointerId)return false;sample(event);queue();return true;}
    function end(event,cancelled=false){
      if(!contact||contact.id!==event.pointerId)return false;
      if(cancelled){stop();return true;}
      sample(event);const last=contact.samples.at(-1),first=contact.samples[0],elapsed=last.time-first.time;
      const reduced=api.reducedMotion?api.reducedMotion():global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const fling=contact.type==='touch'&&!reduced&&contact.distance>=8&&time(event)-contact.movedAt<80&&elapsed>=8;
      release={pointerType:contact.type,vx:fling?clamp((first.x-last.x)/elapsed,-3.5,3.5):0,vy:fling?clamp((first.y-last.y)/elapsed,-3.5,3.5):0};
      contact=null;queue();return true;
    }
    function tick(timestamp){
      frame=0;if(api.matches&&!api.matches(scope)){stop();return;}
      const element=api.element();if(!element){stop();return;}
      let x=dx,y=dy;dx=dy=0;
      if(coast){
        const elapsed=Math.max(0,timestamp-coast.time);coast.time=timestamp;
        // A stalled/hidden frame must not replay a large jump on return.
        if(elapsed>80){stop();return;}
        const decay=Math.exp(-elapsed/240),travel=240*(1-decay);
        x+=coast.vx*travel;y+=coast.vy*travel;coast.vx*=decay;coast.vy*=decay;
      }
      if(x||y){
        const left=element.scrollLeft,top=element.scrollTop,maxX=Math.max(0,element.scrollWidth-element.clientWidth),maxY=Math.max(0,element.scrollHeight-element.clientHeight);
        element.scrollLeft=clamp(left+x,0,maxX);element.scrollTop=clamp(top+y,0,maxY);
        const actualX=element.scrollLeft-left,actualY=element.scrollTop-top;
        if(contact||release)overflowY=Math.abs(y-actualY)>.5?overflowY+y-actualY:0;
        if(coast){if(Math.abs(actualX)<.1&&x)coast.vx=0;if(Math.abs(actualY)<.1&&y)coast.vy=0;}
        api.moved?.({x:actualX,y:actualY,scope});
      }
      if(release){
        const ended=release;release=null;
        if(api.ended?.({pointerType:ended.pointerType,overflowY,scope})===true){stop();return;}
        if(Math.abs(ended.vx)+Math.abs(ended.vy)>.04)coast={vx:ended.vx,vy:ended.vy,time:timestamp};
      }
      if(coast){if(Math.abs(coast.vx)+Math.abs(coast.vy)<.025)coast=null;else queue();}
    }
    return Object.freeze({begin,move,end,stop,active});
  }
  const api=Object.freeze({create});if(typeof module!=='undefined'&&module.exports)module.exports=api;global.WindsScrollMotion=api;
})(typeof window!=='undefined'?window:globalThis);
