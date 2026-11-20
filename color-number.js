/* Numbered-dot pictures. Geometry becomes ordinary editable circle shapes;
 * the transparent labels are one image, so filling a numeral hits its circle.
 * No new notebook format or drawing-event handlers are required. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.WindsColorNumber=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const WIDTH=700,HEIGHT=910,COLS=34,ROWS=44,RADIUS=8.1;
  const DESIGNS=Object.freeze([
    {id:'number-butterfly',name:'Butterfly Garden',detail:'Reveal a jewel-winged butterfly among flowers, one numbered circle at a time.',palette:['#173f4f','#389e9d','#a8dad0','#f4c463','#ed795f','#f6af9e','#fff0d5','#74456a']},
    {id:'number-koi',name:'Moonlit Koi Pond',detail:'Two flowing koi, lotus blossoms and turquoise ripples hidden in numbered dots.',palette:['#173f59','#237c94','#72c9c3','#f5b84f','#ed7053','#bc4655','#fff1d5','#b6ddd2']},
    {id:'number-fox',name:'Woodland Fox',detail:'A copper fox with a cream chest, framed by moonlit leaves and golden stars.',palette:['#17364c','#276b67','#99c6b3','#f3bf62','#e57b42','#f7dcb5','#fff3dc','#a94336']},
    {id:'number-owl',name:'Starlit Owl',detail:'A wide-eyed owl on a flowering branch beneath a crescent moon.',palette:['#202b4d','#4e5b80','#8ca9bf','#efc66f','#b57d57','#e8c8a0','#fff0d5','#78506b']},
    {id:'number-turtle',name:'Coral Reef Turtle',detail:'An ocean turtle with a jewel-patterned shell, coral fans and sea bubbles.',palette:['#163e59','#287d96','#79c4bb','#f0c36c','#e78170','#b85071','#f7edce','#419581']},
    {id:'number-lotus',name:'Lotus Sunrise',detail:'Layered pink lotus petals opening above a calm pool at sunrise.',palette:['#324c6a','#729cb4','#b8d6d2','#f3c66b','#e78393','#b6537e','#fff0d5','#438780']},
    {id:'number-mountains',name:'Alpine Reflection',detail:'Snow-capped peaks, an amber sun and evergreen trees reflected in a lake.',palette:['#24364f','#486b82','#88b4be','#f2c363','#cc8763','#b5caca','#f6eddb','#396d64']},
    {id:'number-peacock',name:'Peacock Jewel',detail:'A royal-blue peacock framed by a fan of emerald and golden eye feathers.',palette:['#203653','#287f85','#84c8b0','#f0c66a','#dc936c','#65598d','#fff0d5','#375f9b']}
  ].map(design=>Object.freeze({...design,palette:Object.freeze(design.palette),collection:'Color by number',level:'Numbered dots',numbered:true,keywords:'color colour coloring by number numbered dots circles mosaic hidden picture reveal'})));
  const cache=new Map();
  function designFor(id){const design=DESIGNS.find(design=>design.id===id);if(!design)throw Error('Choose an available numbered picture.');return design;}
  function ellipse(x,y,cx,cy,rx,ry,angle=0){const c=Math.cos(angle),s=Math.sin(angle),dx=x-cx,dy=y-cy;return ((dx*c+dy*s)/rx)**2+((dy*c-dx*s)/ry)**2<1;}
  function polygon(x,y,vertices){let inside=false;for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
    const [a,b]=vertices[i],[c,d]=vertices[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
  }return inside;}
  function blossom(x,y,cx,cy,r,petals=7){const dx=x-cx,dy=y-cy,angle=Math.atan2(dy,dx),distance=Math.hypot(dx,dy);if(distance<r*.23)return 4;return distance<r*(.75+.23*Math.cos(petals*angle))?7:0;}
  const wing=[[.025,.34],[.11,.16],[.24,.12],[.36,.20],[.39,.34],[.31,.46],[.19,.50],[.27,.53],[.30,.65],[.22,.79],[.11,.76],[.035,.56]];
  function butterfly(x,y){
    let n=y>.77?2:3;
    if(Math.sin(x*9+y*11)>.35)n=2;
    if(x<.13||x>.9)n=1;
    for(const [cx,cy,r] of [[.14,.78,.11],[.87,.86,.10],[.83,.13,.08]])n=blossom(x,y,cx,cy,r)||n;
    const sx=Math.abs(x-.5);
    if(polygon(sx,y,wing)){
      n=8;
      if(ellipse(sx,y,.205,.325,.155,.17,-.28))n=5;
      if(ellipse(sx,y,.16,.34,.10,.12,-.28))n=4;
      if(ellipse(sx,y,.22,.29,.045,.065,-.28))n=7;
      if(ellipse(sx,y,.16,.625,.10,.115,.2))n=6;
      if(ellipse(sx,y,.15,.62,.057,.065,.2))n=5;
      if(sx<.075&&y>.32&&y<.62)n=4;
      if(ellipse(sx,y,.31,.36,.016,.023)||ellipse(sx,y,.29,.23,.017,.022)||ellipse(sx,y,.22,.72,.016,.02))n=7;
    }
    if(ellipse(x,y,.5,.455,.025,.205)||ellipse(x,y,.5,.255,.033,.035))n=1;
    if(y>.17&&y<.26&&Math.abs(sx-(.26-y)*.5)<.009)n=1;
    return n;
  }
  function fish(x,y,cx,cy,angle){
    const c=Math.cos(angle),s=Math.sin(angle),dx=x-cx,dy=y-cy,u=dx*c+dy*s,v=dy*c-dx*s;
    let n=0;
    if(polygon(u,v,[[0,.16],[-.14,.33],[0,.29],[.14,.33]]))n=5;
    if(ellipse(u,v,-.10,.015,.06,.11,-.5)||ellipse(u,v,.10,.015,.06,.11,.5))n=8;
    if(ellipse(u,v,0,-.035,.105,.23)){
      n=7;
      if(ellipse(u,v,-.025,-.12,.09,.065,.4)||ellipse(u,v,.035,.04,.09,.075,-.5))n=5;
      if(ellipse(u,v,-.025,.13,.065,.055,.3))n=4;
      if(u>.035&&v<-.17)n=1;
      if(Math.abs(u)<.012&&v>-.10&&v<.14)n=6;
    }
    return n;
  }
  function koi(x,y){
    let n=Math.sin(y*23+x*8)>.45?2:1;
    if(Math.sin(y*23+x*8)<-.55)n=3;
    const ripple=Math.hypot((x-.51)*.85,y-.51);
    if([.30,.39,.48].some(r=>Math.abs(ripple-r)<.009))n=8;
    n=fish(x,y,.34,.36,-.40)||n;
    n=fish(x,y,.66,.65,2.72)||n;
    for(const [cx,cy,r] of [[.82,.14,.105],[.16,.84,.09]]){
      if(ellipse(x,y,cx-.025,cy+.06,r*1.25,r*.65,-.3))n=3;
      n=blossom(x,y,cx,cy,r,8)||n;
    }
    return n;
  }
  const foxHead=[[.30,.29],[.50,.23],[.70,.29],[.68,.46],[.5,.59],[.32,.46]];
  function fox(x,y){
    let n=1;
    for(let side=0;side<2;side++){
      const xx=side?1-x:x;
      if(Math.abs(xx-(.10+.06*Math.sin(y*6)))<.012&&y>.18&&y<.95)n=2;
      for(let i=0;i<7;i++)if(ellipse(xx,y,.075+(i%2)*.095,.22+i*.10,.038,.075,(i%2?1:-1)*.65))n=i%3===0?3:2;
    }
    if(ellipse(x,y,.73,.77,.20,.115,-.5))n=x>.8?7:5;
    if(ellipse(x,y,.5,.70,.18,.255))n=5;
    if(ellipse(x,y,.5,.68,.085,.18))n=6;
    if(ellipse(x,y,.39,.91,.08,.034)||ellipse(x,y,.61,.91,.08,.034))n=8;
    for(const side of [-1,1]){
      const xx=.5+side*(x-.5);
      if(polygon(xx,y,[[.30,.34],[.27,.10],[.47,.28]]))n=8;
      if(polygon(xx,y,[[.32,.29],[.30,.16],[.42,.28]]))n=4;
    }
    if(polygon(x,y,foxHead)){
      n=5;
      if(polygon(x,y,[[.31,.38],[.46,.43],[.5,.53],[.37,.49]])||polygon(x,y,[[.69,.38],[.54,.43],[.5,.53],[.63,.49]]))n=7;
      if(Math.abs(x-.5)<.018&&y>.30&&y<.45)n=4;
      if(ellipse(x,y,.405,.365,.025,.013,-.2)||ellipse(x,y,.595,.365,.025,.013,.2))n=1;
      if(polygon(x,y,[[.47,.48],[.53,.48],[.5,.52]]))n=1;
    }
    if(ellipse(x,y,.78,.11,.055,.055)&&!ellipse(x,y,.80,.095,.052,.052))n=7;
    for(const [cx,cy] of [[.20,.09],[.82,.35],[.16,.52],[.70,.05]])if(Math.abs(x-cx)+Math.abs(y-cy)<.018)n=4;
    return n;
  }
  function moon(x,y,cx,cy,r){return ellipse(x,y,cx,cy,r,r)&&!ellipse(x,y,cx+r*.38,cy-r*.22,r*.91,r*.91);}
  function owl(x,y){
    let n=y>.78?2:1;
    if(moon(x,y,.79,.14,.082))n=7;
    for(const [cx,cy] of [[.13,.13],[.31,.06],[.86,.39],[.13,.49],[.67,.08]])if(Math.abs(x-cx)+Math.abs(y-cy)<.018)n=4;
    if(Math.abs(y-(.86-.07*Math.sin(x*3)))<.018&&x>.07&&x<.94)n=5;
    if(ellipse(x,y,.5,.62,.23,.25)){
      n=5;
      if(ellipse(x,y,.5,.66,.16,.19))n=6;
      if(ellipse(x,y,.31,.61,.075,.19,-.16)||ellipse(x,y,.69,.61,.075,.19,.16))n=8;
      const scallop=(y-.51)*34+Math.cos((x-.5)*50)*.6;
      if(Math.abs(x-.5)<.13&&y>.56&&y<.79&&Math.abs(Math.sin(scallop))<.24)n=3;
    }
    if(polygon(x,y,[[.26,.37],[.25,.17],[.40,.29],[.60,.29],[.75,.17],[.74,.37]]))n=5;
    if(ellipse(x,y,.5,.37,.25,.18))n=5;
    for(const cx of [.39,.61]){
      if(ellipse(x,y,cx,.37,.112,.12))n=6;
      if(ellipse(x,y,cx,.365,.074,.079))n=4;
      if(ellipse(x,y,cx,.36,.038,.049))n=1;
      if(ellipse(x,y,cx-.013,.34,.012,.016))n=7;
    }
    if(polygon(x,y,[[.465,.44],[.535,.44],[.5,.51]]))n=4;
    for(const cx of [.42,.58])if(ellipse(x,y,cx,.835,.045,.022))n=4;
    for(const [cx,cy] of [[.16,.82],[.83,.81]]){if(ellipse(x,y,cx,cy-.05,.07,.035,-.4))n=3;n=blossom(x,y,cx,cy,.047,5)||n;}
    return n;
  }
  function turtle(x,y){
    let n=Math.sin(y*15+x*7)>.4?2:1;
    if(Math.sin(y*15+x*7)<-.5)n=3;
    for(const [cx,cy,r] of [[.13,.16,.026],[.20,.10,.018],[.84,.25,.03],[.88,.16,.018]])if(Math.abs(Math.hypot(x-cx,y-cy)-r)<.007)n=7;
    for(const side of [-1,1])for(let i=0;i<4;i++){
      const cx=.5+side*(.31+i*.025),top=.74-i*.055;
      if(Math.abs(x-cx)<.012&&y>top&&y<.95)n=5;
      if(Math.abs(Math.abs(x-cx)-(.83-y)*.7)<.012&&y>top&&y<.84)n=6;
    }
    const dx=x-.5,dy=y-.48,angle=-.25,c=Math.cos(angle),s=Math.sin(angle),u=dx*c+dy*s,v=dy*c-dx*s;
    if(ellipse(u,v,-.20,-.09,.125,.07,-.65)||ellipse(u,v,.20,-.09,.125,.07,.65))n=8;
    if(ellipse(u,v,-.14,.23,.07,.12,.45)||ellipse(u,v,.14,.23,.07,.12,-.45))n=8;
    if(ellipse(u,v,0,-.31,.075,.105))n=3;
    if(ellipse(u,v,.034,-.35,.014,.018))n=1;
    if(ellipse(u,v,0,0,.19,.27)){
      n=4;
      if(ellipse(u,v,0,0,.169,.246))n=8;
      if(ellipse(u,v,0,0,.071,.098))n=3;
      for(let i=0;i<6;i++){
        const theta=i*Math.PI/3;
        if(ellipse(u,v,Math.cos(theta)*.115,Math.sin(theta)*.166,.052,.075,theta*.22))n=i%2?2:3;
      }
      if(Math.abs(u)<.012&&Math.abs(v)<.18)n=4;
    }
    if(y>.92&&Math.sin(x*20)>.5)n=4;
    return n;
  }
  function lotus(x,y){
    let n=y<.55?3:1;
    if(y<.55){if(y<.20)n=1;else if(y<.32)n=2;if(ellipse(x,y,.5,.36,.19,.19))n=y<.35?4:5;}
    if(y>.56&&Math.sin(y*55+x*7)>.74)n=2;
    if(y>.65&&Math.abs(x-.5)<(.95-y)*.53&&Math.sin(y*80)>.15)n=4;
    if(ellipse(x,y,.28,.77,.25,.075,-.16)||ellipse(x,y,.72,.77,.25,.075,.16))n=8;
    const sx=Math.abs(x-.5);
    if(ellipse(sx,y,.20,.61,.19,.09,.55))n=6;
    if(ellipse(sx,y,.14,.54,.115,.22,-.58))n=5;
    if(ellipse(sx,y,.085,.57,.095,.20,-.34))n=7;
    if(ellipse(x,y,.5,.49,.085,.245))n=6;
    if(ellipse(x,y,.5,.525,.052,.18))n=5;
    if(ellipse(sx,y,.15,.68,.17,.064,.08))n=5;
    if(ellipse(x,y,.5,.71,.15,.044))n=6;
    if(ellipse(x,y,.5,.70,.08,.02))n=4;
    return n;
  }
  function mountains(x,y){
    let n=y<.54?3:2;
    if(y<.20)n=1;else if(y<.31)n=2;
    if(ellipse(x,y,.76,.235,.10,.10))n=4;
    const yy=y>.56?1.12-y:y;
    if(polygon(x,yy,[[.01,.55],[.34,.16],[.64,.55]]))n=x<.34?2:6;
    if(polygon(x,yy,[[.34,.16],[.25,.29],[.30,.28],[.34,.32],[.38,.27],[.44,.30]]))n=7;
    if(polygon(x,yy,[[.32,.55],[.64,.25],[.99,.55]]))n=x<.64?1:5;
    if(polygon(x,yy,[[.64,.25],[.54,.35],[.60,.33],[.65,.38],[.69,.34],[.75,.37]]))n=7;
    if(y>.56){if(Math.sin(y*98+x*13)>.72)n=3;if(x>.66&&x<.84&&Math.sin(y*76)>.35)n=4;}
    if(Math.abs(y-.56)<.023)n=8;
    for(const [cx,base,height] of [[.12,.86,.35],[.22,.94,.26],[.87,.78,.25]]){
      for(let i=0;i<3;i++)if(polygon(x,y,[[cx,base-height+i*height*.19],[cx-height*(.18+i*.12),base-height*(.55-i*.25)],[cx+height*(.18+i*.12),base-height*(.55-i*.25)]]))n=8;
      if(Math.abs(x-cx)<.009&&y>base-height*.55&&y<base)n=1;
    }
    return n;
  }
  function peacock(x,y){
    let n=1;
    for(let i=0;i<11;i++){
      const a=(-160+i*14)*Math.PI/180,cx=.5+Math.cos(a)*.34,cy=.71+Math.sin(a)*.51;
      const tilt=Math.atan2(cy-.71,cx-.5)+Math.PI/2;
      if(ellipse(x,y,cx,cy,.077,.20,tilt))n=2;
      if(ellipse(x,y,cx,cy-.015,.046,.073,tilt))n=4;
      if(ellipse(x,y,cx,cy-.015,.029,.047,tilt))n=8;
      if(ellipse(x,y,cx,cy-.015,.015,.024,tilt))n=1;
    }
    if(ellipse(x,y,.5,.73,.12,.14))n=8;
    if(ellipse(x,y,.5,.62,.039,.18))n=8;
    if(ellipse(x,y,.51,.47,.054,.049))n=8;
    if(ellipse(x,y,.525,.46,.014,.013))n=7;
    if(polygon(x,y,[[.55,.47],[.60,.49],[.55,.50]]))n=5;
    for(let i=0;i<3;i++)if(ellipse(x,y,.48+i*.025,.385,.012,.02))n=i===1?4:6;
    if(Math.abs(x-.5)<.075&&y>.76&&y<.86)n=6;
    if((Math.abs(x-.46)<.009||Math.abs(x-.54)<.009)&&y>.83&&y<.94)n=5;
    for(const [cx,cy] of [[.13,.91],[.86,.9]]){if(ellipse(x,y,cx,cy,.075,.04))n=3;n=blossom(x,y,cx,cy-.035,.045,5)||n;}
    return n;
  }
  const classifiers={'number-butterfly':butterfly,'number-koi':koi,'number-fox':fox,'number-owl':owl,'number-turtle':turtle,'number-lotus':lotus,'number-mountains':mountains,'number-peacock':peacock};
  function cells(id){
    designFor(id);if(cache.has(id))return cache.get(id);
    const result=[];
    for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++){
      const x=26+col*19.2+(row%2)*9.6,y=27+row*17.6;
      result.push(Object.freeze({x,y,n:classifiers[id]((x-17)/665,(y-18)/780)}));
    }
    const frozen=Object.freeze(result);cache.set(id,frozen);return frozen;
  }
  function disc(ctx,x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
  function labels(ctx,id){
    const design=designFor(id);
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 8.5px Arial';ctx.fillStyle='#263b4b';
    for(const cell of cells(id))ctx.fillText(String(cell.n),cell.x,cell.y+.4);
    ctx.font='600 11px Arial';
    for(let i=0;i<8;i++){
      const x=43+(i%4)*172,y=834+Math.floor(i/4)*31;
      disc(ctx,x,y,10,design.palette[i]);ctx.fillStyle='#f9fbff';ctx.textAlign='left';ctx.fillText(`${i+1}  ${design.palette[i].toUpperCase()}`,x+17,y);
    }
    ctx.textAlign='center';ctx.font='10px Arial';ctx.fillStyle='#b9cbd2';ctx.fillText('Tap a color key with Fill, then color matching numbers. Zoom in for detail.',350,890);ctx.restore();
  }
  function drawPreview(ctx,id,size){
    const design=designFor(id);
    ctx.save();ctx.strokeStyle='#30344c';ctx.translate((size-WIDTH*size/HEIGHT)/2,0);ctx.scale(size/HEIGHT,size/HEIGHT);
    ctx.fillStyle='#142a39';ctx.fillRect(0,0,WIDTH,HEIGHT);
    for(const cell of cells(id))disc(ctx,cell.x,cell.y,RADIUS,design.palette[cell.n-1]);
    labels(ctx,id);ctx.restore();
  }
  function items(id,uid,src,x=70,y=178){
    designFor(id);
    return [
      {id:uid(),type:'shape',kind:'rectangle',x,y,w:WIDTH,h:HEIGHT,color:'#142a39',size:1,strokeStyle:'none',fillColor:'#142a39',fillOpacity:1},
      ...cells(id).map(cell=>({id:uid(),type:'shape',kind:'circle',x:x+cell.x-RADIUS,y:y+cell.y-RADIUS,w:RADIUS*2,h:RADIUS*2,color:'#a2adb5',size:.5,strokeStyle:'solid',fillColor:'#ffffff',fillOpacity:1})),
      {id:uid(),type:'image',x,y,w:WIDTH,h:HEIGHT,src,colorByNumber:id}
    ];
  }
  function paletteAt(id,x,y){
    const design=designFor(id);
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>WIDTH||y<0||y>HEIGHT)return null;
    for(let i=0;i<8;i++)if(x>=25+(i%4)*172&&x<=185+(i%4)*172&&Math.abs(y-(834+Math.floor(i/4)*31))<=14)return design.palette[i];
    return null;
  }
  return Object.freeze({DESIGNS,WIDTH,HEIGHT,COLS,ROWS,RADIUS,cells,labels,drawPreview,items,paletteAt});
});
