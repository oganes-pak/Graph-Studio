class FakeContext {
  constructor(){return new Proxy(this,{get:(t,p)=>p in t?t[p]:(...args)=>{},set:(t,p,v)=>(t[p]=v,true)});}
  measureText(text){return {width:String(text).length*7};}
  createRadialGradient(){return {addColorStop(){}};}
}
class FakeCanvas extends EventTarget {
  constructor(){super();this.style={};this.parentElement={getBoundingClientRect:()=>({width:900,height:650})};this.width=900;this.height=650;this.ctx=new FakeContext();}
  getContext(){return this.ctx;}
  getBoundingClientRect(){return {width:900,height:650,left:0,top:0};}
  setPointerCapture(){}
  releasePointerCapture(){}
  focus(){}
}
globalThis.HTMLCanvasElement=FakeCanvas;
globalThis.ResizeObserver=class{observe(){} disconnect(){}};
globalThis.window=globalThis;
globalThis.window.matchMedia=()=>({matches:false});
globalThis.window.devicePixelRatio=1;
globalThis.document={};
globalThis.requestAnimationFrame=(fn)=>1;
globalThis.cancelAnimationFrame=()=>{};
if(!globalThis.CustomEvent)globalThis.CustomEvent=class extends Event{constructor(type,options={}){super(type);this.detail=options.detail;}};

const {Graph3DEngine}=await import('../src/engine/Graph3DEngine.js');
const canvas=new FakeCanvas();
const data={nodes:[
  {id:'core',type:'core',name:'Главная тема',description:'Описание'},
  {id:'a',type:'group',name:'Ветка A'},
  {id:'b',type:'node',name:'Узел B'}
],links:[{source:'core',target:'a'},{source:'a',target:'b'}]};
const engine=new Graph3DEngine({canvas,data});
let duplicateBlocked=false;try{engine.addLink({source:'a',target:'core'});}catch(error){duplicateBlocked=error.message.includes('уже существует');}
if(!duplicateBlocked)throw new Error('Duplicate connection was not blocked');
let transientObserved=false;canvas.addEventListener('graph:configchange',()=>{transientObserved=engine.lastChangeTransient;},{once:true});
engine.updateConfig({links:{flow:{speed:.31}}},{rebuild:false,transient:true});
if(!transientObserved)throw new Error('Transient preview flag was not visible during event');
engine.resize();
engine.updateProjection();
for(let i=0;i<180;i++)engine.update(1/60);
engine.renderOnce();
engine.updateConfig({networkPulse:{style:'organic',glowEnabled:false,nodeDeformation:.1},node:{labels:{mode:'all'}}},{rebuild:false});
engine.renderOnce();
engine.setLayout('hex');
for(let i=0;i<120;i++)engine.updatePhysics(1/60);
const finite=engine.nodes.every(n=>[n.x0,n.y0,n.z0,n.vx,n.vy,n.vz].every(Number.isFinite));
if(!finite)throw new Error('Physics produced non-finite values');
engine.setEditingLocked(true);
let blocked=false;try{engine.addNode({id:'x',name:'X'});}catch{blocked=true;}
if(!blocked)throw new Error('Editing lock failed');
console.log(JSON.stringify({ok:true,nodes:engine.nodes.length,links:engine.links.length,layout:engine.normalizedLayoutType(),finite,duplicateBlocked,transientObserved}));
engine.destroy();
