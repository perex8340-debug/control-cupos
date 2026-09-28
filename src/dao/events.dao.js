const Event = require('../models/Event');

class EventsDAO {
  async create(eventData) {
    return Event.create(eventData);
  }

  async findById(id) {
    return Event.findById(id).populate('organizer', 'first_name last_name email');
  }

  async findByIdLean(id) {
    return Event.findById(id).lean();
  }

  async find(filter, { sort, skip, limit }) {
    return Event.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  async count(filter) {
    return Event.countDocuments(filter);
  }

  async findByIdAndUpdate(id, updateData) {
    return Event.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('organizer', 'first_name last_name email');
  }
}

module.exports = new EventsDAO();