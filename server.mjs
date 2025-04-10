process.env.IS_RENDER = 'true';

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFile, writeFile, mkdir } from 'fs/promises';
import fs from 'fs';
import { obtenerMensajes, guardarMensaje, obtenerClientes } from './chat.mjs';
import { guardarContacto, obtenerContactos } from './contactos.mjs';
import crypto from 'crypto';
import { Server } from 'socket.io';
import consultarEOIR from './scraper.mjs';
import shipstationRoutes from './shipstation.mjs';
import { obtenerLista, guardarLista, guardarCliente, eliminarCliente, finalizarCliente } from './lista.mjs';

import { obtenerCitas, cancelarCita } from './google.mjs';
import clientesRouter from './rutas/clientes.js';


// Configuración inicial
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HITOS_PATH = path.join(__dirname, 'db', 'hitos.json');

// Asegurar que existan los directorios y archivos necesarios
if (!fs.existsSync(path.join(__dirname, 'db'))) {
  fs.mkdirSync(path.join(__dirname, 'db'));
}

if (!fs.existsSync(HITOS_PATH)) {
  fs.writeFileSync(HITOS_PATH, '{}', 'utf-8');
}

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(clientesRouter);
// Constantes
const ASESOR_ID = 'asesor-zoran-001';

// Rutas
shipstationRoutes(app);
const rutaClientes = path.join(__dirname, 'db', 'clientes.json');

