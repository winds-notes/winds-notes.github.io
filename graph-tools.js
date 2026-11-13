/* Editable Cartesian plots. The expression language only evaluates math. */
(function(global){
  'use strict';
  const DEFAULT=Object.freeze({equation:'y = a*x^2',xMin:-5,xMax:5,yMin:-5,yMax:10,
    parameter:Object.freeze({name:'a',min:-5,max:5,value:1})});
  const FUNCTIONS=new Map([
    ['sin',Math.sin],['cos',Math.cos],['tan',Math.tan],['sqrt',Math.sqrt],['abs',Math.abs],
    ['exp',Math.exp],['ln',Math.log],['log',Math.log10]
  ]);
  const OPERATORS={
    '+':(a,b)=>a+b,'-':(a,b)=>a-b,'*':(a,b)=>a*b,'/':(a,b)=>a/b,'^':(a,b)=>a**b
  };
  const cache=new Map();
  function compile(equation){
    if(typeof equation!=='string'||!equation.trim()||equation.length>160)throw Error('Enter an equation of up to 160 characters.');
    if(cache.has(equation))return cache.get(equation);
    const source=equation.toLowerCase().trim().replace(/^y\s*=\s*/,'')
      .replace(/[−–]/g,'-').replace(/[×·]/g,'*').replace(/÷/g,'/').replace(/π/g,' pi ')
      .replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,text=>'^('+[...text].map(char=>'-0123456789'['⁻⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(char)]).join('')+')');
    const tokens=[];
    const lexer=/\s+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[a-z]+|[+\-*/^()]/gy;
    while(lexer.lastIndex<source.length){
      const match=lexer.exec(source);
      if(!match)throw Error('Use x, numbers, parentheses, and math operators.');
      const value=match[0];
      if(!value.trim())continue;
      if(/^[a-z]{2}$/.test(value)&&!FUNCTIONS.has(value)&&value!=='pi'&&value.includes('x'))tokens.push(...value);
      else tokens.push(value);
      if(tokens.length>120)throw Error('This equation is too long.');
    }
    let index=0,parameter=null;
    const take=()=>tokens[index++];
    const peek=()=>tokens[index];
    function atom(){
      const token=take();
      if(token==='('){
        const inner=sum();
        if(take()!==')')throw Error('Add the closing parenthesis.');
        return inner;
      }
      if(FUNCTIONS.has(token)){
        if(peek()!=='(')throw Error(`Write ${token}(x) with parentheses.`);
        const argument=atom(),fn=FUNCTIONS.get(token);
        return (x,p)=>fn(argument(x,p));
      }
      if(token==='x')return x=>x;
      if(token==='pi'||token==='e')return ()=>token==='pi'?Math.PI:Math.E;
      if(token&&/^[a-z]$/.test(token)&&token!=='y'){
        if(parameter&&parameter!==token)throw Error('Use one slider parameter per graph.');
        parameter=token;return (x,p)=>p;
      }
      const number=Number(token);
      if(token&&/^[.\d]/.test(token)&&Number.isFinite(number))return ()=>number;
      throw Error('Expected a number, x, a parameter, or a function.');
    }
    function power(){
      const left=atom();
      if(peek()!=='^')return left;
      take();const right=signed();
      return (x,p)=>left(x,p)**right(x,p);
    }
    function signed(){
      const token=peek();
      if(token!=='+'&&token!=='-')return power();
      take();const term=signed();
      return token==='-'?(x,p)=>-term(x,p):term;
    }
    function chain(read,operators,implicit=false){
      let expression=read();
      while(peek()){
        const token=peek();
        if(operators.includes(token))take();
        else if(!implicit||!/^[a-z(]/.test(token))break;
        const left=expression,right=read(),operation=OPERATORS[operators.includes(token)?token:'*'];
        expression=(x,p)=>operation(left(x,p),right(x,p));
      }
      return expression;
    }
    const product=()=>chain(signed,['*','/'],true);
    function sum(){return chain(product,['+','-']);}
    const evaluate=sum();
    if(index!==tokens.length)throw Error('Check the operators and parentheses.');
    const result=Object.freeze({evaluate,parameter});
    cache.set(equation,result);
    if(cache.size>64)cache.delete(cache.keys().next().value);
    return result;
  }
  function interval(min,max,label){
    if(![min,max].every(value=>Number.isFinite(value)&&Math.abs(value)<=1e6)||max-min<.0001)
      throw Error(`${label} needs a minimum smaller than its maximum.`);
    return [min,max];
  }
  function validate(value){
    const equation=typeof value?.equation==='string'?value.equation.trim():null;
    const compiled=compile(equation);
    const [xMin,xMax]=interval(value.xMin,value.xMax,'X axis');
    const [yMin,yMax]=interval(value.yMin,value.yMax,'Y axis');
    const graph={equation,xMin,xMax,yMin,yMax};
    if(compiled.parameter){
      const {min=-5,max=5,value:current=1}=value.parameter||{};
      interval(min,max,'Slider');
      if(!Number.isFinite(current))throw Error('Enter a slider value.');
      graph.parameter={name:compiled.parameter,min,max,value:Math.min(max,Math.max(min,current))};
    }
    return graph;
  }
  function ticks(min,max){
    const target=(max-min)/5,magnitude=10**Math.floor(Math.log10(target));
    const step=([1,2,5,10].find(factor=>factor*magnitude>=target))*magnitude;
    return Array.from({length:7},(_,i)=>(Math.ceil(min/step)+i)*step)
      .filter(tick=>tick<=max+step*1e-9);
  }
  function label(value){return String(+value.toPrecision(4));}
  function curveWidth(item){
    return item.size??Math.min(2.4,Math.min(12,Math.min(item.w,item.h)*.075)*.24);
  }
  function draw(ctx,item){
    const {x,y,w,h,graph}=item;
    if(!graph||![x,y,w,h].every(Number.isFinite)||w<1||h<1)return;
    let fn;
    try{fn=compile(graph.equation).evaluate;}catch{return;}
    const {xMin,xMax,yMin,yMax,parameter}=graph, xSpan=xMax-xMin,ySpan=yMax-yMin;
    if(![xMin,xMax,yMin,yMax].every(value=>Number.isFinite(value)&&Math.abs(value)<=1e6)||xSpan<.0001||ySpan<.0001)return;
    const font=Math.min(12,Math.min(w,h)*.075);
    const left=x+font*3.6,right=x+w-font,top=y+font*2.8,bottom=y+h-font*2;
    const px=value=>left+(value-xMin)/xSpan*(right-left),py=value=>bottom-(value-yMin)/ySpan*(bottom-top);
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    ctx.fillStyle='#ffffff';ctx.fillRect(x,y,w,h);
    ctx.lineWidth=Math.min(1,font*.15);ctx.strokeStyle='#d9dfeb';ctx.strokeRect(x+.5,y+.5,w-1,h-1);
    ctx.font=`600 ${font}px system-ui,sans-serif`;ctx.fillStyle='#282d43';ctx.textBaseline='top';ctx.textAlign='left';
    ctx.fillText(parameter?`${graph.equation}   (${parameter.name} = ${label(parameter.value)})`:graph.equation,x+font,y+font*.65,w-font*2);
    ctx.font=`${font*.85}px system-ui,sans-serif`;ctx.fillStyle='#5a647b';
    ctx.strokeStyle='#e5e9f2';ctx.beginPath();
    for(const value of ticks(xMin,xMax)){
      const cx=px(value);ctx.moveTo(cx,top);ctx.lineTo(cx,bottom);
      ctx.textAlign='center';ctx.fillText(label(value),cx,bottom+font*.35);
    }
    for(const value of ticks(yMin,yMax)){
      const cy=py(value);ctx.moveTo(left,cy);ctx.lineTo(right,cy);
      ctx.textAlign='right';ctx.fillText(label(value),left-font*.5,cy-font*.4,font*3);
    }
    ctx.stroke();
    ctx.strokeStyle='#8996af';ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);
    if(xMin<0&&xMax>0){ctx.moveTo(px(0),top);ctx.lineTo(px(0),bottom);}
    if(yMin<0&&yMax>0){ctx.moveTo(left,py(0));ctx.lineTo(right,py(0));}
    ctx.stroke();
    ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();ctx.beginPath();
    ctx.strokeStyle=item.color||'#5f55dc';ctx.lineWidth=curveWidth(item);ctx.lineCap='round';ctx.lineJoin='round';
    let previous=null;
    const current=parameter?.value??1;
    for(let i=0;i<=320;i++){
      const input=xMin+xSpan*i/320,output=fn(input,current);
      if(!Number.isFinite(output)||Math.abs(output-yMin)>ySpan*1e4){previous=null;continue;}
      let join=Boolean(previous);
      if(previous&&Math.abs(output-previous.output)>ySpan*.8){
        const midpoint=fn((input+previous.input)/2,current);
        join=Number.isFinite(midpoint)&&Math.abs(midpoint-(output+previous.output)/2)<ySpan*.35;
      }
      if(join)ctx.lineTo(px(input),py(output));else ctx.moveTo(px(input),py(output));
      previous={input,output};
    }
    ctx.stroke();ctx.restore();
  }
  let adapter=null,editor=null,adjustment=null,editorFrame=0;
  const $=id=>document.getElementById(id);
  const rangeFields=['xMin','xMax','yMin','yMax'];
  const axisInput=key=>$('graph'+key[0].toUpperCase()+key.slice(1));
  function setRange(input,parameter){
    input.min=parameter.min;input.max=parameter.max;input.value=parameter.value;
  }
  function editorGraph(){
    const equation=$('graphEquation').value, compiled=compile(equation);
    $('graphParameterFields').hidden=!compiled.parameter;
    $('graphParameterName').textContent=compiled.parameter||'';
    return validate({equation,...Object.fromEntries(rangeFields.map(key=>[key,axisInput(key).valueAsNumber])),
      parameter:{min:$('graphParameterMin').valueAsNumber,max:$('graphParameterMax').valueAsNumber,
        value:$('graphParameterValue').valueAsNumber}});
  }
  function showError(message=''){
    const error=$('graphError');
    error.textContent=message;error.hidden=!message;$('graphSubmit').disabled=Boolean(message);
  }
  function updateEditor(){
    editorFrame=0;
    if(!editor||!$('graphDialog').open)return;
    const canvas=$('graphPreview'),ctx=canvas.getContext('2d');
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    try{
      const graph=editorGraph(),parameter=graph.parameter;
      if(parameter){
        setRange($('graphParameterValue'),parameter);
        $('graphParameterValue').setAttribute('aria-label',`Parameter ${parameter.name}`);
        $('graphParameterOutput').value=label(parameter.value);
      }
      ctx.scale(canvas.width/540,canvas.height/312);
      draw(ctx,{graph,x:0,y:0,w:540,h:312,color:editor.color,size:editor.item?.size});
      showError();
    }catch(error){showError(error.message);}
  }
  function open(item=null){
    if(!adapter?.canEdit()||editor)return;
    adapter.prepare();
    if(!adapter.canEdit())return;
    const graph=item?.graph||DEFAULT,parameter=graph.parameter||DEFAULT.parameter;
    editor={scope:adapter.context(),item,color:item?.color||adapter.color()};
    $('graphDialogTitle').textContent=item?'Edit graph':'Insert graph';
    $('graphSubmit').textContent=item?'Apply graph':'Insert graph';
    $('graphEquation').value=graph.equation;
    for(const key of rangeFields)axisInput(key).value=graph[key];
    $('graphParameterMin').value=parameter.min;$('graphParameterMax').value=parameter.max;
    setRange($('graphParameterValue'),parameter);
    $('graphDialog').showModal();updateEditor();
  }
  function stopAdjustment(){
    const session=adjustment;
    adjustment=null;
    if(!session)return null;
    if(session.frame)cancelAnimationFrame(session.frame);
    session.renderer?.release();
    return session;
  }
  function cancel(){
    stopAdjustment();
    editor=null;
    if(editorFrame)cancelAnimationFrame(editorFrame);
    editorFrame=0;
    const dialog=$('graphDialog');
    if(dialog?.open)dialog.close();
  }
  function syncSelection(item){
    const controls=$('graphControls');
    if(!controls)return;
    if(adjustment&&adjustment.item!==item)stopAdjustment();
    controls.hidden=item?.type!=='graph';
    const parameter=item?.graph?.parameter;
    $('graphQuickControl').hidden=!parameter;
    if(!parameter||adjustment)return;
    const input=$('graphQuickValue');
    setRange(input,parameter);input.setAttribute('aria-label',`Parameter ${parameter.name}`);
    $('graphQuickName').textContent=parameter.name;
    $('graphQuickOutput').value=label(parameter.value);
  }
  function previewParameter(){
    const item=adapter.selected();
    if(item?.type!=='graph'||!item.graph.parameter)return;
    if(!adjustment){
      if(!adapter.canEdit())return;
      adapter.prepare();
      if(!adapter.canEdit())return;
      adjustment={item,scope:adapter.context(),frame:0,renderer:null};
    }
    const session=adjustment;
    const value=$('graphQuickValue').valueAsNumber;
    session.graph={...item.graph,parameter:{...item.graph.parameter,value}};
    $('graphQuickOutput').value=label(value);
    if(session.frame)return;
    session.frame=requestAnimationFrame(()=>{
      session.frame=0;
      if(adjustment!==session||!adapter.matches(session.scope)||adapter.selected()!==item||!adapter.canPaint())return;
      session.renderer??=adapter.preparePreview(item);
      session.renderer.paint({...item,graph:session.graph});
    });
  }
  function finishParameter(commit){
    const session=stopAdjustment();
    if(!session||!adapter.matches(session.scope))return;
    if(commit&&adapter.selected()===session.item&&adapter.commit(session,session.graph))return;
    adapter.restore(session.scope);
  }
  function init(next){
    adapter=next;
    const dialog=$('graphDialog');
    $('graphForm').oninput=()=>{
      if(!editorFrame)editorFrame=requestAnimationFrame(updateEditor);
    };
    $('graphForm').onsubmit=event=>{
      event.preventDefault();if(!editor)return;
      try{
        const graph=editorGraph(),target=editor;
        editor=null;dialog.close();
        if(!adapter.commit(target,graph))adapter.notify('The page changed. Open Graph again to apply the edit.');
      }catch(error){showError(error.message);}
    };
    $('graphCancel').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{
      if(dialog.open)return;
      editor=null;if(editorFrame)cancelAnimationFrame(editorFrame);editorFrame=0;
    });
    $('editGraph').onclick=()=>{const item=adapter.selected();if(item?.type==='graph')open(item);};
    const quick=$('graphQuickValue');
    quick.oninput=previewParameter;quick.onchange=()=>finishParameter(true);quick.onblur=()=>finishParameter(true);
    quick.addEventListener('pointercancel',()=>finishParameter(false));
    quick.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&adjustment){event.preventDefault();finishParameter(false);}
    });
  }
  const isEditing=()=>Boolean(editor||adjustment);
  const api=Object.freeze({DEFAULT,compile,validate,draw,curveWidth,init,open,cancel,syncSelection,isEditing});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.WindsGraph=api;
})(typeof window!=='undefined'?window:globalThis);
