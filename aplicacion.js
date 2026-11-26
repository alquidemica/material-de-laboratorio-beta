"use strict";
// El catálogo seleccionado determina los identificadores y la cantidad de cartas.
let TOTAL=0;
const $ = (id) => document.getElementById(id);
const card=$('card'), cardArt=$('cardArt'), cardName=$('cardName'), cardNumber=$('cardNumber'), logoReserve=$('logoReserve');
const status=$('status'), mainBtn=$('mainBtn'), shuffleBtn=$('shuffleBtn'), descriptionBtn=$('descriptionBtn');
const modal=$('descriptionModal'), descriptionTitle=$('descriptionTitle'), descriptionText=$('descriptionText'), closeBtn=$('closeDescriptionBtn');
let images=new Map(), deck=[], position=-1, currentCard=0;
let playing=false, finished=false, ready=false, loading=true, changing=false, modalOpen=false;
let activeMode='lottery', descriptionTrigger=null, randomLocked=false, memoryLocked=false;
const ALLOWED_CATALOGS=Object.freeze({laboratorio:'catalogos/laboratorio.json', 'elementos-demo':'catalogos/elementos-demo/manifest.json'});
const catalogFromURL=new URLSearchParams(location.search).get('catalogo');
const selectedCatalog=Object.hasOwn(ALLOWED_CATALOGS,catalogFromURL)?catalogFromURL:'laboratorio';
// Única interfaz de contenido para todos los modos.
function cardContent(id,level=1){return catalogManager.getCard(id,level);}
function activeContentLevel(){
 if(activeMode==='lottery')return Number($('lotteryLevel').value)||1;
 if(activeMode==='memory')return Number($('memoryLevel').value)||1;
 if(activeMode==='study')return Number($('studyLevel').value)||1;
 if(activeMode==='random')return Number($('randomLevel').value)||1;
 return 1;
}
function catalogCategories(){return catalogManager.getCategories();}
function syncLotteryUI(){
 // La configuracion se muestra en la portada, nunca durante la partida ni en resultados.
 $('lotteryAcademic').classList.toggle('hidden',playing||finished);
 const configuring=finished&&activeMode==='lottery';
 descriptionBtn.textContent=configuring?'CONFIGURAR':'DESCRIPCIÓN';
 descriptionBtn.classList.toggle('secondary',configuring);
 descriptionBtn.classList.toggle('description-btn',!configuring);
}
function syncButtons(){
 syncLotteryUI();
 $('lotteryLevel').disabled=playing||loading||changing||modalOpen;
 $('lotteryNovelty').disabled=playing||loading||changing||modalOpen;
 const busy=loading||changing||modalOpen||randomLocked||memoryLocked;
 mainBtn.disabled=busy;
 shuffleBtn.disabled=busy;
 descriptionBtn.disabled=busy||(!finished&&(currentCard===0||!cardContent(currentCard,activeContentLevel())?.descripcion));
 $('studyMode').disabled=busy;
 $('lotteryMode').disabled=changing||modalOpen||randomLocked||memoryLocked;
 $('randomMode').disabled=busy;
 $('memoryMode').disabled=busy;
}

