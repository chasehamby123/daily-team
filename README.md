# daily-team

A four-person creative team that changes every day. Each member has a role, a method, and a stance. The day adds one constraint. The team is computed from the date, so nothing needs to update and everyone gets the same team on the same day.

```text
Team for 2026-10-02

1. Typographer
   Method: Scope the work to what fits in one day.
   Stance: Speaks for the user.
2. Industrial designer
   Method: Write the copy before the layout.
   Stance: Adds one bold element.
3. Furniture maker
   Method: Prototype in the final material.
   Stance: Cuts scope.
4. Book editor
   Method: Make it work in black and white before adding color.
   Stance: Checks cost and time.

Constraint: Learnable in 30 seconds.
```

No role or method repeats within 7 days. No constraint repeats within 22 days.

## Use in Claude Code

```sh
git clone https://github.com/isas1/daily-team ~/.claude/skills/daily-team
```

```text
/daily-team                      today's team
/daily-team <brief>              the team works on your brief
/daily-team build 2 <brief>      the plan, then 2 HTML files in days/<date>/
```

## Run it every day

`run.mjs` sends today's team and `brief.md` to an OpenAI-compatible API. The default is OpenRouter's free models. It writes `days/<date>/team.md` and one HTML file per artifact.

```sh
OPENROUTER_API_KEY=... node run.mjs --artifacts 1
```

To run it daily on GitHub:

1. Fork the repo and enable Actions.
2. Add the secret `OPENROUTER_API_KEY`.
3. Edit `brief.md`.

The `Daily` workflow runs at 06:00 UTC and commits the results. Optional repository variables: `MODEL` (comma-separated, tried in order, default `openrouter/free`), `ARTIFACTS` (0 to 4, default 1), `API_URL`, `TZ`.

Free models can log prompts. Do not put private material in `brief.md`. Artifacts get a Content-Security-Policy that blocks network requests.

## Files

| File | Purpose |
|---|---|
| `team.sh` | Date to team. Pools are at the end of the file. |
| `SKILL.md` | The Claude Code skill. |
| `prompt.md` | Instructions and writing rules, shared by the skill and `run.mjs`. |
| `run.mjs` | Daily run through an API. Node 18 or later, no dependencies. |
| `brief.md` | The brief for daily runs. |
| `test.mjs` | Tests: `node --test` |

## License

MIT
