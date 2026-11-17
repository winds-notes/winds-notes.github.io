/* Personal flashcards and device-local, account-scoped review progress. */
(function(global){
  'use strict';
  const $=id=>document.getElementById(id),minute=60_000,day=24*60*minute;
  const ratings=['again','hard','good','easy'];
  const reviewDate=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  let api,composer,deck;
  function interval(card,rating){
    const previous=card.intervalDays||0;
    switch(rating){
      case 'again':return 10*minute;
      case 'hard':return day*Math.min(365,previous?Math.ceil(previous*1.2):.5);
      case 'good':return day*Math.min(365,previous?Math.max(3,Math.round(previous*2.1)):1);
      case 'easy':return day*Math.min(365,Math.max(4,Math.round(previous*3)));
      default:throw Error('Choose a review rating.');
    }
  }
  function reschedule(card,rating,now){
    const wait=interval(card,rating);
    return {...card,dueAt:now+wait,intervalDays:rating==='again'?0:wait/day,reviewedAt:now,revision:card.revision+1};
  }
  function dueCards(cards,now){
    return cards.filter(card=>card.dueAt<=now).sort((a,b)=>a.dueAt-b.dueAt||a.createdAt-b.createdAt);
  }
  function answer(node,kind){
    return node.querySelector(kind==='image'?'img':'p');
  }
  function showAnswer(node,card,image=''){
    node.hidden=!card;
    const pic=answer(node,'image'),text=answer(node,'text');
    pic.hidden=!image;text.hidden=!card||card.answer.kind!=='text';
    if(image)pic.src=image;else pic.removeAttribute('src');
    text.textContent=card?.answer.kind==='text'?card.answer.text:'';
  }
  function active(session,current,dialog){
    return current===session&&$(dialog).open&&api.account()===session.account;
  }
  function composing(session){return active(session,composer,'cardComposer');}
  function reviewing(session){return active(session,deck,'studyCardsDialog');}
  function byteString(blob){
    if(blob.size>700*1024)throw Error('Choose a smaller selection for this card.');
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(Error('The selected answer could not be prepared.'));
      reader.readAsDataURL(blob);
    });
  }
  async function compose(input){
    if(!input||$('cardComposer').open)return;
    const {scope,items,source}=input,account=api.account();
    if(account!==scope.account)return;
    const capture=items.length===1&&items[0].type==='text'?{kind:'text',text:items[0].text.trim()}:{kind:'image'};
    if(capture.kind==='text'&&(!capture.text||capture.text.length>16000)){
      api.toast('Select a passage between 1 and 16,000 characters.');return;
    }
    const session=composer={account,answer:capture,source,busy:capture.kind==='image'};
    showComposer(session);
    if(!session.busy)return;
    try{
      const image=await byteString(await api.snapshot(input));
      if(!composing(session))return;
      session.image=image;session.busy=false;updateComposer(session);
    }catch(error){
      if(!composing(session))return;
      session.busy=false;session.failed=true;updateComposer(session,error.message);
    }
  }
  function showComposer(session){
    $('cardComposerTitle').textContent=session.card?'Edit study card':'Create study card';
    $('cardPrompt').value=session.card?.prompt||'';
    $('cardTextAnswer').value=session.answer.kind==='text'?session.answer.text:'';
    $('cardTextAnswer').required=session.answer.kind==='text';
    $('cardTextAnswer').closest('label').hidden=session.answer.kind!=='text';
    $('cardSave').textContent=session.card?'Save changes':'Save card';
    $('cardComposer').showModal();
    updateComposer(session);
    $('cardPrompt').focus();
  }
  function updateComposer(session,message){
    $('cardSave').disabled=session.busy||session.failed;
    $('cardPrompt').readOnly=$('cardTextAnswer').readOnly=Boolean(session.saving);
    $('cardComposerStatus').textContent=message??(session.saving?'Saving card…':session.busy?'Preparing selected answer…':'');
    const card=session.image?{answer:session.answer}:null;
    showAnswer($('cardComposerPreview'),card,session.image);
  }
  async function saveCard(event){
    event.preventDefault();
    const session=composer;if(!session||session.busy||session.failed)return;
    const prompt=$('cardPrompt').value.trim(),value=$('cardTextAnswer').value.trim();
    if(!prompt||(session.answer.kind==='text'&&!value)){
      $('cardComposerStatus').textContent='Enter a prompt and an answer.';return;
    }
    const previous=session.card,answer=session.answer.kind==='text'?{kind:'text',text:value}:session.answer;
    const stamp=Date.now(),id=previous?.id||api.id();
    session.busy=session.saving=true;updateComposer(session);
    try{
      const card=await api.update(session.account,id,current=>{
        if(previous&&current?.revision!==previous.revision)throw Error('This card changed in another tab. Reopen it to edit the latest version.');
        return previous?{...current,prompt,answer,revision:current.revision+1}:
          {id,prompt,answer,source:session.source,createdAt:stamp,dueAt:stamp,intervalDays:0,revision:0};
      },previous?undefined:session.image);
      if(!composing(session))return;
      $('cardComposer').close();composer=null;
      api.toast(previous?'Study card updated':'Study card saved · ready for review');
      if(deck&&reviewing(deck)){
        deck.cards=deck.cards.map(entry=>entry.id===card.id?card:entry);
        deck.current=card;drawDeck(deck);
      }
    }catch(error){
      if(composing(session)){
        session.busy=session.saving=false;updateComposer(session,error.message||'The card could not be saved.');
      }
    }
  }

  const relative=card=>card.dueAt<=Date.now()?'Due now':reviewDate.format(card.dueAt);
  function drawDeck(session){
    const {current,busy,mode,revealed,cards}=session;
    const now=Date.now(),due=dueCards(cards,now);
    clearTimeout(session.timer);
    const next=cards.reduce((soon,card)=>card.dueAt>now?Math.min(soon,card.dueAt):soon,Infinity);
    if(!busy&&Number.isFinite(next))session.timer=setTimeout(()=>{
      if(!reviewing(session))return;
      const ready=dueCards(session.cards,Date.now())[0];
      if(session.mode==='review'&&!session.current&&ready)showCard(session,ready,'review');
      else drawDeck(session);
    },Math.min(next-now,2_147_000_000));
    $('cardDeckSummary').textContent=busy==='load'?'Loading study cards…':`${due.length} due · ${cards.length} ${cards.length===1?'card':'cards'}`;
    $('cardReview').disabled=Boolean(busy)||!due.length||mode==='review';
    $('cardBrowse').disabled=Boolean(busy)||mode==='list';
    $('cardDeckList').hidden=mode!=='list';
    $('cardDeckEmpty').hidden=Boolean(current)||mode==='list'&&cards.length>0||busy==='load';
    $('cardDeckEmpty').textContent=mode==='review'?'You’re caught up.':cards.length?'You’re caught up.':'Select handwriting, text, or a diagram and choose Create study card.';
    if(mode==='review'&&!current&&cards.length){
      $('cardDeckEmpty').textContent+=` Next review ${relative(cards.reduce((a,b)=>a.dueAt<b.dueAt?a:b))}.`;
    }
    const list=$('cardDeckList');
    if(mode==='list'){
      const fragment=document.createDocumentFragment();
      for(const card of [...cards].sort((a,b)=>a.dueAt-b.dueAt)){
        const row=document.createElement('li'),button=document.createElement('button');
        const title=document.createElement('span'),date=document.createElement('small');
        title.textContent=card.prompt;date.textContent=relative(card);
        button.type='button';button.disabled=Boolean(busy);button.append(title,date);
        button.onclick=()=>showCard(session,card,'preview');
        row.append(button);fragment.append(row);
      }
      list.replaceChildren(fragment);
    }else list.replaceChildren();
    $('cardFace').hidden=!current;
    $('cardFacePrompt').textContent=current?.prompt||'';
    $('cardReveal').hidden=!current||revealed;$('cardReveal').disabled=Boolean(busy);
    showAnswer($('cardFaceAnswer'),revealed?current:null,revealed?session.image:'');
    $('cardRatings').hidden=!current||!revealed||mode!=='review';
    $('cardOpenSource').hidden=!current;
    for(const id of ['cardOpenSource','cardEdit','cardDelete'])$(id).disabled=Boolean(busy);
    $('cardEdit').hidden=$('cardDelete').hidden=!current||mode!=='preview';
    for(const control of $('cardRatings').querySelectorAll('button')){
      control.disabled=Boolean(busy);
      if(current){
        const wait=interval(current,control.dataset.rating);
        control.querySelector('small').textContent=wait>=day?`${wait/day} d`:wait>=60*minute?`${wait/(60*minute)} hr`:`${wait/minute} min`;
      }
    }
  }
  function showCard(session,card,mode){
    session.current=card;session.mode=mode;session.revealed=false;session.image='';
    $('cardDeckStatus').textContent='';drawDeck(session);
    if(card)$('cardFacePrompt').focus();
    else $('cardBrowse').focus();
  }
  async function readDeck(session){
    session.busy='load';drawDeck(session);
    try{
      const result=await api.list(session.account);
      if(reviewing(session)){session.cards=result;session.busy=null;drawDeck(session);}
    }catch(error){
      if(reviewing(session)){session.busy=null;drawDeck(session);$('cardDeckStatus').textContent=error.message||'Study cards could not be loaded.';}
    }
  }
  async function open(){
    if($('studyCardsDialog').open)return;
    clearTimeout(deck?.timer);
    const session=deck={account:api.account(),cards:[],mode:'list',current:null};
    $('cardDeckStatus').textContent='';
    $('studyCardsDialog').showModal();
    await readDeck(session);
  }
  async function reveal(){
    const session=deck,card=session?.current;
    if(!card||session.busy)return;
    if(card.answer.kind==='image'){
      session.busy='reveal';drawDeck(session);
      try{
        session.image=await api.image(session.account,card.id);
        if(!session.image)throw Error('The card image is unavailable.');
      }catch(error){
        if(reviewing(session)){
          session.busy=null;drawDeck(session);$('cardDeckStatus').textContent=error.message;
        }
        return;
      }
      if(!reviewing(session))return;
      session.busy=null;
    }
    session.revealed=true;drawDeck(session);
    (session.mode==='review'?$('cardRatings').querySelector('button'):$('cardOpenSource')).focus();
  }
  async function grade(rating){
    const session=deck,card=session?.current;
    if(!card||session.busy||!session.revealed||session.mode!=='review')return;
    session.busy='save';drawDeck(session);
    try{
      const stamp=Date.now();
      const updated=await api.update(session.account,card.id,current=>{
        if(current?.revision!==card.revision||current.dueAt>stamp)throw Error('This card has already changed. Its latest progress is now loaded.');
        return reschedule(current,rating,stamp);
      });
      if(!reviewing(session))return;
      session.cards=session.cards.map(entry=>entry.id===updated.id?updated:entry);
      session.busy=null;
      showCard(session,dueCards(session.cards,Date.now())[0]||null,'review');
    }catch(error){
      if(!reviewing(session))return;
      session.current=null;session.mode='list';
      await readDeck(session);
      if(reviewing(session))$('cardDeckStatus').textContent=error.message||'The review could not be saved.';
    }
  }
  async function remove(){
    const session=deck,card=session?.current;
    if(!card||session.busy||!confirm('Delete this study card and its review progress?'))return;
    session.busy='save';drawDeck(session);
    try{
      await api.update(session.account,card.id,current=>{
        if(current?.revision!==card.revision)throw Error('This card changed in another tab. Reopen the collection to see the latest version.');
        return null;
      });
      if(reviewing(session)){session.cards=session.cards.filter(entry=>entry.id!==card.id);session.busy=null;showCard(session,null,'list');}
    }catch(error){
      if(reviewing(session)){session.busy=null;drawDeck(session);$('cardDeckStatus').textContent=error.message;}
    }
  }
  async function edit(){
    const session=deck,card=session?.current;
    if(!card||session.busy||$('cardComposer').open)return;
    const next=composer={account:session.account,answer:card.answer,card,busy:card.answer.kind==='image'};
    showComposer(next);
    if(!next.busy)return;
    try{
      next.image=await api.image(next.account,card.id);
      if(!next.image)throw Error('The card image is unavailable.');
      if(composing(next)){next.busy=false;updateComposer(next);}
    }catch(error){
      if(composing(next)){next.busy=false;updateComposer(next,error.message);}
    }
  }
  function close(){
    clearTimeout(deck?.timer);
    composer=null;deck=null;
    $('cardComposer').close();$('studyCardsDialog').close();
    showAnswer($('cardComposerPreview'),null);showAnswer($('cardFaceAnswer'),null);
    $('cardDeckList').replaceChildren();
  }
  function init(adapter){
    api=adapter;
    $('openStudyCards').onclick=open;
    $('cardComposerForm').onsubmit=saveCard;
    $('cardComposer').onclose=()=>{if(!$('cardComposer').open){composer=null;showAnswer($('cardComposerPreview'),null);}};
    $('studyCardsDialog').onclose=()=>{if(!$('studyCardsDialog').open){clearTimeout(deck?.timer);deck=null;showAnswer($('cardFaceAnswer'),null);$('cardDeckList').replaceChildren();}};
    $('cardReview').onclick=()=>{if(deck&&!deck.busy)showCard(deck,dueCards(deck.cards,Date.now())[0]||null,'review');};
    $('cardBrowse').onclick=()=>{if(deck&&!deck.busy){showCard(deck,null,'list');$('cardReview').focus();}};
    $('cardReveal').onclick=reveal;$('cardEdit').onclick=edit;$('cardDelete').onclick=remove;
    $('cardRatings').onclick=event=>{
      const rating=event.target.closest('button')?.dataset.rating;if(ratings.includes(rating))void grade(rating);
    };
    $('cardOpenSource').onclick=()=>{
      const session=deck,card=session?.current;
      if(!card||session.busy)return;
      const source=api.resolveSource(card.source);
      if(!source){$('cardDeckStatus').textContent='The source page is unavailable in this workspace.';return;}
      $('studyCardsDialog').close();
      api.openSource(source);
    };
  }
  global.WindsCards=Object.freeze({init,open,compose,close,interval,reschedule,dueCards});
})(typeof window!=='undefined'?window:globalThis);
