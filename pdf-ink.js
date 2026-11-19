/* Annotation input for the PDF study pane. Durable edits run after input idle. */
(function(global){
  'use strict';
  const $=id=>document.getElementById(id);
  let api,reader,gesture=null,mode='pen',frame=0,timer=0,lastInput=0,processing=false;
  const touches=new Map(),pending=[];
  let pinch=null,pan=null,wheelDistance=0,pageChangedAt=0;
  const source=()=>reader.current();
  const current=()=>{
    const session=source(),page=session?.pages[session.index];
    return session&&page?api.target(session.account,session.book,page.id):null;
  };
  function point(event,target){
    const rect=$('studyPdfInk').getBoundingClientRect(),turn=target.page.background.turn||0;
    const [x,y]=global.WindsPdfText.turnPoint((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height,(360-turn)%360);
    return [Math.max(0,Math.min(1,x))*target.page.background.width/2,
      Math.max(0,Math.min(1,y))*target.page.background.height/2,event.pressure>0?event.pressure:.5];
  }
  function context(id,target){
    const canvas=$(id),bg=target.page.background;
    if(canvas.width!==bg.width)canvas.width=bg.width;
    if(canvas.height!==bg.height)canvas.height=bg.height;
    const ctx=canvas.getContext('2d');
    ctx.setTransform(2,0,0,2,0,0);
    return ctx;
  }
  function clear(id){const canvas=$(id);canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
  function buttons(){
    for(const button of document.querySelectorAll('[data-pdf-ink]'))button.setAttribute('aria-pressed',String(button.dataset.pdfInk===mode));
    const target=current(),history=target&&api.history(target);
    $('pdfInkUndo').disabled=!history?.undo.length||processing||pending.length>0;
    $('pdfInkRedo').disabled=!history?.redo.length||processing||pending.length>0;
    $('studyPdfInk').hidden=!target;
    $('studyPdfInk').style.pointerEvents=source()?.picking?'none':'auto';
  }
  function paint(){
    frame=0;
    const target=current();if(!target||api.busy())return;
    const base=context('studyPdfAnnotations',target);
    base.clearRect(0,0,target.page.background.width/2,target.page.background.height/2);
    api.paint(base,target.page.items);
    for(const job of pending)if(job.target.page===target.page&&job.item)api.paint(base,[job.item]);
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
      ctx.stroke();ctx.restore();draft.painted=points.length;
    }else{
      api.paintDraft(ctx,draft.item,draft.painted);
      draft.painted=draft.item.points.length;
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
        catch(error){api.toast(error.message||'PDF annotation could not be applied.');}
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
  function down(event,recovered=false){
    if((event.button!==0&&!recovered)||!current())return;
    if(event.pointerType==='touch'){
      if(gesture?.pointerType==='pen'||Date.now()-lastInput<700)return;
      if(api.settings().penOnly||mode==='pan'||touches.size){
        if(gesture?.pointerType==='touch')finish(true);
        touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
        pan={x:event.clientX,y:event.clientY,overflow:0};
        if(touches.size===2){const [a,b]=[...touches.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:source().zoom};}
        event.currentTarget.setPointerCapture(event.pointerId);return;
      }
    }
    if(api.busy())return;
    if(gesture){if(gesture.pointerType==='pen'&&event.pointerType==='pen')finish();else return;}
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
    const target=current(),settings=api.settings(),first=point(event,target);
    if(mode==='pan'){pan={x:event.clientX,y:event.clientY,overflow:0};touches.set(event.pointerId,{x:event.clientX,y:event.clientY});return;}
    gesture={id:event.pointerId,pointerType:event.pointerType,target,painted:0,
      ...(mode==='eraser'?{kind:'erase',radius:settings.eraserSize/2,points:[first],originals:target.page.items,count:target.page.items.length+pending.length}:
        {kind:'append',item:{id:api.id(),type:'stroke',tool:mode,color:settings.color,size:settings.size,points:[first]}})};
    api.pending(1);lastInput=Date.now();api.touch();queueFrame();
  }
  function move(event){
    if(touches.has(event.pointerId)){
      touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pinch&&touches.size===2){
        const [a,b]=[...touches.values()];reader.zoom(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance));
      }else if(pan){
        const scroll=$('studyPdfScroll'),dy=pan.y-event.clientY;
        const atEdge=dy>0?scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-2:scroll.scrollTop<=1;
        pan.overflow=atEdge?pan.overflow+dy:0;
        scroll.scrollLeft+=pan.x-event.clientX;scroll.scrollTop+=dy;
        pan.x=event.clientX;pan.y=event.clientY;
      }
      return;
    }
    if(!gesture&&event.pointerType==='pen'&&event.buttons){down(event,true);}
    if(gesture?.id!==event.pointerId)return;
    const points=gesture.item?.points||gesture.points;
    const samples=event.getCoalescedEvents?.();
    for(const sample of samples?.length?samples:[event])points.push(point(sample,gesture.target));
    lastInput=Date.now();api.touch();queueFrame();
  }
  function up(event,cancel=false){
    if(touches.has(event.pointerId)){
      const overflow=pan?.overflow||0;
      touches.delete(event.pointerId);pinch=null;pan=null;
      if(!cancel&&!touches.size&&Math.abs(overflow)>70)nextPage(Math.sign(overflow));
    }
    if(gesture?.id===event.pointerId)finish(cancel&&gesture.pointerType!=='pen');
  }
  function setPage(){
    finish();touches.clear();pan=pinch=null;
    clear('studyPdfInk');clear('studyPdfAnnotations');refresh();
  }
  function close(){setPage();$('studyPdfAnnotations').width=$('studyPdfAnnotations').height=1;$('studyPdfInk').width=$('studyPdfInk').height=1;}
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
    for(const button of document.querySelectorAll('[data-pdf-ink]'))button.onclick=()=>{
      finish();mode=button.dataset.pdfInk;reader.clearTools();buttons();
    };
    for(const [id,kind] of [['pdfInkUndo','undo'],['pdfInkRedo','redo']])$(id).onclick=()=>{
      const target=current();if(!target||pending.length||gesture||processing)return;
      api.pending(1);pending.push({kind,target});schedule();
    };
    $('studyPdfScroll').addEventListener('wheel',event=>{
      if(event.ctrlKey||gesture||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
      const scroll=$('studyPdfScroll'),edge=event.deltaY>0?scroll.scrollTop+scroll.clientHeight>=scroll.scrollHeight-2:scroll.scrollTop<=1;
      wheelDistance=edge?wheelDistance+event.deltaY:0;
      if(Math.abs(wheelDistance)>90)nextPage(Math.sign(wheelDistance));
    },{passive:true});
    global.addEventListener('blur',()=>{finish();touches.clear();pan=pinch=null;});
  }
  global.WindsPdfInk=Object.freeze({init,setPage,refresh,close});
})(window);
