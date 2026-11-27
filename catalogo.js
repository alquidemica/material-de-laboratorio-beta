"use strict";
const APP_VERSION="v4.4 · RC1";
const UI_TEXT_ES=Object.freeze({
 catalogLoading:"Preparando cartas: {count} de {total}…",
 catalogAvailable:"{count} cartas disponibles · {catalog}",
 catalogShuffled:"Mazo barajado · {count} cartas",
 lotteryFinished:"Se han echado las {count} cartas.",
 cardFound:"{count} cartas encontradas",
 memoryCandidates:"{count} cartas disponibles para elegir · se necesitan {pairs} parejas",
 memoryPairs:"Parejas: {count} de {total}",
 memoryErrors:"Errores: {count}",
 memoryTime:"Tiempo: {time}",
 notEnoughCards:"No hay suficientes cartas para iniciar.",
 randomAvailable:"{count} cartas disponibles",
 randomKnown:"¡Bien! Carta reconocida.",
 randomReview:"Enviado al final de la baraja para repasar."
});
function uiText(key,values={}){
 const text=UI_TEXT_ES[key];
 if(typeof text!=="string")throw new Error(`Texto de interfaz no definido: ${key}`);
 return text.replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(values,name)?String(values[name]):match);
}

/* Alquidémica v4.4 alpha 4: capa de datos independiente de los juegos.
   El adaptador 'legacy' mantiene el formato de materiales.json y las 42 imágenes.
   En fases siguientes admitiremos texto por idioma/nivel sin cambiar los juegos. */
class CatalogManager {
 constructor(){this.config=null;this.items={};this.ids=[];this.categories={};this.locale='es';}
 async load(manifestUrl){
  const manifest=await this.readJson(manifestUrl);
  const required=['id','nombre','datos','imagenes','portada','categorias','niveles'];
  for(const field of required)if(!manifest[field])throw new Error(`Catálogo: falta ${field}`);
  if(!Array.isArray(manifest.niveles)||!manifest.niveles.length)throw new Error('Catálogo: niveles incorrectos');
  const levelNumbers=manifest.niveles.map(l=>Number(l.id));
  if(levelNumbers.some(n=>!Number.isSafeInteger(n)||n<1)||new Set(levelNumbers).size!==levelNumbers.length)
   throw new Error('Catálogo: IDs de nivel inválidos o repetidos');
  if(!manifest.categorias||typeof manifest.categorias!=='object'||Array.isArray(manifest.categorias)||
     !Object.keys(manifest.categorias).length)
   throw new Error('Catálogo: categorías incorrectas');
  if(typeof manifest.imagenes!=='string'||!manifest.imagenes.includes('{id}')||typeof manifest.portada!=='string')
   throw new Error('Catálogo: rutas de imágenes incorrectas');
  const raw=await this.readJson(new URL(manifest.datos,new URL(manifestUrl,location.href)).href);
  const rawKeys=Object.keys(raw);
  if(rawKeys.some(key=>!(/^(0|[1-9]\d*)$/.test(key)&&Number.isSafeInteger(Number(key)))))
   throw new Error('Catálogo: identificadores de cartas inválidos');
  // El ID 0 está reservado para portada y no cuenta como carta de juego.
  const ids=rawKeys.map(Number).filter(id=>id>0).sort((a,b)=>a-b);
  if(!ids.length)throw new Error('Catálogo sin cartas');
  const levels=new Set(manifest.niveles.map(level=>Number(level.id)));
  for(const id of ids){
   const m=raw[id];
   if(m&&m.contenidoPorNivel!==undefined){
    if(!m.contenidoPorNivel||typeof m.contenidoPorNivel!=='object'||Array.isArray(m.contenidoPorNivel)||
       Object.keys(m.contenidoPorNivel).some(n=>!levels.has(Number(n))))
     throw new Error(`Ficha ${id}: contenidoPorNivel inválido`);
   }
   // Campo opcional durante la transición editorial de las 110 cartas.
   // Cuando se proporciona, debe ser texto no vacío en cualquiera de sus variantes.
   const validEssential=value=>value===undefined||(typeof value==='string'&&value.trim().length>0);
   if(!validEssential(m?.funcionEsencial))throw new Error(`Ficha ${id}: funcionEsencial invalida`);
   const translated=Object.values(m?.traducciones||{});
   const tierVariants=Object.values(m?.contenidoPorNivel||{}).flatMap(block=>Object.values(block||{}));
   if([...translated,...tierVariants].some(block=>block&&typeof block==='object'&&!validEssential(block.funcionEsencial)))
    throw new Error(`Ficha ${id}: funcionEsencial invalida`);
   if(!m||typeof m.nombre!=='string'||!m.nombre.trim()||typeof m.descripcion!=='string'||!m.descripcion.trim()||!levels.has(m.nivel)||!Array.isArray(m.categorias)||!m.categorias.length||m.categorias.some(cat=>!Object.hasOwn(manifest.categorias,cat)))throw new Error(`Ficha ${id} incompleta`);
  }
  this.config=manifest;this.items=raw;this.ids=ids;this.categories=manifest.categorias;this.locale=manifest.idiomaBase||'es';
  return this;
 }
 async readJson(url){const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw new Error(`No se pudo cargar ${url}`);return r.json();}
 eligibleIds(level,category=0,novelty='all'){
  const academicLevel=Number(level);
  return this.ids.filter(id=>{
   const item=this.items[id];
   return item.nivel<=academicLevel && (!category||item.categorias.includes(Number(category))) &&
    (novelty==='all'||(novelty==='new'&&item.nivel===academicLevel));
  });
 }
 countByLevel(level,novelty='all'){return this.eligibleIds(level,0,novelty).length;}
 getLevelName(level){return this.config?.niveles?.find(l=>Number(l.id)===Number(level))?.nombre||`Nivel ${level}`;}
 imageUrl(id){
  if(id===0)return this.config.portada;
  const override=this.items[id]?.imagen;
  if(typeof override==='string'&&/^[a-zA-Z0-9/_-]+\.(webp|png|jpg|jpeg|svg)(\?v=[a-zA-Z0-9.]+)?$/.test(override))return override;
  return this.config.imagenes.replaceAll('{id}',String(id));
 }
 // La primera ficha de nivel inferior se reutiliza hasta que exista una versión ampliada.
 getContent(id,{level=1,locale=this.locale}={}){
  const item=this.items[id];if(!item)return null;
  const baseLocale=this.config.idiomaBase||'es';
  const translations=item.traducciones||{};
  const byLevel=item.contenidoPorNivel||{};
  // Si no hay traducción, conservamos el contenido base en español.
  const result={...item,...(translations[baseLocale]||{}),...(translations[locale]||{})};
  const suitable=Object.keys(byLevel).map(Number).filter(n=>Number.isFinite(n)&&n<=level).sort((a,b)=>a-b);
  for(const n of suitable){
   const block=byLevel[n];
   if(!block||typeof block!=='object')continue;
   // Permite fichas por nivel con {es:{...}, en:{...}}.
   Object.assign(result,block[baseLocale]||{},block[locale]||{});
  }
  return result;
 }
 getIds(){return [...this.ids];}
 getCategories(){return {...this.categories};}
 getCard(id,level=1,locale=this.locale){return this.getContent(id,{level,locale});}
 // Función breve separada de la descripción. Puede variar por idioma y nivel.
 // Si todavía no se ha redactado, devuelve null sin afectar los juegos.
 getEssentialFunction(id,level=1,locale=this.locale){
  const content=this.getCard(id,level,locale);
  const value=content?.funcionEsencial;
  return typeof value==='string'&&value.trim()?value.trim():null;
 }


}
const catalogManager=new CatalogManager();

