// ruta: ./rutas/clientes.js (por ejemplo)

import express from 'express';
import { readFile } from 'fs/promises';

const router = express.Router();
const ruta = './db/clientes.json';

router.get('/clientes', async (req, res) => {
  try {
    const data = await readFile(ruta, 'utf-8');
    const clientes = JSON.parse(data);
    res.json(clientes); // ✅ devuelve todos, sin filtro
  } catch (error) {
    res.status(500).json({ error: 'Error al leer clientes' });
  }
});

export default router;
