/* Search the guide's readable HTML, including collapsed lesson text. */
(() => {
  'use strict';
  const input=document.getElementById('tutorialSearch');
  const clear=document.getElementById('clearTutorialSearch');
  const status=document.getElementById('tutorialSearchStatus');
  const empty=document.getElementById('tutorialEmpty');
  const sections=[...document.querySelectorAll('#tutorialLessons > section')].map(section=>{
    const title=section.querySelector('h2').textContent;
    const lessons=[...section.querySelectorAll('details')].map(node=>({
      node,text:`${title} ${node.dataset.keywords||''} ${node.textContent}`.toLowerCase()
    }));
    return {section,lessons};
  });
  function filter(){
    const words=input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count=0;
    for(const {section,lessons} of sections){
      let matches=0;
      for(const {node,text} of lessons){
        node.hidden=!words.every(word=>text.includes(word));
        if(!node.hidden)matches++;
      }
      section.hidden=matches===0;
      count+=matches;
    }
    clear.hidden=!input.value;
    empty.hidden=count>0;
    status.textContent=words.length?(count?`${count} matching lesson${count===1?'':'s'}`:'No matching lessons'):'';
  }
  function revealLink(){
    const target=document.getElementById(location.hash.slice(1));
    if(!target?.closest('#tutorialLessons'))return;
    if(target.hidden||target.closest('section')?.hidden){input.value='';filter();}
    if(target.matches('details'))target.open=true;
    target.scrollIntoView();
  }
  input.addEventListener('input',filter);
  input.addEventListener('search',filter);
  clear.addEventListener('click',()=>{input.value='';filter();input.focus();});
  for(const link of document.querySelectorAll('.tutorial-topics a')){
    link.addEventListener('click',()=>{input.value='';filter();});
  }
  window.addEventListener('hashchange',revealLink);
  document.getElementById('tutorialSearchBox').hidden=false;
  filter();
  if(location.hash)revealLink();
})();