/* v4.4 Alfa 4: configuración visual y educativa declarativa.
   Solo toma datos del manifiesto de la baraja seleccionada. */
const DEFAULT_CATALOG_TITLES={lottery:'Lotería',study:'Estudio libre',random:'Estudio aleatorio',memory:'Memoria'};
const CATALOG_COLOR_TOKENS={
 acento:'--tema-acento',principal:'--tema-principal',secundario:'--tema-secundario',
 texto:'--tema-texto',panel:'--tema-panel',panelTexto:'--tema-panel-texto',
 modal:'--tema-modal',modalTexto:'--tema-modal-texto',borde:'--tema-borde',
 reversoInicio:'--tema-reverso-inicio',reversoFin:'--tema-reverso-fin'
};
function applyCatalogTheme(config){
 const root=document.documentElement,colors=config.tema?.colores||{};
 for(const [key,token] of Object.entries(CATALOG_COLOR_TOKENS)){
  const value=colors[key];
  // Colores declarativos; no ejecutamos CSS arbitrario para los controles.
  if(typeof value==='string'&&/^#[0-9a-fA-F]{3,8}$/.test(value))root.style.setProperty(token,value);
  else root.style.removeProperty(token);
 }
 const fondo=config.tema?.fondo||{};
 const bgColor=typeof fondo.color==='string'&&/^#[0-9a-fA-F]{3,8}$/.test(fondo.color)?fondo.color:'#15578b';
 document.body.style.backgroundColor=bgColor;
 if(fondo.tipo==='imagen'&&typeof fondo.valor==='string'&&/^[a-zA-Z0-9/_-]+\.(webp|png|jpg|jpeg|svg)$/.test(fondo.valor)){
  document.body.style.backgroundImage=`url("${fondo.valor}")`;
 }else if(fondo.tipo==='degradado'&&typeof fondo.valor==='string'&&fondo.valor.startsWith('radial-gradient(')){
  document.body.style.backgroundImage=fondo.valor;
 }else document.body.style.backgroundImage='none';
 document.body.dataset.catalogTheme=config.id;
}
function catalogInstruction(key,fallback=''){
 return catalogManager.config?.instrucciones?.[key]||fallback;
}
function catalogModeTitle(mode){
 return catalogManager.config?.titulos?.[mode]||DEFAULT_CATALOG_TITLES[mode]||'Alquidémica';
}
