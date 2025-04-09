
  // Variables globales
  const chatList = document.getElementById('chat-list');
  const chatBody = document.getElementById('chat-body');
  const chatMessage = document.getElementById('chat-message');
  const sendButton = document.getElementById('send-message');
  const chatName = document.getElementById('chat-name');
  const chatStatus = document.querySelector('.chat-header small');
  const inboxTitle = document.getElementById('inbox-title');
  const panels = {
    contacto: document.getElementById('panel-contacto'),
    perfil: document.getElementById('panel-perfil')
  };
  const modalArchivo = document.getElementById('modal-confirmacion');
  const menuOpciones = document.getElementById('menu-opciones');
  const menuArchivo = document.getElementById('menu-archivo');

  // Datos de ejemplo
  const clientes = [
    {
      nombre: 'Willie Hudson',
      numero: '3015558923',
      mensaje: 'Me está dando dolor de cabeza',
      hora: '15:50',
      foto: 'https://i.pravatar.cc/150?u=willie',
      estado: 'pendientes'
    },
    {
      nombre: 'Paciente Depresivo',
      numero: '3126663241',
      mensaje: 'Tal vez dos meses más?',
      hora: '14:48',
      foto: 'https://i.pravatar.cc/150?u=depresion',
      estado: 'archivados'
    },
    {
      nombre: 'Lisa Wealden',
      numero: '3194441110',
      mensaje: 'Iré a verte mañana...',
      hora: '14:10',
      foto: 'https://i.pravatar.cc/150?u=lisa',
      estado: 'abiertos'
    }
  ];

  let estadoActual = 'pendientes';
  let chatSeleccionado = null;
  let chatActivoIndex = null;
  let mensajeId = 0;
  let mensajeActivoId = null;
  let archivoPendiente = null;
  let archivoHTMLPendiente = '';
  let archivoURLActivo = '';
  let escribiendoTimeout;

  // Inicialización
  document.addEventListener('DOMContentLoaded', () => {
    renderInbox();
    actualizarMenuLateral();
    
    // Configurar eventos
    sendButton.addEventListener('click', enviarMensaje);
    chatMessage.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') enviarMensaje();
    });
    
    chatMessage.addEventListener('input', () => {
      if (!chatSeleccionado) return;
      chatStatus.textContent = 'Escribiendo...';
      clearTimeout(escribiendoTimeout);
      escribiendoTimeout = setTimeout(() => {
        chatStatus.textContent = 'Última conexión: hace 2 minutos';
      }, 2000);
    });
    
    document.getElementById('file-upload').addEventListener('change', manejarArchivoSeleccionado);
    
    document.body.addEventListener('click', () => {
      menuOpciones.classList.remove('active');
      menuArchivo.classList.remove('active');
    });
  });

  // Funciones principales
  function actualizarMenuLateral() {
    const categorias = {
      abiertos: clientes.some(c => c.estado === 'abiertos'),
      archivados: clientes.some(c => c.estado === 'archivados')
    };

    const items = document.querySelectorAll('.nav-links li');
    items[1].style.display = categorias.abiertos ? '' : 'none';
    items[2].style.display = categorias.archivados ? '' : 'none';
  }

  function renderInbox() {
    chatList.innerHTML = '';
    const clientesFiltrados = clientes.filter(c => c.estado === estadoActual);

    clientesFiltrados.forEach((cliente, index) => {
      const item = document.createElement('li');
      item.classList.add('chat-item');
      item.innerHTML = `
        <img src="${cliente.foto}" alt="${cliente.nombre}" />
        <div class="chat-info">
          <strong>${cliente.nombre}</strong>
          <p>${cliente.mensaje}</p>
        </div>
        <span class="chat-time">${cliente.hora}</span>
      `;
      item.addEventListener('click', () => seleccionarChat(index, item));
      item.addEventListener('contextmenu', e => mostrarMenuOpciones(e, null, 'chat', index, clientesFiltrados));
      chatList.appendChild(item);
    });

    actualizarMenuLateral();
  }

  function filtrarMensajes(estado) {
    estadoActual = estado;
    inboxTitle.textContent = `Mensajes ${estado.charAt(0).toUpperCase() + estado.slice(1)}`;
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
    const opciones = ['pendientes', 'abiertos', 'archivados', 'clientes'];
    document.querySelectorAll('.nav-links li')[opciones.indexOf(estado)].classList.add('active');
    renderInbox();
  }

  function seleccionarChat(index, item) {
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    const cliente = clientes[index];
    chatSeleccionado = cliente;
    chatName.textContent = cliente.nombre;
    chatBody.innerHTML = '';
    addMessage('Hola, ¿cómo puedo ayudarte?', 'received');
    
    // En dispositivos móviles, mostrar el panel de chat
    if (window.innerWidth <= 768) {
      document.querySelector('.chat-panel').classList.add('active');
    }
  }

  function addMessage(text, type = 'sent', timestamp = new Date()) {
    const fecha = new Date(timestamp);
    const fechaClave = fecha.toDateString();

    // Agrupar por fecha
    let seccion = chatBody.querySelector(`[data-fecha='${fechaClave}']`);
    if (!seccion) {
      const etiquetaFecha = document.createElement('div');
      etiquetaFecha.className = 'fecha-etiqueta';
      etiquetaFecha.dataset.fecha = fechaClave;
      etiquetaFecha.textContent = obtenerEtiquetaFecha(fecha);
      chatBody.appendChild(etiquetaFecha);
    }

    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    const id = `msg-${mensajeId++}`;
    msg.setAttribute('data-id', id);

    msg.innerHTML = `
      <div class="mensaje-texto">${text}</div>
      <div class="mensaje-footer">
        <small>${fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
        ${type === 'sent' ? `<span class="estado-mensaje" data-id="${id}">✅</span>` : ''}
      </div>
    `;

    if (type === 'sent') {
      msg.addEventListener('contextmenu', e => {
        const link = msg.querySelector('a');
        if (link) {
          e.preventDefault();
          archivoURLActivo = link.href;
          mostrarMenuArchivo(e);
        } else {
          mostrarMenuOpciones(e, id, 'mensaje');
        }
      });

      // Simular entregado en 2s
      setTimeout(() => {
        const estado = document.querySelector(`.estado-mensaje[data-id="${id}"]`);
        if (estado) estado.textContent = '✅✅';
      }, 2000);

      // Simular visto en 4s
      setTimeout(() => {
        const estado = document.querySelector(`.estado-mensaje[data-id="${id}"]`);
        if (estado) estado.classList.add('visto');
      }, 4000);
    }

    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function addFileMessage(html, type = 'sent') {
    const fecha = new Date();
    const fechaClave = fecha.toDateString();

    let seccion = chatBody.querySelector(`[data-fecha='${fechaClave}']`);
    if (!seccion) {
      const etiquetaFecha = document.createElement('div');
      etiquetaFecha.className = 'fecha-etiqueta';
      etiquetaFecha.dataset.fecha = fechaClave;
      etiquetaFecha.textContent = obtenerEtiquetaFecha(fecha);
      chatBody.appendChild(etiquetaFecha);
    }

    const id = `msg-${mensajeId++}`;
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.setAttribute('data-id', id);
    msg.innerHTML = `
      <div class="mensaje-texto">${html}</div>
      <div class="mensaje-footer">
        <small>${fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
        ${type === 'sent' ? `<span class="estado-mensaje" data-id="${id}">✅</span>` : ''}
      </div>
    `;

    if (type === 'sent') {
      msg.addEventListener('contextmenu', e => {
        e.preventDefault();
        const link = msg.querySelector('a');
        if (link) {
          archivoURLActivo = link.href;
          mostrarMenuArchivo(e);
        } else {
          mostrarMenuOpciones(e, id, 'mensaje');
        }
      });

      // Estado "recibido"
      setTimeout(() => {
        const estado = document.querySelector(`.estado-mensaje[data-id="${id}"]`);
        if (estado) estado.textContent = '✅✅';
      }, 2000);

      // Estado "visto"
      setTimeout(() => {
        const estado = document.querySelector(`.estado-mensaje[data-id="${id}"]`);
        if (estado) estado.classList.add('visto');
      }, 4000);
    }

    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function obtenerEtiquetaFecha(fecha) {
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);

    if (fecha.toDateString() === hoy.toDateString()) return 'Hoy';
    if (fecha.toDateString() === ayer.toDateString()) return 'Ayer';

    return fecha.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function enviarMensaje() {
    const text = chatMessage.value.trim();
    if (!text) return;
    
    addMessage(text, 'sent');
    
    // Simular respuesta después de 1-3 segundos
    setTimeout(() => {
      const respuestas = [
        "Entendido, voy a revisar tu caso.",
        "Gracias por la información.",
        "¿Necesitas algo más?",
        "Perfecto, continuaremos con el proceso."
      ];
      const respuesta = respuestas[Math.floor(Math.random() * respuestas.length)];
      addMessage(respuesta, 'received');
    }, 1000 + Math.random() * 2000);
    
    chatMessage.value = '';
  }

  function manejarArchivoSeleccionado(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      archivoPendiente = file;

      if (file.type.startsWith('image/')) {
        archivoHTMLPendiente = `
          <a href="${url}" target="_blank">
            <img src="${url}" alt="Imagen" class="preview-image">
          </a>`;
      } else if (file.type === 'application/pdf') {
        archivoHTMLPendiente = `
          <div class="preview-file">
            <i class="fas fa-file-pdf"></i> <a href="${url}" target="_blank">${file.name}</a>
          </div>`;
      } else {
        archivoHTMLPendiente = `
          <div class="preview-file">
            <div class="file-info">
              <i class="fas fa-file"></i> <span>${file.name}</span>
              <a href="${url}" download="${file.name}" class="download-button">Descargar</a>
            </div>
          </div>`;
      }

      document.getElementById('preview-archivo-modal').innerHTML = archivoHTMLPendiente;
      modalArchivo.classList.add('visible');
    };

    reader.readAsDataURL(file);
  }

  function confirmarEnvioArchivo() {
    if (!archivoPendiente) return;
    addFileMessage(archivoHTMLPendiente, 'sent');
    cerrarModalArchivo();
  }

  function cerrarModalArchivo() {
    archivoPendiente = null;
    archivoHTMLPendiente = '';
    document.getElementById('file-upload').value = '';
    modalArchivo.classList.remove('visible');
  }

  function mostrarPanel(tipo, editar = false) {
    Object.values(panels).forEach(p => p.classList.remove('active'));
    const panel = panels[tipo];
    if (tipo === 'contacto') {
      document.getElementById('contact-panel-title').textContent = editar ? 'Editar Contacto' : 'Añadir Contacto';
    }
    panel.classList.add('active');
  }

  function guardarContacto() {
    const nombre = document.getElementById('contact-nombre').value;
    const numero = document.getElementById('contact-numero').value;
    const foto = document.getElementById('contact-foto').value || 'https://i.pravatar.cc/150';
    
    clientes.push({ 
      nombre, 
      numero, 
      mensaje: 'Nuevo contacto añadido', 
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
      foto, 
      estado: 'pendientes' 
    });
    
    renderInbox();
    actualizarMenuLateral();
    panels.contacto.classList.remove('active');
  }

  function guardarPerfil() {
    const nombre = document.getElementById('perfil-nombre').value;
    const estado = document.getElementById('perfil-estado').value;
    const foto = document.getElementById('perfil-foto').value;
    
    if (nombre) document.querySelector('.profile h3').textContent = nombre;
    if (estado) document.querySelector('.profile p').textContent = estado;
    if (foto) document.querySelector('.profile img').src = foto;
    
    panels.perfil.classList.remove('active');
  }

  function mostrarMenuOpciones(e, id, tipo = 'mensaje', index = null, lista = []) {
    e.preventDefault();
    e.stopPropagation();

    mensajeActivoId = tipo === 'mensaje' ? id : null;
    chatActivoIndex = tipo === 'chat' && index !== null ? lista[index].numero : null;

    const msgBox = menuOpciones.querySelector('.opciones-mensaje');
    const chatBox = menuOpciones.querySelector('.opciones-chat');

    msgBox.style.display = tipo === 'mensaje' ? 'block' : 'none';
    chatBox.style.display = tipo === 'chat' ? 'block' : 'none';

    menuOpciones.style.top = `${e.clientY}px`;
    menuOpciones.style.left = `${e.clientX}px`;
    menuOpciones.classList.add('active');
  }

  function mostrarMenuArchivo(e) {
    e.preventDefault();
    e.stopPropagation();
    menuArchivo.style.top = `${e.clientY}px`;
    menuArchivo.style.left = `${e.clientX}px`;
    menuArchivo.classList.add('active');
  }

  function moverChat(nuevaCategoria) {
    if (chatActivoIndex !== null) {
      const chat = clientes.find(c => c.numero === chatActivoIndex);
      if (chat) {
        chat.estado = nuevaCategoria;
        renderInbox();
        actualizarMenuLateral();
        chatActivoIndex = null;
        menuOpciones.classList.remove('active');
      }
    }
  }

  function editarMensajeDesdeMenu() {
    if (!mensajeActivoId) return;
    editarMensaje(mensajeActivoId);
    menuOpciones.classList.remove('active');
  }

  function borrarMensajeDesdeMenu() {
    if (!mensajeActivoId) return;
    borrarMensaje(mensajeActivoId);
    menuOpciones.classList.remove('active');
  }

  function editarMensaje(id) {
    const mensaje = chatBody.querySelector(`[data-id='${id}']`);
    const textoOriginal = mensaje.querySelector('.mensaje-texto').textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = textoOriginal;
    input.className = 'editar-input';
    mensaje.querySelector('.mensaje-texto').replaceWith(input);
    input.focus();

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const nuevoTexto = input.value;

        // Simular actualización en servidor
        setTimeout(() => {
          const nuevoDiv = document.createElement('div');
          nuevoDiv.className = 'mensaje-texto';
          nuevoDiv.textContent = nuevoTexto;
          input.replaceWith(nuevoDiv);
        }, 300);
      }
    });
  }

  function borrarMensaje(id) {
    const mensaje = chatBody.querySelector(`[data-id='${id}']`);
    if (!mensaje) return;

    const confirmar = confirm('¿Estás seguro que deseas borrar este mensaje?');
    if (!confirmar) return;

    // Simular borrado en servidor
    setTimeout(() => {
      mensaje.remove();
    }, 300);
  }

  function descargarArchivoContextual() {
    if (!archivoURLActivo) return;

    const link = document.createElement('a');
    link.href = archivoURLActivo;
    link.download = '';
    link.click();

    archivoURLActivo = '';
    menuArchivo.classList.remove('active');
  }
