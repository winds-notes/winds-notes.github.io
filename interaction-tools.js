/* Pure geometry for area selection and adjustable whole-stroke erasing. */
(function(global){
  'use strict';
  const rect=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)});
  const intersects=(a,b)=>a.x<=b.x+b.w&&a.x+a.w>=b.x&&a.y<=b.y+b.h&&a.y+a.h>=b.y;
  const contains=(a,b,pad=2)=>b.x>=a.x-pad&&b.y>=a.y-pad&&b.x+b.w<=a.x+a.w+pad&&b.y+b.h<=a.y+a.h+pad;
  function union(boxes){if(!boxes.length)return null;const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};}
  function pointDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=dx*dx+dy*dy?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy))):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
  function segmentDistance(a,b,c,d){
    const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x),ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
    if(((ab1>0&&ab2<0)||(ab1<0&&ab2>0))&&((cd1>0&&cd2<0)||(cd1<0&&cd2>0)))return 0;
    return Math.min(pointDistance(a,c,d),pointDistance(b,c,d),pointDistance(c,a,b),pointDistance(d,a,b));
  }
  function eraseHit(item,points,radius,bounds,inkRadius=0,inkOnly=true){
    if(inkOnly&&item.type!=='stroke')return false;if(!points.length)return false;
    const sweep=union(points.map(p=>({x:p.x-radius,y:p.y-radius,w:radius*2,h:radius*2})));if(!intersects(sweep,bounds))return false;
    if(item.type!=='stroke'){
      const corners=[{x:bounds.x,y:bounds.y},{x:bounds.x+bounds.w,y:bounds.y},{x:bounds.x+bounds.w,y:bounds.y+bounds.h},{x:bounds.x,y:bounds.y+bounds.h}];
      for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[i];if(contains(bounds,{x:b.x,y:b.y,w:0,h:0},0))return true;for(let j=0;j<4;j++)if(segmentDistance(a,b,corners[j],corners[(j+1)%4])<=radius)return true;}return false;
    }
    const samples=item.points||[];
    for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[i];for(let j=0;j<samples.length;j++){const p=samples[Math.max(0,j-1)],q=samples[j];if(segmentDistance(a,b,{x:p[0],y:p[1]},{x:q[0],y:q[1]})<=radius+inkRadius)return true;}}
    return false;
  }
  // Bound geometry work between yields, including unusually long imported strokes.
  async function eraseHitAsync(item,points,radius,bounds,inkRadius,inkOnly,pause){
    if(item.type!=='stroke')return eraseHit(item,points,radius,bounds,inkRadius,inkOnly);
    if(!points.length)return false;const samples=item.points||[],reach=radius+inkRadius;let work=0;
    for(let i=0;i<points.length;i++){
      const a=points[Math.max(0,i-1)],b=points[i],sweep={x:Math.min(a.x,b.x)-reach,y:Math.min(a.y,b.y)-reach,w:Math.abs(a.x-b.x)+2*reach,h:Math.abs(a.y-b.y)+2*reach};
      if(!intersects(sweep,bounds))continue;
      for(let j=0;j<samples.length;j++){
        if(++work%2048===0)await pause();const p=samples[Math.max(0,j-1)],q=samples[j];
        if(Math.max(p[0],q[0])<sweep.x||Math.min(p[0],q[0])>sweep.x+sweep.w||Math.max(p[1],q[1])<sweep.y||Math.min(p[1],q[1])>sweep.y+sweep.h)continue;
        if(segmentDistance(a,b,{x:p[0],y:p[1]},{x:q[0],y:q[1]})<=reach)return true;
      }
    }return false;
  }
  function translate(items,dx,dy){return items.map(item=>item.type==='stroke'?{...item,points:item.points.map(p=>[p[0]+dx,p[1]+dy,p[2]])}:{...item,x:item.x+dx,y:item.y+dy});}
  const api=Object.freeze({rect,intersects,contains,union,pointDistance,segmentDistance,eraseHit,eraseHitAsync,translate});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;global.WindsInteractions=api;
})(typeof window!=='undefined'?window:globalThis);
