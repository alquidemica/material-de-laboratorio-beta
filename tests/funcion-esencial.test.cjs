"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'catalogo.js'),'utf8');
const context=vm.createContext({URL,console,location:{href:'https://example.test/'}});
vm.runInContext(source,context,{filename:'catalogo.js'});
const Manager=vm.runInContext('CatalogManager',context);
async function managerWithData(){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'catalogos/laboratorio.json'),'utf8'));
 const records=JSON.parse(fs.readFileSync(path.join(root,'materiales.json'),'utf8'));
 const url='https://example.test/catalogos/laboratorio.json';
 const manager=new Manager();
 manager.readJson=async requested=>requested===url?manifest:records;
 await manager.load(url);
 return {manager,records,manifest,url};
}
test('Funcion esencial: existe como campo separado y accesible desde el gestor',async()=>{
 const {manager}=await managerWithData();
 assert.match(manager.getEssentialFunction(1),/Contener/);
 assert.equal(manager.getCard(1).funcionEsencial,manager.getEssentialFunction(1));
 assert.ok(manager.getCard(1).descripcion.length>0);
});
test('Funcion esencial: cartas antiguas sin el campo siguen funcionando',async()=>{
 const {manager}=await managerWithData();
 assert.equal(manager.getEssentialFunction(3),null);
 assert.ok(manager.getCard(3).descripcion);
});
test('Funcion esencial: permite especializaciones por nivel e idioma',async()=>{
 const {manager}=await managerWithData();
 manager.items[1].contenidoPorNivel={
  '2':{es:{funcionEsencial:'Función avanzada de preparatoria.'},en:{funcionEsencial:'High school essential function.'}},
  '3':{es:{funcionEsencial:'Función universitaria.'}}
 };
 assert.equal(manager.getEssentialFunction(1,1),'Contener, mezclar y calentar sustancias; sus marcas solo permiten estimar volúmenes.');
 assert.equal(manager.getEssentialFunction(1,2,'es'),'Función avanzada de preparatoria.');
 assert.equal(manager.getEssentialFunction(1,2,'en'),'High school essential function.');
 assert.equal(manager.getEssentialFunction(1,3,'es'),'Función universitaria.');
});
test('Funcion esencial: rechaza cadenas vacias',async()=>{
 const {manager,records,manifest,url}=await managerWithData();
 records[1].funcionEsencial='   ';
 manager.readJson=async requested=>requested===url?manifest:records;
 await assert.rejects(manager.load(url),/funcionEsencial invalida/);
});
