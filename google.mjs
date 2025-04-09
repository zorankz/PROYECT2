import { google } from 'googleapis';

// ✅ Credenciales válidas
const oauth2Client = new google.auth.OAuth2(
  '263153849327-968gmlp7eql1ulbsdj66gtoelk6to32b.apps.googleusercontent.com',
  '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',
  'https://developers.google.com/oauthplayground'
);

// 🔐 Refresh token válido
oauth2Client.setCredentials({
  refresh_token: '1//04wyiGqVHto0XCgYIARAAGAQSNwF-L9Irm70_OEIHvAcm-mc9Cc9vE5By7pJ-lVAJMv-7TwgmIlF4QkRW5Gxg0FM30y3KzrGSa_A'
});

// 📆 Cliente de Google Calendar
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

/**
 * 📅 Obtener las próximas citas
 */
export async function obtenerCitas() {
  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
      fields: 'items(id,summary,start,description)'
    });

    const eventos = res.data.items || [];

    console.log(`✅ ${eventos.length} cita(s) encontrada(s)`);

    return eventos.map(evt => {
      const fecha = evt.start?.dateTime || evt.start?.date;
      const isAllDay = !evt.start?.dateTime;
      const hora = isAllDay
        ? 'Todo el día'
        : new Date(evt.start.dateTime).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });

      return {
        id: evt.id,
        nombre: evt.summary || '(Sin título)',
        fecha,
        hora,
        descripcion: evt.description || ''
      };
    });
  } catch (error) {
    console.error('❌ Error al obtener citas:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * ❌ Cancelar una cita por ID
 */
export async function cancelarCita(eventId) {
  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId
    });

    console.log(`🗑️ Evento ${eventId} cancelado correctamente`);
  } catch (error) {
    console.error('❌ Error al cancelar cita:', error.response?.data || error.message);
    throw error;
  }
}
