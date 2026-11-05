/* Text layout, formatting and explicit editing, separate from Pencil input. */
(function(global){
  'use strict';
  const FONTS=Object.freeze([
    {name:'Arial',stack:'Arial, Helvetica, sans-serif'},
    {name:'Georgia',stack:'Georgia, "Times New Roman", serif'},
    {name:'Times New Roman',stack:'"Times New Roman", Times, serif'},
    {name:'Verdana',stack:'Verdana, Geneva, sans-serif'},
    {name:'Trebuchet MS',stack:'"Trebuchet MS", Arial, sans-serif'},
    {name:'Courier New',stack:'"Courier New", Courier, monospace'},
    {name:'Palatino',stack:'Palatino, "Palatino Linotype", Georgia, serif'},
    {name:'Chalkboard SE',stack:'"Chalkboard SE", "Comic Sans MS", cursive'},
    {name:'system-ui',stack:'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'}
  ]);
  const finite=(value,fallback)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
  function style(item={}){return {fontFamily:FONTS.some(f=>f.name===item.fontFamily)?item.fontFamily:'Arial',size:Math.max(1,Math.min(300,finite(item.size,20))),bold:item.bold===true,italic:item.italic===true,underline:item.underline===true,align:['left','center','right'].includes(item.align)?item.align:'left',lineHeight:Math.max(.8,Math.min(3,finite(item.lineHeight,1.42)))};}
  const stack=item=>FONTS.find(f=>f.name===style(item).fontFamily).stack;
  function font(item){const s=style(item);return `${s.italic?'italic ':''}${s.bold?'bold ':''}${s.size}px ${stack(s)}`;}
  function wrap(ctx,text,maxWidth){
    const lines=[];
    for(const para of String(text||'').split('\n')){
      if(!para){lines.push('');continue;}let line='';
      for(const word of para.split(/\s+/)){
        if(ctx.measureText(word).width>maxWidth&&maxWidth>0){
          if(line){lines.push(line);line='';}
          const chars=typeof Intl!=='undefined'&&Intl.Segmenter?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(word)].map(part=>part.segment):Array.from(word);let start=0;
          while(start<chars.length){let low=start+1,high=chars.length,best=low;while(low<=high){const middle=Math.floor((low+high)/2);if(ctx.measureText(chars.slice(start,middle).join('')).width<=maxWidth){best=middle;low=middle+1;}else high=middle-1;}const part=chars.slice(start,best).join('');start=best;if(start<chars.length)lines.push(part);else line=part;}
        }else{const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word;}else line=next;}
      }lines.push(line);
    }return lines;
  }
  function layout(ctx,item){const s=style(item);ctx.font=font(s);const lines=wrap(ctx,item.text,item.w||480);return {lines,h:Math.max(Math.max(1,lines.length)*s.size*s.lineHeight,(lines.length-1)*s.size*s.lineHeight+s.size*(s.underline?1.12:1.05)),style:s};}
  function draw(ctx,item){
    const {lines,style:s}=layout(ctx,item);ctx.fillStyle=item.color||'#2b2d4c';ctx.textBaseline='top';ctx.textAlign='left';
    lines.forEach((line,index)=>{
      const width=ctx.measureText(line).width,space=Math.max(0,(item.w||480)-width),x=item.x+(s.align==='center'?space/2:s.align==='right'?space:0),y=item.y+index*s.size*s.lineHeight;
      ctx.fillText(line,x,y);
      if(s.underline&&line){ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=Math.max(1,s.size/18);ctx.beginPath();ctx.moveTo(x,y+s.size*1.08);ctx.lineTo(x+width,y+s.size*1.08);ctx.stroke();}
    });
  }
  let api=null,current=null;
  const $=id=>document.getElementById(id);
  function close(){const before=current;current=null;$('textEditBackdrop').hidden=true;$('textEditContent').value='';if(before?.trigger?.isConnected&&before.trigger.offsetParent!==null)before.trigger.focus();}
  function colorInput(value){if(/^#[a-f\d]{3}$/i.test(value))return '#'+[...value.slice(1)].map(c=>c+c).join('');return /^#[a-f\d]{6,8}$/i.test(value)?value.slice(0,7):'#2b2d4c';}
  function draft(){
    const item=current.item;return {...item,text:$('textEditContent').value,fontFamily:$('textEditFont').value,size:Number($('textEditSize').value),color:current.colorChanged?$('textEditColor').value:item.color,
      bold:$('textEditBold').getAttribute('aria-pressed')==='true',italic:$('textEditItalic').getAttribute('aria-pressed')==='true',underline:$('textEditUnderline').getAttribute('aria-pressed')==='true',align:$('textEditAlign').value,lineHeight:Number($('textEditSpacing').value),w:Number($('textEditWidth').value)};
  }
  function preview(){if(!current)return;const item=draft(),s=style(item),editor=$('textEditContent');editor.style.fontFamily=stack(s);editor.style.fontSize=s.size+'px';editor.style.fontWeight=s.bold?'700':'400';editor.style.fontStyle=s.italic?'italic':'normal';editor.style.textDecoration=s.underline?'underline':'none';editor.style.color=item.color;editor.style.textAlign=s.align;editor.style.lineHeight=String(s.lineHeight);}
  function open(item,scope){
    if(item?.type!=='text')return;close();const s=style(item);current={item:{...item},scope,trigger:document.activeElement,colorChanged:false};
    $('textEditFont').value=s.fontFamily;$('textEditSize').value=s.size;$('textEditColor').value=colorInput(item.color);$('textEditWidth').value=item.w||480;$('textEditAlign').value=s.align;$('textEditSpacing').value=s.lineHeight;
    for(const [id,key] of [['textEditBold','bold'],['textEditItalic','italic'],['textEditUnderline','underline']])$(id).setAttribute('aria-pressed',String(s[key]));
    $('textEditContent').value=item.text;$('textEditStatus').textContent='';$('textEditBackdrop').hidden=false;preview();$('textEditContent').focus();
  }
  function apply(){
    if(!current)return;const entry=current,item=draft();
    if(!Number.isFinite(item.size)||item.size<1||item.size>300||!Number.isFinite(item.w)||item.w<1||item.w>2200||!Number.isFinite(item.lineHeight)||item.lineHeight<.8||item.lineHeight>3){$('textEditStatus').textContent='Choose a size from 1–300, width from 1–2200 and line spacing from 0.8–3.';return;}
    try{api.apply(item,entry.scope);close();}catch(error){$('textEditStatus').textContent=error.message||'The text could not be updated.';}
  }
  function init(adapter){
    api=adapter;$('textEditFont').replaceChildren(...FONTS.map(f=>{const option=document.createElement('option');option.value=f.name;option.textContent=f.name==='system-ui'?'System':f.name;return option;}));
    $('textEditClose').onclick=$('textEditCancel').onclick=close;$('textEditForm').onsubmit=event=>{event.preventDefault();apply();};
    for(const id of ['textEditFont','textEditSize','textEditWidth','textEditAlign','textEditSpacing'])$(id).oninput=preview;
    $('textEditColor').oninput=()=>{if(current)current.colorChanged=true;preview();};
    for(const id of ['textEditBold','textEditItalic','textEditUnderline'])$(id).onclick=()=>{$(id).setAttribute('aria-pressed',String($(id).getAttribute('aria-pressed')!=='true'));preview();};
    $('textEditBackdrop').onkeydown=event=>{
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();apply();return;}
      if(event.key==='Tab'){const controls=[...$('textEditDialog').querySelectorAll('button,input,textarea,select')].filter(el=>!el.disabled),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    };
  }
  const exported=Object.freeze({FONTS,style,stack,font,wrap,layout,draw,init,open,close,isOpen:()=>current!==null});
  if(typeof module!=='undefined'&&module.exports)module.exports=exported;global.WindsText=exported;
})(typeof window!=='undefined'?window:globalThis);
