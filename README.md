# daily-team

Every day a new four-person creative team builds one small, useful web tool. Each member has a role, a method, and a stance. The day adds a constraint and a task.

## Today

<!-- TODAY:START -->
### 2026-10-03: Running pace calculator: distance and time give pace per km and per mile and projected times for 5 km, 10 km, half, and full marathon.

The first daily run adds the example here.

```text
Team for 2026-10-03

1. Service designer
   Method: Give each idea 20 minutes, then move on.
   Stance: Questions the brief.
2. Product designer
   Method: List the assumptions in the brief and check each one.
   Stance: Plans how it reaches people.
3. Interaction designer
   Method: Build the smallest version that works end to end.
   Stance: Guards execution quality.
4. Choreographer
   Method: Remove one element per pass until it breaks, then restore the last one.
   Stance: Pushes for a less expected result.

Constraint: Has a dark mode that follows the system setting.
Task: Running pace calculator: distance and time give pace per km and per mile and projected times for 5 km, 10 km, half, and full marathon.
```
<!-- TODAY:END -->

## How it works

`team.sh` turns the date into a team, a constraint, and a task. Nothing needs to update: the same date always gives the same result. No role or method repeats within 7 days, no constraint within 22 days, and no task within 61 days. Run `sh team.sh 2026-12-25` to see any date.

Each morning the `Daily` workflow sends the team and task to a language model. The team proposes, objects, and decides, then builds the tool as one HTML file. The workflow checks the file, takes a screenshot, updates this README, and commits the result to [days/](days/).

## Use in Claude Code

```sh
git clone https://github.com/isas1/daily-team ~/.claude/skills/daily-team
```

```text
/daily-team                      today's team and task
/daily-team <brief>              the team plans your brief instead
/daily-team build                the team builds today's task as an HTML file
/daily-team build 2 <brief>      2 HTML files for your brief
```

## Run it yourself

Requires Node 20 or later. Put your key in `.env`, which git ignores:

```sh
echo "OPENROUTER_API_KEY=your-key" > .env
node --env-file=.env run.mjs --artifacts 1
sh shot.sh
node publish.mjs
```

The default model is `openrouter/free`, which routes to OpenRouter's free models. Set `MODEL` to a comma-separated list to choose models, and `API_URL` for any OpenAI-compatible endpoint. A `brief.md` file, also ignored by git, replaces the daily task.

## Run it daily on GitHub

1. Fork the repo and enable Actions.
2. Create an OpenRouter key with a credit limit, then add it as the secret `OPENROUTER_API_KEY`.
3. Optional repository variables: `MODEL`, `ARTIFACTS` (0 to 4, default 1), `API_URL`, `TZ`, and `PAGES` (`true` to publish the tools on GitHub Pages).

The workflow runs at 06:00 UTC. You can also start it from the Actions tab.

## Safety

- The key is only passed to the step that calls the API. It is never written to disk or printed.
- Generated HTML gets a Content-Security-Policy that blocks network requests. On GitHub Pages each tool runs in a sandboxed frame, so it cannot read data from other pages on the same domain.
- Free models can log prompts. Do not put private material in `brief.md`.
- See [SECURITY.md](SECURITY.md) to report a problem.

## Files

| File | Purpose |
|---|---|
| `team.sh` | Date to team, constraint, and task. Pools are at the end of the file. |
| `SKILL.md` | The Claude Code skill. |
| `prompt.md` | Instructions and writing rules, shared by the skill and `run.mjs`. |
| `run.mjs` | Calls the model and writes `days/<date>/`. |
| `shot.sh` | Screenshots each new HTML file with headless Chrome. |
| `publish.mjs` | Updates the Today block and builds the Pages site. |
| `test.mjs` | Tests: `node --test test.mjs` |

## License

MIT
