const crypto = require('crypto');
const ticketsRepository = require('../repositories/tickets.repository');
const eventsRepository = require('../repositories/events.repository');
const usersRepository = require('../repositories/users.repository');
const { HttpError } = require('../utils/errors');
const { sendConfirmationEmail, sendCancellationEmail } = require('./mail.service');
const {
  ticketDTO,
  myTicketsDTO,
  eventTicketsDTO,
} = require('../dto/ticket.dto');
const { eventTicketListDTO } = require('../dto/event.dto');

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

class TicketsService {
  assertValidId(id, label = 'Identificador') {
    if (!OBJECT_ID_REGEX.test(String(id))) {
      throw new HttpError(400, `${label} no válido`);
    }
  }

  generateReservationCode() {
    return crypto.randomBytes(8).toString('hex').toUpperCase();
  }

  // -------------------------------------------------------------------------
  // Inscripción
  // -------------------------------------------------------------------------
  async createTicket(user, eventId, { quantity } = {}) {
    this.assertValidId(eventId, 'Identificador de evento');

    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      throw new HttpError(400, 'La cantidad solicitada debe ser un número entero mayor a 0');
    }

    const event = await eventsRepository.findByIdLean(eventId);
    if (!event) {
      throw new HttpError(404, 'Evento no encontrado');
    }

    if (event.status !== 'published') {
      throw new HttpError(400, 'El evento no está publicado');
    }

    if (new Date(event.date).getTime() <= Date.now()) {
      throw new HttpError(400, 'El evento ya ha finalizado');
    }

    const occupied = await ticketsRepository.countActiveTickets(eventId);
    const available = event.capacity - occupied;
    if (parsedQuantity > available) {
      throw new HttpError(
        409,
        `No hay cupos suficientes. Cupos disponibles: ${available}`
      );
    }

    const existing = await ticketsRepository.findActiveByUserAndEvent(user.id, eventId);
    if (existing) {
      throw new HttpError(409, 'Ya tenés una inscripción activa para este evento');
    }

    const ticket = await ticketsRepository.create({
      user: user.id,
      event: eventId,
      status: 'confirmed',
      quantity: parsedQuantity,
      reservationCode: this.generateReservationCode(),
    });

    // Notificación por email al confirmar la inscripción.
    // Las credenciales siempre vienen de variables de entorno.
    try {
      const userRecord = await usersRepository.findById(user.id);
      await sendConfirmationEmail({
        to: userRecord.email,
        eventTitle: event.title,
        reservationCode: ticket.reservationCode,
        quantity: ticket.quantity,
      });
    } catch (mailError) {
      console.error('No se pudo enviar el email de confirmación:', mailError.message);
    }

    return this.getPublicTicket(ticket);
  }

  // -------------------------------------------------------------------------
  // Mis tickets
  // -------------------------------------------------------------------------
  async getMyTickets(user) {
    const tickets = await ticketsRepository.findByUser(user.id);
    return tickets.map(myTicketsDTO);
  }

  // -------------------------------------------------------------------------
  // Tickets por evento (organizer de ese evento o admin)
  // -------------------------------------------------------------------------
  async getEventTickets(user, eventId) {
    this.assertValidId(eventId, 'Identificador de evento');

    const event = await eventsRepository.findByIdLean(eventId);
    if (!event) {
      throw new HttpError(404, 'Evento no encontrado');
    }

    const isOwner = event.organizer.toString() === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new HttpError(403, 'No tenés permisos para ver los tickets de este evento');
    }

    const tickets = await ticketsRepository.findByEvent(eventId);
    return {
      event: eventTicketListDTO(event),
      occupied: await ticketsRepository.countActiveTickets(eventId),
      tickets: tickets.map(eventTicketsDTO),
    };
  }

  // -------------------------------------------------------------------------
  // Cancelación: marca cancelled + cancelledAt, no elimina el documento.
  // El cupo se libera solo por no contar los tickets cancelled.
  // -------------------------------------------------------------------------
  async cancelTicket(user, ticketId) {
    this.assertValidId(ticketId, 'Identificador de ticket');

    const ticket = await ticketsRepository.findByIdLean(ticketId);
    if (!ticket) {
      throw new HttpError(404, 'Ticket no encontrado');
    }

    const isOwner = ticket.user.toString() === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new HttpError(403, 'No tenés permisos para cancelar este ticket');
    }

    if (ticket.status === 'cancelled') {
      throw new HttpError(400, 'El ticket ya está cancelado');
    }

    const updated = await ticketsRepository.cancelTicket(ticketId);

    // Notificación por email al cancelar (no bloqueante, igual que la confirmación).
    // Se envía al dueño real del ticket (ticket.user), no necesariamente a quien
    // ejecuta la cancelación (puede ser un admin).
    try {
      const [owner, event] = await Promise.all([
        usersRepository.findById(ticket.user),
        eventsRepository.findByIdLean(ticket.event),
      ]);

      if (owner) {
        await sendCancellationEmail({
          to: owner.email,
          eventTitle: event ? event.title : 'Evento',
          reservationCode: ticket.reservationCode,
        });
      }
    } catch (mailError) {
      console.error('No se pudo enviar el email de cancelación:', mailError.message);
    }

    return this.getPublicTicket(updated);
  }

  // -------------------------------------------------------------------------
  // Serialización pública (DTO: balance entre cantidad de información y
  // no exponer datos sensibles de otros usuarios).
  // -------------------------------------------------------------------------
  getPublicTicket(ticket) {
    return ticketDTO(ticket);
  }
}

module.exports = new TicketsService();