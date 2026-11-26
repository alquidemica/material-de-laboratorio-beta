"use strict";
/* Ejecutar desde la raíz: node --test tests/catalogo.test.cjs */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"catalogo.js"),"utf8");
const context=vm.createContext({URL,console});
vm.runInContext(source,context,{filename:"catalogo.js"});
const CatalogManager=vm.runInContext("CatalogManager",context);
const uiText=vm.runInContext("uiText",context);

async function fixture(manifestPath,dataPath){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,manifestPath),"utf8"));
 const records=JSON.parse(fs.readFileSync(path.join(root,dataPath),"utf8"));
 const url=new URL(manifestPath,"https://example.test/").href;
 const manager=new CatalogManager();
 manager.readJson=async requested=>requested===url?manifest:records;
 await manager.load(url);
 return {manager,manifest,records,url};
}
test("laboratorio: niveles acumulativos y novedades",async()=>{
 const {manager}=await fixture("catalogos/laboratorio.json","materiales.json");
 assert.equal(manager.getIds().length,52);
 assert.deepEqual([1,2,3].map(l=>manager.countByLevel(l)),[42,47,52]);
 assert.deepEqual([2,3].map(l=>manager.countByLevel(l,"new")),[5,5]);
 assert.equal(manager.getIds().includes(0),false);
});
test("elementos demo: doce cartas y ningún nivel adicional",async()=>{
 const {manager}=await fixture("catalogos/elementos-demo/manifest.json","catalogos/elementos-demo/elementos.json");
 assert.equal(manager.getIds().length,12);
 assert.deepEqual([1,2,3].map(l=>manager.countByLevel(l)),[12,12,12]);
});
test("validación: rechaza nivel inexistente",async()=>{
 const {manager,manifest,records,url}=await fixture("catalogos/laboratorio.json","materiales.json");
 const invalid=structuredClone(records);
 const first=manager.getIds()[0];
 invalid[first].nivel=999;
 manager.readJson=async requested=>requested===url?manifest:invalid;
 await assert.rejects(manager.load(url),/Ficha .* incompleta/);
});
test("textos centralizados conservan sustituciones",()=>{
 assert.equal(uiText("memoryPairs",{count:2,total:9}),"Parejas: 2 de 9");
 assert.equal(uiText("catalogLoading",{count:1,total:53}),"Preparando cartas: 1 de 53…");
});
