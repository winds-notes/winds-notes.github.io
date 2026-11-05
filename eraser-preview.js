/* Live eraser feedback: cached protected pixels, clipped patch copies and transient masks.
   No notebook mutation, serialization, storage or network work in the preview. */
(function(global){
  'use strict';
  const CELL=96,MAX_PIXELS=4194304;
  const scopeEqual=(a,b)=>Boolean(a&&b&&a.account===b.account&&a.book===b.book&&a.page===b.page);
  const sameGeometry=(a,b)=>Boolean(a&&b&&Object.keys(a).filter(k=>k!=='erasures').every(k=>a[k]===b[k])&&Object.keys(b).filter(k=>k!=='erasures').every(k=>a[k]===b[k]));
  const intersects=(a,b)=>a.x<=b.x+b.w&&a.x+a.w>=b.x&&a.y<=b.y+b.h&&a.y+a.h>=b.y;
  function create(adapter){
    let cache=null,surface=null;const sessions=new Map(),visible=new Map();
    const now=adapter.now||(()=>performance.now());
    function ready(key){return Boolean(cache&&scopeEqual(cache.key.scope,key.scope)&&cache.key.revision===key.revision&&cache.key.inkOnly===key.inkOnly&&cache.key.width===key.width&&cache.key.height===key.height);}
    function releaseCache(){cache=null;if(surface)surface.width=surface.height=1;}
    function complete(gesture){const session=sessions.get(gesture);if(!session)return false;sessions.delete(gesture);for(const [id,entry] of session.entries){const left=(visible.get(id)||[]).filter(value=>value!==entry);if(left.length)visible.set(id,left);else visible.delete(id);}return session.painted||session.entries.size>0;}
    function reset(){for(const gesture of sessions.keys())complete(gesture);releaseCache();}
    function prepare(key,items,paintProtected){
      if(ready(key))return true;if(cache&&!scopeEqual(cache.key.scope,key.scope))reset();
      if(!surface)surface=adapter.makeCanvas();cache=null;
      try{
        const ratio=Math.min(2,4096/key.width,4096/key.height,Math.sqrt(MAX_PIXELS/(key.width*key.height)));let ctx=null;
        for(const factor of [1,.5,.25]){surface.width=1;surface.height=Math.max(1,Math.floor(key.height*ratio*factor));surface.width=Math.max(1,Math.floor(key.width*ratio*factor));ctx=surface.getContext('2d');if(ctx)break;}
        if(!ctx){releaseCache();return false;}
        ctx.setTransform(surface.width/key.width,0,0,surface.height/key.height,0,0);paintProtected(ctx);
        const grid=new Map(),large=[],records=[];
        for(const item of items){if(key.inkOnly&&item.type!=='stroke')continue;const bounds=adapter.bounds(item),box=adapter.visualBounds(item);const record={item,bounds,box};records.push(record);
          const x0=Math.max(0,Math.floor(box.x/CELL)),y0=Math.max(0,Math.floor(box.y/CELL)),x1=Math.min(Math.floor(key.width/CELL),Math.floor((box.x+box.w)/CELL)),y1=Math.min(Math.floor(key.height/CELL),Math.floor((box.y+box.h)/CELL));
          if((x1-x0+1)*(y1-y0+1)>64){large.push(record);continue;}
          for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const id=x+':'+y;if(!grid.has(id))grid.set(id,[]);grid.get(id).push(record);}
        }
        cache={key:{...key,scope:{...key.scope}},surface,grid,large,records};return true;
      }catch{releaseCache();return false;}
    }
    function begin(gesture,key){if(!ready(key))return false;sessions.set(gesture,{cache,queue:[],cursor:0,last:null,serial:0,entries:new Map(),patchAllowed:true,painted:false});return true;}
    function add(gesture,point){const s=sessions.get(gesture);if(!s)return;s.queue.push({a:s.last||point,b:point});s.last=point;}
    function candidates(s,box){const result=new Set(s.cache.large),width=s.cache.key.width,height=s.cache.key.height;
      for(let y=Math.max(0,Math.floor(box.y/CELL));y<=Math.min(Math.floor(height/CELL),Math.floor((box.y+box.h)/CELL));y++)for(let x=Math.max(0,Math.floor(box.x/CELL));x<=Math.min(Math.floor(width/CELL),Math.floor((box.x+box.w)/CELL));x++)for(const record of s.cache.grid.get(x+':'+y)||[])result.add(record);
      return result;
    }
    function metadata(gesture,s,segment,box){
      const serial=++s.serial;
      for(const record of candidates(s,box)){if(!intersects(record.box,box))continue;let entry=s.entries.get(record.item.id);
        if(!entry){entry={source:record.item,masks:[],lastSerial:-1};s.entries.set(record.item.id,entry);if(!visible.has(record.item.id))visible.set(record.item.id,[]);visible.get(record.item.id).push(entry);}
        const w=Math.max(1,record.bounds.w),h=Math.max(1,record.bounds.h),normalize=p=>{const local=adapter.localPoint(record.item,p);return [(local.x-record.bounds.x)/w,(local.y-record.bounds.y)/h];};
        if(entry.lastSerial===serial-1){const mask=entry.masks.at(-1);if(mask.points.length>=2048)mask.points=mask.points.filter((_,i)=>i%2===0);mask.points.push(normalize(segment.b));}
        else{const points=[normalize(segment.a)];if(segment.a.x!==segment.b.x||segment.a.y!==segment.b.y)points.push(normalize(segment.b));entry.masks.push({rx:gesture.radius/w,ry:gesture.radius/h,points});}entry.lastSerial=serial;
      }
    }
    function copyPatch(ctx,s,segment,radius,box){
      const {a,b}=segment,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),nx=length?-dy/length:0,ny=length?dx/length:1;
      const key=s.cache.key,x=Math.max(0,Math.floor(box.x-1)),y=Math.max(0,Math.floor(box.y-1)),right=Math.min(key.width,Math.ceil(box.x+box.w+1)),bottom=Math.min(key.height,Math.ceil(box.y+box.h+1));if(right<=x||bottom<=y)return;
      ctx.save();try{ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.beginPath();
        if(!length)ctx.arc(a.x,a.y,radius,0,Math.PI*2);
        else{ctx.moveTo(a.x+nx*radius,a.y+ny*radius);ctx.lineTo(b.x+nx*radius,b.y+ny*radius);ctx.arc(b.x,b.y,radius,angle+Math.PI/2,angle-Math.PI/2,true);ctx.lineTo(a.x-nx*radius,a.y-ny*radius);ctx.arc(a.x,a.y,radius,angle-Math.PI/2,angle+Math.PI/2,true);}
        ctx.closePath();ctx.clip();const sx=s.cache.surface.width/key.width,sy=s.cache.surface.height/key.height;ctx.drawImage(s.cache.surface,x*sx,y*sy,(right-x)*sx,(bottom-y)*sy,x,y,right-x,bottom-y);
      }finally{ctx.restore();}
    }
    function drain(gesture,s,ctx,visual,limit){let count=0;while(s.cursor<s.queue.length){const segment=s.queue[s.cursor++],r=gesture.radius,box={x:Math.min(segment.a.x,segment.b.x)-r,y:Math.min(segment.a.y,segment.b.y)-r,w:Math.abs(segment.a.x-segment.b.x)+2*r,h:Math.abs(segment.a.y-segment.b.y)+2*r};metadata(gesture,s,segment,box);
        if(visual&&s.patchAllowed){try{copyPatch(ctx,s,segment,r,box);s.painted=true;}catch{s.patchAllowed=false;}}
        count++;if(limit&&limit(count))break;
      }if(s.cursor===s.queue.length){s.queue=[];s.cursor=0;}
    }
    function paint(ctx,scope){const start=now();let count=0;for(const [gesture,s] of sessions){if(!scopeEqual(s.cache.key.scope,scope))continue;drain(gesture,s,ctx,true,n=>{count++;return count>=64||now()-start>=4;});if(count>=64||now()-start>=4)break;}}
    function stopPainting(active=null){for(const [gesture,s] of sessions)if(gesture!==active)s.patchAllowed=false;}
    function beforeRender(active=null){for(const [gesture,s] of sessions)drain(gesture,s,null,false,null);stopPainting(active);}
    function effective(item){const entries=visible.get(item.id);if(!entries)return item;const masks=[];for(const entry of entries)if(sameGeometry(entry.source,item))masks.push(...entry.masks);return masks.length?{...item,erasures:[...(item.erasures||[]),...masks]}:item;}
    function hasWork(){for(const s of sessions.values())if(s.cursor<s.queue.length)return true;return false;}
    return Object.freeze({prepare,ready,begin,add,has:gesture=>sessions.has(gesture),paint,hasWork,stopPainting,beforeRender,effective,complete,reset,releaseCache,invalidate:()=>{cache=null;}});
  }
  const api=Object.freeze({create});if(typeof module!=='undefined'&&module.exports)module.exports=api;global.WindsEraserPreview=api;
})(typeof window!=='undefined'?window:globalThis);
