# Meeting administration

`/admin/meetings` uses the existing meeting tables and the same admin authorization as `/admin/topics`. No schema changes are required.

## API contract

All responses use `{ success: true, ... }` or `{ success: false, error }`. All endpoints require an authenticated clan administrator.

| Method | Endpoint | Result / body |
| --- | --- | --- |
| GET | `/api/admin/meetings` | `{ meetings }`; each meeting includes the total participant count and at most 10 participant previews |
| POST | `/api/admin/meetings` | Body `{ title, scheduled_at }`; returns `{ meeting }` |
| GET | `/api/admin/meetings/:id` | `{ meeting }` with every participant |
| PATCH | `/api/admin/meetings/:id` | Body `{ title, scheduled_at }`; returns `{ meeting }` |
| DELETE | `/api/admin/meetings/:id` | Deletes the meeting and its participant assignments |
| POST | `/api/admin/meetings/:id/assign` | Body described below; returns `{ meeting }` |
| GET | `/api/admin/meetings/rooms` | `{ rooms }` from the existing room cache |
| GET | `/api/admin/meetings/roster` | `{ roster }` from the existing roster cache |

Titles must contain 1–200 characters after trimming. `scheduled_at` must be an ISO date-time with a timezone. The UI converts local input to UTC and displays dates in the browser's timezone.

Assignment accepts optional `participants`, `room_id`, `room_name`, and `replace_participants`. Participant entries contain `mezon_id`, `display_name`, optional `username`, `avatar_url`, and `role` (`student` or `teacher`).

- Default behavior upserts supplied participants, preserving the original API contract.
- `replace_participants: true` replaces the selection; `participants: []` removes everyone. Omitted `participants` leaves people unchanged.
- `room_id: ""` clears the room. Omitted `room_id` leaves it unchanged.
- Participant and room changes commit together. Existing participants retain their attendance/reminder fields.

## Integration with bot sync (part B)

The UI only reads the existing `meeting_rooms_cache` and `meeting_roster_cache` through the endpoints above. Part B can populate them using the existing `pgDb.upsertMeetingRoomsCache` and `pgDb.upsertMeetingRosterCache` methods. Empty caches show empty-state messages; creating and editing a meeting still works. Existing assignments remain selectable even if absent from the latest cache.

Bot synchronization, reminders, and attendance detection are outside this change.
