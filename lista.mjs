import { readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';

const ruta = './db/clientes.json';

// Leer lista actual (oculta los que tienen estatus "Completado")
export async function obtenerLista() {
  try {
    const contenido = await readFile(ruta, 'utf-8');
    const lista = JSON.parse(contenido);
    return lista.filter(cliente => cliente.estatus !== 'Completado');
  } catch {
    return [];
  }
}

// Guardar un nuevo cliente con ID único
export async function guardarCliente(cliente) {
  const lista = await obtenerLista();
  cliente.id = cliente.id || randomUUID(); // 👈 genera ID si no existe
  lista.push(cliente);
  await writeFile(ruta, JSON.stringify(lista, null, 2));
  return cliente; // ✅ devolvemos el cliente completo, no solo su ID
}

// Eliminar cliente por ID
export async function eliminarCliente(id) {
  const lista = await obtenerLista();
  const nuevaLista = lista.filter(c => c.id !== id);
  await writeFile(ruta, JSON.stringify(nuevaLista, null, 2));
}

// Marcar cliente como finalizado por ID
export async function finalizarCliente(id) {
  const lista = await obtenerLista();
  const modificada = lista.map(c =>
    c.id === id ? { ...c, finalizado: true } : c
  );
  await writeFile(ruta, JSON.stringify(modificada, null, 2));
}
export async function guardarLista(lista) {
  await writeFile(ruta, JSON.stringify(lista, null, 2));
}
