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
    '2H': Object.freeze({shade:'#747d88', opacity:0.32, width:0.65, grain:0.06, kind:'graphite'}),
    H: Object.freeze({shade:'#5d6673', opacity:0.42, width:0.78, grain:0.08, kind:'graphite'}),
    HB: Object.freeze({shade:'#46505b', opacity:0.56, width:0.89, grain:0.11, kind:'graphite'}),
    B: Object.freeze({shade:'#3b4350', opacity:0.66, width:1.06, grain:0.14, kind:'graphite'}),
    '2B': Object.freeze({shade:'#303845', opacity:0.75, width:1.18, grain:0.17, kind:'graphite'}),
    '4B': Object.freeze({shade:'#232a35', opacity:0.84, width:1.43, grain:0.23, kind:'graphite'}),
    '6B': Object.freeze({shade:'#191f2b', opacity:0.93, width:1.68, grain:0.26, kind:'graphite'}),
    Charcoal: Object.freeze({shade:'#1f242c', opacity:0.86, width:2.05, grain:0.35, kind:'charcoal'}),
    'Ink Brush': Object.freeze({shade:'#1e2740', opacity:0.98, width:1.35, grain:0, kind:'ink', colorMode:'ink'}),
    'Color Pencil': Object.freeze({shade:'#5a5b70', opacity:0.54, width:1.02, grain:0.17, kind:'color', colorMode:'ink'})
  });
  const STROKE_STYLES = new Set(['solid','dashed','dotted','none']);
  const FILLABLE = new Set(['rectangle', 'square', 'ellipse', 'circle', 'triangle', 'diamond', 'star']);
  const isFillableShape = kind => FILLABLE.has(kind);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const midpoint = (a,b) => [(a[0]+b[0])*0.5, (a[1]+b[1])*0.5];

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

  function pencilGrade(grade) { return PENCIL_GRADES[grade] || PENCIL_GRADES.HB; }
  function pressureAt(pt) { return clamp(Number.isFinite(pt?.[2])?pt[2]:.68,.10,1); }
  function hash(id,index,salt){
    let n=(index+1)*2654435761 ^ (salt+1)*2246822519;
    const s=String(id||'');for(let k=0;k<s.length;k++) n=Math.imul(n ^ s.charCodeAt(k),16777619);
    n^=n>>>16;n=Math.imul(n,2246822519);n^=n>>>13;
    return (n>>>0)/4294967295;
  }
  function pencilWidth(item,pressure) { const settings=pencilGrade(item.grade); return Math.max(.4,(item.size||3)*settings.width*(settings.kind==='ink'?.16+1.18*pressure:.43+.75*pressure)); }

  function drawGraphiteCurve(ctx,item,a,b,control,index) {
    const settings=pencilGrade(item.grade);
    const p=control?pressureAt(control):(.5*(pressureAt(a)+pressureAt(b)));
    ctx.save();
    const pigment=settings.colorMode==='ink' && /^#[0-9a-fA-F]{6}$/.test(item.color||'')?item.color:settings.shade;
    ctx.strokeStyle=pigment;ctx.fillStyle=pigment;
    ctx.globalAlpha=clamp(settings.opacity*(settings.kind==='ink'?.85+.15*p:.52+.48*p),.08,1);
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.lineWidth=pencilWidth(item,p);
    ctx.beginPath();ctx.moveTo(a[0],a[1]);
    if(control)ctx.quadraticCurveTo(control[0],control[1],b[0],b[1]);
    else ctx.lineTo(b[0],b[1]);
    ctx.stroke();
    // Soft graphite grain is deterministic, so exports and reopened notebooks
    // reproduce the original drawing. Just one speck per small segment keeps
    // the stylus drawing path light on slower iPads.
    if(settings.grain>0 && index%3===0 && Math.hypot(b[0]-a[0],b[1]-a[1])>1.5) {
      const t=.25+.5*hash(item.id,index,0);
      const jitter=(hash(item.id,index,1)-.5)*ctx.lineWidth*1.7;
      const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.max(0.01,Math.hypot(dx,dy));
      const gx=a[0]+dx*t-dy/len*jitter,gy=a[1]+dy*t+dx/len*jitter;
      ctx.beginPath();ctx.globalAlpha=settings.grain*(.5+.5*p);
      ctx.arc(gx,gy,Math.max(.22,ctx.lineWidth*.21),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  function drawArtistPart(ctx,item,points,index) {
    if(index===0) {
      const a=points[0];ctx.save();ctx.globalAlpha=pencilGrade(item.grade).opacity;
      const settings=pencilGrade(item.grade);ctx.fillStyle=settings.colorMode==='ink' && /^#[0-9a-fA-F]{6}$/.test(item.color||'')?item.color:settings.shade;
      ctx.beginPath();ctx.arc(a[0],a[1],pencilWidth(item,pressureAt(a))*.5,0,Math.PI*2);ctx.fill();ctx.restore();
    } else if(index===1) {
      drawGraphiteCurve(ctx,item,points[0],midpoint(points[0],points[1]),null,index);
    } else {
      const a=points[index-2],b=points[index-1],c=points[index];
      drawGraphiteCurve(ctx,item,midpoint(a,b),midpoint(b,c),b,index);
    }
  }
  function drawArtistEnd(ctx,item,points){
    if(points.length<2)return;
    const a=points[points.length-2],b=points[points.length-1];
    drawGraphiteCurve(ctx,item,midpoint(a,b),b,null,points.length);
  }
  function drawArtistStroke(ctx,item){
    const points=item.points||[];
    for(let i=0;i<points.length;i++)drawArtistPart(ctx,item,points,i);
    drawArtistEnd(ctx,item,points);
  }
  return Object.freeze({PENCIL_GRADES, STROKE_STYLES, isFillableShape, drawShape, shapePath,
    drawArtistPart, drawArtistEnd, drawArtistStroke, pencilGrade});
});
