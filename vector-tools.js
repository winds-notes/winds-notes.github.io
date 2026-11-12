/* Editable Bézier paths shared by the notebook, path editor and SVG export. */
(function(global){
  'use strict';
  const WIDTH=600,HEIGHT=360,MAX_NODES=128;
  const keys=['x','y','inX','inY','outX','outY'];
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const color=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
  const number=value=>String(+value.toFixed(5));
  const zeroHandles={inX:0,inY:0,outX:0,outY:0};
  const hitPaths=new WeakMap();
  let hitContext=null;
  function validate(item){
    if(!Array.isArray(item.nodes)||item.nodes.length<2||item.nodes.length>MAX_NODES)throw Error('A vector path needs 2–128 anchor points.');
    const nodes=item.nodes.map(node=>{
      if(!node||!keys.every(key=>Number.isFinite(node[key])&&Math.abs(node[key])<=128)||
        node.x<0||node.x>1||node.y<0||node.y>1)throw Error('Invalid vector anchor.');
      return Object.fromEntries(keys.map(key=>[key,node[key]]));
    });
    const closed=item.closed===true&&nodes.length>=3;
    return {nodes,closed,color:color(item.color,'#2b2d4c'),
      size:clamp(Number.isFinite(item.size)?item.size:3,.5,32),
      fillColor:closed?color(item.fillColor,null):null};
  }
  function segment(a,b){
    return a.outX||a.outY||b.inX||b.inY?
      ['C',a.x+a.outX,a.y+a.outY,b.x+b.inX,b.y+b.inY,b.x,b.y]:['L',b.x,b.y];
  }
  function commands(nodes,closed){
    if(!nodes.length)return [];
    const result=[['M',nodes[0].x,nodes[0].y]];
    for(let i=1;i<nodes.length;i++)result.push(segment(nodes[i-1],nodes[i]));
    if(closed&&nodes.length>=3){
      const closing=segment(nodes[nodes.length-1],nodes[0]);
      if(closing[0]==='C')result.push(closing);
      result.push(['Z']);
    }
    return result;
  }
  function pathData(nodes,closed){
    return commands(nodes,closed).map(([op,...values])=>op+values.map(number).join(' ')).join(' ');
  }
  function extrema(a,b,c,d){
    const A=-a+3*b-3*c+d,B=2*(a-2*b+c),C=b-a;
    const root=B*B-4*A*C;
    const values=Math.abs(A)<1e-9?(Math.abs(B)<1e-9?[]:[-C/B]):
      root<0?[]:[(-B+Math.sqrt(root))/(2*A),(-B-Math.sqrt(root))/(2*A)];
    return values.filter(t=>t>0&&t<1).map(t=>{const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;});
  }
  function bounds(nodes,closed){
    const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y);
    let [x,y]=[nodes[0].x,nodes[0].y];
    for(const [op,...v] of commands(nodes,closed).slice(1)){
      if(op==='C'){
        xs.push(...extrema(x,v[0],v[2],v[4]));ys.push(...extrema(y,v[1],v[3],v[5]));
      }
      if(v.length)[x,y]=v.slice(-2);
    }
    const left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top;
    const w=Math.max(16,width),h=Math.max(16,height);
    return {x:left-(w-width)/2,y:top-(h-height)/2,w,h};
  }
  function fit(draft){
    if(!Array.isArray(draft.nodes)||draft.nodes.length<2||draft.nodes.length>MAX_NODES)throw Error('A vector path needs 2–128 anchor points.');
    const box=bounds(draft.nodes,draft.closed);
    const {x,y,w,h}=box;
    const nodes=draft.nodes.map(n=>({x:clamp((n.x-x)/w,0,1),y:clamp((n.y-y)/h,0,1),
      inX:n.inX/w,inY:n.inY/h,outX:n.outX/w,outY:n.outY/h}));
    return {...box,...validate({...draft,nodes})};
  }
  function scaledNodes(item,x=item.x,y=item.y,w=item.w,h=item.h){
    return item.nodes.map(n=>({x:x+n.x*w,y:y+n.y*h,inX:n.inX*w,inY:n.inY*h,outX:n.outX*w,outY:n.outY*h}));
  }
  function draw(ctx,item){
    if(!Array.isArray(item.nodes)||item.nodes.length<2||item.nodes.length>MAX_NODES||
      ![item.x,item.y,item.w,item.h].every(Number.isFinite)||
      item.nodes.some(node=>!node||!keys.every(key=>Number.isFinite(node[key]))))return;
    const nodes=scaledNodes(item),previous=hitPaths.get(item);
    if(typeof global.Path2D==='function'&&(!previous||['x','y','w','h'].some(key=>previous[key]!==item[key])))
      hitPaths.set(item,{x:item.x,y:item.y,w:item.w,h:item.h,path:new global.Path2D(pathData(nodes,item.closed))});
    ctx.save();ctx.beginPath();
    for(const [op,...v] of commands(nodes,item.closed)){
      if(op==='M')ctx.moveTo(...v);
      else if(op==='L')ctx.lineTo(...v);
      else if(op==='C')ctx.bezierCurveTo(...v);
      else ctx.closePath();
    }
    if(item.closed&&item.fillColor){ctx.fillStyle=item.fillColor;ctx.fill();}
    ctx.strokeStyle=item.color;ctx.lineWidth=item.size;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();ctx.restore();
  }
  function hit(item,x,y,tolerance){
    const path=hitPaths.get(item)?.path;
    if(!hitContext||!path)return true;
    hitContext.lineWidth=item.size+2*tolerance;hitContext.lineJoin='round';hitContext.lineCap='round';
    return Boolean(item.closed&&item.fillColor&&hitContext.isPointInPath(path,x,y))||hitContext.isPointInStroke(path,x,y);
  }
  function reframeMasks(original,next){
    if(!original.erasures?.length)return {};
    return {erasures:original.erasures.map(mask=>({
      rx:mask.rx*original.w/next.w,ry:mask.ry*original.h/next.h,
      points:mask.points.map(([x,y])=>[(original.x+x*original.w-next.x)/next.w,(original.y+y*original.h-next.y)/next.h])
    }))};
  }
  function svg(item){
    const clean=validate(item), {w,h}=item,rotation=Number.isFinite(item.rotation)?item.rotation%360:0;
    if(![w,h].every(value=>Number.isFinite(value)&&value>=16&&value<=2200))throw Error('Invalid vector dimensions.');
    const angle=rotation*Math.PI/180,cos=Math.abs(Math.cos(angle)),sin=Math.abs(Math.sin(angle)),pad=clean.size/2+1;
    const width=w*cos+h*sin+2*pad,height=w*sin+h*cos+2*pad;
    const box=[(w-width)/2,(h-height)/2,width,height].map(number).join(' ');
    const erasures=item.erasures||[];
    const holes=erasures.map(mask=>{
      const sx=mask.rx*w,sy=mask.ry*h;
      const points=mask.points.map(([x,y])=>[number(x/mask.rx),number(y/mask.ry)]);
      const ink=points.length===1?`<circle cx="${points[0][0]}" cy="${points[0][1]}" r="1"/>`:
        `<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      return `<g transform="scale(${number(sx)} ${number(sy)})">${ink}</g>`;
    }).join('');
    const mask=holes?`<defs><mask id="erased" maskUnits="userSpaceOnUse" x="${-pad}" y="${-pad}" width="${w+2*pad}" height="${h+2*pad}"><rect x="${-pad}" y="${-pad}" width="${w+2*pad}" height="${h+2*pad}" fill="white"/>${holes}</mask></defs>`:'';
    const path=`<path d="${pathData(scaledNodes(clean,0,0,w,h),clean.closed)}" fill="${clean.fillColor||'none'}" stroke="${clean.color}" stroke-width="${clean.size}" stroke-linecap="round" stroke-linejoin="round"${holes?' mask="url(#erased)"':''}/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">${mask}<g transform="rotate(${number(rotation)} ${number(w/2)} ${number(h/2)})">${path}</g></svg>`;
  }

  const $=id=>document.getElementById(id), namespace='http://www.w3.org/2000/svg';
  let adapter=null,editor=null,frame=0;
  function element(tag,attrs){
    const node=document.createElementNS(namespace,tag);
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
    return node;
  }
  function style(){
    const closed=$('vectorClosed').checked&&editor.nodes.length>=3;
    return {closed,color:$('vectorColor').value,size:$('vectorWidth').valueAsNumber,
      fillColor:closed&&$('vectorFill').checked?$('vectorFillColor').value:null};
  }
  function render(){
    frame=0;if(!editor)return;
    const {nodes,selected}=editor,{closed,color,size,fillColor}=style();
    const path=$('vectorPathPreview');
    path.setAttribute('d',pathData(nodes,closed));
    path.setAttribute('stroke',color);path.setAttribute('stroke-width',Number.isFinite(size)?clamp(size,.5,32):3);
    path.setAttribute('fill',fillColor||'none');
    $('vectorFill').disabled=!closed;$('vectorFillColor').disabled=!fillColor;
    $('vectorApply').disabled=nodes.length<2;
    const active=nodes[selected],handles=[];
    if(active){
      for(const key of ['in','out']){
        const x=active.x+active[key+'X'],y=active.y+active[key+'Y'];
        if(x===active.x&&y===active.y)continue;
        handles.push(element('line',{x1:active.x,y1:active.y,x2:x,y2:y,class:'vector-tangent-line'}),
          element('circle',{cx:x,cy:y,r:7,class:'vector-tangent','data-handle':key}));
      }
    }
    nodes.forEach(({x,y},index)=>handles.push(element('circle',{cx:x,cy:y,r:7,
      class:`vector-anchor${index===selected?' active':''}`,'data-node':index})));
    $('vectorNodes').replaceChildren(...handles);
    for(const id of ['vectorX','vectorY','vectorSmooth','vectorCorner','vectorRemove'])$(id).disabled=!active;
    for(const [id,key] of [['vectorX','x'],['vectorY','y']]){
      if(document.activeElement!==$(id))$(id).value=active?number(active[key]):'';
    }
  }
  function queue(){
    if(!frame)frame=requestAnimationFrame(render);
  }
  function point(event,snap){
    const surface=$('vectorSurface'),p=surface.createSVGPoint();
    p.x=event.clientX;p.y=event.clientY;
    const result=p.matrixTransform(surface.getScreenCTM().inverse());
    const step=snap&&$('vectorSnap').checked?10:0;
    return {x:clamp(step?Math.round(result.x/step)*step:result.x,0,WIDTH),
      y:clamp(step?Math.round(result.y/step)*step:result.y,0,HEIGHT)};
  }
  function pointerDown(event){
    if(!editor||editor.drag||event.button!==0||event.isPrimary===false)return;
    let handle=event.target.dataset.handle,node=event.target.dataset.node;
    if(event.pointerType==='touch'&&node==null&&!handle){
      const p=point(event,false),radius=16*WIDTH/$('vectorSurface').getBoundingClientRect().width;
      const selected=editor.nodes[editor.selected];
      handle=selected&&['in','out'].find(key=>(selected[key+'X']||selected[key+'Y'])&&
        Math.hypot(selected.x+selected[key+'X']-p.x,selected.y+selected[key+'Y']-p.y)<radius);
      if(!handle){
        let closest=radius;
        editor.nodes.forEach((anchor,index)=>{
          const distance=Math.hypot(anchor.x-p.x,anchor.y-p.y);
          if(distance<closest){closest=distance;node=index;}
        });
      }
    }
    const p=point(event,true);
    let index=handle?editor.selected:node==null?-1:Number(node);
    const added=index<0;
    if(added){
      if(editor.nodes.length>=MAX_NODES){adapter.notify('A path can contain up to 128 anchors.');return;}
      index=editor.nodes.length;editor.nodes.push({...p,...zeroHandles});
    }
    event.preventDefault();
    editor.selected=index;
    editor.drag={id:event.pointerId,index,added,handle,start:point(event,false),original:{...editor.nodes[index]}};
    $('vectorSurface').setPointerCapture(event.pointerId);
    queue();
  }
  function pointerMove(event){
    const drag=editor?.drag;
    if(!drag||drag.id!==event.pointerId)return;
    const node=editor.nodes[drag.index],p=point(event,false),dx=p.x-drag.start.x,dy=p.y-drag.start.y;
    if(!drag.moved&&Math.hypot(dx,dy)<3)return;
    drag.moved=true;
    if(drag.added||drag.handle){
      if(drag.handle){
        node[drag.handle+'X']=drag.original[drag.handle+'X']+dx;node[drag.handle+'Y']=drag.original[drag.handle+'Y']+dy;
      }else Object.assign(node,{outX:dx,outY:dy,inX:-dx,inY:-dy});
    }else{
      const snap=value=>$('vectorSnap').checked?Math.round(value/10)*10:value;
      node.x=clamp(snap(drag.original.x+dx),0,WIDTH);node.y=clamp(snap(drag.original.y+dy),0,HEIGHT);
    }
    queue();
  }
  function endPointer(event){
    const drag=editor?.drag;
    if(!drag||drag.id!==event.pointerId)return;
    if(event.type==='pointerup')pointerMove(event);
    else if(drag.added){editor.nodes.pop();editor.selected=editor.nodes.length-1;}
    else editor.nodes[drag.index]=drag.original;
    editor.drag=null;queue();
  }
  function open(item=null){
    if(!adapter?.canEdit()||editor)return;
    adapter.prepare();
    if(!adapter.canEdit())return;
    const factor=item?Math.min(1,520/item.w,280/item.h):1;
    const offsetX=item?(WIDTH-item.w*factor)/2:0,offsetY=item?(HEIGHT-item.h*factor)/2:0;
    editor={scope:adapter.context(),item,factor,offsetX,offsetY,selected:-1,drag:null,
      nodes:item?scaledNodes(item,offsetX,offsetY,item.w*factor,item.h*factor):[]};
    $('vectorDialogTitle').textContent=item?'Edit vector path':'Draw vector path';
    $('vectorApply').textContent=item?'Apply path':'Insert path';
    $('vectorColor').value=item?.color||adapter.color();
    $('vectorWidth').value=item?.size||adapter.size();
    $('vectorClosed').checked=Boolean(item?.closed);
    $('vectorFill').checked=Boolean(item?.fillColor);
    $('vectorFillColor').value=item?.fillColor||'#b9adff';
    $('vectorDialog').showModal();render();
  }
  function cancel(){
    editor=null;if(frame)cancelAnimationFrame(frame);frame=0;
    if($('vectorDialog')?.open)$('vectorDialog').close();
  }
  function submit(event){
    event.preventDefault();if(!editor||editor.drag||editor.nodes.length<2)return;
    const target=editor, {item,factor,offsetX,offsetY}=target;
    const nodes=target.nodes.map(n=>({x:(n.x-offsetX)/factor+(item?.x||0),y:(n.y-offsetY)/factor+(item?.y||0),
      inX:n.inX/factor,inY:n.inY/factor,outX:n.outX/factor,outY:n.outY/factor}));
    try{
      const path=fit({...style(),nodes});
      if(path.w>2200||path.h>2200)throw Error('The path is too large. Bring its points closer together.');
      cancel();
      if(!adapter.commit(target,path))adapter.notify('The page changed. Open the path editor again.');
    }catch(error){adapter.notify(error.message);}
  }
  function init(next){
    adapter=next;
    const hitCanvas=document.createElement('canvas');hitCanvas.width=hitCanvas.height=1;hitContext=hitCanvas.getContext('2d');
    const surface=$('vectorSurface'),dialog=$('vectorDialog');
    surface.addEventListener('pointerdown',pointerDown);
    surface.addEventListener('pointermove',pointerMove);
    for(const event of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(event,endPointer);
    $('vectorForm').onsubmit=submit;$('vectorForm').addEventListener('input',queue);
    $('vectorCancel').onclick=cancel;
    dialog.addEventListener('close',()=>{if(!dialog.open)cancel();});
    for(const [id,key,max] of [['vectorX','x',WIDTH],['vectorY','y',HEIGHT]]){
      $(id).onchange=()=>{
        const node=editor?.nodes[editor.selected],value=$(id).valueAsNumber;
        if(node&&Number.isFinite(value)){node[key]=clamp(value,0,max);$(id).value=number(node[key]);queue();}
      };
    }
    $('vectorRemove').onclick=()=>{
      editor.nodes.splice(editor.selected,1);editor.selected=Math.min(editor.selected,editor.nodes.length-1);queue();
    };
    $('vectorCorner').onclick=()=>{Object.assign(editor.nodes[editor.selected],zeroHandles);queue();};
    $('vectorSmooth').onclick=()=>{
      const {nodes,selected}=editor,closed=$('vectorClosed').checked;
      const before=nodes[selected-1]||(closed?nodes.at(-1):nodes[selected]);
      const after=nodes[selected+1]||(closed?nodes[0]:nodes[selected]);
      const dx=(after.x-before.x)/6,dy=(after.y-before.y)/6;
      Object.assign(nodes[selected],{inX:-dx,inY:-dy,outX:dx,outY:dy});queue();
    };
    $('editVector').onclick=()=>{const item=adapter.selected();if(item?.type==='vector')open(item);};
  }
  function syncSelection(item){
    $('vectorControls').hidden=item?.type!=='vector';
    $('exportVector').hidden=item?.type!=='vector';
  }
  const api=Object.freeze({validate,fit,pathData,draw,hit,svg,reframeMasks,init,open,cancel,syncSelection,isEditing:()=>Boolean(editor)});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.WindsVector=api;
})(typeof window!=='undefined'?window:globalThis);
