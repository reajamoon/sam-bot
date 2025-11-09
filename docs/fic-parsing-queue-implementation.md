# Fic Parsing Queue System: Implementation Plan

## Overview
This document outlines the design and implementation plan for a database-backed queue system to manage fic parsing jobs (e.g., AO3, FFN, Wattpad) for the Discord bot. The goal is to prevent duplicate/clashing fetches, avoid timeouts, and provide a robust, scalable, and user-friendly experience.

---

## 1. Database Schema

### Table: ParseQueue
- `id` (PK, auto-increment)
- `fic_url` (string, unique or indexed)
- `status` (enum: pending, processing, done, error)
- `requested_by` (string or array: Discord user IDs)
- `result` (JSON or text, nullable)
- `error_message` (text, nullable)
- `created_at` (datetime)
- `updated_at` (datetime)

### Table: ParseQueueSubscribers (optional, for multi-user notification)
- `id` (PK)
- `queue_id` (FK to ParseQueue)
- `user_id` (Discord user ID)

---

## 2. Workflow

### a. Enqueue Request
- On fic metadata request, check if a queue entry exists for the URL:
  - If `status` is `pending` or `processing`, add user to subscribers and inform them it's in progress.
  - If `status` is `done`, return cached result.
  - If `status` is `error`, return error or allow retry.
  - If no entry, create a new `pending` job and add user as subscriber.

### b. Worker Process
- A background worker polls the queue for `pending` jobs:
  - Sets job to `processing`.
  - Runs the parsing logic (Puppeteer, etc.).
  - On success: stores result, sets status to `done`.
  - On failure: sets status to `error`, logs error message.
  - Notifies all subscribers (if implemented).

### c. Discord Command Flow
- User requests fic metadata:
  - If job is `pending`/`processing`, inform user and subscribe them.
  - If job is `done`, return result.
  - If job is `error`, return error or allow retry.
  - If no job, enqueue and inform user.

### d. Result Delivery
- When a job completes, notify all subscribers (DM or channel message).
- Optionally, cache results for a configurable time.

---

## 3. Implementation Steps

1. **Design Sequelize models and migrations for `ParseQueue` and `ParseQueueSubscribers`**
2. **Implement enqueue logic in Discord command handlers**
3. **Implement background worker (Node.js script or PM2 process)**
4. **Integrate worker with parsing logic (ficParser.js, ao3Meta.js, etc.)**
5. **Implement subscriber notification system**
6. **Add error handling, retries, and logging**
7. **Test with multiple users and edge cases**

---

## 4. Considerations
- **Concurrency:** Ensure only one worker processes a job at a time (use DB row locking or atomic status updates).
- **Scalability:** Worker can be scaled horizontally if needed.
- **Timeouts:** Worker should have reasonable timeouts and retry logic.
- **Security:** Sanitize URLs and user input.
- **User Experience:** Provide clear feedback and notifications.
- **Extensibility:** Queue can be used for other long-running tasks in the future.

---

## 5. Future Enhancements
- Add priority levels to queue jobs.
- Add admin dashboard for monitoring queue/jobs.
- Add analytics for most-requested fics/sites.
- Integrate with caching layer (e.g., Redis) for faster lookups.

---

## 6. References
- See `docs/bot-architecture-overview.md` for overall system design.
- See `docs/message-tracking-utility.md` for notification patterns.
- See `docs/profile-module-architecture.md` for Sequelize usage patterns.

---
