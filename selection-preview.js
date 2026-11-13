/* Cached object transforms. Page objects and history are never changed here. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.WindsSelectionPreview=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const MAX_PIXELS=4194304;
  function create(adapter){
    const surfaces=[];let cache=null;
    function release(){cache=null;surfaces.forEach(surface=>{surface.width=surface.height=1;});}
    function surface(index,width,height,scale){
      const canvas=surfaces[index]||(surfaces[index]=adapter.makeCanvas());
      const ratio=Math.min(scale,4096/width,4096/height,Math.sqrt(MAX_PIXELS/(width*height)));
      canvas.width=1;canvas.height=Math.max(1,Math.floor(height*ratio));canvas.width=Math.max(1,Math.floor(width*ratio));
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('Selection preview unavailable');
      ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
      return {canvas,ctx,sx:canvas.width/width,sy:canvas.height/height};
    }
    function prepare(page,original,width,height){
      release();
      try{
        const index=page.items.indexOf(original);if(index<0)return false;
        const below=surface(0,width,height,2);adapter.background(below.ctx,page);
        for(let i=0;i<index;i++)adapter.draw(below.ctx,page.items[i]);
        let above=null;
        if(index+1<page.items.length){above=surface(1,width,height,2);for(let i=index+1;i<page.items.length;i++)adapter.draw(above.ctx,page.items[i]);}
        const flat={...original,rotation:0},bounds=adapter.bounds(flat);
        const sprite=surface(2,Math.max(1,bounds.w),Math.max(1,bounds.h),2);
        sprite.ctx.translate(-bounds.x,-bounds.y);adapter.draw(sprite.ctx,flat);
        const originalBounds=adapter.bounds(original);
        cache={original,width,height,below,above,sprite,bounds,originalBounds,previous:originalBounds};return true;
      }catch{release();return false;}
    }
    function paint(ctx,preview,dx=0,dy=0,resizing=false){
      if(!cache)return false;
      const c=cache,next=resizing?adapter.bounds(preview):{...c.originalBounds,x:c.originalBounds.x+dx,y:c.originalBounds.y+dy};
      const x=Math.max(0,Math.floor(Math.min(c.previous.x,next.x)-2)),y=Math.max(0,Math.floor(Math.min(c.previous.y,next.y)-2));
      const right=Math.min(c.width,Math.ceil(Math.max(c.previous.x+c.previous.w,next.x+next.w)+2)),bottom=Math.min(c.height,Math.ceil(Math.max(c.previous.y+c.previous.h,next.y+next.h)+2));
      if(right<=x||bottom<=y){c.previous=next;return true;}
      const patch=layer=>ctx.drawImage(layer.canvas,x*layer.sx,y*layer.sy,(right-x)*layer.sx,(bottom-y)*layer.sy,x,y,right-x,bottom-y);
      ctx.save();
      try{
        ctx.beginPath();ctx.rect(x,y,right-x,bottom-y);ctx.clip();patch(c.below);
        if(resizing&&['shape','graph','vector','stroke'].includes(preview.type))adapter.draw(ctx,preview);
        else{
          ctx.save();adapter.rotate(ctx,preview);
          if(resizing){const a=adapter.rect(c.original),b=adapter.rect(preview);ctx.translate(b.x,b.y);ctx.scale(b.w/Math.max(.001,a.w),b.h/Math.max(.001,a.h));ctx.translate(-a.x,-a.y);}
          else ctx.translate(dx,dy);
          ctx.drawImage(c.sprite.canvas,c.bounds.x,c.bounds.y,c.bounds.w,c.bounds.h);ctx.restore();
        }
        if(c.above)patch(c.above);
      }finally{ctx.restore();}
      c.previous=next;return true;
    }
    return Object.freeze({prepare,paint,release});
  }
  return Object.freeze({create});
});
