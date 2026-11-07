/* Closed-area filling. Raster work is bounded and yields outside input callbacks. */
(function(global){
  'use strict';
  let active=false,selected=false;
  async function region(pixels,width,height,x,y,pause=async()=>{}){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width*height>1500000||pixels.length!==width*height*4)throw Error('This page is too large to fill safely.');
    x=Math.floor(x);y=Math.floor(y);
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=width||y>=height)throw Error('Tap inside the page.');
    const seed=y*width+x;
    if(pixels[seed*4+3]>=12)throw Error('Tap inside the boundary, away from its line.');
    const visited=new Uint8Array(width*height),queue=new Int32Array(width*height);
    let read=0,write=1,minX=x,maxX=x,minY=y,maxY=y;
    queue[0]=seed;visited[seed]=1;
    const visit=index=>{
      if(!visited[index]&&pixels[index*4+3]<12){visited[index]=1;queue[write++]=index;}
    };
    while(read<write){
      for(let work=0;read<write&&work<8192;read++,work++){
        const index=queue[read],px=index%width,py=Math.floor(index/width);
        if(px===0||py===0||px===width-1||py===height-1)throw Error('This area is open. Close every gap in the boundary, then try again.');
        minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
        visit(index-1);visit(index+1);visit(index-width);visit(index+width);
      }
      await pause();
    }
    if(write<4)throw Error('This area is too small to fill.');
    // One pixel under the outline prevents a light seam; the outline is kept above it.
    minX--;minY--;maxX++;maxY++;
    const w=maxX-minX+1,h=maxY-minY+1,mask=new Uint8Array(w*h);
    for(let row=0;row<h;row++){
      for(let col=0;col<w;col++){
        const index=(minY+row)*width+minX+col;
        const inside=visited[index]||pixels[index*4+3]>=12&&(visited[index-1]||visited[index+1]||visited[index-width]||visited[index+width]);
        if(inside)mask[row*w+col]=1;
      }
      if(row%32===0)await pause();
    }
    return {x:minX,y:minY,w,h,mask};
  }
  async function colorize(area,color,opacity,pause=async()=>{}){
    if(!/^#[0-9a-fA-F]{6}$/.test(color)||!Number.isFinite(opacity)||opacity<=0||opacity>1)throw Error('Choose a fill color and opacity.');
    const rgba=new Uint8ClampedArray(area.w*area.h*4),rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16));
    for(let row=0;row<area.h;row++){
      for(let col=0;col<area.w;col++){
        const i=row*area.w+col;if(!area.mask[i])continue;
        rgba[i*4]=rgb[0];rgba[i*4+1]=rgb[1];rgba[i*4+2]=rgb[2];rgba[i*4+3]=Math.round(opacity*255);
      }
      if(row%32===0)await pause();
    }
    return rgba;
  }
  async function sameMask(area,pixels,pause=async()=>{}){
    if(pixels.length!==area.mask.length*4)return false;
    for(let row=0;row<area.h;row++){
      for(let col=0;col<area.w;col++){const i=row*area.w+col;if(Boolean(area.mask[i])!==Boolean(pixels[i*4+3]))return false;}
      if(row%32===0)await pause();
    }
    return true;
  }
  const api=Object.freeze({region,colorize,sameMask,setActive:value=>{active=Boolean(value);},isActive:()=>active,setSelected:value=>{selected=Boolean(value);},isSelected:()=>selected});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.WindsBoundaryFill=api;
})(typeof window!=='undefined'?window:globalThis);
