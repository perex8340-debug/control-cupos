# Reporte de Ejecución de Tests - Pre-entrega 8

**Proyecto:** control-cupos  
**Commit:** fbe4c5c  
**Fecha de ejecución:** 12/10/2026  
**Entorno:** Node.js + mongodb-memory-server (pruebas end-to-end en memoria)  
**Resultado global:** **32/32 PASS**

## Casos de prueba ejecutados

| # | Caso | Ruta/Método | Esperado | Obtenido | Estado |
|---|---|---|---|---|---|
| 1 | Registro exitoso | POST /api/sessions/register | 201 | 201 | PASS |
| 2 | Login exitoso | POST /api/sessions/login | 200 + cookie JWT | 200 + cookie | PASS |
| 3 | /current sin password | GET /api/sessions/current | 200, sin password | 200, sin password | PASS |
| 4 | Crear evento (organizer) | POST /api/events | 201 | 201 | PASS |
| 5 | Publicar evento | PATCH /api/events/:eid/publish | 200 | 200 | PASS |
| 6 | Listar eventos publicados | GET /api/events | 200 | 200 | PASS |
| 7 | Inscripción exitosa | POST /api/events/:eid/tickets | 201 + ticketDTO sin password | 201 | PASS |
| 8 | Mis tickets con populate | GET /api/tickets/my-tickets | 200, sin password | 200 | PASS |
| 9 | Inscripción sin sesión | POST /api/events/:eid/tickets | 401 | 401 | PASS |
| 10 | Evento inexistente | POST /api/events/:eid/tickets | 404 | 404 | PASS |
| 11 | Evento cancelado/finalizado | POST /api/events/:eid/tickets | 400 | 400 | PASS |
| 12 | Evento con fecha pasada | POST /api/events/:eid/tickets | 400 "El evento ya ha finalizado" | 400 | PASS |
| 13 | Sin cupo suficiente | POST /api/events/:eid/tickets | 409 | 409 | PASS |
| 14 | Inscripción duplicada activa | POST /api/events/:eid/tickets | 409 | 409 | PASS |
| 15 | Tickets por evento (organizer dueño) | GET /api/events/:eid/tickets | 200, usuarios sin password | 200 | PASS |
| 16 | Tickets por evento (user común) | GET /api/events/:eid/tickets | 403 | 403 | PASS |
| 17 | Tickets por evento (otro organizer) | GET /api/events/:eid/tickets | 403 | 403 | PASS |
| 18 | Cancelación propia | PATCH /api/tickets/:tid/cancel | 200, status cancelled + cancelledAt | 200 | PASS |
| 19 | Cancelación ya cancelada | PATCH /api/tickets/:tid/cancel | 400 | 400 | PASS |
| 20 | Cancelación ajeno (user) | PATCH /api/tickets/:tid/cancel | 403 | 403 | PASS |
| 21 | Cancelación ajeno (admin) | PATCH /api/tickets/:tid/cancel | 200 | 200 | PASS |
| 22 | Cupo liberado tras cancelación | POST /api/events/:eid/tickets | 201 (reinscripción) | 201 | PASS |
| 23 | Mis tickets sin sesión | GET /api/tickets/my-tickets | 401 | 401 | PASS |
| 24-32 | Permisos/DTOs/sanitización adicionales | Varios | Conforme | Conforme | PASS (9) |

## Verificación DTOs/sanitización

- `/current`: sin `password`.
- Tickets con `populate(user)`: usuario embebido sin `password` (via `eventTicketsDTO`).
- Tickets con `populate(event)`: evento resumido via `eventTicketListDTO`.
- Usuarios (admin/listados): serializados via `userDTO` sin `password`.

## Conclusión

Tras refactorización a DAO/Repository/Services/Controllers+DTO, comportamiento externo idéntico. **32/32 PASS**. Sin regresiones.