// Una sola plantilla lógica para lotería y estudio libre.
function populateCard(element,id){
 const m=cardContent(id,activeContentLevel())||{}, art=element.querySelector('.card-art'), name=element.querySelector('.card-name');
 element.classList.toggle('cover',id===0);
 element.style.setProperty('--outer',id===0?'#a65add':m.marco||'#54cdbc');
 art.src=images.get(id)?.src||catalogManager.imageUrl(id);
 art.alt=id===0?'Ilustración de portada de la baraja':m.nombre||`Carta ${id}`;
 element.querySelector('.card-number').textContent=id;
 name.textContent=id===0?(catalogManager.config?.tituloPortada||'LOTERÍA DE MATERIAL DEL LABORATORIO'):m.nombre||`Carta ${id}`;
 name.classList.toggle('long',id!==0&&(m.nombre||'').length>20);
 name.classList.toggle('very-long',id!==0&&(m.nombre||'').length>31);
}
function renderCard(id){
 currentCard=id;
 populateCard(card,id);
 logoReserve.classList.toggle('hidden',id!==0||selectedCatalog!=='laboratorio');
 card.setAttribute('aria-label',id===0?'Portada':`Carta ${id}, ${cardContent(id,activeContentLevel()).nombre}`);
 card.classList.remove('pop');void card.offsetWidth;card.classList.add('pop');syncButtons();
}
async function loadApp(){
 try{
  $('catalogSelect').value=selectedCatalog;
  await catalogManager.load(`${ALLOWED_CATALOGS[selectedCatalog]}?v=4.4a4`);
  TOTAL=catalogManager.eligibleIds(1).length;
  document.title=`${catalogManager.config.nombre} · Alquidémica`;
  applyCatalogTheme(catalogManager.config);
  $('pageTitle').textContent=catalogModeTitle('lottery');
  const setInstruction=(id,key,fallback)=>{$(id).textContent=catalogInstruction(key,fallback);};
  setInstruction('lotteryHint','loteriaPista','Durante la partida también puedes usar Espacio o →');
  setInstruction('studySearchLabel','buscarEtiqueta','Buscar carta');
  $('studySearch').placeholder=catalogInstruction('buscarEjemplo',catalogManager.config.ejemploBusqueda||'Buscar carta…');
  setInstruction('studyIntro','estudioNota','Explora el catálogo por nivel y categoría.');
  setInstruction('emptyStudy','estudioVacio','No se encontraron cartas.');
  setInstruction('randomIntro','aleatorioPreparacion','Evalúa tus respuestas y repasa los conceptos.');
  setInstruction('randomInstruction','aleatorioInstruccion','Intenta identificar la carta antes de ver su descripción.');
  setInstruction('memoryIntro','memoriaPreparacion','Encuentra parejas idénticas de la baraja seleccionada.');
  // Precarga escalonada con límite de seis imágenes simultáneas.
  const pending=[0,...catalogManager.getIds()];
  let loaded=0,next=0;
  async function worker(){while(next<pending.length){
   const id=pending[next++],url=catalogManager.imageUrl(id),image=new Image();
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error(url));image.src=url;if(image.complete)image.naturalWidth?resolve():reject(new Error(url));});
   images.set(id,image);loaded++;status.textContent=`Preparando cartas: ${loaded} de ${pending.length}…`;
  }}
  await Promise.all(Array.from({length:Math.min(6,pending.length)},worker));
  loading=false;renderCard(0);updateLotterySelection();
  mainBtn.textContent='BARAJAR Y COMENZAR';syncButtons();
 }catch(e){status.textContent=`Error al cargar ${e.message}. Comprueba los archivos y recarga.`;mainBtn.textContent='ERROR DE CARGA';}
}
function shuffled(ids){const result=[...ids];for(let i=result.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function eligibleIds(level,category=0,novelty='all'){return catalogManager.eligibleIds(level,category,novelty);}
function lotterySelectionIds(){return eligibleIds(Number($('lotteryLevel').value),0,$('lotteryNovelty').value);}
function updateLotterySelection(){
 if(loading||playing)return;
 const ids=lotterySelectionIds();TOTAL=ids.length;ready=false;finished=false;position=-1;deck=[];
 renderCard(0);status.textContent=`${TOTAL} cartas disponibles · ${catalogManager.config.nombre}`;
 mainBtn.textContent='BARAJAR Y COMENZAR';mainBtn.disabled=!TOTAL;
 shuffleBtn.classList.add('hidden');syncButtons();
 if(!TOTAL)mainBtn.disabled=true;
}
$('lotteryLevel').addEventListener('change',updateLotterySelection);
$('lotteryNovelty').addEventListener('change',updateLotterySelection);
function shuffleDeck(){if(loading||changing||modalOpen||randomLocked||memoryLocked)return;
 deck=shuffled(lotterySelectionIds());
 TOTAL=deck.length;
 position=-1;playing=false;finished=false;ready=true;renderCard(0);
 status.textContent=`Mazo barajado · ${TOTAL} cartas`;mainBtn.textContent='COMENZAR';shuffleBtn.classList.remove('hidden');syncButtons();}
function startGame(){if(loading||changing||modalOpen||!lotterySelectionIds().length)return;if(!ready)shuffleDeck();playing=true;ready=false;finished=false;mainBtn.textContent='ECHAR CARTA';drawNext();}
function drawNext(){if(!playing||finished||loading||changing||modalOpen)return;
 if(position+1>=deck.length){endGame();return;}
 changing=true;position++;renderCard(deck[position]);status.textContent=`Carta ${position+1} de ${TOTAL}`;
 if(position===deck.length-1)mainBtn.textContent='TERMINAR';
 requestAnimationFrame(()=>requestAnimationFrame(()=>{changing=false;syncButtons();}));}
function endGame(){finished=true;playing=false;ready=false;status.innerHTML=`<span class="finished">¡LOTERÍA!</span><br>Se han echado las ${TOTAL} cartas.`;mainBtn.textContent='BARAJAR DE NUEVO';shuffleBtn.classList.add('hidden');syncButtons();}
function openDescription(id=currentCard,trigger=document.activeElement){if(id===0||!cardContent(id,activeContentLevel())||loading||changing||modalOpen)return;
 $('randomRating').classList.add('hidden');$('randomFeedback').classList.add('hidden');closeBtn.disabled=false;closeBtn.classList.remove('hidden');
 const content=cardContent(id,activeContentLevel());
 descriptionTitle.textContent=content.nombre;descriptionText.textContent=content.descripcion;
 descriptionTrigger=trigger;modalOpen=true;modal.classList.remove('hidden');$('app').inert=true;document.body.classList.add('modal-open');syncButtons();closeBtn.focus({preventScroll:true});}
function closeDescription(){if(!modalOpen||closeBtn.disabled)return;modalOpen=false;modal.classList.add('hidden');modal.classList.remove('cover-dialog');$('startCoverBtn').classList.add('hidden');closeBtn.textContent='ENTENDIDO';$('app').inert=false;document.body.classList.remove('modal-open');syncButtons();descriptionTrigger?.focus({preventScroll:true});descriptionTrigger=null;if(activeMode==='random')afterRandomDescription();if(activeMode==='memory')afterMemoryDescription();}
mainBtn.addEventListener('click',()=>{if(finished){shuffleDeck();return;}if(!playing){startGame();return;}drawNext();});
shuffleBtn.addEventListener('click',()=>{if(!playing||confirm('¿Barajar de nuevo? Se reiniciará la partida actual.'))shuffleDeck();});
function configureLottery(){
 if(activeMode!=='lottery'||!finished||loading||changing||modalOpen)return;
 // Regresa a la portada sin modificar el nivel ni la seleccion elegidos.
 updateLotterySelection();
}
descriptionBtn.addEventListener('click',()=>{
 if(finished){configureLottery();return;}
 openDescription(currentCard,descriptionBtn);
});
closeBtn.addEventListener('click',closeDescription);
document.addEventListener('keydown',e=>{if(modalOpen){if(e.code==='Escape'){e.preventDefault();closeDescription();}else if(e.key==='Tab'){e.preventDefault();const buttons=[...modal.querySelectorAll('button')].filter(b=>!b.disabled&&!b.closest('.hidden'));const i=buttons.indexOf(document.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus({preventScroll:true});}return;}
 if(activeMode==='lottery'&&(e.code==='Space'||e.code==='ArrowRight')&&playing&&!finished&&!e.target.closest('input,select,textarea,.mode-nav')){e.preventDefault();if(!e.repeat)drawNext();}});

// Las cartas de lotería son activables al toque y mediante teclado.
function revealLotteryCard(){
 if(activeMode!=='lottery'||loading||changing||modalOpen||memoryLocked||randomLocked)return;
 if(currentCard!==0){openDescription(currentCard,card);return;}
 $('randomRating').classList.add('hidden');$('randomFeedback').classList.add('hidden');
 descriptionTitle.textContent=catalogInstruction('preguntaInicio','¿Comenzamos la lotería?');descriptionText.textContent='';
 $('startCoverBtn').classList.remove('hidden');closeBtn.textContent='CANCELAR';closeBtn.disabled=false;
 descriptionTrigger=card;modalOpen=true;modal.classList.add('cover-dialog');modal.classList.remove('hidden');
 $('app').inert=true;document.body.classList.add('modal-open');syncButtons();$('startCoverBtn').focus({preventScroll:true});
}
card.addEventListener('click',revealLotteryCard);
card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();revealLotteryCard();}});
$('startCoverBtn').addEventListener('click',()=>{if(!modalOpen||!modal.classList.contains('cover-dialog'))return;closeDescription();startGame();});
$('catalogSelect').addEventListener('change',event=>{
 const target=event.target.value;
 if(!Object.hasOwn(ALLOWED_CATALOGS,target))return;
 if(modalOpen||randomLocked||memoryLocked){event.target.value=selectedCatalog;return;}
 if(playing&&!confirm('Cambiar de baraja reiniciará la partida de lotería. ¿Continuar?')){event.target.value=selectedCatalog;return;}
 const url=new URL(location.href);
 if(target==='laboratorio')url.searchParams.delete('catalogo');
 else url.searchParams.set('catalogo',target);
 location.assign(url.href);
});

loadApp();
