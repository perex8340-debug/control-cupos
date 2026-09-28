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

  async countActiveForEvent(eventId) {
    return ticketsDAO.countActiveForEvent(eventId);
  }

  async findByEvent(eventId) {
    return ticketsDAO.findByEvent(eventId);
  }

  async findByIdAndUpdate(id, updateData) {
    return ticketsDAO.findByIdAndUpdate(id, updateData);
  }
}

module.exports = new TicketsRepository();