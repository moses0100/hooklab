# HookLab

Local-only Node.js 24 + native SQLite app. Read README.md and docs/ROADMAP.md first.

- Keep the loopback bind and same-origin/Host checks. This version has no authentication.
- Persist only redacted structured payloads. Never commit `.data`, real requests, credentials, or production screenshots.
- UI payloads must use textContent, never innerHTML. Keep static assets local; the server uses an explicit file allowlist.
- Run npm run check and npm test after code changes. HTTP tests need permission to bind loopback sockets.
- Make one useful, bounded improvement per daily run. Use short commits and checkpoint tags for meaningful milestones.
- Do not change the author/date, force-push, or manufacture commits.
- Publishing source is currently awaiting explicit public-source approval after automatic review rejected public repository creation on 2026-11-04. Until the user approves in this chat, keep work and commits local; do not use another channel or automation to publish it.
