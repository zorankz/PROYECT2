import { readFile, writeFile, access } from 'fs/promises';

import pkg from 'uuid';
const { v4: uuidv4 } = pkg;

const RUTA_MENSAJES = './db/mensajes.json';
const RUTA_CLIENTES = './db/contactos.json';

// Crear archivos si no existen
async function inicializarDB() {
  try {
    await access(RUTA_MENSAJES);
  } catch {
    await writeFile(RUTA_MENSAJES, '{}', 'utf-8');
  }
  
  try {
    await access(RUTA_CLIENTES);
  } catch {
    await writeFile(RUTA_CLIENTES, '{}', 'utf-8');
  }
}

await inicializarDB();

export async function obtenerClientes() {
  const raw = await readFile(RUTA_CLIENTES, 'utf-8');
  return JSON.parse(raw);
}

export async function crearCliente(datos) {
  const clientes = await obtenerClientes();
  const id = uuidv4();
  
  const nuevoCliente = {
    id,
    ...datos,
    fechaCreacion: new Date().toISOString(),
    status: 'pendiente',
    mensajes: []
  };
  
  clientes[id] = nuevoCliente;
  await writeFile(RUTA_CLIENTES, JSON.stringify(clientes, null, 2), 'utf-8');
  return nuevoCliente;
}

export async function obtenerMensajes(clienteID) {
  const raw = await readFile(RUTA_MENSAJES, 'utf-8');
  const datos = JSON.parse(raw);
  return datos[clienteID] || [];
}

const rutaMensajes = './db/mensajes.json';

export async function guardarMensaje(clienteId, { autor, texto }) {
  let mensajes = {};

  try {
    const contenido = await readFile(RUTA_MENSAJES, 'utf-8');
    mensajes = JSON.parse(contenido || '{}');
  } catch (err) {
    console.error('❌ Error leyendo mensajes.json:', err);
    mensajes = {};
  }

  if (!mensajes[clienteId]) {
    mensajes[clienteId] = [];
  }

  const nuevoMensaje = {
    autor,
    texto,
    fecha: new Date().toISOString(),
    leido: false
  };

  mensajes[clienteId].push(nuevoMensaje);

  await writeFile(RUTA_MENSAJES, JSON.stringify(mensajes, null, 2), 'utf-8');
  
  return nuevoMensaje;
}




export async function actualizarStatus(clienteID, status) {
  const clientes = await obtenerClientes();
  if (!clientes[clienteID]) {
    throw new Error('Cliente no encontrado');
  }

  clientes[clienteID].status = status;
  await writeFile(RUTA_CLIENTES, JSON.stringify(clientes, null, 2), 'utf-8');
  return clientes[clienteID];
}



