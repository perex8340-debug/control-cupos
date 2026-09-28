const eventsDAO = require('../dao/events.dao');

class EventsRepository {
  async create(eventData) {
    return eventsDAO.create(eventData);
  }

  // findById devuelve el evento con organizer poblado
  async findById(id) {
    return eventsDAO.findById(id);
  }

  // findByIdLean devuelve el documento sin populate (para chequear
  // ownership sin traer datos del organizador)
  async findByIdLean(id) {
    return eventsDAO.findByIdLean(id);
  }

  async find(filter, options) {
    return eventsDAO.find(filter, options);
  }

  async count(filter) {
    return eventsDAO.count(filter);
  }

  async update(id, updateData) {
    return eventsDAO.findByIdAndUpdate(id, updateData);
  }
}

module.exports = new EventsRepository();