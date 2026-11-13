/* WiNDS Notes creative tools: reusable canvas drawing primitives.
 * Kept separate so Codex can extend pencil grades and filled figures without
 * touching the Apple Pencil pointer-event pipeline.
 */
(function (root, factory) {
  const art=(root&&root.WindsMandalaArt)||(typeof module!=='undefined'&&module.exports?require('./mandala-art.js'):null);
  const api = factory(art);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WindsCreative = api;
})(typeof window !== 'undefined' ? window : globalThis, function (ART) {
  'use strict';

  const ARTIST_COLLECTIONS=Object.freeze({graphite:'Graphite',ink:'Ink',pigment:'Pigment',paint:'Paint',effects:'Effects'});
  const extraArtistMaterials = {
    'Ballpoint Pen': {group:'ink',description:'Fine handwriting',detail:'Slim line with subtle pressure',
      profile:{kind:'ink',opacity:.9,width:.36,response:'technical'}},
    'Gel Pen': {group:'ink',description:'Smooth notes and outlines',detail:'Opaque, even line',
      profile:{kind:'ink',opacity:1,width:.66,response:'constant'}},
    'Dip Pen': {group:'ink',description:'Fine-to-bold lettering',detail:'Flexible nib with tapered strokes',
      profile:{kind:'ink',opacity:1,width:1.14,response:'fountain'}},
    'Calligraphy Nib': {group:'ink',description:'Italic and broad-edge lettering',detail:'Angled chisel tip',
      profile:{kind:'paint',opacity:1,width:1.65,grain:.08,softness:.1,spacing:.13,texture:'solid',squareTip:true,aspect:.29,angle:-.76,core:0,deposit:.78}},
    'Watercolor Wash': {group:'paint',description:'Transparent color washes',detail:'Soft, diffuse pigment',
      profile:{kind:'paint',opacity:.44,width:3.2,grain:.16,softness:.86,spacing:.32,texture:'wash',deposit:.34}},
    'Watercolor Edge': {group:'paint',description:'Watercolor with dark edges',detail:'Granulated pigment with a defined rim',
      profile:{kind:'paint',opacity:.62,width:2.8,grain:.35,softness:.22,spacing:.43,texture:'rim',deposit:.43}},
    Gouache: {group:'paint',description:'Matte color blocks',detail:'Dense, velvety paint',
      profile:{kind:'paint',opacity:.97,width:2.28,grain:.14,softness:.27,spacing:.22,texture:'matte',deposit:.62}},
    'Round Acrylic': {group:'paint',description:'Opaque detail and curves',detail:'Round tip with fine bristle marks',
      profile:{kind:'paint',opacity:1,width:1.72,grain:.32,softness:.16,spacing:.22,texture:'bristle',deposit:.62}},
    'Flat Acrylic': {group:'paint',description:'Square-edged strokes',detail:'Wide, flat bristle tip',
      profile:{kind:'paint',opacity:1,width:2.65,grain:.28,softness:.16,spacing:.27,texture:'bristle',squareTip:true,aspect:.5,angle:-.48,deposit:.65}},
    Filbert: {group:'paint',description:'Rounded petals and leaves',detail:'Soft oval bristle tip',
      profile:{kind:'paint',opacity:.87,width:2.32,grain:.26,softness:.35,spacing:.28,texture:'bristle',aspect:.56,angle:.35,deposit:.57}},
    'Fan Brush': {group:'paint',description:'Grass, hair and foliage',detail:'Separated bristle bands',
      profile:{kind:'paint',opacity:.91,width:2.95,grain:.45,softness:.18,spacing:.44,texture:'fan',aspect:.52,angle:-.9,deposit:.67}},
    'Oil Paint': {group:'paint',description:'Rich brush marks',detail:'Dense pigment with raised ridges',
      profile:{kind:'paint',opacity:1,width:2.5,grain:.35,softness:.17,spacing:.34,texture:'ridges',aspect:.76,deposit:.66}},
    'Palette Knife': {group:'paint',description:'Scraped strokes and blocks',detail:'Crisp edge with broken color',
      profile:{kind:'paint',opacity:1,width:2.92,grain:.45,softness:.1,spacing:.56,texture:'knife',squareTip:true,aspect:.38,angle:-.62,deposit:.8}},
    Sponge: {group:'paint',description:'Mottled color and foliage',detail:'Open pores and soft edges',
      profile:{kind:'paint',opacity:.84,width:2.96,grain:.63,softness:.35,spacing:.58,texture:'sponge',scatter:.17,deposit:.74}},
    Airbrush: {group:'effects',description:'Soft shading and gradients',detail:'Diffuse spray with no hard outline',
      profile:{kind:'effect',opacity:.37,width:3.52,grain:.14,softness:1,spacing:.36,texture:'air',core:0,deposit:.28}},
    'Ink Splatter': {group:'effects',description:'Scattered ink droplets',detail:'Irregular specks at several sizes',
      profile:{kind:'effect',opacity:.92,width:3.15,grain:.72,softness:.3,spacing:.87,texture:'splatter',scatter:.3,core:0,deposit:.9}},
    Stipple: {group:'effects',description:'Dotted texture and shadows',detail:'Fine, separated dots',
      profile:{kind:'effect',opacity:.87,width:2.15,grain:.76,softness:.16,spacing:.75,texture:'stipple',scatter:.12,core:0,deposit:.86}},
    'Grain Brush': {group:'effects',description:'Paper-grain shading',detail:'Broken pigment across the stroke',
      profile:{kind:'effect',opacity:.72,width:2.66,grain:.8,softness:.52,spacing:.52,texture:'grain',scatter:.18,core:0,deposit:.68}},
    Glitter: {group:'effects',description:'Sparkled accents',detail:'Fine grains and small starbursts',
      profile:{kind:'effect',opacity:.96,width:3,grain:.68,softness:.25,spacing:.8,texture:'glitter',scatter:.15,core:0,deposit:.95}},
    Hatching: {group:'effects',description:'Slanted shading marks',detail:'Parallel diagonal marks',
      profile:{kind:'effect',opacity:.98,width:2.45,grain:.21,softness:.16,spacing:1.02,texture:'hatch',squareTip:true,aspect:.83,angle:-.2,core:0,deposit:.84}}
  };

  // Brush profiles are deliberately cheap to render on iPad. A single stroke
  // uses deterministic texture: no bitmap allocation or storage in pen handlers.
  const PENCIL_GRADES = Object.freeze({
    '4H': Object.freeze({shade:'#7b838d', opacity:.24, width:.42, grain:.05, softness:.10, spacing:.20, kind:'graphite'}),
    '3H': Object.freeze({shade:'#707b86', opacity:.29, width:.49, grain:.06, softness:.11, spacing:.20, kind:'graphite'}),
    '2H': Object.freeze({shade:'#66717c', opacity:0.34, width:0.56, grain:0.07, softness:0.13, spacing:0.20, kind:'graphite'}),
    H: Object.freeze({shade:'#59626d', opacity:0.44, width:0.72, grain:0.10, softness:0.17, spacing:0.20, kind:'graphite'}),
    F: Object.freeze({shade:'#4e5965', opacity:.51, width:.84, grain:.12, softness:.19, spacing:.20, kind:'graphite'}),
    HB: Object.freeze({shade:'#414953', opacity:0.58, width:0.96, grain:0.15, softness:0.21, spacing:0.19, kind:'graphite'}),
    B: Object.freeze({shade:'#353d47', opacity:0.66, width:1.16, grain:0.19, softness:0.25, spacing:0.18, kind:'graphite'}),
    '2B': Object.freeze({shade:'#2d343e', opacity:0.76, width:1.46, grain:0.23, softness:0.29, spacing:0.18, kind:'graphite'}),
    '3B': Object.freeze({shade:'#29313a', opacity:.81, width:1.66, grain:.26, softness:.32, spacing:.17, kind:'graphite'}),
    '4B': Object.freeze({shade:'#252c35', opacity:0.85, width:1.86, grain:0.29, softness:0.34, spacing:0.17, kind:'graphite'}),
    '6B': Object.freeze({shade:'#1d242d', opacity:0.94, width:2.28, grain:0.34, softness:0.39, spacing:0.16, kind:'graphite'}),
    '8B': Object.freeze({shade:'#171d24', opacity:.98, width:2.62, grain:.40, softness:.44, spacing:.15, kind:'graphite'}),
    Charcoal: Object.freeze({shade:'#25262c', opacity:0.90, width:2.85, grain:0.58, softness:0.54, spacing:0.13, kind:'charcoal'}),
    'Vine Charcoal': Object.freeze({shade:'#525258', opacity:.56, width:2.45, grain:.72, softness:.67, spacing:.16, kind:'charcoal'}),
    'Compressed Charcoal': Object.freeze({shade:'#16181d', opacity:.98, width:3.05, grain:.43, softness:.36, spacing:.12, kind:'charcoal'}),
    Fineliner: Object.freeze({shade:'#1e2740', opacity:1, width:.48, grain:0, kind:'ink', colorMode:'ink', response:'technical'}),
    'Technical Pen': Object.freeze({shade:'#1e2740', opacity:1, width:.25, grain:0, kind:'ink', colorMode:'ink', response:'constant'}),
    'Fountain Pen': Object.freeze({shade:'#1e2740', opacity:1, width:.84, grain:0, kind:'ink', colorMode:'ink', response:'fountain'}),
    'Brush Marker': Object.freeze({shade:'#1e2740', opacity:1, width:2.10, grain:0, kind:'ink', colorMode:'ink', response:'marker'}),
    'Dry Brush': Object.freeze({shade:'#1e2740', opacity:.94, width:2.2, grain:.60, softness:.15, spacing:.12, kind:'drybrush', colorMode:'ink'}),
    'Soft Pastel': Object.freeze({shade:'#996c98', opacity:.77, width:2.75, grain:.58, softness:.48, spacing:.15, kind:'pastel', colorMode:'ink'}),
    'Oil Pastel': Object.freeze({shade:'#996c98', opacity:.95, width:2.2, grain:.26, softness:.16, spacing:.16, kind:'wax', colorMode:'ink'}),
    Chalk: Object.freeze({shade:'#687c96', opacity:.67, width:2.55, grain:.68, softness:.38, spacing:.14, kind:'chalk', colorMode:'ink'}),
    'Ink Brush': Object.freeze({shade:'#1e2740', opacity:1, width:1.48, grain:0, kind:'ink', colorMode:'ink'}),
    'Color Pencil': Object.freeze({shade:'#5a5b70', opacity:0.74, width:1.18, grain:0.32, softness:0.20, spacing:0.19, kind:'color', colorMode:'ink'}),
    ...Object.fromEntries(Object.entries(extraArtistMaterials).map(([name,{profile}])=>[name,Object.freeze({shade:'#1e2740',colorMode:'ink',...profile})]))
  });
  const ARTIST_MATERIALS = Object.freeze({
    "4H": Object.freeze({"group": "graphite", "description": "Pale construction", "detail": "Very light \u00b7 firm point"}),
    "3H": Object.freeze({"group": "graphite", "description": "Architectural studies", "detail": "Light \u00b7 precise point"}),
    "2H": Object.freeze({"group": "graphite", "description": "Fine construction", "detail": "Light \u00b7 fine point"}),
    "H": Object.freeze({"group": "graphite", "description": "Precise light lines", "detail": "Light \u00b7 controlled grain"}),
    "F": Object.freeze({"group": "graphite", "description": "Fine point drawing", "detail": "Balanced \u00b7 crisp edge"}),
    "HB": Object.freeze({"group": "graphite", "description": "Everyday sketch", "detail": "Balanced \u00b7 paper grain"}),
    "B": Object.freeze({"group": "graphite", "description": "Soft outlines", "detail": "Soft \u00b7 gentle shading"}),
    "2B": Object.freeze({"group": "graphite", "description": "Sketch shading", "detail": "Soft \u00b7 rich shading"}),
    "3B": Object.freeze({"group": "graphite", "description": "Tonal studies", "detail": "Rich \u00b7 soft grain"}),
    "4B": Object.freeze({"group": "graphite", "description": "Rich graphite", "detail": "Dark \u00b7 velvety shading"}),
    "6B": Object.freeze({"group": "graphite", "description": "Very dark shading", "detail": "Deep \u00b7 broad graphite"}),
    "8B": Object.freeze({"group": "graphite", "description": "Deep expressive shadows", "detail": "Darkest \u00b7 softest graphite"}),
    "Technical Pen": Object.freeze({"group": "ink", "description": "Precise technical line", "detail": "Constant width \u00b7 solid ink"}),
    "Fineliner": Object.freeze({"group": "ink", "description": "Clean drawing & hatching", "detail": "Steady width \u00b7 solid ink"}),
    "Fountain Pen": Object.freeze({"group": "ink", "description": "Fluid lettering", "detail": "Moderate pressure variation"}),
    "Ink Brush": Object.freeze({"group": "ink", "description": "Expressive colored ink", "detail": "Wide pressure variation"}),
    "Brush Marker": Object.freeze({"group": "ink", "description": "Bold illustration", "detail": "Broad \u00b7 controlled pressure"}),
    "Dry Brush": Object.freeze({"group": "ink", "description": "Broken bristle texture", "detail": "Textured \u00b7 dry ink"}),
    "Charcoal": Object.freeze({"group": "pigment", "description": "Broad textured marks", "detail": "Soft \u00b7 broken deposits"}),
    "Vine Charcoal": Object.freeze({"group": "pigment", "description": "Airy gesture drawing", "detail": "Light \u00b7 diffuse charcoal"}),
    "Compressed Charcoal": Object.freeze({"group": "pigment", "description": "Deep charcoal shadows", "detail": "Dense \u00b7 broad deposits"}),
    "Color Pencil": Object.freeze({"group": "pigment", "description": "Layered colored sketch", "detail": "Fine \u00b7 colored pigment"}),
    "Soft Pastel": Object.freeze({"group": "pigment", "description": "Powdery color studies", "detail": "Soft edges \u00b7 broken pigment"}),
    "Oil Pastel": Object.freeze({"group": "pigment", "description": "Dense waxy color", "detail": "Rich \u00b7 streaked pigment"}),
    "Chalk": Object.freeze({"group": "pigment", "description": "Grainy expressive marks", "detail": "Porous \u00b7 powder texture"}),
    ...Object.fromEntries(Object.entries(extraArtistMaterials).map(([name,{group,description,detail}])=>[name,Object.freeze({group,description,detail})]))
  });
  const STROKE_STYLES = new Set(['solid','dashed','dotted','none']);
  // Open paths in unit coordinates. Six numbers describe a cubic segment.
  const brace=[[1,0],[.12,0,.43,.21,.43,.33],[.43,.43,.3,.5,0,.5],[.3,.5,.43,.57,.43,.67],[.43,.79,.12,1,1,1]];
  const bracket=[[1,0],[0,0],[0,1],[1,1]];
  const paren=[[1,0],[-1/3,.25,-1/3,.75,1,1]];
  const angle=[[1,0],[0,.5],[1,1]];
  const floor=[[0,0],[0,1],[1,1]];
  const ceiling=[[1,0],[0,0],[0,1]];
  const horizontal=y=>[[0,y],[1,y]];
  const vertical=x=>[[x,0],[x,1]];
  const equals=[horizontal(.25),horizontal(.75)];
  const integral=[[1,0],[.15,-.03,.82,.55,.35,.82],[.24,.96,.15,1,0,1]];
  const wave=y=>[[0,y],[.35,y-.45,.65,y+.45,1,y]];
  const union=[[0,0],[0,.55],[0,1.15,1,1.15,1,.55],[1,0]];
  const elementOf=[[1,0],[.46,0],[0,0,0,.32,0,.5],[0,.68,0,1,.46,1],[1,1]];
  const mirror=(path,axis=0)=>path.map(entry=>entry.map((value,index)=>index%2===axis?1-value:value));
  const dot=(x,y)=>[[x,y],[x,y]];
  const oval=[[.5,0],[.78,0,1,.22,1,.5],[1,.78,.78,1,.5,1],[.22,1,0,.78,0,.5],[0,.22,.22,0,.5,0]];
  // The same paths drive the picker previews, notebook ink and hit tests.
  const MATH_GROUPS=[
    {label:'Brackets & grouping',symbols:{
      mathLeftBrace:['Left brace',.52,brace],mathRightBrace:['Right brace',.52,mirror(brace)],
      mathLeftBracket:['Left bracket',.52,bracket],mathRightBracket:['Right bracket',.52,mirror(bracket)],
      mathLeftParen:['Left parenthesis',.5,paren],mathRightParen:['Right parenthesis',.5,mirror(paren)],
      mathLeftAngle:['Left angle bracket',.54,angle],mathRightAngle:['Right angle bracket',.54,mirror(angle)],
      mathLeftFloor:['Left floor',.52,floor],mathRightFloor:['Right floor',.52,mirror(floor)],
      mathLeftCeiling:['Left ceiling',.52,ceiling],mathRightCeiling:['Right ceiling',.52,mirror(ceiling)],
      mathAbsolute:['Absolute value bar',1,vertical(.5)],mathNorm:['Norm bars',.44,vertical(0),vertical(1)]
    }},
    {label:'Operations & comparisons',symbols:{
      mathPlus:['Plus',1,horizontal(.5),vertical(.5)],mathMinus:['Minus',1,horizontal(.5)],
      mathTimes:['Multiply',1,[[0,0],[1,1]],[[1,0],[0,1]]],
      mathDivide:['Divide',1,horizontal(.5),dot(.5,.12),dot(.5,.88)],
      mathPlusMinus:['Plus or minus',1,horizontal(.3),[[.5,0],[.5,.6]],horizontal(1)],
      mathFraction:['Fraction bar',1,horizontal(.5)],mathEquals:['Equals',1,...equals],
      mathNotEqual:['Not equal',1,...equals,[[.76,0],[.24,1]]],
      mathApprox:['Approximately equal',1,wave(.25),wave(.75)],
      mathIdentical:['Identical to',1,horizontal(.14),horizontal(.5),horizontal(.86)],
      mathLess:['Less than',1,angle],mathGreater:['Greater than',1,mirror(angle)],
      mathLessEqual:['Less than or equal',1,[[1,0],[0,.34],[1,.68]],horizontal(1)],
      mathGreaterEqual:['Greater than or equal',1,[[0,0],[1,.34],[0,.68]],horizontal(1)],
      mathRoot:['Square root',1,[[0,.62],[.14,.55],[.28,1],[.48,0],[1,0]]]
    }},
    {label:'Calculus & sets',symbols:{
      mathSum:['Summation',.9,[[1,0],[0,0],[.55,.5],[0,1],[1,1]]],
      mathProduct:['Product',.9,horizontal(0),vertical(.18),vertical(.82)],
      mathIntegral:['Integral',.52,integral],
      mathDoubleIntegral:['Double integral',.7,integral.map(entry=>entry.map((value,index)=>index%2?value:value*.6)),
        integral.map(entry=>entry.map((value,index)=>index%2?value:.4+value*.6))],
      mathInfinity:['Infinity',1,[[.5,.5],[.32,.05,.24,.08,.17,.08],[0,.08,0,.35,0,.5],[0,.65,0,.92,.17,.92],
        [.32,.92,.4,.72,.5,.5],[.68,.05,.76,.08,.83,.08],[1,.08,1,.35,1,.5],[1,.65,1,.92,.83,.92],[.68,.92,.6,.72,.5,.5]]],
      mathPi:['Pi',1,[[0,.23],[.04,.12,.12,.12,.23,.12],[1,.12]],[[.36,.12],[.36,.48,.31,.74,.19,.98]],
        [[.74,.12],[.68,.34,.62,.65,.65,.86],[.67,1,.84,1,.95,.86]]],
      mathDelta:['Delta',.94,[[0,1],[.5,0],[1,1],[0,1]]],
      mathUnion:['Union',.94,union],mathIntersection:['Intersection',.94,mirror(union,1)],
      mathElement:['Element of',1,elementOf,horizontal(.5)],
      mathNotElement:['Not an element of',1,elementOf,horizontal(.5),[[.77,0],[.23,1]]],
      mathSubset:['Subset of',1,elementOf],mathSuperset:['Superset of',1,mirror(elementOf)],
      mathEmptySet:['Empty set',.88,oval,[[0,1],[1,0]]]
    }}
  ];
  const MATH_SYMBOLS=new Map(MATH_GROUPS.flatMap(({symbols})=>Object.entries(symbols)));
  const isMathShape=kind=>MATH_SYMBOLS.has(kind);
  function mathDragSize(delta){
    return Math.max(16,Math.abs(delta))*(delta<0?-1:1);
  }
  const MATH_SHAPE_GROUPS=Object.freeze(MATH_GROUPS.map(({label,symbols})=>Object.freeze({
    label,shapes:Object.freeze(Object.fromEntries(Object.entries(symbols).map(([kind,[name]])=>[kind,name])))
  })));
  const SHAPE_GROUPS = Object.freeze([
    {label:'Basic',shapes:{rectangle:'Rectangle',roundedRectangle:'Rounded rectangle',square:'Square',ellipse:'Ellipse',circle:'Circle',semicircle:'Semicircle'}},
    {label:'Polygons',shapes:{triangle:'Triangle',rightTriangle:'Right triangle',diamond:'Diamond',trapezoid:'Trapezoid',parallelogram:'Parallelogram',pentagon:'Pentagon',hexagon:'Hexagon',octagon:'Octagon'}},
    {label:'Symbols',shapes:{star:'Star',heart:'Heart',cross:'Cross',speechBubble:'Speech bubble',chevron:'Chevron',shield:'Shield'}},
    {label:'Lines & arrows',shapes:{line:'Line',arrow:'Arrow'}}
  ].map(group=>Object.freeze({...group,shapes:Object.freeze(group.shapes)})));
  const SHAPE_NAMES = Object.freeze(Object.assign({},...[...SHAPE_GROUPS,...MATH_SHAPE_GROUPS].map(group=>group.shapes)));
  const isShapeKind = kind => Object.prototype.hasOwnProperty.call(SHAPE_NAMES,kind);
  const isFillableShape = kind => isShapeKind(kind)&&kind!=='line'&&kind!=='arrow'&&!isMathShape(kind);
  const shapeStrokeStyle=(kind,style)=>STROKE_STYLES.has(style)&&!(isMathShape(kind)&&style==='none')?style:'solid';
  // Each outline uses unit coordinates. A six-value entry is a cubic curve.
  const SHAPE_OUTLINES = new Map(Object.entries({
    roundedRectangle:[[.16,0],[.84,0],[.93,0,1,.07,1,.16],[1,.84],[1,.93,.93,1,.84,1],[.16,1],[.07,1,0,.93,0,.84],[0,.16],[0,.07,.07,0,.16,0]],
    semicircle:[[0,1],[0,.448,.224,0,.5,0],[.776,0,1,.448,1,1]],
    rightTriangle:[[0,0],[1,1],[0,1]],
    trapezoid:[[.22,0],[.78,0],[1,1],[0,1]],
    parallelogram:[[.24,0],[1,0],[.76,1],[0,1]],
    pentagon:[[.5,0],[1,.38],[.81,1],[.19,1],[0,.38]],
    hexagon:[[.25,0],[.75,0],[1,.5],[.75,1],[.25,1],[0,.5]],
    octagon:[[.29,0],[.71,0],[1,.29],[1,.71],[.71,1],[.29,1],[0,.71],[0,.29]],
    heart:[[.5,.2],[.34,-.13,0,.01,0,.3],[0,.54,.25,.81,.5,1],[.75,.81,1,.54,1,.3],[1,.01,.66,-.13,.5,.2]],
    cross:[[.34,0],[.66,0],[.66,.34],[1,.34],[1,.66],[.66,.66],[.66,1],[.34,1],[.34,.66],[0,.66],[0,.34],[.34,.34]],
    speechBubble:[[.12,0],[.88,0],[.95,0,1,.05,1,.12],[1,.6],[1,.67,.95,.72,.88,.72],[.46,.72],[.22,1],[.27,.72],[.12,.72],[.05,.72,0,.67,0,.6],[0,.12],[0,.05,.05,0,.12,0]],
    chevron:[[0,0],[.57,0],[1,.5],[.57,1],[0,1],[.43,.5]],
    shield:[[0,.13],[.5,0],[1,.13],[1,.49],[1,.75,.75,.9,.5,1],[.25,.9,0,.75,0,.49]]
  }));
  function outlineIcon(outline,width=18){
    return outline.map((entry,i)=>`${i===0?'M':entry.length===6?'C':'L'}${entry.map((n,j)=>
      +(j%2?3+n*18:12+(n-.5)*width).toFixed(2)).join(' ')}`).join(' ');
  }
  const SHAPE_ICONS = new Map([
    ...[...SHAPE_OUTLINES].map(([kind,outline])=>[kind,`<path d="${outlineIcon(outline)}Z"/>`]),
    ...[...MATH_SYMBOLS].map(([kind,[,aspect,...paths]])=>[kind,`<path d="${paths.map(path=>outlineIcon(path,18*aspect)).join(' ')}"/>`])
  ]);
  const shapeIcon = kind => SHAPE_ICONS.get(kind);
  function outlineVertices(outline){
    // Sample curves once so hit testing follows the same outline as painting.
    const vertices=[outline[0]];
    for(const entry of outline.slice(1)){
      if(entry.length===2){vertices.push(entry);continue;}
      const [x,y]=vertices[vertices.length-1], [a,b,c,d,ex,ey]=entry;
      for(let i=1;i<=24;i++){
        const t=i/24,u=1-t;
        vertices.push([u*u*u*x+3*u*u*t*a+3*u*t*t*c+t*t*t*ex,u*u*u*y+3*u*u*t*b+3*u*t*t*d+t*t*t*ey]);
      }
    }
    return vertices;
  }
  const SHAPE_VERTICES = new Map([...SHAPE_OUTLINES].map(([kind,outline])=>[kind,outlineVertices(outline)]));
  const MATH_VERTICES = new Map([...MATH_SYMBOLS].map(([kind,[,,...paths]])=>[kind,paths.map(outlineVertices)]));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const midpoint = (a,b) => [(a[0]+b[0])*0.5, (a[1]+b[1])*0.5];

  const rotatable = item => ['image','sticker','shape','vector'].includes(item?.type);
  function objectRotation(item) {
    return rotatable(item)&&Number.isFinite(item.rotation)?((item.rotation%360)+360)%360:0;
  }
  function objectRect(item) {
    return {x:item.x,y:item.y,w:item.type==='sticker'?(item.size||78):item.w,h:item.type==='sticker'?(item.size||78):item.h};
  }
  function setStickerFont(ctx,size){
    ctx.textBaseline='top';
    ctx.textAlign='left';
    ctx.font=`${size}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`;
  }
  function drawSticker(ctx,item){
    setStickerFont(ctx,item.size||78);
    ctx.fillText(item.emoji,item.x,item.y);
  }
  const stickerFrames=new Map();
  let stickerMeasureContext;
  function stickerSelectionBounds(item){
    const bounds=objectRect(item);
    if(!stickerFrames.has(item.emoji)){
      if(stickerMeasureContext===undefined){
        stickerMeasureContext=typeof document==='undefined'?null:document.createElement('canvas').getContext('2d');
      }
      if(!stickerMeasureContext)return bounds;
      const referenceSize=128;
      setStickerFont(stickerMeasureContext,referenceSize);
      const {actualBoundingBoxLeft:left,actualBoundingBoxRight:right,
        actualBoundingBoxAscent:ascent,actualBoundingBoxDescent:descent}=stickerMeasureContext.measureText(item.emoji);
      const inkWidth=left+right,inkHeight=ascent+descent;
      let frame=null;
      if([left,right,ascent,descent].every(Number.isFinite)&&inkWidth>0&&inkHeight>0){
        const side=Math.max(inkWidth,inkHeight)+2;
        frame={x:(right-left-side)/2/referenceSize,y:(descent-ascent-side)/2/referenceSize,side:side/referenceSize};
      }
      if(stickerFrames.size>=128)stickerFrames.delete(stickerFrames.keys().next().value);
      stickerFrames.set(item.emoji,frame);
    }
    const frame=stickerFrames.get(item.emoji);
    if(!frame)return bounds;
    const size=bounds.w;
    return {x:item.x+frame.x*size,y:item.y+frame.y*size,w:frame.side*size,h:frame.side*size};
  }
  function resizeSticker(item,size,corner){
    const resized={...item,size:clamp(size,16,1600)};
    const anchor=sticker=>{
      const b=stickerSelectionBounds(sticker);
      return objectPoint(sticker,{x:corner.includes('w')?b.x+b.w:b.x,y:corner.includes('n')?b.y+b.h:b.y});
    };
    const before=anchor(item),after=anchor(resized);
    return {...resized,x:item.x+before.x-after.x,y:item.y+before.y-after.y};
  }
  function objectPoint(item,point,inverse=false) {
    const rotation=objectRotation(item);if(!rotation)return point;
    const b=objectRect(item),cx=b.x+b.w/2,cy=b.y+b.h/2;
    const angle=rotation*Math.PI/180*(inverse?-1:1),cos=Math.cos(angle),sin=Math.sin(angle);
    const dx=point.x-cx,dy=point.y-cy;
    return {x:cx+dx*cos-dy*sin,y:cy+dx*sin+dy*cos};
  }
  function rotateContext(ctx,item) {
    const rotation=objectRotation(item);if(!rotation)return;
    const b=objectRect(item),cx=b.x+b.w/2,cy=b.y+b.h/2;
    ctx.translate(cx,cy);ctx.rotate(rotation*Math.PI/180);ctx.translate(-cx,-cy);
  }
  function positionObjectRect(original,resized) {
    if(!objectRotation(original))return resized;
    const b=objectRect(resized),center=objectPoint(original,{x:b.x+b.w/2,y:b.y+b.h/2});
    return {...resized,x:center.x-b.w/2,y:center.y-b.h/2};
  }
  function rotationFromDrag(item,start,point,snap=false){
    const b=objectRect(item),cx=b.x+b.w/2,cy=b.y+b.h/2;
    if(Math.hypot(point.x-cx,point.y-cy)<1)return objectRotation(item);
    const delta=Math.atan2(point.y-cy,point.x-cx)-Math.atan2(start.y-cy,start.x-cx);
    const degrees=objectRotation(item)+delta*180/Math.PI;
    return objectRotation({...item,rotation:snap?Math.round(degrees/15)*15:degrees});
  }

  const FULL_CROP = Object.freeze({x:0,y:0,w:1,h:1});
  function pageBackgroundRect(background,dimensions){
    const scale=Math.min(dimensions.width/background.width,dimensions.height/background.height),w=background.width*scale,h=background.height*scale;
    return {x:(dimensions.width-w)/2,y:(dimensions.height-h)/2,w,h};
  }
  function imageCrop(crop) {
    if(!crop || !['x','y','w','h'].every(k=>Number.isFinite(crop[k])))return {...FULL_CROP};
    const x=clamp(crop.x,0,.99),y=clamp(crop.y,0,.99);
    return {x,y,w:clamp(crop.w,.01,1-x),h:clamp(crop.h,.01,1-y)};
  }
  function dragImageCrop(crop,corner,dx,dy) {
    const next=imageCrop(crop),right=next.x+next.w,bottom=next.y+next.h;
    if(corner==='move')return {...next,x:clamp(next.x+dx,0,1-next.w),y:clamp(next.y+dy,0,1-next.h)};
    if(corner.includes('w')){next.x=clamp(next.x+dx,0,right-.01);next.w=right-next.x;}
    if(corner.includes('e'))next.w=clamp(next.w+dx,.01,1-next.x);
    if(corner.includes('n')){next.y=clamp(next.y+dy,0,bottom-.01);next.h=bottom-next.y;}
    if(corner.includes('s'))next.h=clamp(next.h+dy,.01,1-next.y);
    return next;
  }
  function cropImage(item,crop,maxDimension=2200) {
    const old=imageCrop(item.crop),next=imageCrop(crop);
    const fullWidth=item.w/old.w,fullHeight=item.h/old.h;
    const scale=Math.min(1,maxDimension/(fullWidth*next.w),maxDimension/(fullHeight*next.h));
    const result={...item,x:item.x+(next.x-old.x)*fullWidth,y:item.y+(next.y-old.y)*fullHeight,
      w:fullWidth*next.w*scale,h:fullHeight*next.h*scale};
    if(item.erasures?.length)result.erasures=item.erasures.map(mask=>({rx:mask.rx*old.w/next.w,ry:mask.ry*old.h/next.h,points:mask.points.map(([u,v])=>[(old.x+u*old.w-next.x)/next.w,(old.y+v*old.h-next.y)/next.h])}));
    if(next.x===0 && next.y===0 && next.w===1 && next.h===1)delete result.crop;
    else result.crop=next;
    return positionObjectRect(item,result);
  }
  // Object-relative masks retain editable source data and follow move/resize/rotation.
  function erasurePath(points,radius,bounds,localPoint=p=>p){
    const w=Math.max(1,bounds.w),h=Math.max(1,bounds.h);
    return {rx:radius/w,ry:radius/h,points:points.map(point=>{const p=localPoint(point);return [(p.x-bounds.x)/w,(p.y-bounds.y)/h];})};
  }
  function erasedAt(item,bounds,point){
    if(!item.erasures?.length)return false;const p=objectPoint(item,point,true),u=(p.x-bounds.x)/Math.max(1,bounds.w),v=(p.y-bounds.y)/Math.max(1,bounds.h);
    for(const mask of item.erasures){const x=u/mask.rx,y=v/mask.ry;
      for(let i=0;i<mask.points.length;i++){const a=mask.points[Math.max(0,i-1)],b=mask.points[i],ax=a[0]/mask.rx,ay=a[1]/mask.ry,dx=b[0]/mask.rx-ax,dy=b[1]/mask.ry-ay,t=dx*dx+dy*dy?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy))):0;if(Math.hypot(x-ax-t*dx,y-ay-t*dy)<=1)return true;}
    }return false;
  }
  let eraserSurface=null;
  function eraserLayer(width,height){
    if(!eraserSurface)eraserSurface=document.createElement('canvas');
    // Reuse one surface; Safari can retain backing stores of discarded canvases.
    for(const factor of [1,.5,.25]){
      const w=Math.max(1,Math.floor(width*factor)),h=Math.max(1,Math.floor(height*factor));
      if(eraserSurface.width!==w||eraserSurface.height!==h){eraserSurface.width=1;eraserSurface.height=h;eraserSurface.width=w;}
      const layer=eraserSurface.getContext('2d');if(layer)return {canvas:eraserSurface,layer};
      eraserSurface.width=eraserSurface.height=1;
    }
    eraserSurface=null;const error=Error('Not enough drawing memory. Close other browser tabs and reopen this notebook.');error.code='CANVAS_MEMORY';throw error;
  }
  function drawErasedItem(ctx,item,bounds,visualBounds,drawSource){
    const pad=['shape','vector'].includes(item.type)?Math.max(2,(item.size||1)/2+2):2;
    const box={x:visualBounds.x-pad,y:visualBounds.y-pad,w:visualBounds.w+pad*2,h:visualBounds.h+pad*2};
    const t=typeof ctx.getTransform==='function'?ctx.getTransform():{a:2,b:0,c:0,d:2},resolution=Math.max(.2,Math.hypot(t.a,t.b),Math.hypot(t.c,t.d));
    const ratio=Math.min(resolution,4096/box.w,4096/box.h,Math.sqrt(4194304/(box.w*box.h)));
    const {canvas,layer}=eraserLayer(box.w*ratio,box.h*ratio);
    layer.setTransform(1,0,0,1,0,0);layer.clearRect(0,0,canvas.width,canvas.height);layer.globalCompositeOperation='source-over';layer.globalAlpha=1;
    layer.setTransform(canvas.width/box.w,0,0,canvas.height/box.h,-box.x*canvas.width/box.w,-box.y*canvas.height/box.h);
    drawSource(layer,item);layer.globalCompositeOperation='destination-out';layer.globalAlpha=1;layer.strokeStyle=layer.fillStyle='#000';layer.lineWidth=2;layer.lineCap=layer.lineJoin='round';
    for(const mask of item.erasures){
      layer.save();rotateContext(layer,item);layer.translate(bounds.x,bounds.y);layer.scale(Math.max(1,bounds.w)*mask.rx,Math.max(1,bounds.h)*mask.ry);layer.beginPath();
      const first=mask.points[0];if(mask.points.length===1){layer.arc(first[0]/mask.rx,first[1]/mask.ry,1,0,Math.PI*2);layer.fill();}
      else{layer.moveTo(first[0]/mask.rx,first[1]/mask.ry);for(let i=1;i<mask.points.length;i++)layer.lineTo(mask.points[i][0]/mask.rx,mask.points[i][1]/mask.ry);layer.stroke();}
      layer.restore();
    }
    // Composite only this object's pixels. Holes reveal other items and the paper.
    ctx.drawImage(canvas,box.x,box.y,box.w,box.h);
  }
  function drawImage(ctx,item,image) {
    const crop=imageCrop(item.crop);
    ctx.drawImage(image,crop.x*image.naturalWidth,crop.y*image.naturalHeight,
      crop.w*image.naturalWidth,crop.h*image.naturalHeight,item.x,item.y,item.w,item.h);
  }

  function penWidth(item,point) {
    const pressure=clamp(Number.isFinite(point?.[2])?point[2]:.68,.1,1);
    return Math.max(.85,(item.size||3)*(.45+.55*pressure));
  }
  function penMidpoint(item,a,b) {
    return {x:(a[0]+b[0])*.5,y:(a[1]+b[1])*.5,r:(penWidth(item,a)+penWidth(item,b))*.25};
  }
  function penPoint(item,p) {return {x:p[0],y:p[1],r:penWidth(item,p)*.5};}
  function penCurve(item,points,index,finish=false) {
    if(points.length<2)return null;
    if(finish){const a=points[points.length-2],b=points[points.length-1];return {a:penMidpoint(item,a,b),b:penPoint(item,b)};}
    if(index===1)return {a:penPoint(item,points[0]),b:penMidpoint(item,points[0],points[1])};
    const a=points[index-2],b=points[index-1],c=points[index];
    return {a:penMidpoint(item,a,b),control:penPoint(item,b),b:penMidpoint(item,b,c)};
  }
  function drawPenCurve(ctx,curve,startCap=true,endCap=true) {
    const {a,b}=curve,c=curve.control||{x:(a.x+b.x)*.5,y:(a.y+b.y)*.5,r:(a.r+b.r)*.5};
    const length=Math.hypot(c.x-a.x,c.y-a.y)+Math.hypot(b.x-c.x,b.y-c.y);
    if(length<1e-8){if(startCap||endCap){ctx.beginPath();ctx.arc(b.x,b.y,Math.max(a.r,b.r),0,Math.PI*2);ctx.fill();}return;}
    const vx=c.x-a.x,vy=c.y-a.y,dx=b.x-2*c.x+a.x,dy=b.y-2*c.y+a.y,den=dx*dx+dy*dy;
    if(den>1e-12 && vx*(b.x-c.x)+vy*(b.y-c.y)<0){
      const t=-(vx*dx+vy*dy)/den;
      if(t>1e-6 && t<1-1e-6 && Math.hypot(vx+t*dx,vy+t*dy)<1e-7){
        // Split an exact reversal at its stationary point so its tip gets a
        // round cap instead of a collapsed normal or a self-crossing ribbon.
        const mix=(p,q)=>({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,r:p.r+(q.r-p.r)*t});
        const left=mix(a,c),right=mix(c,b),turn=mix(left,right);
        drawPenCurve(ctx,{a,control:left,b:turn},startCap,true);drawPenCurve(ctx,{a:turn,control:right,b},true,endCap);return;
      }
    }
    // Bounded, incremental work: only the new curve is sampled, never the page.
    const steps=clamp(Math.ceil(length/2),2,32),left=[],right=[];
    let startAngle=0,endAngle=0;
    for(let i=0;i<=steps;i++){
      const t=i/steps,u=1-t,x=u*u*a.x+2*u*t*c.x+t*t*b.x,y=u*u*a.y+2*u*t*c.y+t*t*b.y;
      const r=u*u*a.r+2*u*t*c.r+t*t*b.r;
      let dx=u*(c.x-a.x)+t*(b.x-c.x),dy=u*(c.y-a.y)+t*(b.y-c.y);
      if(Math.hypot(dx,dy)<1e-8){dx=b.x-a.x;dy=b.y-a.y;}
      const len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
      left.push([x+nx*r,y+ny*r]);right.push([x-nx*r,y-ny*r]);
      if(i===0)startAngle=Math.atan2(ny,nx);if(i===steps)endAngle=Math.atan2(ny,nx);
    }
    // A filled ribbon varies width continuously. Adjacent curves share the
    // same endpoint radius, rather than stacking different-width line caps.
    ctx.beginPath();ctx.moveTo(...left[0]);
    for(let i=1;i<left.length;i++)ctx.lineTo(...left[i]);
    if(endCap)ctx.arc(b.x,b.y,b.r,endAngle,endAngle-Math.PI,true);else ctx.lineTo(...right[right.length-1]);
    for(let i=right.length-2;i>=0;i--)ctx.lineTo(...right[i]);
    if(startCap)ctx.arc(a.x,a.y,a.r,startAngle-Math.PI,startAngle-2*Math.PI,true);else ctx.lineTo(...left[0]);
    ctx.closePath();ctx.fill();
  }
  function tracePenDisc(ctx,{x,y,r}) {
    ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,Math.PI*2);ctx.closePath();
  }
  function tracePenSweep(ctx,a,b) {
    const dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy),radiusDelta=a.r-b.r;
    if(distance<=Math.abs(radiusDelta)+1e-8){
      tracePenDisc(ctx,a.r>=b.r?a:b);
      return;
    }
    // The sides touch both discs tangentially, even as pressure changes.
    // A perpendicular side with a cap at each sample leaves a visible ridge.
    const direction=Math.atan2(dy,dx),offset=Math.acos(radiusDelta/distance);
    const lower=direction-offset,upper=direction+offset;
    const lx=Math.cos(lower),ly=Math.sin(lower),ux=Math.cos(upper),uy=Math.sin(upper);
    ctx.moveTo(a.x+a.r*lx,a.y+a.r*ly);
    ctx.lineTo(b.x+b.r*lx,b.y+b.r*ly);
    ctx.arc(b.x,b.y,b.r,lower,upper);
    ctx.lineTo(a.x+a.r*ux,a.y+a.r*uy);
    ctx.arc(a.x,a.y,a.r,upper,lower+Math.PI*2);
    ctx.closePath();
  }
  function drawPenSweep(ctx,curve) {
    if(!curve)return;
    const {a,b,control}=curve;
    ctx.beginPath();
    if(!control){
      tracePenSweep(ctx,a,b);
    }else{
      // Subdivide by how far the curve and pressure depart from a straight
      // interpolation. Straight samples and long, straight tails stay cheap.
      const bend=Math.hypot(a.x-2*control.x+b.x,a.y-2*control.y+b.y)+Math.abs(a.r-2*control.r+b.r);
      const steps=clamp(Math.ceil(Math.sqrt(bend/.32)),1,24);
      let previous=a;
      for(let i=1;i<steps;i++){
        const t=i/steps,u=1-t;
        const next={
          x:u*u*a.x+2*u*t*control.x+t*t*b.x,
          y:u*u*a.y+2*u*t*control.y+t*t*b.y,
          r:u*u*a.r+2*u*t*control.r+t*t*b.r
        };
        tracePenSweep(ctx,previous,next);previous=next;
      }
      tracePenSweep(ctx,previous,b);
    }
    // Same-winding sweeps fill together, including tight loops and reversals.
    ctx.fill();
  }
  function drawPenPart(ctx,item,points,index) {
    if(index===0){ctx.beginPath();tracePenDisc(ctx,penPoint(item,points[0]));ctx.fill();return;}
    drawPenSweep(ctx,penCurve(item,points,index));
  }
  function drawPenEnd(ctx,item,points) {
    drawPenSweep(ctx,penCurve(item,points,0,true));
  }

  function shapeBox({x,y,w,h}) {
    return {left:x+Math.min(0,w),top:y+Math.min(0,h),width:Math.abs(w),height:Math.abs(h)};
  }
  function traceOutline(ctx,outline,{left,top,width,height}){
    ctx.moveTo(left+outline[0][0]*width,top+outline[0][1]*height);
    for(const [a,b,c,d,ex,ey] of outline.slice(1)){
      if(c!==undefined)ctx.bezierCurveTo(left+a*width,top+b*height,left+c*width,top+d*height,left+ex*width,top+ey*height);
      else ctx.lineTo(left+a*width,top+b*height);
    }
  }
  function shapePath(ctx, item) {
    const {x,y,w,h} = item;
    const math=MATH_SYMBOLS.get(item.kind);
    const outline=SHAPE_OUTLINES.get(item.kind);
    ctx.beginPath();
    if(math){
      const box=shapeBox(item);
      for(let i=2;i<math.length;i++)traceOutline(ctx,math[i],box);
    }
    else if(outline){
      traceOutline(ctx,outline,shapeBox(item));
      ctx.closePath();
    }
    else if(item.kind==='rectangle' || item.kind==='square') ctx.rect(x,y,w,h);
    else if(item.kind==='ellipse' || item.kind==='circle') ctx.ellipse(x+w/2,y+h/2,Math.max(0.1,Math.abs(w/2)),Math.max(0.1,Math.abs(h/2)),0,0,Math.PI*2);
    else if(item.kind==='triangle') {
      ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.closePath();
    } else if(item.kind==='diamond') {
      ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h/2);ctx.lineTo(x+w/2,y+h);ctx.lineTo(x,y+h/2);ctx.closePath();
    } else if(item.kind==='star') {
      // Independent radii allow landscape as well as portrait star figures.
      const cx=x+w/2, cy=y+h/2, rx=Math.max(.1,Math.abs(w)/2), ry=Math.max(.1,Math.abs(h)/2);
      for(let i=0;i<10;i++){
        const a=-Math.PI/2+i*Math.PI/5, r=i%2?.44:1;
        const px=cx+Math.cos(a)*rx*r, py=cy+Math.sin(a)*ry*r;
        if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(x,y);ctx.lineTo(x+w,y+h);
      if(item.kind==='arrow') {
        const angle=Math.atan2(h,w),len=Math.min(25,Math.max(12,(item.size||3)*5));
        const ex=x+w,ey=y+h;
        ctx.moveTo(ex-len*Math.cos(angle-.58),ey-len*Math.sin(angle-.58));
        ctx.lineTo(ex,ey);ctx.lineTo(ex-len*Math.cos(angle+.58),ey-len*Math.sin(angle+.58));
      }
    }
  }

  function shapeHit(item,point,tolerance=8){
    if(shapeStrokeStyle(item.kind,item.strokeStyle)==='none'&&(!item.fillColor||item.fillOpacity===0))return false;
    const {x,y,w,h}=item,px=point.x,py=point.y,reach=tolerance+(item.size||3)/2;
    const segment=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(px-a[0]-t*dx,py-a[1]-t*dy)<=reach;};
    const math=MATH_VERTICES.get(item.kind);
    if(math){
      const {left,top,width,height}=shapeBox(item);
      return math.some(path=>{
        const vertices=path.map(([u,v])=>[left+u*width,top+v*height]);
        return vertices.some((point,index)=>index>0&&segment(vertices[index-1],point));
      });
    }
    if(item.kind==='line'||item.kind==='arrow'){
      if(segment([x,y],[x+w,y+h]))return true;
      if(item.kind==='line')return false;
      const angle=Math.atan2(h,w),length=Math.min(25,Math.max(12,(item.size||3)*5));
      return [-.58,.58].some(delta=>segment([x+w,y+h],[x+w-length*Math.cos(angle+delta),y+h-length*Math.sin(angle+delta)]));
    }
    if(item.kind==='ellipse'||item.kind==='circle'){
      const rx=Math.max(.1,Math.abs(w)/2),ry=Math.max(.1,Math.abs(h)/2);
      return Math.hypot((px-x-w/2)/rx,(py-y-h/2)/ry)<=1+reach/Math.min(rx,ry);
    }
    const custom=SHAPE_VERTICES.get(item.kind);
    let vertices;
    if(custom){
      const {left,top,width,height}=shapeBox(item);
      vertices=custom.map(([u,v])=>[left+u*width,top+v*height]);
    }
    else if(item.kind==='triangle')vertices=[[x+w/2,y],[x+w,y+h],[x,y+h]];
    else if(item.kind==='diamond')vertices=[[x+w/2,y],[x+w,y+h/2],[x+w/2,y+h],[x,y+h/2]];
    else if(item.kind==='star')vertices=Array.from({length:10},(_,i)=>{const angle=-Math.PI/2+i*Math.PI/5,r=i%2?.44:1;return [x+w/2+Math.cos(angle)*Math.abs(w)/2*r,y+h/2+Math.sin(angle)*Math.abs(h)/2*r];});
    else vertices=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
    let inside=false;
    for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
      const a=vertices[j],b=vertices[i];if(segment(a,b))return true;
      if((a[1]>py)!==(b[1]>py)&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  }
  function drawShape(ctx,item) {
    ctx.save();
    ctx.lineWidth=item.size||3;ctx.strokeStyle=item.color||'#2b2d4c';
    ctx.lineJoin='round';ctx.lineCap='round';
    shapePath(ctx,item);
    if(isFillableShape(item.kind) && typeof item.fillColor==='string' && /^#[0-9a-fA-F]{6}$/.test(item.fillColor)) {
      ctx.save();ctx.fillStyle=item.fillColor;
      ctx.globalAlpha=clamp(Number.isFinite(item.fillOpacity)?item.fillOpacity:1,0,1);
      ctx.fill();ctx.restore();
    }
    const style=shapeStrokeStyle(item.kind,item.strokeStyle);
    if(style!=='none'){
      if(style==='dashed')ctx.setLineDash([Math.max(5,ctx.lineWidth*3),Math.max(4,ctx.lineWidth*2)]);
      else if(style==='dotted')ctx.setLineDash([Math.max(1,ctx.lineWidth*.2),Math.max(4,ctx.lineWidth*1.8)]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function pencilGrade(grade) { return PENCIL_GRADES[artistGradeName(grade)]; }
  function artistGradeName(grade){return Object.prototype.hasOwnProperty.call(PENCIL_GRADES,grade)?grade:'HB';}
  function pressureAt(pt) { return clamp(Number.isFinite(pt?.[2])?pt[2]:.68,.03,1); }
  function hash(id,index,salt){
    let n=(index+1)*2654435761 ^ (salt+1)*2246822519;
    const s=String(id||'');for(let k=0;k<s.length;k++) n=Math.imul(n ^ s.charCodeAt(k),16777619);
    n^=n>>>16;n=Math.imul(n,2246822519);n^=n>>>13;
    return (n>>>0)/4294967295;
  }
  function grainNoise(x,y,seed){
    let n=Math.imul(x+1,374761393)^Math.imul(y+1,668265263)^seed;
    n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
  }
  function artistPigment(item){
    const settings=pencilGrade(item.grade);
    return settings.colorMode==='ink' && /^#[0-9a-fA-F]{6}$/.test(item.color||'')?item.color:settings.shade;
  }
  function pencilWidth(item,pressure){
    const settings=pencilGrade(item.grade),p=clamp(Number.isFinite(pressure)?pressure:.68,.03,1);
    const response=settings.response==='constant'?1:settings.response==='technical'?.92+.16*p:settings.response==='fountain'?.34+1.06*Math.pow(p,1.1):settings.response==='marker'?.65+.75*Math.pow(p,.75):settings.kind==='ink'?.08+1.42*Math.pow(p,1.55):.28+.98*Math.pow(p,.8);
    return Math.max(settings.kind==='ink'?.35:.42,(item.size||3)*settings.width*response);
  }
  function artistBoundsPadding(item){return pencilWidth(item,1)*(pencilGrade(item.grade).squareTip?.75:.68)+2;}
  const brushTooth = {
    solid:()=>1,
    wash:(x,y,r,fine,coarse)=>.62+.24*coarse+.14*fine,
    rim:(x,y,r,fine,coarse)=>Math.min(1,.18+.42*coarse+.25*fine+Math.max(0,1-Math.abs(r-.77)*7)*.52),
    matte:(x,y,r,fine,coarse)=>.64+.23*coarse+.13*fine,
    bristle:(x,y,r,fine,coarse,seed)=>.28+.58*grainNoise(0,y>>1,seed)+.14*fine,
    fan:(x,y,r,fine,coarse,seed)=>grainNoise(0,Math.floor(y/(1+x*.026)),seed)>.52?.79+.21*fine:.018,
    ridges:(x,y,r,fine,coarse)=>.53+.38*(.5+.5*Math.sin(y*1.3+x*.12))+.09*fine,
    knife:(x,y,r,fine,coarse,seed)=>grainNoise(x>>3,y>>1,seed)>.22?.7+.3*fine:.06,
    sponge:(x,y,r,fine,coarse,seed)=>grainNoise(x>>3,y>>3,seed)>.44?.38+.62*coarse:.025,
    air:(x,y,r,fine)=>.86+.14*fine,
    splatter:(x,y,r,fine,coarse)=>coarse>.9||fine>.985?.6+.4*fine:.008,
    stipple:(x,y,r,fine)=>fine>.9?fine:.005,
    grain:(x,y,r,fine,coarse)=>fine+coarse*.4>.78?.52+.48*fine:.025,
    glitter:(x,y,r,fine,coarse,seed)=>{
      const dx=Math.abs(x%13-6),dy=Math.abs(y%13-6);
      if((dx<=1&&dy<5||dy<=1&&dx<5)&&grainNoise(Math.floor(x/13),Math.floor(y/13),seed)>.59)return .9+.1*fine;
      return fine>.956?fine:.005;
    },
    hatch:(x,y,r,fine)=>((x+y*2)%21)<4?.69+.31*fine:.01
  };
  function artistStampPixels(grade,color){
    grade=artistGradeName(grade);
    const settings=pencilGrade(grade),side=settings.kind==='charcoal'?96:64;
    const pigment=/^#[0-9a-fA-F]{6}$/.test(color||'')?color:settings.shade;
    const rgb=[1,3,5].map(i=>parseInt(pigment.slice(i,i+2),16));
    const data=new Uint8ClampedArray(side*side*4),seed=Math.floor(hash(grade,0,17)*4294967295);
    for(let y=0;y<side;y++)for(let x=0;x<side;x++){
      const dx=(x+.5)/side*2-1,dy=(y+.5)/side*2-1;
      const r=settings.squareTip?Math.max(Math.abs(dx),Math.abs(dy))/.98:Math.hypot(dx,dy);
      const fine=grainNoise(x,y,seed),coarse=grainNoise(x>>2,y>>2,seed^0x5bd1e995);
      let edge=Math.pow(clamp((1-r)/(settings.softness||.2),0,1),.8),tooth;
      if(settings.texture){
        tooth=brushTooth[settings.texture](x,y,r,fine,coarse,seed);
        if(settings.texture==='air')edge*=edge;
      }else if(settings.kind==='charcoal'){
        tooth=(.09+.91*coarse)*(fine>.72+.18*coarse?.12:1);
        edge*=.68+.32*grainNoise(x>>3,y>>3,seed);
      }else if(settings.kind==='color'){
        const fiber=grainNoise(x>>2,y>>1,seed^0x27d4eb2d);
        tooth=(.10+.90*Math.pow(fine,.75))*(fiber<.24?.18:1);
      }else if(settings.kind==='drybrush'){
        const bristle=grainNoise(x>>1,0,seed);
        tooth=bristle<.38?.02:(.25+.75*fine)*(coarse<.20?.08:1);
      }else if(settings.kind==='pastel'){
        tooth=(.12+.88*coarse)*(fine<.3?.10:1);
        edge*=.55+.45*grainNoise(x>>2,y>>2,seed);
      }else if(settings.kind==='wax'){
        const ridge=grainNoise(x>>2,y>>1,seed);
        tooth=.45+.55*ridge;if(fine<.12+ridge*.12)tooth*=.12;
      }else if(settings.kind==='chalk'){
        tooth=Math.pow(fine,.6)*(coarse<.33?.08:1);
        edge*=.65+.35*coarse;
      }else{
        tooth=.15+.85*(.64*fine+.36*coarse);
        if(fine>.97-settings.grain*.35)tooth*=.12;
      }
      const offset=(y*side+x)*4;
      data[offset]=rgb[0];data[offset+1]=rgb[1];data[offset+2]=rgb[2];data[offset+3]=Math.round(255*edge*tooth);
    }
    return {width:side,height:side,data};
  }
  function artistPaperPixels(grade,color){
    grade=artistGradeName(grade);
    const settings=pencilGrade(grade),side=64,pigment=/^#[0-9a-fA-F]{6}$/.test(color||'')?color:settings.shade;
    const rgb=[1,3,5].map(i=>parseInt(pigment.slice(i,i+2),16)),data=new Uint8ClampedArray(side*side*4);
    const seed=Math.floor(hash(grade,7,23)*4294967295);
    for(let y=0;y<side;y++)for(let x=0;x<side;x++){
      const fine=grainNoise(x,y,seed),fiber=grainNoise(x>>1,y>>2,seed^0x27d4eb2d),offset=(y*side+x)*4;
      const tooth=settings.kind==='color'?.65*fine+.35*fiber:fine;
      data[offset]=rgb[0];data[offset+1]=rgb[1];data[offset+2]=rgb[2];
      data[offset+3]=tooth<.25+settings.grain*.25?0:Math.round(255*(.45+.55*tooth));
    }
    return {width:side,height:side,data};
  }
  function materialCanvas(){
    if(typeof OffscreenCanvas==='function')return new OffscreenCanvas(1,1);
    return typeof document!=='undefined'?document.createElement('canvas'):null;
  }
  function putMaterialPixels(canvas,pixels){
    canvas.width=pixels.width;canvas.height=pixels.height;
    const ctx=canvas.getContext('2d'),image=ctx.createImageData(pixels.width,pixels.height);
    image.data.set(pixels.data);ctx.putImageData(image,0,0);return ctx;
  }
  const artistStamps=new Map(),artistPatterns=new Map();
  function artistStamp(grade,color){
    const key=grade+'|'+color.toLowerCase();
    if(artistStamps.has(key))return artistStamps.get(key);
    let stamp=null;
    try{
      stamp=materialCanvas();
      if(stamp){
        const ctx=putMaterialPixels(stamp,artistStampPixels(grade,color));
        if(['graphite','color','wax'].includes(pencilGrade(grade).kind) && typeof ctx.createPattern==='function'){
          const paper=materialCanvas();putMaterialPixels(paper,artistPaperPixels(grade,color));
          const pattern=ctx.createPattern(paper,'repeat');
          try{pattern?.setTransform?.({a:.6,b:0,c:0,d:.6,e:0,f:0});}catch{}
          artistPatterns.set(key,pattern);
        }
      }
    }catch{stamp=null;}
    artistStamps.set(key,stamp);
    // Keep default masks resident; bound all custom-color material sets.
    const colors=[...artistStamps.keys()].filter(k=>{const split=k.lastIndexOf('|');return k.slice(split+1)!==pencilGrade(k.slice(0,split)).shade.toLowerCase();});
    if(colors.length>128){artistStamps.delete(colors[0]);artistPatterns.delete(colors[0]);}
    return stamp;
  }
  function prepareArtistColor(color,grade){
    if(!/^#[0-9a-fA-F]{6}$/.test(color||''))return;
    const materials=grade?[[artistGradeName(grade),pencilGrade(grade)]]:Object.entries(PENCIL_GRADES);
    for(const [name,settings] of materials)if(settings.colorMode==='ink'&&settings.kind!=='ink')artistStamp(name,color);
  }
  function artistPoint(item,p){return {x:p[0],y:p[1],p:pressureAt(p),r:pencilWidth(item,pressureAt(p))*.5};}
  function artistMidpoint(item,a,b){
    const first=artistPoint(item,a),second=artistPoint(item,b);
    return {x:(first.x+second.x)*.5,y:(first.y+second.y)*.5,p:(first.p+second.p)*.5,r:(first.r+second.r)*.5};
  }
  function artistCurve(item,points,index,finish=false){
    if(points.length<2)return null;
    if(finish){const a=points[points.length-2],b=points[points.length-1];return {a:artistMidpoint(item,a,b),b:artistPoint(item,b)};}
    if(index===1)return {a:artistPoint(item,points[0]),b:artistMidpoint(item,points[0],points[1])};
    return {a:artistMidpoint(item,points[index-2],points[index-1]),control:artistPoint(item,points[index-1]),b:artistMidpoint(item,points[index-1],points[index])};
  }
  function artistCurvePath(ctx,a,b,c){
    ctx.beginPath();ctx.moveTo(a.x,a.y);
    if(c)ctx.quadraticCurveTo(c.x,c.y,b.x,b.y);else ctx.lineTo(b.x,b.y);
  }
  function artistFlow(item){return Number.isFinite(item.flow)?clamp(item.flow,.1,1):1;}
  function drawArtistCurve(ctx,item,curve,index,finish=false){
    if(!curve)return;
    const grade=artistGradeName(item.grade),settings=pencilGrade(grade),pigment=artistPigment(item),flow=artistFlow(item),{a,b}=curve;
    ctx.save();ctx.fillStyle=pigment;ctx.strokeStyle=pigment;ctx.lineCap='round';ctx.lineJoin='round';
    if(settings.kind==='ink'){
      ctx.globalAlpha=flow*settings.opacity;
      // Reduced-flow ink joins edge-to-edge; overlapping internal round caps
      // would leave a dark bead at every input sample. Legacy opaque ink stays exact.
      if(ctx.globalAlpha<1)drawPenCurve(ctx,curve,index===1,finish);else drawPenCurve(ctx,curve);
      ctx.restore();return;
    }
    const c=curve.control||{x:(a.x+b.x)*.5,y:(a.y+b.y)*.5,p:(a.p+b.p)*.5,r:(a.r+b.r)*.5};
    const length=Math.hypot(c.x-a.x,c.y-a.y)+Math.hypot(b.x-c.x,b.y-c.y);
    const p=(a.p+2*c.p+b.p)*.25,width=a.r+b.r;
    // A light continuous core joins the material deposits without dark beads.
    if(settings.core!==0){
      ctx.globalAlpha=flow*settings.opacity*(settings.kind==='charcoal'?.025+.035*p:.055+.065*p);
      ctx.lineCap='butt';ctx.lineWidth=Math.max(.3,width*.68);artistCurvePath(ctx,a,b,curve.control);ctx.stroke();
    }
    const stamp=artistStamp(grade,pigment);
    if(stamp){
      const paper=artistPatterns.get(grade+'|'+pigment.toLowerCase());
      const steps=clamp(Math.ceil(length/Math.max(.65,width*settings.spacing)),1,96);
      const angle=settings.angle??(settings.kind==='charcoal'?-.60:-.22),cos=Math.cos(angle),sin=Math.sin(angle);
      const deposit=settings.deposit??(!paper ? .45 : settings.kind==='color' ? .28 : .36);
      const seed=Math.floor(hash(grade,index,13)*4294967295);
      ctx.save();ctx.rotate(angle);
      for(let i=0;i<steps;i++){
        const t=(i+.5)/steps,u=1-t;
        let x=u*u*a.x+2*u*t*c.x+t*t*b.x,y=u*u*a.y+2*u*t*c.y+t*t*b.y;
        const pressure=u*u*a.p+2*u*t*c.p+t*t*b.p,w=2*(u*u*a.r+2*u*t*c.r+t*t*b.r);
        const dx=u*(c.x-a.x)+t*(b.x-c.x),dy=u*(c.y-a.y)+t*(b.y-c.y),len=Math.hypot(dx,dy)||1;
        const scatter=(grainNoise(i,index,seed)-.5)*w*(settings.scatter??(settings.kind==='charcoal'?.12:.035));
        x-=dy/len*scatter;y+=dx/len*scatter;
        const rx=x*cos+y*sin,ry=-x*sin+y*cos;
        const sw=w*(settings.kind==='charcoal'?1.12:1),sh=w*(settings.aspect??(settings.kind==='charcoal'?.65:.88));
        ctx.globalAlpha=flow*settings.opacity*(.15+.85*Math.pow(pressure,1.1))*deposit;
        ctx.drawImage(stamp,rx-sw/2,ry-sh/2,sw,sh);
      }
      ctx.restore();
      if(paper){
        ctx.fillStyle=paper;ctx.globalAlpha=flow*settings.opacity*(.2+.8*p);
        const scale=point=>({...point,r:point.r*.9});
        drawPenCurve(ctx,{a:scale(a),b:scale(b),...(curve.control?{control:scale(c)}:{})},index===1,finish);
      }
    }else{
      // Canvas-less or restricted environments retain deterministic vector ink.
      const fibers=settings.kind==='charcoal'?6:4;
      for(let i=0;i<fibers;i++){
        const offset=(i/(fibers-1)-.5)*width*.7;
        const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
        ctx.globalAlpha=flow*settings.opacity*(.1+.16*p)*(.6+.4*hash(grade,index,i));
        ctx.lineWidth=Math.max(.3,width/(fibers*2));
        artistCurvePath(ctx,{x:a.x+nx*offset,y:a.y+ny*offset},{x:b.x+nx*offset,y:b.y+ny*offset},curve.control?{x:c.x+nx*offset,y:c.y+ny*offset}:null);ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawArtistPart(ctx,item,points,index){
    if(index===0){
      const a=artistPoint(item,points[0]),settings=pencilGrade(item.grade),pigment=artistPigment(item),flow=artistFlow(item);
      ctx.save();ctx.fillStyle=pigment;
      if(settings.kind==='ink'){
        ctx.globalAlpha=flow*settings.opacity;ctx.beginPath();ctx.arc(a.x,a.y,a.r,0,Math.PI*2);ctx.fill();
      }else{
        const stamp=artistStamp(artistGradeName(item.grade),pigment);
        ctx.globalAlpha=flow*settings.opacity*(.15+.85*Math.pow(a.p,1.1))*.58;
        if(stamp&&settings.aspect){
          ctx.translate(a.x,a.y);ctx.rotate(settings.angle??-.22);
          ctx.drawImage(stamp,-a.r,-a.r*settings.aspect,a.r*2,a.r*2*settings.aspect);
        }else if(stamp)ctx.drawImage(stamp,a.x-a.r,a.y-a.r,a.r*2,a.r*2);
        else{ctx.beginPath();ctx.arc(a.x,a.y,a.r,0,Math.PI*2);ctx.fill();}
      }
      ctx.restore();return;
    }
    drawArtistCurve(ctx,item,artistCurve(item,points,index),index);
  }
  function drawArtistEnd(ctx,item,points){drawArtistCurve(ctx,item,artistCurve(item,points,0,true),points.length,true);}
  function drawArtistStroke(ctx,item){
    const points=item.points||[];
    for(let i=0;i<points.length;i++)drawArtistPart(ctx,item,points,i);
    drawArtistEnd(ctx,item,points);
  }
  const mandalaDesign=(id,name,collection,level,detail,layers)=>Object.freeze({id,name,collection,level,detail,layers:Object.freeze(layers.map(layer=>Object.freeze(layer)))});
  const MANDALA_DESIGNS=Object.freeze([
    Object.freeze({id:'lotus',name:'Lotus Bloom',collection:'Floral',detail:'Eight petals and a delicate outer ring',level:'Calm'}),
    Object.freeze({id:'sunflower',name:'Sunflower',collection:'Floral',detail:'Long petals around concentric circles',level:'Calm'}),
    Object.freeze({id:'star',name:'Star Mosaic',collection:'Geometric',detail:'Layered stars and twelve radial sections',level:'Focused'}),
    Object.freeze({id:'rose',name:'Rose Window',collection:'Ornamental',detail:'Overlapping circles and a petal border',level:'Intricate'}),
    Object.freeze({id:'orbit',name:'Orbit Garden',collection:'Geometric',detail:'Circular paths, diamonds and eight orbits',level:'Focused'}),
    Object.freeze({id:'peacock',name:'Peacock Bloom',collection:'Nature',detail:'Nested petals with small jewel-like centers',level:'Intricate'}),
    mandalaDesign("daisy","Daisy Chain","Floral","Calm","Rounded petals and a ring of small flowers",[["ring",0.24],["petals",12,0.26,0.72,0.14],["circles",18,0.84,0.07]]),
    mandalaDesign("marigold","Marigold Lace","Floral","Focused","Three alternating layers of scalloped petals",[["petals",8,0.13,0.43,0.16],["petals",16,0.42,0.73,0.1,0.196],["petals",24,0.73,0.92,0.055],["ring",0.74]]),
    mandalaDesign("dahlia","Dahlia Crown","Floral","Intricate","Pointed petals, nested diamonds and a jeweled border",[["diamonds",12,0.14,0.53,0.1],["petals",24,0.48,0.86,0.065,0.131],["circles",24,0.9,0.025]]),
    mandalaDesign("camellia","Camellia Layers","Floral","Focused","Broad overlapping petals in two offset rings",[["petals",6,0.13,0.58,0.26],["petals",12,0.55,0.9,0.11,0.262],["ring",0.6]]),
    mandalaDesign("magnolia","Magnolia Embrace","Floral","Calm","Six generous petals with pearl-like centers",[["petals",6,0.16,0.88,0.3],["circles",6,0.56,0.1],["ring",0.18]]),
    mandalaDesign("iris","Iris Compass","Floral","Focused","Four sweeping petals and fine diagonal leaves",[["petals",4,0.16,0.91,0.36],["leaves",4,0.28,0.78,0.12,0.785],["ring",0.23]]),
    mandalaDesign("chrysanthemum","Chrysanthemum","Floral","Intricate","Fine inner petals inside a dense floral crown",[["petals",18,0.14,0.53,0.065],["petals",36,0.51,0.91,0.038,0.087],["ring",0.55],["ring",0.92]]),
    mandalaDesign("waterlily","Water Lily","Floral","Focused","A double lotus floating within soft wave rings",[["petals",8,0.14,0.6,0.2],["petals",8,0.29,0.81,0.16,0.393],["wave",8,0.89,0.035],["ring",0.21]]),
    mandalaDesign("jasmine","Jasmine Garland","Floral","Calm","Eight small blossoms around a gentle central flower",[["petals",8,0.14,0.47,0.13],["tiles",8,0.69,0.16,6,0.393],["circles",8,0.69,0.055,0.393],["ring",0.91]]),
    mandalaDesign("cherry","Cherry Blossom","Floral","Calm","Five open petals and an ornamental diamond border",[["petals",5,0.14,0.73,0.34],["circles",5,0.48,0.075],["diamonds",15,0.78,0.91,0.045,0.209]]),
    mandalaDesign("octagon","Octagon Sanctuary","Geometric","Calm","Rotated octagons and broad diamond cells",[["polygon",8,0.31,0.393],["polygon",8,0.59,0],["polygon",8,0.88,0.393],["diamonds",8,0.32,0.84,0.17]]),
    mandalaDesign("honeycomb","Honeycomb Halo","Geometric","Focused","Hexagonal cells arranged around a six-pointed core",[["polygon",6,0.26,0],["tiles",6,0.48,0.21,6,0],["tiles",12,0.79,0.105,6,0.262],["ring",0.92]]),
    mandalaDesign("prism","Prism Wheel","Geometric","Focused","Triangular prisms between nested polygon rings",[["polygon",12,0.25,0],["polygon",12,0.55,0.262],["polygon",12,0.9,0],["spokes",12,0.11,0.95],["star",12,0.56,0.9,0.262]]),
    mandalaDesign("diamond-weave","Diamond Weave","Geometric","Intricate","Interlocking diamond rings and a square core",[["polygon",4,0.22,0.785],["diamonds",8,0.23,0.65,0.16],["diamonds",16,0.56,0.91,0.065,0.196],["ring",0.68]]),
    mandalaDesign("mosaic-wheel","Mosaic Wheel","Geometric","Calm","Twelve clear sectors with diamond-shaped tiles",[["ring",0.29],["ring",0.62],["spokes",12,0.11,0.95],["diamonds",12,0.32,0.89,0.075,0.262]]),
    mandalaDesign("compass-rose","Compass Rose","Geometric","Focused","Long cardinal points surrounded by shorter compass tips",[["star",4,0.18,0.87],["star",8,0.42,0.74,0.393],["polygon",8,0.9,0],["ring",0.32]]),
    mandalaDesign("kaleidoscope","Kaleidoscope Glass","Geometric","Intricate","Overlaid stars, hexagons and triangular window panes",[["star",6,0.3,0.8],["star",6,0.42,0.9,0.524],["polygon",6,0.57,0],["spokes",12,0.11,0.95,0.262]]),
    mandalaDesign("crystal","Crystal Facets","Geometric","Focused","Twelve elongated crystals with a fine polygon border",[["diamonds",12,0.16,0.83,0.12],["polygon",12,0.44,0.262],["polygon",12,0.91,0],["ring",0.26]]),
    mandalaDesign("concentric-kites","Kite Carousel","Geometric","Focused","Three distinct rings of kite-shaped compartments",[["diamonds",6,0.14,0.4,0.1],["diamonds",12,0.4,0.68,0.07,0.262],["diamonds",18,0.69,0.92,0.045],["ring",0.69]]),
    mandalaDesign("triangle-garden","Triangle Garden","Geometric","Intricate","Triangular flowers and a six-pointed mosaic rim",[["tiles",6,0.42,0.21,3,0],["tiles",12,0.76,0.13,3,0.262],["star",12,0.78,0.92],["ring",0.2]]),
    mandalaDesign("solar-crown","Solar Crown","Celestial","Calm","A sun with broad rays and two central rings",[["ring",0.22],["ring",0.34],["diamonds",12,0.35,0.92,0.105],["circles",12,0.63,0.035]]),
    mandalaDesign("lunar-halo","Lunar Halo","Celestial","Calm","Quiet circular orbits inside a scalloped lunar border",[["ring",0.23],["circles",8,0.47,0.22,0.393],["ring",0.72],["wave",16,0.87,0.045]]),
    mandalaDesign("starlight","Starlight Medallion","Celestial","Focused","An eight-pointed star with two tiny star borders",[["star",8,0.31,0.75],["star",16,0.8,0.92,0.098],["polygon",8,0.25,0.393],["ring",0.77]]),
    mandalaDesign("galaxy-rings","Galaxy Rings","Celestial","Focused","Three bands of orbital circles and a distant star ring",[["circles",6,0.3,0.15],["circles",12,0.58,0.105,0.262],["circles",24,0.84,0.045],["ring",0.45],["ring",0.72]]),
    mandalaDesign("eclipse","Eclipse Geometry","Celestial","Calm","Large orbit windows separated by nested circular paths",[["ring",0.28],["circles",4,0.52,0.22,0.785],["ring",0.77],["spokes",8,0.77,0.95],["ring",0.87]]),
    mandalaDesign("comet-wheel","Comet Wheel","Celestial","Focused","Slender comet petals around a sparkling central star",[["star",6,0.19,0.39],["petals",12,0.4,0.91,0.09,0.131],["circles",12,0.7,0.045,0.131],["ring",0.43]]),
    mandalaDesign("aurora","Aurora Ribbons","Celestial","Intricate","Undulating rings divided into bright ribbon-like sections",[["wave",6,0.25,0.035],["wave",12,0.49,0.065],["wave",18,0.77,0.07],["spokes",12,0.11,0.95],["ring",0.91]]),
    mandalaDesign("constellation","Constellation Crown","Celestial","Intricate","Small polygon stars arranged around a twelve-pointed core",[["star",12,0.23,0.48],["tiles",12,0.71,0.14,5,0],["circles",12,0.71,0.045],["ring",0.9]]),
    mandalaDesign("cosmic-flower","Cosmic Flower","Celestial","Focused","Pointed stellar petals framed by luminous orbit circles",[["petals",10,0.13,0.7,0.16],["star",10,0.52,0.85,0.314],["circles",20,0.89,0.025],["ring",0.72]]),
    mandalaDesign("moon-petals","Moon Petals","Celestial","Calm","Eight moon-shaped rings inside a lotus-like halo",[["circles",8,0.4,0.23],["petals",16,0.67,0.91,0.065,0.196],["ring",0.65],["ring",0.22]]),
    mandalaDesign("lace-medallion","Lace Medallion","Ornamental","Intricate","Scalloped circles with a delicate double-petal fringe",[["circles",12,0.4,0.23],["petals",24,0.64,0.84,0.045],["circles",36,0.89,0.028],["ring",0.86]]),
    mandalaDesign("royal-rosette","Royal Rosette","Ornamental","Focused","Bold diamonds, nested petals and a pearl-trimmed edge",[["diamonds",8,0.13,0.48,0.12],["petals",16,0.45,0.82,0.08,0.196],["circles",16,0.89,0.045],["ring",0.84]]),
    mandalaDesign("cathedral","Cathedral Window","Ornamental","Intricate","Gothic-style petal windows inside polygon frames",[["polygon",12,0.91,0.262],["petals",12,0.16,0.85,0.17],["petals",12,0.35,0.74,0.09],["ring",0.29],["ring",0.57]]),
    mandalaDesign("filigree","Filigree Bloom","Ornamental","Intricate","Alternating curls, diamonds and many small oval leaves",[["wave",8,0.3,0.055],["diamonds",16,0.34,0.69,0.055],["petals",32,0.7,0.92,0.035,0.098],["ring",0.69]]),
    mandalaDesign("pearl-necklace","Pearl Necklace","Ornamental","Calm","Clear rings of large and small pearls around a flower",[["petals",8,0.13,0.45,0.13],["circles",12,0.59,0.1],["circles",24,0.85,0.055],["ring",0.74]]),
    mandalaDesign("rangoli","Rangoli Festival","Ornamental","Intricate","Layered squares, diamonds and rounded petal flourishes",[["polygon",4,0.28,0.785],["polygon",4,0.46,0],["diamonds",8,0.3,0.8,0.18],["petals",16,0.74,0.92,0.055,0.196],["ring",0.84]]),
    mandalaDesign("arabesque","Arabesque Garden","Ornamental","Focused","Curved leaves and alternating decorative diamond borders",[["leaves",8,0.16,0.67,0.19],["diamonds",16,0.7,0.9,0.055,0.196],["wave",16,0.91,0.015],["ring",0.25]]),
    mandalaDesign("woven-ribbon","Woven Ribbons","Ornamental","Intricate","Interlaced wavy bands crossed by a fine radial lattice",[["wave",8,0.35,0.075],["wave",8,0.48,0.075,3.142],["wave",16,0.76,0.055],["spokes",16,0.11,0.95,0.196],["ring",0.91]]),
    mandalaDesign("jewel-box","Jewel Box","Ornamental","Focused","Eight gemstone facets surrounded by tiny jewel frames",[["diamonds",8,0.13,0.57,0.18],["tiles",16,0.76,0.105,4,0.196],["circles",16,0.76,0.035,0.196],["polygon",8,0.91,0.393]]),
    mandalaDesign("fern","Fern Fronds","Nature","Focused","Eight divided leaves framed by a fine beaded border",[["leaves",8,0.16,0.84,0.2],["circles",24,0.9,0.026],["ring",0.88]]),
    mandalaDesign("seashell","Seashell Fan","Nature","Intricate","Nested fan-shaped shells around a circular center",[["petals",8,0.22,0.91,0.21],["petals",8,0.4,0.91,0.15],["petals",8,0.58,0.91,0.085],["ring",0.23]]),
    mandalaDesign("butterfly","Butterfly Circle","Nature","Calm","Six small butterflies orbiting a central blossom",[["petals",6,0.13,0.36,0.12],["butterflies",6,0.61,0.22,0.095],["ring",0.88],["ring",0.4]]),
    mandalaDesign("leaf-wreath","Leaf Wreath","Nature","Calm","Two rings of leaves with generous spaces for color",[["leaves",6,0.16,0.52,0.16],["leaves",12,0.54,0.9,0.095,0.262],["ring",0.54]]),
    mandalaDesign("raindrop","Raindrop Ripples","Nature","Focused","Twelve drop-shaped petals inside soft water ripples",[["petals",12,0.23,0.86,0.11],["circles",12,0.61,0.04],["wave",12,0.9,0.025],["ring",0.21]]),
    ...(ART?.DESIGNS||[])
  ]);
  function prepareMandala(id){
    const design=MANDALA_DESIGNS.find(design=>design.id===id);
    if(!design)return Promise.reject(Error('Choose an available mandala design.'));
    return design.motif?ART.prepare(id):Promise.resolve(null);
  }
  function drawMandala(ctx,id,size,prepared){
    const design=MANDALA_DESIGNS.find(design=>design.id===id);
    if(!design||!Number.isFinite(size)||size<16||size>4096)throw Error('Choose a valid mandala design and size.');
    ctx.save();
    try{
      ctx.translate(size/2,size/2);ctx.scale((size-8)/2,(size-8)/2);
      ctx.strokeStyle='#30344c';ctx.lineWidth=.009;ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=1;ctx.setLineDash([]);
      const circle=(r,x=0,y=0)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.closePath();ctx.stroke();};
      const repeat=(count,draw,offset=0)=>{for(let i=0;i<count;i++){ctx.save();ctx.rotate(offset+i*Math.PI*2/count);draw();ctx.restore();}};
      const petal=(inner,outer,width)=>{
        const span=outer-inner;ctx.beginPath();ctx.moveTo(inner,0);
        ctx.bezierCurveTo(inner+span*.3,-width,outer-span*.2,-width,outer,0);
        ctx.bezierCurveTo(outer-span*.2,width,inner+span*.3,width,inner,0);ctx.closePath();ctx.stroke();
      };
      const diamond=(inner,outer,width)=>{ctx.beginPath();ctx.moveTo(inner,0);ctx.lineTo((inner+outer)/2,width);ctx.lineTo(outer,0);ctx.lineTo((inner+outer)/2,-width);ctx.closePath();ctx.stroke();};
      const star=(count,inner,outer)=>{ctx.beginPath();for(let i=0;i<count*2;i++){const a=i*Math.PI/count,r=i%2?inner:outer;if(i)ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);else ctx.moveTo(r,0);}ctx.closePath();ctx.stroke();};
      const polygon=(sides,radius,offset=0)=>{
        ctx.beginPath();for(let i=0;i<sides;i++){const a=offset+i*Math.PI*2/sides,x=Math.cos(a)*radius,y=Math.sin(a)*radius;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();
      };
      const wave=(count,radius,amplitude,phase=0)=>{
        ctx.beginPath();for(let i=0;i<count*20;i++){const a=i*Math.PI*2/(count*20),r=radius+Math.sin(a*count+phase)*amplitude;if(i)ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);else ctx.moveTo(r,0);}ctx.closePath();ctx.stroke();
      };
      const leaf=(inner,outer,width)=>{
        petal(inner,outer,width);ctx.beginPath();ctx.moveTo(inner,0);ctx.lineTo(outer,0);ctx.stroke();
        const span=outer-inner;
        for(const t of [.35,.65])for(const side of [-1,1]){
          const u=1-t,x=u*u*u*inner+3*u*u*t*(inner+span*.3)+3*u*t*t*(outer-span*.2)+t*t*t*outer,y=side*3*width*t*u;
          ctx.beginPath();ctx.moveTo(inner+span*(t+.12),0);ctx.lineTo(x,y);ctx.stroke();
        }
      };
      if(design.motif){ART.draw(ctx,design,prepared);}
      else if(design.layers){
        for(const [kind,a,b,c,d=0,e=0] of design.layers){
          if(kind==='ring')circle(a);
          else if(kind==='petals')repeat(a,()=>petal(b,c,d),e);
          else if(kind==='leaves')repeat(a,()=>leaf(b,c,d),e);
          else if(kind==='diamonds')repeat(a,()=>diamond(b,c,d),e);
          else if(kind==='circles')repeat(a,()=>circle(c,b,0),d);
          else if(kind==='polygon')polygon(a,b,c||0);
          else if(kind==='star'){ctx.save();ctx.rotate(d);star(a,b,c);ctx.restore();}
          else if(kind==='spokes')repeat(a,()=>{ctx.beginPath();ctx.moveTo(b,0);ctx.lineTo(c,0);ctx.stroke();},d);
          else if(kind==='wave')wave(a,b,c,d);
          else if(kind==='tiles')repeat(a,()=>{ctx.save();ctx.translate(b,0);polygon(d,c);ctx.restore();},e);
          else if(kind==='butterflies')repeat(a,()=>{ctx.save();ctx.translate(b,0);for(const angle of [-2.25,-.70,.70,2.25]){ctx.save();ctx.rotate(angle);petal(0,c,d);ctx.restore();}ctx.restore();});
          else throw Error('Unsupported mandala layer');
        }
        circle(.11);circle(.95);
      }else if(id==='lotus'){
        repeat(8,()=>petal(.13,.69,.23));circle(.71);
        repeat(16,()=>petal(.73,.93,.075),Math.PI/16);circle(.95);circle(.12);
      }else if(id==='sunflower'){
        repeat(16,()=>petal(.25,.9,.115));circle(.24);circle(.12);circle(.95);
      }else if(id==='star'){
        circle(.95);star(12,.62,.9);star(6,.27,.49);circle(.54);
        repeat(12,()=>{ctx.beginPath();ctx.moveTo(.12,0);ctx.lineTo(.95,0);ctx.stroke();});circle(.12);
      }else if(id==='rose'){
        repeat(12,()=>circle(.30,.42,0));circle(.74);
        repeat(24,()=>petal(.76,.93,.045),Math.PI/24);circle(.95);circle(.11);
      }else if(id==='orbit'){
        circle(.95);circle(.9);circle(.6);circle(.35);circle(.12);
        repeat(8,()=>{circle(.2,.48,0);diamond(.15,.31,.055);ctx.beginPath();ctx.moveTo(.69,0);ctx.lineTo(.9,0);ctx.stroke();});
      }else if(id==='peacock'){
        repeat(10,()=>{petal(.17,.91,.20);petal(.34,.77,.105);circle(.055,.58,0);});circle(.14);circle(.95);
      }
    }finally{ctx.restore();}
  }
  // Allocate the small reusable material masks before the first Pencil contact.
  for(const [grade,settings] of Object.entries(PENCIL_GRADES))if(settings.kind!=='ink')artistStamp(grade,settings.shade);
  return Object.freeze({MANDALA_DESIGNS,prepareMandala,drawMandala,PENCIL_GRADES, ARTIST_MATERIALS, ARTIST_COLLECTIONS, STROKE_STYLES, SHAPE_GROUPS, MATH_SHAPE_GROUPS, SHAPE_NAMES, isShapeKind, isMathShape, isFillableShape, shapeStrokeStyle, mathDragSize, shapeIcon, drawShape, shapePath,shapeHit,
    drawArtistPart, drawArtistEnd, drawArtistStroke, pencilGrade, pencilWidth, artistCurve, artistBoundsPadding, artistStampPixels, artistPaperPixels, prepareArtistColor,
    erasurePath,erasedAt,drawErasedItem,pageBackgroundRect,imageCrop,dragImageCrop,cropImage,drawImage,penCurve,drawPenPart,drawPenEnd,
    rotatable,objectRotation,objectRect,objectPoint,rotateContext,positionObjectRect,rotationFromDrag,
    drawSticker,stickerSelectionBounds,resizeSticker});
});
