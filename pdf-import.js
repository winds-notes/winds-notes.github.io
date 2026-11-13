/* Local PDF import. Parsing/rasterization is confined to the modal import task. */
(function(global){
  'use strict';
  const MAX_FILE_BYTES=25*1024*1024,MAX_PAGES=50,MAX_RENDERED_BYTES=60*1024*1024;
  let api=null,current=null,library=null;
  const $=id=>document.getElementById(id);
  const cancelled=()=>Object.assign(Error('PDF import cancelled.'),{cancelled:true});
  function parsePages(value,total){
    if(!Number.isInteger(total)||total<1)throw Error('This PDF has no pages.');
    const pages=new Set(),parts=String(value).trim().split(',');
    if(!String(value).trim())throw Error('Enter the pages to import, for example 1-5, 8.');
    for(const part of parts){
      const match=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if(!match)throw Error('Use page numbers or ranges, for example 1-5, 8.');
      const first=Number(match[1]),last=Number(match[2]||match[1]);
      if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first<1||last<first||last>total)throw Error(`Choose pages between 1 and ${total}.`);
      for(let i=first;i<=last;i++){pages.add(i);if(pages.size>MAX_PAGES)throw Error(`Import up to ${MAX_PAGES} pages at a time.`);}
    }
    return [...pages].sort((a,b)=>a-b);
  }
  function pageLayout(width,height){
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid PDF page size.');
    const orientation=width>height?'landscape':'portrait';
    const target=orientation==='landscape'?{width:1188,height:840}:{width:840,height:1188};
    const scale=Math.min(target.width/width,target.height/height)*2;
    return {orientation,scale,width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
  }
  function check(session){if(current!==session||session.cancelled)throw cancelled();if(api.context().workspace!==session.context.workspace)throw Error('The account changed. Reopen the PDF in the intended account.');}
  function status(text,error=false){$('pdfImportStatus').textContent=text;$('pdfImportStatus').classList.toggle('error',error);}
  function ready(){
    if(!current?.pdf||current.running)return;
    try{const pages=parsePages($('pdfPageRange').value,current.pdf.numPages);$('pdfImportStart').textContent=`Import ${pages.length} page${pages.length===1?'':'s'}`;$('pdfImportStart').disabled=false;$('pdfRangeHint').textContent=`${pages.length} selected · up to ${MAX_PAGES} per import`;}
    catch(error){$('pdfImportStart').disabled=true;$('pdfRangeHint').textContent=error.message;}
  }
  async function engine(){
    if(!library)library=import('./vendor/pdfjs/pdf.min.mjs').catch(error=>{library=null;throw error;});
    return library;
  }
  function dispose(session){
    session.render?.cancel();
    try{Promise.resolve(session.loading?.destroy()).catch(()=>{});}catch{}
  }
  function close(){
    const session=current;if(!session||session.committing)return;
    session.cancelled=true;current=null;dispose(session);$('pdfImportBackdrop').hidden=true;
    $('pdfPassword').value='';
    if(session.trigger?.isConnected&&session.trigger.offsetParent!==null)session.trigger.focus();
  }
  async function preview(session){
    const page=await session.pdf.getPage(1);check(session);
    const base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(280/base.width,300/base.height)}),canvas=$('pdfImportPreview');
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    session.render=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,background:'#ffffff',annotationMode:session.lib.AnnotationMode.ENABLE});
    try{await session.render.promise;check(session);}finally{session.render=null;page.cleanup();}
    canvas.hidden=false;
  }
  async function open(file,{reference=false}={}){
    if(!file)return;
    if(file.size>MAX_FILE_BYTES){api.toast('PDF is too large · choose a file under 25 MB');return;}
    if(current)close();
    const session={context:api.context(),trigger:document.activeElement,cancelled:false,running:false,committing:false,file,reference};current=session;
    $('pdfImportBackdrop').hidden=false;$('pdfImportDialog').focus();$('pdfImportName').textContent=file.name;$('pdfImportPageCount').textContent='';$('pdfImportStart').textContent='Import pages';
    $('pdfImportPreview').hidden=true;$('pdfImportOptions').hidden=true;$('pdfImportOptions').disabled=false;$('pdfTitleControl').hidden=false;$('pdfPasswordForm').hidden=true;$('pdfImportStart').disabled=true;
    $('pdfImportCancel').disabled=false;$('pdfImportClose').disabled=false;$('pdfImportProgress').hidden=true;
    $('pdfImportTitle').value=file.name.replace(/\.pdf$/i,'').slice(0,70)||'PDF notebook';
    const append=$('pdfAppendOption');append.disabled=reference||!session.context.bookId;append.textContent=session.context.bookId?`Add to ${session.context.bookTitle}`:'Add to current notebook';$('pdfImportDestination').value='new';
    status('Opening PDF on this device…');
    try{
      await api.prepare();check(session);
      session.lib=await engine();check(session);
      const base=new URL('./vendor/pdfjs/',document.baseURI);session.lib.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.min.mjs',base).href;
      const data=new Uint8Array(await file.arrayBuffer());check(session);
      session.loading=session.lib.getDocument({data,isEvalSupported:false,enableScripting:false,enableXfa:false,stopAtErrors:true,
        cMapUrl:new URL('cmaps/',base).href,cMapPacked:true,standardFontDataUrl:new URL('standard_fonts/',base).href,
        wasmUrl:new URL('wasm/',base).href,iccUrl:new URL('iccs/',base).href,canvasMaxAreaInBytes:32*1024*1024});
      session.loading.onPassword=(unlock,reason)=>{
        if(current!==session||session.cancelled)return;
        session.unlock=unlock;$('pdfPasswordForm').hidden=false;status(reason===session.lib.PasswordResponses.INCORRECT_PASSWORD?'That password did not unlock this PDF. Try again.':'Enter this PDF’s password to open it.',reason===session.lib.PasswordResponses.INCORRECT_PASSWORD);$('pdfPassword').focus();
      };
      session.pdf=await session.loading.promise;check(session);$('pdfPasswordForm').hidden=true;$('pdfPassword').value='';
      $('pdfImportPageCount').textContent=`${session.pdf.numPages} page${session.pdf.numPages===1?'':'s'} · preview of page 1`;
      await preview(session);check(session);
      $('pdfPageRange').value=session.pdf.numPages===1?'1':`1-${Math.min(MAX_PAGES,session.pdf.numPages)}`;
      $('pdfImportOptions').hidden=false;status('Choose your pages, then import. The original PDF stays unchanged.');ready();
    }catch(error){if(current===session&&!session.cancelled){dispose(session);session.pdf=null;status(error?.message||'This PDF could not be opened.',true);}}
  }
  async function start(){
    const session=current;if(!session?.pdf||session.running)return;
    let selected;try{selected=parsePages($('pdfPageRange').value,session.pdf.numPages);}catch(error){status(error.message,true);return;}
    session.running=true;$('pdfImportStart').disabled=true;$('pdfImportOptions').disabled=true;$('pdfImportProgress').hidden=false;
    $('pdfImportProgress').max=selected.length;$('pdfImportProgress').value=0;
    const pages=[];let total=0;
    try{
      for(const number of selected){
        check(session);status(`Preparing PDF page ${number} · ${pages.length+1} of ${selected.length}…`);
        const page=await session.pdf.getPage(number);check(session);const base=page.getViewport({scale:1}),layout=pageLayout(base.width,base.height),viewport=page.getViewport({scale:layout.scale});
        const canvas=document.createElement('canvas');canvas.width=layout.width;canvas.height=layout.height;
        try{
          session.render=page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,background:'#ffffff',annotationMode:session.lib.AnnotationMode.ENABLE});
          await session.render.promise;check(session);
          const src=canvas.toDataURL('image/jpeg',.93),thumb=document.createElement('canvas');
          const scale=Math.min(240/canvas.width,340/canvas.height);thumb.width=Math.max(1,Math.round(canvas.width*scale));thumb.height=Math.max(1,Math.round(canvas.height*scale));
          thumb.getContext('2d',{alpha:false}).drawImage(canvas,0,0,thumb.width,thumb.height);const thumbnail=thumb.toDataURL('image/jpeg',.8);thumb.width=thumb.height=1;
          total+=src.length+thumbnail.length;if(total>MAX_RENDERED_BYTES)throw Error('These pages are too large together. Choose fewer pages and try again.');
          pages.push({orientation:layout.orientation,template:'blank',items:[],background:{type:'pdf',src,thumbnail,width:layout.width,height:layout.height,sourceName:session.file.name.slice(0,200),sourcePage:number}});
        }finally{session.render=null;canvas.width=canvas.height=1;page.cleanup();}
        $('pdfImportProgress').value=pages.length;await new Promise(resolve=>setTimeout(resolve,0));
      }
      check(session);session.committing=true;$('pdfImportCancel').disabled=true;$('pdfImportClose').disabled=true;status('Saving your annotation pages…');
      const result=await api.commit({pages,title:$('pdfImportTitle').value.trim()||'PDF notebook',append:!session.reference&&$('pdfImportDestination').value==='append',reference:session.reference},session.context);
      session.committing=false;close();
      if(session.reference&&result?.id)api.showReference?.(result.id,session.context);
      api.toast(result?.saved===false?'PDF pages opened · device storage could not save them. Export a backup.':
        session.reference?'PDF reference opened beside your notes':`Imported ${pages.length} PDF page${pages.length===1?'':'s'} · ready to annotate`);
    }catch(error){
      session.committing=false;
      if(current===session&&!session.cancelled){session.running=false;$('pdfImportOptions').disabled=false;$('pdfImportCancel').disabled=false;$('pdfImportClose').disabled=false;status(error.message||'PDF import failed. Existing notes are unchanged.',true);ready();}
    }
  }
  function init(adapter){
    api=adapter;$('pdfImportStart').onclick=start;$('pdfImportCancel').onclick=$('pdfImportClose').onclick=close;$('pdfPageRange').oninput=ready;
    $('pdfImportDestination').onchange=()=>{$('pdfTitleControl').hidden=$('pdfImportDestination').value==='append';};
    $('pdfPasswordForm').onsubmit=e=>{e.preventDefault();if(current?.unlock){const unlock=current.unlock;current.unlock=null;status('Unlocking PDF…');unlock($('pdfPassword').value);$('pdfPassword').value='';}};
    document.addEventListener('keydown',event=>{
      if(!current)return;
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key==='Tab'){
        const controls=[...$('pdfImportDialog').querySelectorAll('button,input,select')].filter(el=>!el.disabled&&el.offsetParent!==null),first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===$('pdfImportDialog'))){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    });
  }
  const exported=Object.freeze({init,open,isOpen:()=>current!==null,parsePages,pageLayout,MAX_FILE_BYTES,MAX_PAGES,MAX_RENDERED_BYTES});
  if(typeof module!=='undefined'&&module.exports)module.exports=exported;
  global.WindsPDFImport=exported;
})(typeof window!=='undefined'?window:globalThis);
