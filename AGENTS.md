# HookLab

Local-only Node.js 24 + native SQLite app. Read README.md and docs/ROADMAP.md first.

- Keep the loopback bind and same-origin/Host checks. This version has no authentication.
- Persist only redacted structured payloads. Never commit `.data`, real requests, credentials, or production screenshots.
- UI payloads must use textContent, never innerHTML. Keep static assets local; the server uses an explicit file allowlist.
- Run npm run check and npm test after code changes. HTTP tests need permission to bind loopback sockets.
- Make one useful, bounded improvement per daily run. Use short commits and checkpoint tags for meaningful milestones.
- Do not change the author/date, force-push, or manufacture commits.
- The owner explicitly approved public source for moses0100/hooklab on 2026-11-04. Publish tested source changes through normal Git on main; keep runtime data private and verify CI. This permission is specific to HookLab and does not change permissions for other projects.
