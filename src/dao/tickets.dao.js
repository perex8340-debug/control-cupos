const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');

class TicketsDAO {
  async create(ticketData) {
    return Ticket.create(ticketData);
  }

  async findById(id) {
    return Ticket.findById(id);
  }

  async findByIdLean(id) {
    return Ticket.findById(id).lean();
  }

  async findByUser(userId) {
    return Ticket.find({ user: userId })
      .populate('event', 'title date location status')
      .sort({ createdAt: -1 });
  }

  async findActiveByUserAndEvent(userId, eventId) {
    return Ticket.findOne({
      user: userId,
      event: eventId,
      status: { $in: ['confirmed', 'pending'] },
    }).lean();
  }

  async countActiveForEvent(eventId) {
    const result = await Ticket.aggregate([
      {
        $match: {
          event: new mongoose.Types.ObjectId(String(eventId)),
          status: { $in: ['confirmed', 'pending'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$quantity' } } },
    ]);
    return result.length > 0 ? result[0].total : 0;
  }

  async findByEvent(eventId) {
    return Ticket.find({ event: eventId })
      .populate('user', 'first_name last_name email')
      .populate('event', 'title date location')
      .sort({ createdAt: -1 });
  }

  async findByIdAndUpdate(id, updateData) {
    return Ticket.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  }

  async countActive(filter = {}) {
    return Ticket.countDocuments({ ...filter, status: { $in: ['confirmed', 'pending'] } });
  }
}

module.exports = new TicketsDAO();