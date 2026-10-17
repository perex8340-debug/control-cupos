const ticketsDAO = require('../dao/tickets.dao');

class TicketsRepository {
  async create(ticketData) {
    return ticketsDAO.create(ticketData);
  }

  async findById(id) {
    return ticketsDAO.findById(id);
  }

  async findByIdLean(id) {
    return ticketsDAO.findByIdLean(id);
  }

  async findByUser(userId) {
    return ticketsDAO.findByUser(userId);
  }

  async findActiveByUserAndEvent(userId, eventId) {
    return ticketsDAO.findActiveByUserAndEvent(userId, eventId);
  }

  // Método orientado al dominio: cuenta los cupos ocupados (tickets activos)
  // de un evento.
  async countActiveTickets(eventId) {
    return ticketsDAO.countActiveTickets(eventId);
  }

  async findByEvent(eventId) {
    return ticketsDAO.findByEvent(eventId);
  }

  // Método orientado al dominio: cancela un ticket (lógico, no borra el
  // documento) marcando status=cancelled y registrando cancelledAt.
  async cancelTicket(ticketId) {
    return ticketsDAO.findByIdAndUpdate(ticketId, {
      status: 'cancelled',
      cancelledAt: new Date(),
    });
  }
}

module.exports = new TicketsRepository();