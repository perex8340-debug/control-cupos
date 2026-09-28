const crypto = require('crypto');
const ticketsRepository = require('../repositories/tickets.repository');
const eventsRepository = require('../repositories/events.repository');
const usersRepository = require('../repositories/users.repository');
const { HttpError } = require('../utils/errors');
const { sendConfirmationEmail } = require('./mail.service');

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

    if (event.status === 'cancelled' || event.status === 'finished') {
      throw new HttpError(400, 'El evento está cancelado o finalizado');
    }

    const occupied = await ticketsRepository.countActiveForEvent(eventId);
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
    return tickets.map((ticket) => ({
      id: ticket._id.toString(),
      status: ticket.status,
      quantity: ticket.quantity,
      reservationCode: ticket.reservationCode,
      createdAt: ticket.createdAt,
      cancelledAt: ticket.cancelledAt,
      event: ticket.event
        ? {
            id: ticket.event._id.toString(),
            title: ticket.event.title,
            date: ticket.event.date,
            location: ticket.event.location,
          }
        : null,
    }));
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
      event: {
        id: event._id.toString(),
        title: event.title,
        capacity: event.capacity,
      },
      occupied: await ticketsRepository.countActiveForEvent(eventId),
      tickets: tickets.map((ticket) => ({
        id: ticket._id.toString(),
        status: ticket.status,
        quantity: ticket.quantity,
        reservationCode: ticket.reservationCode,
        createdAt: ticket.createdAt,
        cancelledAt: ticket.cancelledAt,
        user: ticket.user
          ? {
              id: ticket.user._id.toString(),
              first_name: ticket.user.first_name,
              last_name: ticket.user.last_name,
              email: ticket.user.email,
            }
          : null,
      })),
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

    const updated = await ticketsRepository.findByIdAndUpdate(ticketId, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });

    return this.getPublicTicket(updated);
  }

  // -------------------------------------------------------------------------
  // Serialización pública (balance entre cantidad de información y
  // no exponer datos sensibles de otros usuarios).
  // -------------------------------------------------------------------------
  getPublicTicket(ticket) {
    return {
      id: ticket._id.toString(),
      event: ticket.event ? ticket.event.toString() : ticket.event,
      status: ticket.status,
      quantity: ticket.quantity,
      reservationCode: ticket.reservationCode,
      createdAt: ticket.createdAt,
      cancelledAt: ticket.cancelledAt,
    };
  }
}

module.exports = new TicketsService();