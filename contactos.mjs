import fs from 'fs/promises';
const ruta = './db/clientes.json';

export async function guardarContacto(cliente) {
  try {
    let contenido = '{}';

    try {
      contenido = await fs.readFile(ruta, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Si el archivo no existe, se crea
        await fs.writeFile(ruta, '{}');
        contenido = '{}';
      } else {
        throw err;
      }
    }

    let contactos = {};

    try {
      contactos = JSON.parse(contenido);
    } catch (err) {
      console.error('❌ JSON inválido en contactos.json:', contenido);
      contactos = {};
    }

    contactos[cliente.id] = cliente;

    await fs.writeFile(ruta, JSON.stringify(contactos, null, 2));
    console.log('✅ Contacto guardado:', cliente.nombre);
  } catch (error) {
    console.error('❌ Error guardando contacto:', error);
    throw error;
  }
}
export async function obtenerContactos() {
  try {
    const contenido = await fs.readFile('./db/clientes.json', 'utf8');
    return JSON.parse(contenido);
  } catch (err) {
    console.error('❌ Error leyendo contactos:', err);
    return {};
  }
}
