# Multi-Bot Migration Todo List

This document tracks the step-by-step migration of the Sam bot codebase to support a unified multi-bot workspace for Sam, Dean, and Cas.

---

## 1. Plan and Prepare

- [ ] Define new folder structure for multi-bot support
- [ ] Identify all bot-specific and shared code
- [ ] Backup current codebase

## 2. Create New Folder Structure

- [ ] Create `src/bots/sam/` for Sam-specific code
- [ ] Create `src/bots/dean/` for Dean-specific code
- [ ] Create `src/bots/cas/` for Cas-specific code
- [ ] Create `src/bots/jack/` for Jack (queueWorker) specific code
- [ ] Create `src/shared/` for shared utilities, models, and helpers

## 3. Migrate Sam's Code

- [ ] Move `src/commands` to `src/bots/sam/commands`
- [ ] Move `src/events` to `src/bots/sam/events`
- [ ] Move Sam's entry point (main bot file) to `src/bots/sam/`
- [ ] Update all imports in Sam's code to reflect new paths
- [ ] Test Sam bot after each move

## 4. Migrate and Refactor Shared Code

- [ ] Move shared utilities to `src/shared/`
- [ ] Move shared models to `src/shared/`
- [ ] Update imports in all bots to use shared code
- [ ] Test Sam bot for shared code integration

## 5. Prepare for Dean and Cas

- [ ] Scaffold `src/bots/dean/` and `src/bots/cas/` with placeholder files
- [ ] Set up entry points for Dean and Cas
- [ ] Ensure shared code is accessible to all bots

## 6. Update Configuration and Scripts

- [ ] Update configuration files for multi-bot support
- [ ] Update PM2 ecosystem config for multiple bots
- [ ] Update deployment scripts as needed

## 7. Final Testing and Cleanup

- [ ] Run full test suite for Sam
- [ ] Verify no broken imports or runtime errors
- [ ] Document new structure and migration process

---

### Notes

- Commit after each major step for easy rollback
- Use global search/replace to update imports
- Test frequently to catch issues early

---

This checklist will be updated as the migration progresses.
