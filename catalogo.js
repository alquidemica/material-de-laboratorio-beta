"use strict";
/* Alquidémica v4.4 alpha 1: capa de datos independiente de los juegos.
   El adaptador 'legacy' mantiene el formato de materiales.json y las 42 imágenes.
   En fases siguientes admitiremos texto por idioma/nivel sin cambiar los juegos. */
class CatalogManager {
 constructor(){this.config=null;this.items={};this.ids=[];this.categories={};this.locale='es';}
 async load(manifestUrl){
  const manifest=await this.readJson(manifestUrl);
  const required=['id','nombre','datos','imagenes','portada','categorias','niveles'];
  for(const field of required)if(!manifest[field])throw new Error(`Catálogo: falta ${field}`);
  if(!Array.isArray(manifest.niveles)||!manifest.niveles.length)throw new Error('Catálogo: niveles incorrectos');
  const raw=await this.readJson(new URL(manifest.datos,new URL(manifestUrl,location.href)).href);
  const ids=Object.keys(raw).map(Number).filter(id=>Number.isSafeInteger(id)&&id>0).sort((a,b)=>a-b);
  if(!ids.length)throw new Error('Catálogo sin cartas');
  const levels=new Set(manifest.niveles.map(level=>Number(level.id)));
  for(const id of ids){
   const m=raw[id];
   if(!m||typeof m.nombre!=='string'||!m.nombre.trim()||typeof m.descripcion!=='string'||!m.descripcion.trim()||!levels.has(m.nivel)||!Array.isArray(m.categorias)||!m.categorias.length||m.categorias.some(cat=>!Object.hasOwn(manifest.categorias,cat)))throw new Error(`Ficha ${id} incompleta`);
  }
  this.config=manifest;this.items=raw;this.ids=ids;this.categories=manifest.categorias;this.locale=manifest.idiomaBase||'es';
  return this;
 }
 async readJson(url){const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw new Error(`No se pudo cargar ${url}`);return r.json();}
 eligibleIds(level,category=0){return this.ids.filter(id=>this.items[id].nivel<=level&&(!category||this.items[id].categorias.includes(category)));}
 imageUrl(id){return id===0?this.config.portada:this.config.imagenes.replaceAll('{id}',String(id));}
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

}
const catalogManager=new CatalogManager();
