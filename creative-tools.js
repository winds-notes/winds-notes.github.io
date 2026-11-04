/* WiNDS Notes creative tools: reusable canvas drawing primitives.
 * Kept separate so Codex can extend pencil grades and filled figures without
 * touching the Apple Pencil pointer-event pipeline.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WindsCreative = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Brush profiles are deliberately cheap to render on iPad. A single stroke
  // uses deterministic texture: no bitmap allocation or storage in pen handlers.
  const PENCIL_GRADES = Object.freeze({
    '2H': Object.freeze({shade:'#66717c', opacity:0.34, width:0.56, grain:0.07, softness:0.13, spacing:0.20, kind:'graphite'}),
    H: Object.freeze({shade:'#59626d', opacity:0.44, width:0.72, grain:0.10, softness:0.17, spacing:0.20, kind:'graphite'}),
    HB: Object.freeze({shade:'#414953', opacity:0.58, width:0.96, grain:0.15, softness:0.21, spacing:0.19, kind:'graphite'}),
    B: Object.freeze({shade:'#353d47', opacity:0.66, width:1.16, grain:0.19, softness:0.25, spacing:0.18, kind:'graphite'}),
    '2B': Object.freeze({shade:'#2d343e', opacity:0.76, width:1.46, grain:0.23, softness:0.29, spacing:0.18, kind:'graphite'}),
    '4B': Object.freeze({shade:'#252c35', opacity:0.85, width:1.86, grain:0.29, softness:0.34, spacing:0.17, kind:'graphite'}),
    '6B': Object.freeze({shade:'#1d242d', opacity:0.94, width:2.28, grain:0.34, softness:0.39, spacing:0.16, kind:'graphite'}),
    Charcoal: Object.freeze({shade:'#25262c', opacity:0.90, width:2.85, grain:0.58, softness:0.54, spacing:0.13, kind:'charcoal'}),
    'Ink Brush': Object.freeze({shade:'#1e2740', opacity:1, width:1.48, grain:0, kind:'ink', colorMode:'ink'}),
    'Color Pencil': Object.freeze({shade:'#5a5b70', opacity:0.74, width:1.18, grain:0.32, softness:0.20, spacing:0.19, kind:'color', colorMode:'ink'})
  });
  const STROKE_STYLES = new Set(['solid','dashed','dotted','none']);
  const FILLABLE = new Set(['rectangle', 'square', 'ellipse', 'circle', 'triangle', 'diamond', 'star']);
  const isFillableShape = kind => FILLABLE.has(kind);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const midpoint = (a,b) => [(a[0]+b[0])*0.5, (a[1]+b[1])*0.5];

  const rotatable = item => item?.type==='image'||item?.type==='sticker';
  function objectRotation(item) {
    return rotatable(item)&&Number.isFinite(item.rotation)?((item.rotation%360)+360)%360:0;
  }
  function objectRect(item) {
    return {x:item.x,y:item.y,w:item.type==='sticker'?(item.size||78):item.w,h:item.type==='sticker'?(item.size||78):item.h};
  }
  function objectPoint(item,point,inverse=false) {
    const rotation=objectRotation(item);if(!rotation)return point;
    const b=objectRect(item),cx=b.x+b.w/2,cy=b.y+b.h/2;
    const angle=rotation*Math.PI/180*(inverse?-1:1),cos=Math.cos(angle),sin=Math.sin(angle);
    const dx=point.x-cx,dy=point.y-cy;
    return {x:cx+dx*cos-dy*sin,y:cy+dx*sin+dy*cos};
  }
  function rotateContext(ctx,item) {
    const rotation=objectRotation(item);if(!rotation)return;
    const b=objectRect(item),cx=b.x+b.w/2,cy=b.y+b.h/2;
    ctx.translate(cx,cy);ctx.rotate(rotation*Math.PI/180);ctx.translate(-cx,-cy);
  }
  function positionObjectRect(original,resized) {
    if(!objectRotation(original))return resized;
    const b=objectRect(resized),center=objectPoint(original,{x:b.x+b.w/2,y:b.y+b.h/2});
    return {...resized,x:center.x-b.w/2,y:center.y-b.h/2};
  }

  const FULL_CROP = Object.freeze({x:0,y:0,w:1,h:1});
  function imageCrop(crop) {
    if(!crop || !['x','y','w','h'].every(k=>Number.isFinite(crop[k])))return {...FULL_CROP};
    const x=clamp(crop.x,0,.99),y=clamp(crop.y,0,.99);
    return {x,y,w:clamp(crop.w,.01,1-x),h:clamp(crop.h,.01,1-y)};
  }
  function dragImageCrop(crop,corner,dx,dy) {
    const next=imageCrop(crop),right=next.x+next.w,bottom=next.y+next.h;
    if(corner==='move')return {...next,x:clamp(next.x+dx,0,1-next.w),y:clamp(next.y+dy,0,1-next.h)};
    if(corner.includes('w')){next.x=clamp(next.x+dx,0,right-.01);next.w=right-next.x;}
    if(corner.includes('e'))next.w=clamp(next.w+dx,.01,1-next.x);
    if(corner.includes('n')){next.y=clamp(next.y+dy,0,bottom-.01);next.h=bottom-next.y;}
    if(corner.includes('s'))next.h=clamp(next.h+dy,.01,1-next.y);
    return next;
  }
  function cropImage(item,crop) {
    const old=imageCrop(item.crop),next=imageCrop(crop);
    const fullWidth=item.w/old.w,fullHeight=item.h/old.h;
    const scale=Math.min(1,2200/(fullWidth*next.w),2200/(fullHeight*next.h));
    const result={...item,x:item.x+(next.x-old.x)*fullWidth,y:item.y+(next.y-old.y)*fullHeight,
      w:fullWidth*next.w*scale,h:fullHeight*next.h*scale};
    if(next.x===0 && next.y===0 && next.w===1 && next.h===1)delete result.crop;
    else result.crop=next;
    return positionObjectRect(item,result);
  }
  function drawImage(ctx,item,image) {
    const crop=imageCrop(item.crop);
    ctx.drawImage(image,crop.x*image.naturalWidth,crop.y*image.naturalHeight,
      crop.w*image.naturalWidth,crop.h*image.naturalHeight,item.x,item.y,item.w,item.h);
  }

  function penWidth(item,point) {
    const pressure=clamp(Number.isFinite(point?.[2])?point[2]:.68,.1,1);
    return Math.max(.85,(item.size||3)*(.45+.55*pressure));
  }
  function penMidpoint(item,a,b) {
    return {x:(a[0]+b[0])*.5,y:(a[1]+b[1])*.5,r:(penWidth(item,a)+penWidth(item,b))*.25};
  }
  function penPoint(item,p) {return {x:p[0],y:p[1],r:penWidth(item,p)*.5};}
  function penCurve(item,points,index,finish=false) {
    if(points.length<2)return null;
    if(finish){const a=points[points.length-2],b=points[points.length-1];return {a:penMidpoint(item,a,b),b:penPoint(item,b)};}
    if(index===1)return {a:penPoint(item,points[0]),b:penMidpoint(item,points[0],points[1])};
    const a=points[index-2],b=points[index-1],c=points[index];
    return {a:penMidpoint(item,a,b),control:penPoint(item,b),b:penMidpoint(item,b,c)};
  }
  function drawPenCurve(ctx,curve,startCap=true,endCap=true) {
    const {a,b}=curve,c=curve.control||{x:(a.x+b.x)*.5,y:(a.y+b.y)*.5,r:(a.r+b.r)*.5};
    const length=Math.hypot(c.x-a.x,c.y-a.y)+Math.hypot(b.x-c.x,b.y-c.y);
    if(length<1e-8){if(startCap||endCap){ctx.beginPath();ctx.arc(b.x,b.y,Math.max(a.r,b.r),0,Math.PI*2);ctx.fill();}return;}
    const vx=c.x-a.x,vy=c.y-a.y,dx=b.x-2*c.x+a.x,dy=b.y-2*c.y+a.y,den=dx*dx+dy*dy;
    if(den>1e-12 && vx*(b.x-c.x)+vy*(b.y-c.y)<0){
      const t=-(vx*dx+vy*dy)/den;
      if(t>1e-6 && t<1-1e-6 && Math.hypot(vx+t*dx,vy+t*dy)<1e-7){
        // Split an exact reversal at its stationary point so its tip gets a
        // round cap instead of a collapsed normal or a self-crossing ribbon.
        const mix=(p,q)=>({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,r:p.r+(q.r-p.r)*t});
        const left=mix(a,c),right=mix(c,b),turn=mix(left,right);
        drawPenCurve(ctx,{a,control:left,b:turn},startCap,true);drawPenCurve(ctx,{a:turn,control:right,b},true,endCap);return;
      }
    }
    // Bounded, incremental work: only the new curve is sampled, never the page.
    const steps=clamp(Math.ceil(length/2),2,32),left=[],right=[];
    let startAngle=0,endAngle=0;
    for(let i=0;i<=steps;i++){
      const t=i/steps,u=1-t,x=u*u*a.x+2*u*t*c.x+t*t*b.x,y=u*u*a.y+2*u*t*c.y+t*t*b.y;
      const r=u*u*a.r+2*u*t*c.r+t*t*b.r;
      let dx=u*(c.x-a.x)+t*(b.x-c.x),dy=u*(c.y-a.y)+t*(b.y-c.y);
      if(Math.hypot(dx,dy)<1e-8){dx=b.x-a.x;dy=b.y-a.y;}
      const len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
      left.push([x+nx*r,y+ny*r]);right.push([x-nx*r,y-ny*r]);
      if(i===0)startAngle=Math.atan2(ny,nx);if(i===steps)endAngle=Math.atan2(ny,nx);
    }
    // A filled ribbon varies width continuously. Adjacent curves share the
    // same endpoint radius, rather than stacking different-width line caps.
    ctx.beginPath();ctx.moveTo(...left[0]);
    for(let i=1;i<left.length;i++)ctx.lineTo(...left[i]);
    if(endCap)ctx.arc(b.x,b.y,b.r,endAngle,endAngle-Math.PI,true);else ctx.lineTo(...right[right.length-1]);
    for(let i=right.length-2;i>=0;i--)ctx.lineTo(...right[i]);
    if(startCap)ctx.arc(a.x,a.y,a.r,startAngle-Math.PI,startAngle-2*Math.PI,true);else ctx.lineTo(...left[0]);
    ctx.closePath();ctx.fill();
  }
  function drawPenPart(ctx,item,points,index) {
    if(index===0){const p=points[0];ctx.beginPath();ctx.arc(p[0],p[1],penWidth(item,p)*.5,0,Math.PI*2);ctx.fill();return;}
    drawPenCurve(ctx,penCurve(item,points,index));
  }
  function drawPenEnd(ctx,item,points) {
    const curve=penCurve(item,points,0,true);if(curve)drawPenCurve(ctx,curve);
  }

  function shapePath(ctx, item) {
    const {x,y,w,h} = item;
    ctx.beginPath();
    if(item.kind==='rectangle' || item.kind==='square') ctx.rect(x,y,w,h);
    else if(item.kind==='ellipse' || item.kind==='circle') ctx.ellipse(x+w/2,y+h/2,Math.max(0.1,Math.abs(w/2)),Math.max(0.1,Math.abs(h/2)),0,0,Math.PI*2);
    else if(item.kind==='triangle') {
      ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.closePath();
    } else if(item.kind==='diamond') {
      ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h/2);ctx.lineTo(x+w/2,y+h);ctx.lineTo(x,y+h/2);ctx.closePath();
    } else if(item.kind==='star') {
      // Independent radii allow landscape as well as portrait star figures.
      const cx=x+w/2, cy=y+h/2, rx=Math.max(.1,Math.abs(w)/2), ry=Math.max(.1,Math.abs(h)/2);
      for(let i=0;i<10;i++){
        const a=-Math.PI/2+i*Math.PI/5, r=i%2?.44:1;
        const px=cx+Math.cos(a)*rx*r, py=cy+Math.sin(a)*ry*r;
        if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(x,y);ctx.lineTo(x+w,y+h);
      if(item.kind==='arrow') {
        const angle=Math.atan2(h,w),len=Math.min(25,Math.max(12,(item.size||3)*5));
        const ex=x+w,ey=y+h;
        ctx.moveTo(ex-len*Math.cos(angle-.58),ey-len*Math.sin(angle-.58));
        ctx.lineTo(ex,ey);ctx.lineTo(ex-len*Math.cos(angle+.58),ey-len*Math.sin(angle+.58));
      }
    }
  }

  function drawShape(ctx,item) {
    ctx.save();
    ctx.lineWidth=item.size||3;ctx.strokeStyle=item.color||'#2b2d4c';
    ctx.lineJoin='round';ctx.lineCap='round';
    shapePath(ctx,item);
    if(isFillableShape(item.kind) && typeof item.fillColor==='string' && /^#[0-9a-fA-F]{6}$/.test(item.fillColor)) {
      ctx.save();ctx.fillStyle=item.fillColor;
      ctx.globalAlpha=clamp(Number.isFinite(item.fillOpacity)?item.fillOpacity:1,0,1);
      ctx.fill();ctx.restore();
    }
    const style=STROKE_STYLES.has(item.strokeStyle)?item.strokeStyle:'solid';
    if(style!=='none'){
      if(style==='dashed')ctx.setLineDash([Math.max(5,ctx.lineWidth*3),Math.max(4,ctx.lineWidth*2)]);
      else if(style==='dotted')ctx.setLineDash([Math.max(1,ctx.lineWidth*.2),Math.max(4,ctx.lineWidth*1.8)]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function pencilGrade(grade) { return PENCIL_GRADES[artistGradeName(grade)]; }
  function artistGradeName(grade){return Object.prototype.hasOwnProperty.call(PENCIL_GRADES,grade)?grade:'HB';}
  function pressureAt(pt) { return clamp(Number.isFinite(pt?.[2])?pt[2]:.68,.03,1); }
  function hash(id,index,salt){
    let n=(index+1)*2654435761 ^ (salt+1)*2246822519;
    const s=String(id||'');for(let k=0;k<s.length;k++) n=Math.imul(n ^ s.charCodeAt(k),16777619);
    n^=n>>>16;n=Math.imul(n,2246822519);n^=n>>>13;
    return (n>>>0)/4294967295;
  }
  function grainNoise(x,y,seed){
    let n=Math.imul(x+1,374761393)^Math.imul(y+1,668265263)^seed;
    n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
  }
  function artistPigment(item){
    const settings=pencilGrade(item.grade);
    return settings.colorMode==='ink' && /^#[0-9a-fA-F]{6}$/.test(item.color||'')?item.color:settings.shade;
  }
  function pencilWidth(item,pressure){
    const settings=pencilGrade(item.grade),p=clamp(Number.isFinite(pressure)?pressure:.68,.03,1);
    const response=settings.kind==='ink'?.08+1.42*Math.pow(p,1.55):.28+.98*Math.pow(p,.8);
    return Math.max(settings.kind==='ink'?.35:.42,(item.size||3)*settings.width*response);
  }
  function artistBoundsPadding(item){return pencilWidth(item,1)*.68+2;}
  function artistStampPixels(grade,color){
    grade=artistGradeName(grade);
    const settings=pencilGrade(grade),side=settings.kind==='charcoal'?96:64;
    const pigment=/^#[0-9a-fA-F]{6}$/.test(color||'')?color:settings.shade;
    const rgb=[1,3,5].map(i=>parseInt(pigment.slice(i,i+2),16));
    const data=new Uint8ClampedArray(side*side*4),seed=Math.floor(hash(grade,0,17)*4294967295);
    for(let y=0;y<side;y++)for(let x=0;x<side;x++){
      const dx=(x+.5)/side*2-1,dy=(y+.5)/side*2-1,r=Math.hypot(dx,dy);
      const fine=grainNoise(x,y,seed),coarse=grainNoise(x>>2,y>>2,seed^0x5bd1e995);
      let edge=Math.pow(clamp((1-r)/(settings.softness||.2),0,1),.8),tooth;
      if(settings.kind==='charcoal'){
        tooth=(.09+.91*coarse)*(fine>.72+.18*coarse?.12:1);
        edge*=.68+.32*grainNoise(x>>3,y>>3,seed);
      }else if(settings.kind==='color'){
        const fiber=grainNoise(x>>2,y>>1,seed^0x27d4eb2d);
        tooth=(.10+.90*Math.pow(fine,.75))*(fiber<.24?.18:1);
      }else{
        tooth=.15+.85*(.64*fine+.36*coarse);
        if(fine>.97-settings.grain*.35)tooth*=.12;
      }
      const offset=(y*side+x)*4;
      data[offset]=rgb[0];data[offset+1]=rgb[1];data[offset+2]=rgb[2];data[offset+3]=Math.round(255*edge*tooth);
    }
    return {width:side,height:side,data};
  }
  function artistPaperPixels(grade,color){
    grade=artistGradeName(grade);
    const settings=pencilGrade(grade),side=64,pigment=/^#[0-9a-fA-F]{6}$/.test(color||'')?color:settings.shade;
    const rgb=[1,3,5].map(i=>parseInt(pigment.slice(i,i+2),16)),data=new Uint8ClampedArray(side*side*4);
    const seed=Math.floor(hash(grade,7,23)*4294967295);
    for(let y=0;y<side;y++)for(let x=0;x<side;x++){
      const fine=grainNoise(x,y,seed),fiber=grainNoise(x>>1,y>>2,seed^0x27d4eb2d),offset=(y*side+x)*4;
      const tooth=settings.kind==='color'?.65*fine+.35*fiber:fine;
      data[offset]=rgb[0];data[offset+1]=rgb[1];data[offset+2]=rgb[2];
      data[offset+3]=tooth<.25+settings.grain*.25?0:Math.round(255*(.45+.55*tooth));
    }
    return {width:side,height:side,data};
  }
  function materialCanvas(){
    if(typeof OffscreenCanvas==='function')return new OffscreenCanvas(1,1);
    return typeof document!=='undefined'?document.createElement('canvas'):null;
  }
  function putMaterialPixels(canvas,pixels){
    canvas.width=pixels.width;canvas.height=pixels.height;
    const ctx=canvas.getContext('2d'),image=ctx.createImageData(pixels.width,pixels.height);
    image.data.set(pixels.data);ctx.putImageData(image,0,0);return ctx;
  }
  const artistStamps=new Map(),artistPatterns=new Map();
  function artistStamp(grade,color){
    const key=grade+'|'+color.toLowerCase();
    if(artistStamps.has(key))return artistStamps.get(key);
    let stamp=null;
    try{
      stamp=materialCanvas();
      if(stamp){
        const ctx=putMaterialPixels(stamp,artistStampPixels(grade,color));
        if(pencilGrade(grade).kind!=='charcoal' && typeof ctx.createPattern==='function'){
          const paper=materialCanvas();putMaterialPixels(paper,artistPaperPixels(grade,color));
          const pattern=ctx.createPattern(paper,'repeat');
          try{pattern?.setTransform?.({a:.6,b:0,c:0,d:.6,e:0,f:0});}catch{}
          artistPatterns.set(key,pattern);
        }
      }
    }catch{stamp=null;}
    artistStamps.set(key,stamp);
    // Keep graphite masks resident; bound custom-color masks to about 512 KB.
    const colors=[...artistStamps.keys()].filter(k=>k.startsWith('Color Pencil|'));
    if(colors.length>32){artistStamps.delete(colors[0]);artistPatterns.delete(colors[0]);}
    return stamp;
  }
  function prepareArtistColor(color){
    if(/^#[0-9a-fA-F]{6}$/.test(color||''))artistStamp('Color Pencil',color);
  }
  function artistPoint(item,p){return {x:p[0],y:p[1],p:pressureAt(p),r:pencilWidth(item,pressureAt(p))*.5};}
  function artistMidpoint(item,a,b){
    const first=artistPoint(item,a),second=artistPoint(item,b);
    return {x:(first.x+second.x)*.5,y:(first.y+second.y)*.5,p:(first.p+second.p)*.5,r:(first.r+second.r)*.5};
  }
  function artistCurve(item,points,index,finish=false){
    if(points.length<2)return null;
    if(finish){const a=points[points.length-2],b=points[points.length-1];return {a:artistMidpoint(item,a,b),b:artistPoint(item,b)};}
    if(index===1)return {a:artistPoint(item,points[0]),b:artistMidpoint(item,points[0],points[1])};
    return {a:artistMidpoint(item,points[index-2],points[index-1]),control:artistPoint(item,points[index-1]),b:artistMidpoint(item,points[index-1],points[index])};
  }
  function artistCurvePath(ctx,a,b,c){
    ctx.beginPath();ctx.moveTo(a.x,a.y);
    if(c)ctx.quadraticCurveTo(c.x,c.y,b.x,b.y);else ctx.lineTo(b.x,b.y);
  }
  function drawArtistCurve(ctx,item,curve,index,finish=false){
    if(!curve)return;
    const grade=artistGradeName(item.grade),settings=pencilGrade(grade),pigment=artistPigment(item),{a,b}=curve;
    ctx.save();ctx.fillStyle=pigment;ctx.strokeStyle=pigment;ctx.lineCap='round';ctx.lineJoin='round';
    if(settings.kind==='ink'){
      ctx.globalAlpha=1;drawPenCurve(ctx,curve);ctx.restore();return;
    }
    const c=curve.control||{x:(a.x+b.x)*.5,y:(a.y+b.y)*.5,p:(a.p+b.p)*.5,r:(a.r+b.r)*.5};
    const length=Math.hypot(c.x-a.x,c.y-a.y)+Math.hypot(b.x-c.x,b.y-c.y);
    const p=(a.p+2*c.p+b.p)*.25,width=a.r+b.r;
    // A light continuous core joins the material deposits without dark beads.
    ctx.globalAlpha=settings.opacity*(settings.kind==='charcoal'?.025+.035*p:.055+.065*p);
    ctx.lineCap='butt';ctx.lineWidth=Math.max(.3,width*.68);artistCurvePath(ctx,a,b,curve.control);ctx.stroke();
    const stamp=artistStamp(grade,pigment);
    if(stamp){
      const paper=artistPatterns.get(grade+'|'+pigment.toLowerCase());
      const steps=clamp(Math.ceil(length/Math.max(.65,width*settings.spacing)),1,96);
      const angle=settings.kind==='charcoal'?-.60:-.22,cos=Math.cos(angle),sin=Math.sin(angle);
      const seed=Math.floor(hash(grade,index,13)*4294967295);
      ctx.save();ctx.rotate(angle);
      for(let i=0;i<steps;i++){
        const t=(i+.5)/steps,u=1-t;
        let x=u*u*a.x+2*u*t*c.x+t*t*b.x,y=u*u*a.y+2*u*t*c.y+t*t*b.y;
        const pressure=u*u*a.p+2*u*t*c.p+t*t*b.p,w=2*(u*u*a.r+2*u*t*c.r+t*t*b.r);
        const dx=u*(c.x-a.x)+t*(b.x-c.x),dy=u*(c.y-a.y)+t*(b.y-c.y),len=Math.hypot(dx,dy)||1;
        const scatter=(grainNoise(i,index,seed)-.5)*w*(settings.kind==='charcoal'?.12:.035);
        x-=dy/len*scatter;y+=dx/len*scatter;
        const rx=x*cos+y*sin,ry=-x*sin+y*cos;
        const sw=w*(settings.kind==='charcoal'?1.12:1),sh=w*(settings.kind==='charcoal'?.65:.88);
        const deposit=!paper ? .45 : settings.kind==='color' ? .28 : .36;
        ctx.globalAlpha=settings.opacity*(.15+.85*Math.pow(pressure,1.1))*deposit;
        ctx.drawImage(stamp,rx-sw/2,ry-sh/2,sw,sh);
      }
      ctx.restore();
      if(paper){
        ctx.fillStyle=paper;ctx.globalAlpha=settings.opacity*(.2+.8*p);
        const scale=point=>({...point,r:point.r*.9});
        drawPenCurve(ctx,{a:scale(a),b:scale(b),...(curve.control?{control:scale(c)}:{})},index===1,finish);
      }
    }else{
      // Canvas-less or restricted environments retain deterministic vector ink.
      const fibers=settings.kind==='charcoal'?6:4;
      for(let i=0;i<fibers;i++){
        const offset=(i/(fibers-1)-.5)*width*.7;
        const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
        ctx.globalAlpha=settings.opacity*(.1+.16*p)*(.6+.4*hash(grade,index,i));
        ctx.lineWidth=Math.max(.3,width/(fibers*2));
        artistCurvePath(ctx,{x:a.x+nx*offset,y:a.y+ny*offset},{x:b.x+nx*offset,y:b.y+ny*offset},curve.control?{x:c.x+nx*offset,y:c.y+ny*offset}:null);ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawArtistPart(ctx,item,points,index){
    if(index===0){
      const a=artistPoint(item,points[0]),settings=pencilGrade(item.grade),pigment=artistPigment(item);
      ctx.save();ctx.fillStyle=pigment;
      if(settings.kind==='ink'){
        ctx.globalAlpha=1;ctx.beginPath();ctx.arc(a.x,a.y,a.r,0,Math.PI*2);ctx.fill();
      }else{
        const stamp=artistStamp(artistGradeName(item.grade),pigment);
        ctx.globalAlpha=settings.opacity*(.15+.85*Math.pow(a.p,1.1))*.58;
        if(stamp)ctx.drawImage(stamp,a.x-a.r,a.y-a.r,a.r*2,a.r*2);
        else{ctx.beginPath();ctx.arc(a.x,a.y,a.r,0,Math.PI*2);ctx.fill();}
      }
      ctx.restore();return;
    }
    drawArtistCurve(ctx,item,artistCurve(item,points,index),index);
  }
  function drawArtistEnd(ctx,item,points){drawArtistCurve(ctx,item,artistCurve(item,points,0,true),points.length,true);}
  function drawArtistStroke(ctx,item){
    const points=item.points||[];
    for(let i=0;i<points.length;i++)drawArtistPart(ctx,item,points,i);
    drawArtistEnd(ctx,item,points);
  }
  // Allocate the small reusable material masks before the first Pencil contact.
  for(const [grade,settings] of Object.entries(PENCIL_GRADES))if(settings.kind!=='ink')artistStamp(grade,settings.shade);
  return Object.freeze({PENCIL_GRADES, STROKE_STYLES, isFillableShape, drawShape, shapePath,
    drawArtistPart, drawArtistEnd, drawArtistStroke, pencilGrade, pencilWidth, artistCurve, artistBoundsPadding, artistStampPixels, artistPaperPixels, prepareArtistColor,
    imageCrop,dragImageCrop,cropImage,drawImage,penCurve,drawPenPart,drawPenEnd,
    rotatable,objectRotation,objectRect,objectPoint,rotateContext,positionObjectRect});
});
