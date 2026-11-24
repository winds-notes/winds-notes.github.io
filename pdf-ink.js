/* Annotation input for the PDF study pane. Durable edits run after input idle. */
(function(global){
  'use strict';
  const $=id=>document.getElementById(id);
  let api,reader,gesture=null,frame=0,timer=0,lastInput=0,processing=false,focused=false;
  const touches=new Map(),pending=[];
  let pinch=null,pan=null,wheelDistance=0,pageChangedAt=0,wheelTimer=0,wheelLast=0;
  let scrollFrame=0,momentum=null,focusFrame=0;
  let protectedRaster=null,protectedPage=null;
  const source=()=>reader.current();
  const current=()=>{
    const session=source(),page=session?.pages[session.index];
    return session&&page?api.target(session.account,session.book,page.id):null;
  };
  const dimensions=target=>api.dimensions?api.dimensions(target):target.page.background;
  function point(event,target,rect=gesture?.rect||$('studyPdfInk').getBoundingClientRect()){
    const geometry=dimensions(target),turn=geometry.turn||0;
    const [x,y]=global.WindsPdfText.turnPoint((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height,(360-turn)%360);
    return [Math.max(0,Math.min(1,x))*geometry.width/2,
      Math.max(0,Math.min(1,y))*geometry.height/2,event.pressure>0?event.pressure:.5];
  }
  function context(id,target){
    const canvas=$(id),bg=dimensions(target);
    if(canvas.width!==bg.width)canvas.width=bg.width;
    if(canvas.height!==bg.height)canvas.height=bg.height;
    const ctx=canvas.getContext('2d');
    ctx.setTransform(2,0,0,2,0,0);
    return ctx;
  }
  function clear(id){const canvas=$(id);canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
  function buttons(){
    const target=current();
    $('studyPdfInk').hidden=!target;
    $('studyPdfInk').style.pointerEvents=source()?.picking?'none':'auto';
    $('studyPdfInk').style.cursor=api.settings().tool==='pan'?'grab':'crosshair';
    api.historyChanged();
  }
  function focusNotes(){focused=false;queueFocus();}
  function queueFocus(){if(!focusFrame)focusFrame=requestAnimationFrame(()=>{focusFrame=0;api.historyChanged();});}
  function historyState(){
    if(!focused||!current())return null;
    return pending.length||gesture||processing?{undo:[],redo:[]}:api.history(current())||{undo:[],redo:[]};
  }
  function historyAction(kind){
    const target=current();if(!focused||!target)return false;
    if(!pending.length&&!gesture&&!processing){api.pending(1);pending.push({kind,target});schedule();queueFocus();}
    return true;
  }
  function toolChanged(){if(!api)return;finish();stopScroll();reader.clearTools();buttons();}
  function paint(){
    frame=0;
    const target=current();if(!target||api.busy())return;
    const base=context('studyPdfAnnotations',target);
    const geometry=dimensions(target);base.clearRect(0,0,geometry.width/2,geometry.height/2);
    api.paint(base,target.page.items,target.page);
    for(const job of pending)if(job.target.page===target.page&&job.item)api.paint(base,[job.item],target.page);
    const protectedItems=api.protectedItems?.(target.page)||[];protectedPage=null;
    if(protectedItems.length){
      protectedRaster=protectedRaster||document.createElement('canvas');protectedRaster.width=geometry.width;protectedRaster.height=geometry.height;
      const protectedContext=protectedRaster.getContext('2d');if(protectedContext){protectedContext.setTransform(2,0,0,2,0,0);api.paint(protectedContext,protectedItems,target.page);protectedPage=target.page;}
    }else if(protectedRaster)protectedRaster.width=protectedRaster.height=1;
    context('studyPdfInk',target);
    clear('studyPdfInk');
    if(gesture?.target.page===target.page)gesture.painted=0;
    paintDraft();buttons();
  }
  function refresh(){
    if(!frame)frame=requestAnimationFrame(()=>{
      frame=0;
      if(gesture||api.busy()){schedule();return;}
      paint();
    });
  }
  function paintDraft(){
    frame=0;
    const draft=gesture;if(!draft)return;
    const target=current();if(target?.page!==draft.target.page)return;
    const ctx=context(draft.kind==='erase'?'studyPdfAnnotations':'studyPdfInk',target);
    if(draft.kind==='erase'){
      ctx.save();ctx.globalCompositeOperation='destination-out';
      ctx.lineWidth=draft.radius*2;ctx.lineCap=ctx.lineJoin='round';
      const points=draft.points;
      ctx.beginPath();
      for(let i=draft.painted;i<points.length;i++){
        const p=points[Math.max(0,i-1)],q=points[i];
        ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);
      }
      ctx.stroke();ctx.restore();
      if(protectedPage===target.page){
        ctx.save();ctx.beginPath();const r=draft.radius;
        for(let i=draft.painted;i<points.length;i++){
          const a=points[Math.max(0,i-1)],b=points[i],angle=Math.atan2(b[1]-a[1],b[0]-a[0]),nx=-Math.sin(angle)*r,ny=Math.cos(angle)*r;
          ctx.moveTo(a[0]+nx,a[1]+ny);ctx.lineTo(b[0]+nx,b[1]+ny);ctx.arc(b[0],b[1],r,angle+Math.PI/2,angle-Math.PI/2,true);ctx.lineTo(a[0]-nx,a[1]-ny);ctx.arc(a[0],a[1],r,angle-Math.PI/2,angle+Math.PI/2,true);ctx.closePath();
        }
        ctx.clip();ctx.drawImage(protectedRaster,0,0,dimensions(target).width/2,dimensions(target).height/2);ctx.restore();
      }
      draft.painted=points.length;
    }else{
      api.paintDraft(ctx,draft.item,draft.painted);
      draft.painted=draft.item.points?.length||0;
    }
  }
  function queueFrame(){if(!frame)frame=requestAnimationFrame(paintDraft);}
  function schedule(){clearTimeout(timer);timer=setTimeout(flush,150);}
  async function flush(){
    if(processing)return;
    if(gesture||touches.size||api.busy()||Date.now()-lastInput<150){schedule();return;}
    processing=true;
    try{
      while(pending.length){
        if(gesture||api.busy())break;
        const job=pending[0];
        try{await api.commit(job,()=>!gesture&&!touches.size&&Date.now()-lastInput>=150);}
        catch(error){api.toast(error.message||'The reference page edit could not be applied.');}
        finally{pending.shift();api.pending(-1);}
      }
    }finally{processing=false;refresh();if(pending.length)schedule();}
  }
  function finish(cancel=false){
    if(!gesture)return;
    const draft=gesture;
    gesture=null;
    if(cancel){api.pending(-1);refresh();return;}
    pending.push(draft);schedule();refresh();
  }
  function nextPage(direction){
    const session=source();if(!session||gesture||Date.now()-pageChangedAt<350)return;
    const index=session.index+direction;
    if(index<0||index>=session.pages.length)return;
    pageChangedAt=Date.now();wheelDistance=0;reader.setPage(index);
    if(direction<0)$('studyPdfScroll').scrollTop=$('studyPdfScroll').scrollHeight;
  }
  function stopScroll(){
    if(scrollFrame)cancelAnimationFrame(scrollFrame);
    scrollFrame=0;momentum=null;
  }
  function scrollTick(now){
    scrollFrame=0;
    const scroll=$('studyPdfScroll');
    if(pinch?.next!=null){reader.zoom(pinch.next);pinch.next=null;}
    if(pan){
      const dx=pan.dx,dy=pan.dy;pan.dx=pan.dy=0;
      const top=scroll.scrollTop;
      scroll.scrollLeft+=dx;scroll.scrollTop+=dy;
      pan.overflow=Math.abs(scroll.scrollTop-top)<.5?pan.overflow+dy:0;
    }else if(momentum){
      const elapsed=Math.min(32,Math.max(0,now-momentum.time));momentum.time=now;
      const left=scroll.scrollLeft,top=scroll.scrollTop;
      scroll.scrollLeft+=momentum.vx*elapsed;scroll.scrollTop+=momentum.vy*elapsed;
      if(Math.abs(scroll.scrollLeft-left)<.5)momentum.vx=0;
      if(Math.abs(scroll.scrollTop-top)<.5)momentum.vy=0;
      const decay=Math.exp(-elapsed/240);momentum.vx*=decay;momentum.vy*=decay;
      if(Math.abs(momentum.vx)+Math.abs(momentum.vy)<.025)momentum=null;
      else queueScroll();
    }
  }
  function queueScroll(){if(!scrollFrame)scrollFrame=requestAnimationFrame(scrollTick);}
  function startPan(event){
    stopScroll();
    touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
    pan={x:event.clientX,y:event.clientY,pointerType:event.pointerType,dx:0,dy:0,vx:0,vy:0,time:performance.now(),overflow:0};
    if(touches.size===2){const [a,b]=[...touches.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:source().zoom};}
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch{}
  }
  function down(event,recovered=false){
    if((event.button!==0&&!recovered)||!current())return;
    const settings=api.settings(),mode=settings.tool;
    if(event.pointerType==='touch'){
      if(gesture?.pointerType==='pen'||Date.now()-lastInput<180)return;
      if(settings.penOnly||mode==='pan'||touches.size){
        if(gesture?.pointerType==='touch')finish(true);
        startPan(event);return;
      }
    }
    if(api.busy())return;
    if(gesture){if(gesture.pointerType==='pen'&&event.pointerType==='pen')finish();else return;}
    stopScroll();focused=true;queueFocus();
    event.preventDefault();try{event.currentTarget.setPointerCapture(event.pointerId);}catch{}
    if(mode==='pan'){startPan(event);return;}
    const target=current(),rect=$('studyPdfInk').getBoundingClientRect(),first=point(event,target,rect);
    if(mode!=='eraser'&&api.canDraw?.(target)===false){api.toast('The drawing layer is hidden or locked. Open this page to choose another layer.');return;}
    const item=mode==='eraser'?null:api.createItem(first,target);
    if(mode!=='eraser'&&!item){api.toast('Use ↗ to open this page in the main editor for selection, text or fill.');return;}
    gesture={id:event.pointerId,pointerType:event.pointerType,target,rect,painted:0,start:first,
      ...(mode==='eraser'?{kind:'erase',radius:settings.eraserSize/2,inkOnly:settings.inkOnly,points:[first],originals:target.page.items,count:target.page.items.length+pending.length}:
        {kind:'append',item})};
    api.pending(1);lastInput=Date.now();api.touch();queueFrame();
  }
  function move(event){
    if(touches.has(event.pointerId)){
      touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pinch&&touches.size===2){
        const [a,b]=[...touches.values()];pinch.next=pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance);
      }else if(pan){
        const dx=pan.x-event.clientX,dy=pan.y-event.clientY,now=performance.now(),elapsed=Math.max(8,now-pan.time);
        pan.dx+=dx;pan.dy+=dy;
        pan.vx=.35*pan.vx+.65*dx/elapsed;pan.vy=.35*pan.vy+.65*dy/elapsed;pan.time=now;
        pan.x=event.clientX;pan.y=event.clientY;
      }
      queueScroll();
      return;
    }
    if(!gesture&&event.pointerType==='pen'&&event.buttons){down(event,true);}
    if(gesture?.id!==event.pointerId)return;
    if(gesture.item?.type==='shape'){
      const p=point(event,gesture.target);api.resizeShape(gesture.item,p[0]-gesture.start[0],p[1]-gesture.start[1]);
      lastInput=Date.now();api.touch();queueFrame();return;
    }
    const points=gesture.item?.points||gesture.points;
    const samples=event.getCoalescedEvents?.();
    for(const sample of samples?.length?samples:[event])points.push(point(sample,gesture.target));
    lastInput=Date.now();api.touch();queueFrame();
  }
  function up(event,cancel=false){
    if(touches.has(event.pointerId)){
      const wasPinching=Boolean(pinch);
      if(scrollFrame){cancelAnimationFrame(scrollFrame);scrollTick(performance.now());}
      const released=pan,overflow=pan?.overflow||0;
      touches.delete(event.pointerId);pinch=null;pan=null;
      if(touches.size){const contact=[...touches.values()][0];pan={...released,x:contact.x,y:contact.y,dx:0,dy:0,vx:0,vy:0,overflow:0};}
      else if(!cancel&&Math.abs(overflow)>70&&!wasPinching)nextPage(Math.sign(overflow));
      else if(!cancel&&!wasPinching&&released?.pointerType==='touch'&&performance.now()-released.time<100&&!(global.matchMedia?.('(prefers-reduced-motion: reduce)').matches)){
        momentum={vx:Math.max(-3,Math.min(3,released.vx)),vy:Math.max(-3,Math.min(3,released.vy)),time:performance.now()};queueScroll();
      }
    }
    if(gesture?.id===event.pointerId)finish(cancel&&gesture.pointerType!=='pen');
  }
  function setPage(){
    finish();stopScroll();clearTimeout(wheelTimer);wheelDistance=0;touches.clear();pan=pinch=null;
    protectedPage=null;if(protectedRaster)protectedRaster.width=protectedRaster.height=1;
    clear('studyPdfInk');clear('studyPdfAnnotations');refresh();
  }
  function close(){setPage();focusNotes();$('studyPdfAnnotations').width=$('studyPdfAnnotations').height=1;$('studyPdfInk').width=$('studyPdfInk').height=1;}
  function init(adapter,reference){
    api=adapter;reader=reference;
    const canvas=$('studyPdfInk');
    for(const type of ['touchstart','touchmove','touchend','touchcancel'])canvas.addEventListener(type,event=>{
      if(event.cancelable&&(!source()?.picking))event.preventDefault();
    },{passive:false});
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);
    canvas.addEventListener('pointerup',event=>up(event));
    canvas.addEventListener('pointercancel',event=>up(event,true));
    canvas.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId)finish(gesture.pointerType!=='pen');});
    $('pageShell').addEventListener('pointerdown',focusNotes,{capture:true,passive:true});
    $('studyPdfScroll').addEventListener('wheel',event=>{
      if(event.ctrlKey||gesture||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
      stopScroll();
      const scroll=$('studyPdfScroll'),edge=event.deltaY>0?scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-2:scroll.scrollTop<=1;
      if(Date.now()-wheelLast>180)wheelDistance=0;
      wheelLast=Date.now();
      wheelDistance=edge?wheelDistance+event.deltaY:0;
      clearTimeout(wheelTimer);
      wheelTimer=setTimeout(()=>{if(Math.abs(wheelDistance)>90)nextPage(Math.sign(wheelDistance));wheelDistance=0;},180);
    },{passive:true});
    global.addEventListener('blur',()=>{finish();stopScroll();touches.clear();pan=pinch=null;});
  }
  global.WindsPdfInk=Object.freeze({init,setPage,refresh,close,toolChanged,historyState,historyAction,focusNotes});
})(window);
