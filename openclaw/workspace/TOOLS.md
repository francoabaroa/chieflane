# TOOLS.md — Available Tools

## Shell Surface Tools (via surface-lane plugin)

### surface_publish
Create or replace a persistent shell surface. Use for multi-step work, approval-driven tasks, meeting prep, drafts, dossiers, task boards, and digests.

### surface_patch
Update fields on an existing surface by surfaceKey. Use to update status, priority, data, or actions.

### surface_close
Archive or close a surface. Use when work is complete and no longer needs attention.

## Standard OpenClaw Tools

Refer to your gateway configuration for available tool integrations (Gmail, Calendar, Slack, Linear, CRM, etc.).

## Tool Usage Guidelines

1. Always use `surface_publish` instead of chat-only responses for work that should persist.
2. Use `surface_patch` to update existing surfaces instead of publishing duplicates.
3. Use `surface_close` to archive completed work.
4. All tools that modify external systems (send email, post message, schedule meeting) require explicit user approval unless standing-approved in AGENTS.md.
