const eventsRepository = require('../repositories/events.repository');
const { HttpError } = require('../utils/errors');

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const VALID_STATUSES = ['draft', 'published', 'cancelled', 'finished'];
const SORTABLE_FIELDS = ['date', 'title', 'category', 'location', 'capacity', 'price', 'status'];
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

class EventsService {
  // -------------------------------------------------------------------------
  // Validaciones de negocio (viven aca, no en rutas ni controllers)
  // -------------------------------------------------------------------------

  validateEventInput({ title, description, category, date, location, capacity, price }) {
    if (!title || !description || !category || !location) {
      throw new HttpError(400, 'Faltan campos obligatorios');
    }

    if (!date) {
      throw new HttpError(400, 'La fecha del evento es obligatoria');
    }

    const eventDate = new Date(date);
    if (Number.isNaN(eventDate.getTime())) {
      throw new HttpError(400, 'La fecha del evento no es válida');
    }

    if (eventDate.getTime() <= Date.now()) {
      throw new HttpError(400, 'No se puede crear un evento con fecha pasada');
    }

    if (typeof capacity !== 'number' || capacity <= 0) {
      throw new HttpError(400, 'La capacidad debe ser mayor a 0');
    }

    if (typeof price !== 'number' || Number.isNaN(price) || price < 0) {
      throw new HttpError(400, 'El precio no puede ser negativo');
    }
  }

  assertCanModify(event, user) {
    const isOwner = event.organizer.toString() === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new HttpError(403, 'No tenés permisos para modificar este evento');
    }
  }

  assertValidId(id) {
    if (!OBJECT_ID_REGEX.test(String(id))) {
      throw new HttpError(400, 'Identificador de evento no válido');
    }
  }

  assertNotCancelled(event) {
    if (event.status === 'cancelled') {
      throw new HttpError(400, 'Un evento cancelado no puede modificarse');
    }
  }

  assertCanPublish(event) {
    if (event.status === 'finished' || event.status === 'cancelled') {
      throw new HttpError(
        400,
        'No se puede publicar un evento ya finalizado o cancelado'
      );
    }
    if (new Date(event.date).getTime() <= Date.now()) {
      throw new HttpError(400, 'No se puede publicar un evento con fecha pasada');
    }
  }

  // -------------------------------------------------------------------------
  // Acciones
  // -------------------------------------------------------------------------

  async createEvent(user, eventData) {
    this.validateEventInput(eventData);

    const event = await eventsRepository.create({
      title: eventData.title.trim(),
      description: eventData.description.trim(),
      category: eventData.category.trim(),
      date: new Date(eventData.date),
      location: eventData.location.trim(),
      capacity: eventData.capacity,
      price: eventData.price,
      organizer: user.id,
    });

    return this.getPublicEvent(event);
  }

  async getEventById(id) {
    this.assertValidId(id);
    const event = await eventsRepository.findById(id);
    if (!event) {
      throw new HttpError(404, 'Evento no encontrado');
    }
    return this.getPublicEvent(event, true);
  }

  async listEvents(query) {
    const { filter, sort, page, limit } = this.buildQuery(query);

    const [data, total] = await Promise.all([
      eventsRepository.find(filter, { sort, skip: (page - 1) * limit, limit }),
      eventsRepository.count(filter),
    ]);

    return {
      data: data.map((event) => this.getPublicEvent(event)),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async updateEvent(user, id, updateData) {
    this.assertValidId(id);
    const event = await eventsRepository.findByIdLean(id);
    if (!event) {
      throw new HttpError(404, 'Evento no encontrado');
    }

    this.assertCanModify(event, user);
    this.assertNotCancelled(event);

    // El estado se cambia solo por PATCH /:id/status; el organizador
    // siempre es el creador (req.user), nunca viene del body.
    const updates = { ...updateData };
    delete updates.status;
    delete updates.organizer;

    if (updates.date) {
      const eventDate = new Date(updates.date);
      if (Number.isNaN(eventDate.getTime())) {
        throw new HttpError(400, 'La fecha del evento no es válida');
      }
      if (eventDate.getTime() <= Date.now()) {
        throw new HttpError(400, 'La fecha del evento no puede ser pasada');
      }
      updates.date = eventDate;
    }

    if (
      updates.capacity !== undefined &&
      (typeof updates.capacity !== 'number' || updates.capacity <= 0)
    ) {
      throw new HttpError(400, 'La capacidad debe ser mayor a 0');
    }

    if (
      updates.price !== undefined &&
      (typeof updates.price !== 'number' ||
        Number.isNaN(updates.price) ||
        updates.price < 0)
    ) {
      throw new HttpError(400, 'El precio no puede ser negativo');
    }

    const updated = await eventsRepository.update(id, updates);
    return this.getPublicEvent(updated, true);
  }

  async updateStatus(user, id, newStatus) {
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new HttpError(
        400,
        `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}`
      );
    }

    this.assertValidId(id);
    const event = await eventsRepository.findByIdLean(id);
    if (!event) {
      throw new HttpError(404, 'Evento no encontrado');
    }

    this.assertCanModify(event, user);

    if (event.status === 'cancelled') {
      throw new HttpError(400, 'Un evento cancelado no puede modificarse');
    }

    if (newStatus === 'published') {
      this.assertCanPublish(event);
    }

    const updated = await eventsRepository.update(id, { status: newStatus });
    return this.getPublicEvent(updated, true);
  }

  // -------------------------------------------------------------------------
  // Query building (filtros, paginacion, ordenamiento)
  // -------------------------------------------------------------------------

  buildQuery(query) {
    const filter = {};

    if (query.status) {
      filter.status = query.status;
    }
    if (query.category) {
      filter.category = { $regex: new RegExp(this.escapeRegex(query.category), 'i') };
    }
    if (query.location) {
      filter.location = { $regex: new RegExp(this.escapeRegex(query.location), 'i') };
    }

    const dateRange = {};
    if (query.dateFrom) {
      dateRange.$gte = new Date(query.dateFrom);
    }
    if (query.dateTo) {
      dateRange.$lte = new Date(query.dateTo);
    }
    if (Object.keys(dateRange).length > 0) {
      filter.date = dateRange;
    }

    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(query.limit, 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );

    const sort = this.buildSort(query.sort);

    return { filter, sort, page, limit };
  }

  buildSort(sortParam) {
    if (!sortParam) {
      return { date: 1 };
    }

    const parts = String(sortParam).split(',');
    const sort = {};
    for (const part of parts) {
      let field = part.trim();
      let order = 1;
      if (field.startsWith('-')) {
        order = -1;
        field = field.slice(1);
      }
      if (SORTABLE_FIELDS.includes(field)) {
        sort[field] = order;
      }
    }

    return Object.keys(sort).length > 0 ? sort : { date: 1 };
  }

  escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // -------------------------------------------------------------------------
  // Serialización pública (nunca expone datos sensibles)
  // -------------------------------------------------------------------------

  getPublicEvent(event, withOrganizer = false) {
    const base = {
      id: event._id.toString(),
      title: event.title,
      description: event.description,
      category: event.category,
      date: event.date,
      location: event.location,
      capacity: event.capacity,
      price: event.price,
      status: event.status,
    };

    if (withOrganizer && typeof event.organizer === 'object' && event.organizer.first_name) {
      base.organizer = {
        id: event.organizer._id.toString(),
        first_name: event.organizer.first_name,
        last_name: event.organizer.last_name,
        email: event.organizer.email,
      };
    } else {
      base.organizer = event.organizer.toString();
    }

    return base;
  }
}

module.exports = new EventsService();