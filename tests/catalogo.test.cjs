"use strict";
/* Pruebas de regresión del gestor de catálogos.
   Desde la raíz del repositorio: node --test tests/catalogo.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "catalogo.js"), "utf8");
// catalogo.js utiliza location.href para resolver las rutas relativas de los JSON.
// En un navegador location existe; en vm de Node hay que proporcionarlo.
const context = vm.createContext({
  URL,
  console,
  location: { href: "https://example.test/" }
});
vm.runInContext(source, context, { filename: "catalogo.js" });
const CatalogManager = vm.runInContext("CatalogManager", context);
const uiText = vm.runInContext("uiText", context);

async function fixture(manifestPath, dataPath) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), "utf8"));
  const records = JSON.parse(fs.readFileSync(path.join(root, dataPath), "utf8"));
  const url = new URL(manifestPath, "https://example.test/").href;
  const manager = new CatalogManager();
  // Evitamos la red: readJson entrega los mismos JSON que usa la aplicación.
  manager.readJson = async requested => requested === url ? manifest : records;
  await manager.load(url);
  return { manager, manifest, records, url };
}

const lab = () => fixture("catalogos/laboratorio.json", "materiales.json");
const elements = () => fixture("catalogos/elementos-demo/manifest.json", "catalogos/elementos-demo/elementos.json");

test("Laboratorio: 42, 47 y 52 cartas acumulativas", async () => {
  const { manager } = await lab();
  assert.equal(manager.getIds().length, 52);
  assert.deepEqual([1, 2, 3].map(level => manager.countByLevel(level)), [42, 47, 52]);
  assert.deepEqual([2, 3].map(level => manager.countByLevel(level, "new")), [5, 5]);
  assert.equal(manager.getIds().includes(0), false, "La portada no pertenece al mazo");
});

test("Laboratorio: todas las cartas tienen contenido y una imagen definida", async () => {
  const { manager } = await lab();
  for (const id of manager.getIds()) {
    const content = manager.getCard(id, 3);
    assert.ok(content.nombre?.trim(), `Carta ${id}: sin nombre`);
    assert.ok(content.descripcion?.trim(), `Carta ${id}: sin descripción`);
    assert.ok(manager.imageUrl(id), `Carta ${id}: sin ruta de imagen`);
  }
  assert.ok(manager.imageUrl(0), "Falta la ruta de la portada");
});

test("Elementos demo: 12 cartas y ninguna novedad académica adicional", async () => {
  const { manager } = await elements();
  assert.equal(manager.getIds().length, 12);
  assert.deepEqual([1, 2, 3].map(level => manager.countByLevel(level)), [12, 12, 12]);
  assert.equal(manager.countByLevel(2, "new"), 0);
  assert.equal(manager.countByLevel(3, "new"), 0);
});

test("Validador: rechaza fichas con un nivel inexistente", async () => {
  const { manager, manifest, records, url } = await lab();
  const invalid = structuredClone(records);
  invalid[manager.getIds()[0]].nivel = 999;
  manager.readJson = async requested => requested === url ? manifest : invalid;
  await assert.rejects(manager.load(url), /Ficha .* incompleta/);
});

test("Validador: rechaza identificadores no numéricos", async () => {
  const { manager, manifest, records, url } = await lab();
  const invalid = structuredClone(records);
  invalid.cartaExtra = { ...invalid[manager.getIds()[0]] };
  manager.readJson = async requested => requested === url ? manifest : invalid;
  await assert.rejects(manager.load(url), /identificadores de cartas inválidos/);
});

test("Validador: rechaza categorías desconocidas", async () => {
  const { manager, manifest, records, url } = await lab();
  const invalid = structuredClone(records);
  invalid[manager.getIds()[0]].categorias = [999];
  manager.readJson = async requested => requested === url ? manifest : invalid;
  await assert.rejects(manager.load(url), /Ficha .* incompleta/);
});

test("Diccionario: sustituye parámetros de los mensajes", () => {
  assert.equal(uiText("memoryPairs", { count: 2, total: 9 }), "Parejas: 2 de 9");
  assert.equal(uiText("catalogLoading", { count: 1, total: 53 }), "Preparando cartas: 1 de 53…");
});

test("Diccionario: señala claves inexistentes", () => {
  assert.throws(() => uiText("claveInexistente"), /Texto de interfaz no definido/);
});
