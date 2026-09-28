# Backend de Eventos - Tickets, inscripciones y control de cupos

API construida con **Node.js, Express, MongoDB y Mongoose** para la **Plataforma
de Eventos e Inscripciones**: entidad **Ticket**, flujo de **inscripción** con
**control de cupos**, **cancelaciones** y **notificaciones por email** con
Nodemailer.

Pre-entrega 7 — Tickets, inscripciones y control de cupos.

Continúa el proyecto de la pre-entrega 6: autenticación (JWT + cookies HTTP
Only), roles (`user`, `organizer`, `admin`), entidad **Event** con su CRUD y
reglas de negocio en la capa de `services`.

## Modelo Ticket

| Campo | Tipo | Reglas |
|-------|------|--------|
| `user` | ObjectId (ref `User`) | **Referencia**, requerida, indexada |
| `event` | ObjectId (ref `Event`) | **Referencia**, requerida, indexada |
| `status` | String | Solo `confirmed`, `pending`, `cancelled` |
| `quantity` | Number | `quantity > 0` |
| `reservationCode` | String | Único, se genera al crear |
| `createdAt` | Date | Auto (default `Date.now`) |
| `cancelledAt` | Date | `null` hasta la cancelación |

> No se embeben objetos completos: `user` y `event` guardan solo su `ObjectId`.
> Index compuesto `{ user, event }` para detectar inscripciones duplicadas.

## Endpoints

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| POST | /api/events/:eid/tickets | **autenticado** | Inscribe en el evento y crea el ticket |
| GET | /api/tickets/my-tickets | **autenticado** | Tickets del usuario (con evento `title`, `date`, `location`) |
| GET | /api/events/:eid/tickets | organizer **del evento** o admin | Tickets de ese evento con datos del usuario |
| PATCH | /api/tickets/:tid/cancel | dueño del ticket o admin | Cancela el ticket (marca `cancelled` + `cancelledAt`) |

## Estados de ticket

| Estado | Significado |
|--------|-------------|
| `pending` | Reserva en proceso |
| `confirmed` | Inscripción confirmada (envía email) |
| `cancelled` | Cancelada; **no ocupa cupo** |

> **Cancelar no elimina el documento**: se cambia a `cancelled` y se registra
> `cancelledAt`. No hay borrado físico.

## Flujo de inscripción (validado en `src/services/tickets.service.js`)

Al hacer `POST /api/events/:eid/tickets` se valida en este orden:

1. El evento **existe** (sino → **404**).
2. El evento está **`published`** (sino → **400**).
3. El evento **no está `cancelled` ni `finished`** (→ **400**).
4. `quantity` es un número entero **> 0** (→ **400**).
5. **Cupos disponibles ≥ quantity**: se suma la `quantity` de los tickets
   activos (`confirmed`/`pending`) del evento.
   `disponible = capacity - ocupados`. Si no alcanza → **409**.
6. El usuario **no tiene ya un ticket activo** para ese evento (→ **409**).
   Los tickets `cancelled` no bloquean nuevas inscripciones.
7. Se crea el ticket **`confirmed`** con `reservationCode` aleatorio y se envía
   la **notificación por email**.

## Cancelación

`PATCH /api/tickets/:tid/cancel`:

- El ticket debe **existir** (→ **404**).
- Debe pertenecer al solicitante **o** ser `admin` (→ **403** si no).
- Si ya está cancelado → **400**.
- Cambia `status` a `cancelled` y setea `cancelledAt`; **el cupo queda
  disponible automáticamente** porque los `cancelled` no se cuentan.

## Notificaciones (Nodemailer)

- Al confirmar una inscripción se envía un email con evento, cantidad y
  `reservationCode`.
- Las credenciales se leen **siempre de variables de entorno**:
  `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`
  (definidas en `.env.example`). Nunca hardcodeadas.
- Si el email falla, la inscripción no se pierde: se loguea el error y se
  responde 201 (el ticket queda creado).

## Códigos de error

| Código | Cuándo |
|--------|--------|
| 200 / 201 | Éxito |
| 400 | Datos inválidos o regla de negocio (evento no publicado/cancelado/finalizado, quantity ≤ 0, ya cancelado) |
| 401 | Sin sesión válida |
| 403 | Sesión pero sin permiso (rol o propiedad del recurso) |
| 404 | Evento o ticket inexistente / mal formado |
| 409 | Cupo insuficiente o inscripción duplicada |
| 500 | Error interno (solo fallos no anticipados) |

## Arquitectura

```
src/
  app.js                    # Express + routers + middleware de errores
  config/                   # env (fail-fast), database, passport
  models/                   # User.js, Event.js, Ticket.js
  controllers/              # solo request/response
  services/                 # lógica de negocio: tickets (cupos), events, sessions, mail
  repositories/ · dao/      # acceso a datos
  middlewares/              # auth (401), authorize (403), errorHandler
  routes/                   # sessions, events, tickets, users
  utils/                    # jwt, hash, errors (HttpError)
```

## Instalación y variables de entorno

```bash
npm install
Copy-Item .env.example .env   # PowerShell (o cp .env.example .env)
npm run dev
```

Variables del `.env`:

| Variable | Descripción | Obligatoria |
|----------|-------------|-------------|
| `PORT` | Puerto del servidor | No (default `3000`) |
| `MONGO_URL` | Cadena de conexión a MongoDB | **Sí** |
| `JWT_SECRET` | Clave para firmar el JWT | **Sí** |
| `JWT_EXPIRES_IN` | Expiración del JWT | No (default `1h`) |
| `NODE_ENV` | `development` / `production` | No |
| `MAIL_HOST` | Host SMTP (ej: `smtp.gmail.com`, Mailtrap) | **Sí** |
| `MAIL_PORT` | Puerto SMTP (465 SSL / 587 STARTTLS) | No (default `587`) |
| `MAIL_USER` | Usuario SMTP | **Sí** |
| `MAIL_PASS` | Password / App Password SMTP | **Sí** |
| `MAIL_FROM` | Remitente de los correos | **Sí** |

> **No se sube `.env`, `node_modules` ni credenciales** al repositorio
> (`.gitignore` los excluye).

## Casos de prueba verificados

1. Inscripción exitosa → **201** + intento de email
2. Inscripción sin sesión → **401**
3. Inscripción a evento inexistente → **404**
4. Inscripción a evento cancelado/finalizado → **400**
5. Sin cupo suficiente → **409** con mensaje claro de cupos disponibles
6. Inscripción duplicada activa → **409**
7. Cancelación propia → **200** (status `cancelled`); cupo se libera → nueva
   inscripción funciona
8. Cancelación ya cancelado → **400**
9. Cancelación de ticket ajeno como user → **403**; como admin → **200**
10. `GET /api/events/:eid/tickets` como user común → **403**
11. `GET /api/events/:eid/tickets` como organizer de otro evento → **403**
12. `GET /api/tickets/my-tickets` sin sesión → **401**

## Evidencias

![Inscripción y control de cupos](evidencias/evidencia_inscripcion_cupos.png)

![Consulta de tickets y permisos](evidencias/evidencia_consulta_tickets.png)

![Cancelaciones y liberación de cupos](evidencias/evidencia_cancelaciones.png)