function cargarClientes() {
  try {
    const data = fs.readFileSync(rutaClientes, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('❌ Error cargando clientes:', err);
    return [];
  }
}

function guardarClientes(clientes) {
  try {
    fs.writeFileSync(rutaClientes, JSON.stringify(clientes, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('❌ Error guardando clientes:', err);
    return false;
  }
}

// ========== Funciones para hitos ==========
function cargarHitos() {
  try {
    const raw = fs.readFileSync(HITOS_PATH, 'utf-8');
    return JSON.parse(raw) || {};
  } catch (err) {
    console.error('❌ Error cargando hitos:', err);
    return {};
  }
}

function guardarHitos(hitos) {
  try {
    fs.writeFileSync(HITOS_PATH, JSON.stringify(hitos, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('❌ Error guardando hitos:', err);
    return false;
  }
}
app.put('/editar-cliente/:id', async (req, res) => {
  const clienteId = req.params.id;
  const datosActualizados = req.body;

  try {
    const clientes = cargarClientes();
    const index = clientes.findIndex(c => c.id === clienteId);

    if (index === -1) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    clientes[index] = {
      ...clientes[index],
      ...datosActualizados
    };

    guardarClientes(clientes);
    res.json(clientes[index]);
  } catch (err) {
    console.error('❌ Error en PUT /editar-cliente/:id:', err);
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
});

// ========== Endpoints para hitos ==========
app.get('/hitos/:clienteId', (req, res) => {
  try {
    const { clienteId } = req.params;
    const hitos = cargarHitos();
    
    if (!hitos[clienteId]) {
      return res.json([]);
    }
    
    res.json(hitos[clienteId]);
  } catch (err) {
    console.error('❌ Error en GET /hitos:', err);
    res.status(500).json({ error: 'Error al obtener hitos' });
  }
});

app.post('/agregar-hito/:clienteId', (req, res) => {
  const { clienteId } = req.params;
  const datosHito = req.body;
  const clientes = cargarClientes();

  const cliente = clientes.find(c => c.id === clienteId);

  if (!cliente) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  const nuevoHito = {
    id: crypto.randomUUID(),
    ...datosHito
  };

  if (!cliente.hitos) cliente.hitos = [];
  cliente.hitos.push(nuevoHito);

  if (guardarClientes(clientes)) {
    // Emitir evento en tiempo real al cliente correspondiente
    io.to(clienteId).emit('progreso-actualizado');

    res.json({ ok: true, hito: nuevoHito });
  } else {
    res.status(500).json({ error: 'Error al guardar el hito' });
  }
});

app.put('/editar-hito/:clienteId/:hitoId', (req, res) => {
  try {
    const { clienteId, hitoId } = req.params;
    const datosActualizados = req.body;
    const clientes = cargarClientes();

    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente || !cliente.hitos) {
      return res.status(404).json({ error: 'Cliente o hitos no encontrados' });
    }

    const hitoIndex = cliente.hitos.findIndex(h => h.id === hitoId);
    if (hitoIndex === -1) {
      return res.status(404).json({ error: 'Hito no encontrado' });
    }

    cliente.hitos[hitoIndex] = {
      ...cliente.hitos[hitoIndex],
      ...datosActualizados,
      fechaActualizacion: new Date().toISOString()
    };

    if (guardarClientes(clientes)) {
      io.to(clienteId).emit('progreso-actualizado'); // 🔴 Emitimos al cliente

      res.json({ ok: true, hito: cliente.hitos[hitoIndex] });
    } else {
      throw new Error('Error al guardar clientes con hito editado');
    }
  } catch (err) {
    console.error('❌ Error en PUT /editar-hito:', err);
    res.status(500).json({ error: 'Error al editar hito' });
  }
});

app.delete('/eliminar-hito/:clienteId/:hitoId', (req, res) => {
  try {
    const { clienteId, hitoId } = req.params;
    const clientes = cargarClientes();

    const cliente = clientes.find(c => c.id === clienteId);
    if (!cliente || !cliente.hitos) {
      return res.status(404).json({ error: 'Cliente o hitos no encontrados' });
    }

    const hitoIndex = cliente.hitos.findIndex(h => h.id === hitoId);
    if (hitoIndex === -1) {
      return res.status(404).json({ error: 'Hito no encontrado' });
    }

    cliente.hitos.splice(hitoIndex, 1);

    if (guardarClientes(clientes)) {
      io.to(clienteId).emit('progreso-actualizado'); // 🔴 Emitimos al cliente
      res.json({ ok: true });
    } else {
      throw new Error('Error al guardar clientes después de eliminar el hito');
    }
  } catch (err) {
    console.error('❌ Error en DELETE /eliminar-hito:', err);
    res.status(500).json({ error: 'Error al eliminar hito' });
  }
});
app.put('/finalizar-caso/:id', (req, res) => {
  const clienteId = req.params.id;
  const filePath = path.join(__dirname, 'db', 'clientes.json');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).send("Error al leer base de datos");

    let clientes = JSON.parse(data);
    const index = clientes.findIndex(c => c.id === clienteId);
    if (index === -1) return res.status(404).send("Cliente no encontrado");

    clientes[index].estatus = "Completado"; // Cambio de estatus

    fs.writeFile(filePath, JSON.stringify(clientes, null, 2), err => {
      if (err) return res.status(500).send("Error al guardar");

      res.json({ success: true });
    });
  });
});

app.get('/progreso/:clienteId', (req, res) => {
  try {
    const { clienteId } = req.params;
    const clientes = cargarClientes(); // ya tienes esta función
    const cliente = clientes.find(c => c.id === clienteId);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json({ hitos: cliente.hitos || [] });
  } catch (err) {
    console.error('❌ Error en GET /progreso/:clienteId:', err);
    res.status(500).json({ error: 'Error al obtener progreso del cliente' });
  }
});


// ========== Resto de endpoints ==========
app.post('/obtener-datos', async (req, res) => {
  const { numeroA } = req.body;
  if (!numeroA?.trim()) return res.status(400).json({ error: 'Número A es requerido' });

  try {
    const datos = await consultarEOIR(numeroA.trim());
    res.json(datos);
  } catch (error) {
    console.error('❌ Error EOIR:', error);
    res.status(500).json({ error: 'No se pudieron obtener los datos del sistema EOIR.' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  try {
    const raw = await readFile('./db/usuarios.json', 'utf-8');
    const usuarios = JSON.parse(raw);

    const user = usuarios.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    res.json({ ok: true, nombre: user.nombre, foto: user.foto || null });
  } catch (err) {
    console.error('❌ Error login:', err);
    res.status(500).json({ error: 'Error en el servidor de login' });
  }
});

app.post('/actualizar-perfil', async (req, res) => {
  const { username, nombre, foto } = req.body;
  if (!username?.trim()) return res.status(400).json({ error: 'Usuario es requerido' });

  try {
    const raw = await readFile('./db/usuarios.json', 'utf-8');
    const usuarios = JSON.parse(raw);

    const user = usuarios.find(u => u.username === username);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (nombre) user.nombre = nombre;
    if (foto && foto.startsWith('data:image')) user.foto = foto;

    await writeFile('./db/usuarios.json', JSON.stringify(usuarios, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error actualizando perfil:', err);
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
});

app.get('/lista-espera', async (_, res) => {
  try {
    const lista = await obtenerLista();
    res.json(lista);
  } catch (err) {
    console.error('❌ Error lista-espera:', err);
    res.status(500).json({ error: 'Error al obtener la lista de espera.' });
  }
});

app.post('/guardar-cliente', async (req, res) => {
  try {
    const datos = req.body;

    if (!datos.nombre || !datos.proceso) {
      return res.status(400).json({ ok: false, error: 'Faltan datos' });
    }

    const id = crypto.randomUUID();
    const nuevoCliente = {
      id,
      ...datos,
      estado: 'pendientes',
      fechaCreacion: new Date().toISOString()
    };

    await guardarContacto(nuevoCliente);
    await guardarCliente(nuevoCliente);

    res.json({ ok: true, id: id, cliente: nuevoCliente });
  } catch (err) {
    console.error('❌ Error en /guardar-cliente:', err);
    res.status(500).json({ ok: false, error: 'Error al guardar cliente' });
  }
});

app.post('/eliminar-cliente', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'ID requerido' });

  try {
    await eliminarCliente(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error eliminar-cliente:', err);
    res.status(500).json({ error: 'Error al eliminar cliente.' });
  }
});

app.post('/finalizar-cliente', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'ID requerido' });

  try {
    await finalizarCliente(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error finalizar-cliente:', err);
    res.status(500).json({ error: 'Error al finalizar cliente.' });
  }
});

app.get('/citas-google', async (req, res) => {
  try {
    const citas = await obtenerCitas();
    res.json(citas);
  } catch (err) {
    console.error('❌ Error obtener-citas:', err);
    res.status(500).json({ error: 'No se pudieron obtener las citas.' });
  }
});

app.post('/cancelar-cita', async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ error: 'eventId requerido' });

  try {
    await cancelarCita(eventId);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error cancelar-cita:', err);
    res.status(500).json({ error: 'No se pudo cancelar la cita.' });
  }
});

app.get('/clientes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const lista = await obtenerLista();
    const cliente = lista.find(c => c.id === id);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(cliente);
  } catch (err) {
    console.error('❌ Error al obtener cliente por ID:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Añadir pago
app.post('/clientes/:id/pagos', async (req, res) => {
  const { id } = req.params;
  const nuevoPago = req.body;

  const lista = await obtenerLista();
  const cliente = lista.find(c => c.id === id);

  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  cliente.pagos = cliente.pagos || [];
  cliente.pagos.push(nuevoPago);
  await guardarLista(lista);

  res.json({ ok: true });
});

// Eliminar pago
app.delete('/clientes/:id/pagos/:index', async (req, res) => {
  const { id, index } = req.params;

  const lista = await obtenerLista();
  const cliente = lista.find(c => c.id === id);

  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  cliente.pagos.splice(index, 1);
  await guardarLista(lista);

  res.json({ ok: true });
});

// Mensajería
app.get('/mensajes/:clienteId', async (req, res) => {
  try {
    const mensajes = await obtenerMensajes(req.params.clienteId);
    res.json(mensajes || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/mensajes/:clienteId', async (req, res) => {
  const { clienteId } = req.params;
  const { autor, texto } = req.body;

  if (!autor || !texto) {
    return res.status(400).json({ error: 'Autor y texto son requeridos' });
  }

  try {
    const nuevoMensaje = await guardarMensaje(clienteId, { autor, texto });
    res.json(nuevoMensaje);
  } catch (error) {
    console.error('❌ Error al guardar mensaje:', error);
    res.status(500).json({ error: 'No se pudo guardar el mensaje.' });
  }
});

app.post('/mensajes/:clienteId/leidos', async (req, res) => {
  const { clienteId } = req.params;
  try {
    const raw = await readFile('./db/mensajes.json', 'utf-8');
    const mensajes = JSON.parse(raw);
    if (mensajes[clienteId]) {
      mensajes[clienteId] = mensajes[clienteId].map(msg => ({ ...msg, leido: true }));
      await writeFile('./db/mensajes.json', JSON.stringify(mensajes, null, 2), 'utf-8');
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error al marcar como leídos:', err);
    res.status(500).json({ error: 'No se pudo actualizar los mensajes.' });
  }
});

// Contactos
app.get('/contactos', (req, res) => {
  try {
    const contactos = JSON.parse(fs.readFileSync('./db/contactos.json', 'utf8'));
    res.json(contactos);
  } catch (err) {
    console.error('Error al leer contactos:', err);
    res.status(500).json({ error: 'No se pudieron cargar los contactos' });
  }
});

app.get('/clientes', async (req, res) => {
  try {
    const clientes = await obtenerClientes();
    res.json(clientes);
  } catch (err) {
    console.error('Error al obtener clientes:', err);
    res.status(500).json({ error: 'No se pudieron cargar los clientes' });
  }
});

app.get('/contactos-inbox', async (_, res) => {
  try {
    const contactos = await obtenerContactos();
    res.json(contactos);
  } catch (err) {
    console.error('❌ Error obtener-contactos:', err);
    res.status(500).json({ error: 'No se pudieron obtener los contactos.' });
  }
});

// Archivos
app.post('/subir-archivo', async (req, res) => {
  const { clienteId, nombre, base64 } = req.body;

  if (!clienteId || !nombre || !base64) {
    return res.status(400).json({ error: 'Faltan datos para guardar el archivo' });
  }

  try {
    const dir = path.join(__dirname, 'uploads', clienteId);
    await mkdir(dir, { recursive: true });

    const ruta = path.join(dir, nombre);
    const base64Clean = base64.replace(/^data:.*?base64,/, '');

    await writeFile(ruta, base64Clean, 'base64');
    res.json({ ok: true, mensaje: `Archivo ${nombre} guardado correctamente` });
  } catch (err) {
    console.error('❌ Error al guardar archivo base64:', err);
    res.status(500).json({ error: 'No se pudo guardar el archivo' });
  }
});

app.get('/archivos/:clienteId', async (req, res) => {
  const dir = path.join(__dirname, 'uploads', req.params.clienteId);

  if (!fs.existsSync(dir)) return res.json([]);

  try {
    const archivos = await fs.promises.readdir(dir);

    const lista = await Promise.all(archivos.map(async nombre => {
      const ext = path.extname(nombre).toLowerCase();
      const mime = ext === '.pdf'
        ? 'application/pdf'
        : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.png'
        ? 'image/png'
        : 'application/octet-stream';

      const buffer = await readFile(path.join(dir, nombre));
      const base64 = `data:${mime};base64,${buffer.toString('base64')}`;

      return { nombre, base64 };
    }));

    res.json(lista);
  } catch (err) {
    console.error('❌ Error al listar archivos:', err);
    res.status(500).json({ error: 'Error al listar los archivos' });
  }
});

app.post('/eliminar-archivo', async (req, res) => {
  const { clienteId, nombre } = req.body;

  if (!clienteId || !nombre) {
    return res.status(400).json({ error: 'ClienteId y nombre del archivo son requeridos' });
  }

  try {
    const ruta = path.join(__dirname, 'uploads', clienteId, nombre);
    if (fs.existsSync(ruta)) {
      await fs.promises.unlink(ruta);
      res.json({ ok: true, mensaje: 'Archivo eliminado' });
    } else {
      res.status(404).json({ error: 'Archivo no encontrado' });
    }
  } catch (err) {
    console.error('❌ Error al eliminar archivo:', err);
    res.status(500).json({ error: 'Error eliminando archivo' });
  }
});

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de Socket.IO
const httpServer = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT} (visible en red local)`);
});

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});


// Eventos de Socket.IO
io.on('connection', (socket) => {
  console.log('🟢 Cliente conectado:', socket.id);

  socket.on('unirse', (clienteId) => {
    if (!clienteId) {
      return socket.emit('error', { message: 'Se requiere clienteId' });
    }
    socket.join(clienteId); // Unirse a la sala con el ID del cliente
    console.log(`Cliente ${socket.id} unido a sala ${clienteId}`);
    socket.emit('unido-exitoso', { clienteId });
  });
  
  socket.on('mensaje-asesor', async (data, callback) => {
    try {
      const mensajeGuardado = await guardarMensaje(data.clienteId, {
        autor: 'asesor',
        texto: data.texto,
        fecha: new Date().toISOString()
      });
  
      // Emitir al cliente correctamente
      socket.to(data.clienteId).emit('mensaje-cliente', {
        ...mensajeGuardado,
        clienteId: data.clienteId
      });
  
      if (callback) callback({ status: 'ok', mensaje: mensajeGuardado });
    } catch (err) {
      console.error('❌ Error en mensaje-asesor:', err);
      if (callback) callback({ status: 'error', error: err.message });
    }
  });
  

  socket.on('mensaje-cliente', async (data, callback) => {
    try {
      if (!data?.clienteId || !data?.texto) {
        throw new Error('Datos incompletos: se requiere clienteId y texto');
      }
      
      const mensajeGuardado = await guardarMensaje(data.clienteId, {
        autor: 'cliente',
        texto: data.texto,
        fecha: new Date().toISOString()
      });

      socket.to(data.clienteId).emit('mensaje-cliente', {
        ...mensajeGuardado,
        clienteId: data.clienteId
      });

      if (callback) callback({ status: 'ok', mensaje: mensajeGuardado });
    } catch (err) {
      console.error('❌ Error en mensaje-cliente:', err);
      if (callback) callback({ status: 'error', error: err.message });
    }
  });
  
  socket.on('archivo-cliente', async (data, callback) => {
    try {
      if (!data?.clienteId || !data?.autor || !data?.archivo) {
        throw new Error('Datos incompletos: se requiere clienteId, autor y archivo');
      }

      const esAsesor = data.autor === ASESOR_ID;
      console.log(`📁 Archivo de ${esAsesor ? 'ASESOR' : 'CLIENTE'} (${data.autor}) → ClienteID: ${data.clienteId}`);

      const archivoGuardado = {
        ...data,
        fecha: new Date().toISOString()
      };

      const sala = data.clienteId;
      const evento = esAsesor ? 'nuevo-archivo' : 'nuevo-archivo-asesor';
      
      socket.to(sala).emit(evento, archivoGuardado);

      if (callback) callback({ status: 'ok', archivo: archivoGuardado });
    } catch (err) {
      console.error('❌ Error en archivo-cliente:', err);
      socket.emit('error-archivo', { error: err.message });
      if (callback) callback({ status: 'error', error: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 Cliente desconectado:', socket.id);
  });
});
