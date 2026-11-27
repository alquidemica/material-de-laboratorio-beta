"use strict";
/* Verificación de los motores reales sin navegador ni modificaciones en producción.
   Desde la raíz: node --test tests/motores.test.cjs */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');

function fakeElement(){
 const el={disabled:false,value:'',textContent:'',innerHTML:'',dataset:{},style:{setProperty(){}},
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  addEventListener(){},setAttribute(){},append(){},replaceChildren(){},focus(){},
  querySelector(){return fakeElement()},querySelectorAll(){return []}};
 return el;
}
function setup(){
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,fakeElement());return elements.get(id)};
 $('lotteryLevel').value='1';$('lotteryNovelty').value='all';
 $('memoryLevel').value='1';$('memoryNovelty').value='all';
 $('randomLevel').value='1';$('randomNovelty').value='all';
 const document={getElementById:$,addEventListener(){},body:fakeElement(),
  querySelector(sel){if(sel==='input[name="memoryPairs"]:checked')return {value:'6'};return null},
  querySelectorAll(){return []},createDocumentFragment(){return fakeElement()},
  createElement(){return fakeElement()},documentElement:{clientWidth:900,clientHeight:700},hidden:false};
 const window={innerHeight:700,innerWidth:900,scrollY:0,visualViewport:{height:700},
  addEventListener(){},matchMedia(){return {matches:false}}};
 const context=vm.createContext({document,window,location:{href:'https://example.test/',search:''},
  URL,URLSearchParams,Map,Set,Math,Object,Number,Array,console,
  requestAnimationFrame(){return 1},cancelAnimationFrame(){},setTimeout(){return 1},clearTimeout(){},
  setInterval(){return 1},clearInterval(){},performance:{now(){return 0}},
  alert(){throw new Error('No debería abrirse una alerta')},confirm(){return true},
  uiText:(key,values={})=>key+' '+JSON.stringify(values),
  catalogManager:{getCard(id){return {nombre:`Carta ${id}`,descripcion:'Descripción'}},
   imageUrl(id){return `cartas/${id}.webp`},eligibleIds(){return Array.from({length:42},(_,i)=>i+1)},
   config:{nombre:'Laboratorio'}}});
 // loadApp() dispara precarga de imágenes y red; se omite únicamente su llamada final.
 const app=fs.readFileSync(path.join(root,'aplicacion.js'),'utf8');
 assert.match(app,/\nloadApp\(\);\s*$/,'No se reconoce el punto de inicio de aplicacion.js');
 vm.runInContext(app.replace(/\nloadApp\(\);\s*$/,'\n'),context,{filename:'aplicacion.js'});
 vm.runInContext(fs.readFileSync(path.join(root,'estudio-aleatorio.js'),'utf8'),context,{filename:'estudio-aleatorio.js'});
 vm.runInContext(fs.readFileSync(path.join(root,'memoria.js'),'utf8'),context,{filename:'memoria.js'});
 return {context,elements};
}

test('Lotería: barajar conserva todas las cartas y no repite ninguna',()=>{
 const {context}=setup();const ids=Array.from({length:52},(_,i)=>i+1);
 const result=vm.runInContext('shuffled',context)(ids);
 assert.equal(result.length,52);
 assert.deepEqual([...result].sort((a,b)=>a-b),ids);
 assert.equal(new Set(result).size,52);
 assert.deepEqual(ids,Array.from({length:52},(_,i)=>i+1),'No modifica la entrada');
});
test('Lotería: barajar con mazos de 5, 12 y 42 cartas',()=>{
 const {context}=setup();const shuffle=vm.runInContext('shuffled',context);
 for(const total of [5,12,42]){
  const ids=Array.from({length:total},(_,i)=>i+1);
  for(let n=0;n<20;n++)assert.deepEqual([...shuffle(ids)].sort((a,b)=>a-b),ids);
 }
});
test('Estudio aleatorio: registra acierto inicial una sola vez',()=>{
 const {context}=setup();const RandomSession=vm.runInContext('RandomSession',context);
 const s=new RandomSession([7]);
 assert.equal(s.rate(true),true);
 assert.equal(s.rate(true),false);
 assert.equal(s.first.get(7),true);
 assert.equal(s.attempts,1);
 assert.equal(s.complete,true);
});
test('Estudio aleatorio: una carta fallada se mueve al final sin duplicarse',()=>{
 const {context}=setup();const RandomSession=vm.runInContext('RandomSession',context);
 const s=new RandomSession([1,2,3,4]);
 s.cards=[1,2,3,4];s.index=0;
 assert.equal(s.rate(false),true);
 assert.deepEqual([...s.cards],[2,3,4,1]);
 assert.equal(s.first.get(1),false);
 assert.equal(s.reviewed.has(1),true);
 assert.equal(s.cards.filter(id=>id===1).length,1);
 s.index=3;assert.equal(s.rate(true),true);
 assert.equal(s.first.get(1),false,'Se conserva el primer intento');
 assert.equal(s.known.has(1),true);
 assert.equal(s.attempts,2);
});
test('Memoria: iniciar 6 parejas genera 12 tarjetas, dos por cada ID',()=>{
 const {context,elements}=setup();
 vm.runInContext("activeMode='memory';loading=false;",context);
 vm.runInContext('startMemory()',context);
 const cards=vm.runInContext('memoryGame.cards',context);
 assert.equal(cards.length,12);
 const counts=new Map();for(const card of cards)counts.set(card.id,(counts.get(card.id)||0)+1);
 assert.equal(counts.size,6);
 for(const count of counts.values())assert.equal(count,2);
 assert.equal(new Set(cards.map(c=>c.unique)).size,12);
});
test('Memoria: los cuatro niveles de dificultad utilizan el número correcto de parejas',()=>{
 for(const pairs of [4,6,9,12]){
  const {context}=setup();
  context.document.querySelector=sel=>sel==='input[name="memoryPairs"]:checked'?{value:String(pairs)}:null;
  vm.runInContext("activeMode='memory';loading=false;",context);
  vm.runInContext('startMemory()',context);
  const cards=vm.runInContext('memoryGame.cards',context);
  assert.equal(cards.length,pairs*2);
  const tally=new Map();for(const c of cards)tally.set(c.id,(tally.get(c.id)||0)+1);
  assert.equal(tally.size,pairs);
  assert.ok([...tally.values()].every(n=>n===2));
 }
});
