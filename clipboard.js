/* Explicit clipboard actions; never runs in the Pencil event pipeline. */
(function(global){
  'use strict';
  const MIME='application/x-winds-notes-object+json',WEB_MIME='web '+MIME,MAX_BYTES=10*1024*1024,MAX_TEXT=100000;
  let api=null,memory=null,pasteScope=null,running=false,epoch=0,pasteTrigger=null;
  const $=id=>document.getElementById(id);
  function decode(text){
    if(typeof text!=='string'||text.length>MAX_BYTES)throw Error('Copied selection exceeds 10 MB.');
    const data=JSON.parse(text);
    if(data?.format!=='winds-notes-clipboard'||data.version!==1||!Array.isArray(data.items)||data.items.length<1||data.items.length>100)throw Error('Unsupported copied selection.');
    return global.WindsFile.validateShared({id:'clipboard',title:'Clipboard',pages:[{id:'clipboard-page',template:'blank',orientation:'portrait',items:data.items}]}).pages[0].items;
  }
  function encode(items){const text=JSON.stringify({format:'winds-notes-clipboard',version:1,items});decode(text);return text;}
  function moveItems(items,dx,dy,newId){return items.map(original=>{const item=JSON.parse(JSON.stringify(original));item.id=newId();if(item.type==='stroke')item.points=item.points.map(([x,y,p])=>[x+dx,y+dy,p]);else{item.x+=dx;item.y+=dy;}return item;});}
  function plain(items){return items.length===1&&items[0].type==='text'?items[0].text:'WiNDS Notes selection';}
  const typing=target=>Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]'));
  function close(){const open=!$('clipboardBackdrop').hidden;epoch++;pasteScope=null;$('clipboardBackdrop').hidden=true;$('clipboardText').value='';if(open){const target=pasteTrigger?.isConnected&&pasteTrigger.offsetParent!==null?pasteTrigger:$('moreOptionsBtn');if(target?.offsetParent!==null)target?.focus();}pasteTrigger=null;}
  function clear(){memory=null;close();}
  function capture(){if(!api.enabled())throw Error('Open a notebook and finish the current interaction first.');const snapshot=api.capture();if(!snapshot)throw Error('Use Select to choose an object first.');const text=encode(snapshot.items||[snapshot.item]);memory={text,account:snapshot.scope.account};return {...snapshot,text};}
  function same(scope){return api.matches(scope);}
  async function copy(cut=false){
    let snapshot;try{snapshot=capture();}catch(error){api.toast(error.message);return;}
    let external=false;
    try{
      if(navigator.clipboard?.write&&global.ClipboardItem){
        const data={'text/plain':new Blob([plain(snapshot.items||[snapshot.item])],{type:'text/plain'})};
        if(global.ClipboardItem.supports?.(WEB_MIME))data[WEB_MIME]=new Blob([snapshot.text],{type:MIME});
        if((snapshot.items?.length||1)>1||snapshot.item.type!=='text'){const png=api.png(snapshot);png.catch(()=>{});data['image/png']=png;}
        await navigator.clipboard.write([new global.ClipboardItem(data)]);external=true;
      }else if((snapshot.items?.length||1)===1&&snapshot.item.type==='text'&&navigator.clipboard?.writeText){await navigator.clipboard.writeText(snapshot.item.text);external=true;}
    }catch{}
    if(!same(snapshot.scope))return;
    if(cut&&!api.remove(snapshot)){api.toast('Selection changed. Copied content is retained; nothing was cut.');return;}
    api.toast(external?(cut?'Cut selection':'Copied selection'):(cut?'Cut within WiNDS · use Paste copied object':'Copied within WiNDS · use Paste copied object'));
  }
  function nativeCopy(event,cut){
    if(typing(event.target)||!api.enabled()||!event.clipboardData)return;
    let snapshot;try{snapshot=capture();}catch{return;}
    try{event.clipboardData.setData('text/plain',plain(snapshot.items||[snapshot.item]));try{event.clipboardData.setData(MIME,snapshot.text);}catch{}event.preventDefault();
      if(cut&&!api.remove(snapshot)){api.toast('Selection changed; nothing was cut.');return;}api.toast(cut?'Cut selection':'Copied selection');
    }catch(error){api.toast(error.message);}
  }
  async function apply(value,scope){
    if(running){api.toast('Finish the current paste first.');return;}running=true;const ticket=epoch;
    try{
      await api.wait(scope);if(!same(scope)||ticket!==epoch)return;
      let items;
      if(value.kind==='objects')items=decode(value.text);
      else if(value.kind==='text'){
        if(value.text.length>MAX_TEXT)throw Error('Paste up to 100,000 text characters at a time.');
        if(!value.text.trim())throw Error('There is no text to paste.');items=[api.textItem(value.text)];
      }else if(value.kind==='image')items=[await api.imageItem(value.file,scope)];
      else throw Error('Paste text, an image, or a WiNDS selection. Use Import PDF or Open notebook for document files.');
      await api.wait(scope);if(!same(scope)||ticket!==epoch)return;api.insert(items,scope);close();api.toast('Pasted · use Select to move, or Undo to remove');
    }catch(error){if(same(scope))api.toast(error.message||'Could not paste this content.');}
    finally{running=false;}
  }
  function fromEvent(data){
    const custom=data.getData(MIME);if(custom)return {kind:'objects',text:custom};
    const file=[...(data.files||[])].find(file=>/^image\/(png|jpeg|webp|gif)$/.test(file.type));if(file)return {kind:'image',file};
    const text=data.getData('text/plain');if(text)return {kind:'text',text};return null;
  }
  function nativePaste(event){
    const inBox=event.target===$('clipboardText');
    if(typing(event.target)&&!inBox)return;
    if(!api.enabled()||!event.clipboardData)return;
    const value=fromEvent(event.clipboardData);
    if(inBox&&value?.kind==='text')return; // Native text editing and selection stay intact.
    if(!value){if(event.clipboardData.files?.length){event.preventDefault();api.toast('Use Import PDF or Open notebook for document files.');}return;}
    const scope=pasteScope||api.context();event.preventDefault();void apply(value,scope);
  }
  function showFallback(scope){
    if(!same(scope))return;pasteTrigger=document.activeElement;pasteScope=scope;$('clipboardBackdrop').hidden=false;$('clipboardText').value='';
    $('pasteInternal').disabled=!memory||memory.account!==scope.account;$('clipboardText').focus();
  }
  async function paste(internal=false){
    if(!api.enabled()){api.toast('Open a notebook and finish the current interaction first.');return;}
    const scope=api.context();
    if(internal){if(!memory||memory.account!==scope.account){api.toast('Copy a notebook object first.');return;}await apply({kind:'objects',text:memory.text},scope);return;}
    try{
      if(navigator.clipboard?.read){
        const entries=await navigator.clipboard.read();if(!same(scope))return;
        for(const entry of entries){
          const custom=entry.types.includes(WEB_MIME)?WEB_MIME:entry.types.includes(MIME)?MIME:null;
          if(custom){const blob=await entry.getType(custom);if(blob.size>MAX_BYTES)throw Error('Copied selection exceeds 10 MB.');await apply({kind:'objects',text:await blob.text()},scope);return;}
          const type=entry.types.find(type=>/^image\/(png|jpeg|webp|gif)$/.test(type));
          if(type){await apply({kind:'image',file:await entry.getType(type)},scope);return;}
          if(entry.types.includes('text/plain')){const blob=await entry.getType('text/plain');if(blob.size>MAX_TEXT*4)throw Error('Paste up to 100,000 text characters at a time.');const text=await blob.text();if(text)await apply({kind:'text',text},scope);else showFallback(scope);return;}
        }
      }else if(navigator.clipboard?.readText){const text=await navigator.clipboard.readText();if(text){await apply({kind:'text',text},scope);return;}}
      showFallback(scope);
    }catch(error){if(same(scope)){showFallback(scope);api.toast(error.name==='NotAllowedError'?'Use the text box’s Paste command, or Paste copied object':error.message||'Use your browser’s Paste command in the text box');}}
  }
  function init(adapter){
    api=adapter;document.addEventListener('keydown',event=>{if(!typing(event.target)&&api.enabled()&&(event.metaKey||event.ctrlKey)&&!event.altKey&&['c','x'].includes(event.key.toLowerCase())){event.preventDefault();if(!event.repeat)void copy(event.key.toLowerCase()==='x');}});document.addEventListener('copy',event=>nativeCopy(event,false));document.addEventListener('cut',event=>nativeCopy(event,true));document.addEventListener('paste',nativePaste);
    $('copySelected').onclick=()=>copy();$('cutSelected').onclick=()=>copy(true);
    $('clipboardClose').onclick=close;$('clipboardCancel').onclick=close;
    $('clipboardInsert').onclick=()=>{if(pasteScope)void apply({kind:'text',text:$('clipboardText').value},pasteScope);};
    $('pasteInternal').onclick=()=>paste(true);
    $('clipboardBackdrop').onkeydown=event=>{
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key==='Tab'){const controls=[...$('clipboardDialog').querySelectorAll('button,textarea')].filter(el=>!el.disabled),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    };
  }
  const exported=Object.freeze({init,copy,paste,clear,decode,encode,moveItems,MAX_BYTES,MAX_TEXT});
  if(typeof module!=='undefined'&&module.exports)module.exports=exported;global.WindsClipboard=exported;
})(typeof window!=='undefined'?window:globalThis);
