# daily-team

A new four-person creative team every day, and the small web tool it built. This repository is the record: each day's team, its plan, and its asset, kept in [days/](days/) and listed in the [archive](ARCHIVE.md).

## Today

<!-- TODAY:START -->
### 2026-10-03: Running pace calculator

<a href="days/2026-10-03/"><img src="days/2026-10-03/team.svg" alt="Team for 2026-10-03: Service designer · Product designer · Interaction designer · Choreographer" width="100%"></a>

**Task:** Running pace calculator: distance and time give pace per km and per mile and projected times for 5 km, 10 km, half, and full marathon.

**Decision:** The page calculates running pace from distance and time, providing per‑km and per‑mile pace plus projected times for 5 km, 10 km, half and full marathon.

<a href="days/2026-10-03/"><img src="days/2026-10-03/artifact-1.png" alt="Screenshot of today's asset" width="100%"></a>

[Open the day](days/2026-10-03/) · [Archive](ARCHIVE.md)
<!-- TODAY:END -->

## Recent days

<!-- RECENT:START -->
| Date | Asset | Task | Team |
|---|---|---|---|
| [2026-10-03](days/2026-10-03/) | <a href="days/2026-10-03/"><img src="days/2026-10-03/artifact-1.png" alt="Running pace calculator" width="160"></a> | Running pace calculator | Service designer · Product designer · Interaction designer · Choreographer |

[All 1 day](ARCHIVE.md)
<!-- RECENT:END -->

## How it works

1. **The team.** `team.sh` turns the date into four members, each with a role, a method, and a stance, plus a constraint and a task. The same date always gives the same team. No role or method repeats within 7 days, no constraint within 22 days, and no task within 61 days.
2. **The work.** Each morning a language model plays the team. The members propose, object, and decide, then build the task as one HTML file.
3. **The checks.** The file must have a title and a mobile layout, stay under 100 KB, and make no network requests. A file that fails is retried once, then marked "needs review".
4. **The record.** The workflow takes a screenshot, draws the team card, writes the day page, updates the archive and this README, and commits the result. Days that fail are recorded too.

## Run your own

Fork the repo, then add one secret:

- `OPENROUTER_API_KEY` for OpenRouter's free models (the default). Create the key with a credit limit.
- Or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` to use a Claude subscription, and set the repository variable `PROVIDER` to `claude`.

Optional variables: `MODEL`, `CLAUDE_MODEL`, `ARTIFACTS` (0 to 4, default 1), `TZ`, and `PAGES` (`true` to publish the tools on GitHub Pages). To record a day by hand with your Claude login, run `sh daily.sh`. It commits and pushes.

The folder also works as a Claude Code skill: clone it into `~/.claude/skills/daily-team`, then use `/daily-team`.

## Safety

- Keys are passed only to the step that calls the model. They are never written to disk or printed.
- The Claude provider runs with no tools, no MCP servers, no user settings or hooks, and no CLAUDE.md, so the model can only return text.
- Every asset gets a Content-Security-Policy that blocks network requests. On GitHub Pages, assets run only inside a sandboxed frame.
- Free models can log prompts. Do not put private material in `brief.md`.
- See [SECURITY.md](SECURITY.md) to report a problem.

## License

MIT
