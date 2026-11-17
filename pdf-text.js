/* PDF word geometry, chapter destinations and local English OCR. */
(function(global){
  'use strict';
  const maxWords=12000,maxPassage=300;
  const clamp=n=>Math.max(0,Math.min(1,n));
  const round=n=>Math.round(n*100000)/100000;
  function turnPoint(x,y,turn){
    switch(turn){
      case 90:return [1-y,x];
      case 180:return [1-x,1-y];
      case 270:return [y,1-x];
      default:return [x,y];
    }
  }
  function wordNear(words,x,y,width,height){
    let index=null,nearest=14**2;
    for(let i=0;i<words.length;i++){
      const [,left,top,w,h]=words[i];
      const dx=Math.max(0,left-x,x-left-w)*width,dy=Math.max(0,top-y,y-top-h)*height;
      const distance=dx*dx+dy*dy;
      if(distance===0)return i;
      if(distance<nearest){nearest=distance;index=i;}
    }
    return index;
  }
  function passage(words,first,last){
    const from=Math.min(first,last),to=Math.max(first,last);
    const entries=words.slice(from,to+1);
    return {quote:entries.map(word=>word[0]).join(' '),regions:entries.map(word=>word.slice(1))};
  }
  function box(x,y,right,bottom){
    x=round(clamp(x));y=round(clamp(y));
    const w=round(clamp(right)-x),h=round(clamp(bottom)-y);
    return w>0&&h>0?[x,y,w,h]:null;
  }
  async function readWords(page,viewport){
    if(typeof page.getTextContent!=='function'||typeof viewport.convertToViewportPoint!=='function')return [];
    const {items,styles={}}=await page.getTextContent(),words=[];
    const measure=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
    for(const item of items){
      const {str,transform:t,width,height,dir,fontName}=item;
      if(!str?.trim()||!t||!width||!height)continue;
      const advance=Math.hypot(t[0],t[1])||1,rise=Math.hypot(t[2],t[3])||1;
      const ascent=styles[fontName]?.ascent??.8;
      const ux=t[0]/advance*width,uy=t[1]/advance*width;
      const vx=t[2]/rise*height,vy=t[3]/rise*height;
      if(measure)measure.font=`100px ${styles[fontName]?.fontFamily||'sans-serif'}`;
      const measureWidth=value=>measure?.measureText(value).width??value.length;
      const total=measureWidth(str)||str.length;
      let widthSoFar=0,previousEnd=0;
      for(const match of str.matchAll(/\S+/gu)){
        widthSoFar+=measureWidth(str.slice(previousEnd,match.index));
        let start=widthSoFar/total;
        widthSoFar+=measureWidth(match[0]);
        let end=widthSoFar/total;
        previousEnd=match.index+match[0].length;
        if(dir==='rtl')[start,end]=[1-end,1-start];
        const points=[];
        for(const offset of [start,end])for(const vertical of [ascent-1,ascent]){
          points.push(viewport.convertToViewportPoint(t[4]+ux*offset+vx*vertical,t[5]+uy*offset+vy*vertical));
        }
        const xs=points.map(p=>p[0]/viewport.width),ys=points.map(p=>p[1]/viewport.height);
        const bounds=box(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys));
        if(bounds)words.push([match[0].slice(0,256),...bounds]);
        if(words.length===maxWords)return words;
      }
    }
    return words;
  }
  async function readChapters(pdf,selected,valid){
    const chapters=new Map();
    if(typeof pdf.getOutline!=='function')return chapters;
    let count=0;
    async function visit(items,depth){
      if(depth>12)return;
      for(const entry of items||[]){
        if(!valid()||++count>500)return;
        if(entry.dest&&entry.title)try{
          const dest=typeof entry.dest==='string'?await pdf.getDestination(entry.dest):entry.dest;
          const ref=dest?.[0];
          const number=Number.isInteger(ref)?ref+1:ref&&1+await pdf.getPageIndex(ref);
          if(selected.includes(number)){
            const labels=chapters.get(number)||[];
            if(labels.length<24)labels.push(entry.title.slice(0,200));
            chapters.set(number,labels);
          }
        }catch{/* Invalid outline entry. */}
        if(entry.items?.length)await visit(entry.items,depth+1);
      }
    }
    await visit(await pdf.getOutline(),0);
    return chapters;
  }
  function find(words,query){
    const key=query.trim().toLowerCase().replace(/\s+/g,' ');
    if(!key)return [];
    const tokens=words.map(word=>word[0].toLowerCase()),content=tokens.join(' '),hits=[];
    let index=0,position=0;
    for(let hit=content.indexOf(key);hit>=0;hit=content.indexOf(key,hit+key.length)){
      while(index<tokens.length-1&&position+tokens[index].length<=hit){position+=tokens[index].length+1;index++;}
      let end=index,offset=position;
      while(end<tokens.length-1&&offset+tokens[end].length<hit+key.length){offset+=tokens[end].length+1;end++;}
      hits.push(words.slice(index,end+1).map(word=>word.slice(1)));
      if(hits.length===500)return hits;
    }
    return hits;
  }
  let engine,worker,workerTimer,queue=Promise.resolve(),base;
  function createWorker(){
    // Language and initialization failures are reported through errorHandler.
    return new Promise((resolve,reject)=>{
      const fail=()=>reject(Error('Could not start English OCR. Make sure the OCR assets are available.'));
      global.Tesseract.createWorker('eng',1,{
        workerPath:new URL('worker.min.js',base).href,corePath:new URL('tesseract-core-lstm.wasm.js',base).href,
        langPath:base.href,workerBlobURL:false,cacheMethod:'none',errorHandler:fail
      }).then(resolve,fail);
    });
  }
  async function recognize({src,width,height},progress,valid){
    if(!valid())return [];
    clearTimeout(workerTimer);
    try{
      base??=new URL('./vendor/ocr/',document.baseURI);
      engine??=new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src=new URL('tesseract.min.js',base);
        script.onload=resolve;
        script.onerror=()=>{engine=null;script.remove();reject(Error('Could not load the OCR engine.'));};
        document.head.append(script);
      });
      await engine;
      if(!valid())return [];
      worker??=await createWorker();
      if(!valid())return [];
      progress();
      // The renderer already produced an embedded data URL. Reading it as bytes
      // avoids turning a decoded canvas or image back into base64 on the UI thread.
      const bytes=new Uint8Array(await fetch(src).then(response=>response.arrayBuffer()));
      if(!valid())return [];
      const {data}=await worker.recognize(bytes,{}, {blocks:true});
      const words=[];
      for(const block of data.blocks||[])for(const paragraph of block.paragraphs)for(const line of paragraph.lines)for(const word of line.words){
        const {x0,y0,x1,y1}=word.bbox,text=word.text.trim();
        const bounds=box(x0/width,y0/height,x1/width,y1/height);
        if(bounds&&text)words.push([text.slice(0,256),...bounds]);
        if(words.length===maxWords)return words;
      }
      return words;
    }finally{
      workerTimer=setTimeout(()=>{const idle=worker;worker=null;idle?.terminate().catch(()=>{});},60000);
    }
  }
  function ocr(background,progress,valid){
    const task=queue.then(()=>recognize(background,progress,valid));
    queue=task.catch(()=>{});
    return task;
  }
  global.WindsPdfText=Object.freeze({readWords,readChapters,maxPassage,find,ocr,turnPoint,wordNear,passage});
})(globalThis);
