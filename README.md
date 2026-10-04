# daily-team

A new four-person creative team every day, and the small web tool it built. This repository is the record: each day's team, its plan, and its asset, kept in [days/](days/) and listed in the [archive](ARCHIVE.md).

Everything in `days/` is written by a language model and checked by scripts, not by hand. The model and provider for each day are on its page.

## Today

<!-- TODAY:START -->
### 2026-10-04: Weekly planner page with priorities, appointments, and notes, printable on A4.

<a href="days/2026-10-04/"><img src="days/2026-10-04/team.png" alt="Team for 2026-10-04: Comic artist · Packaging designer · Exhibition designer · Printmaker" width="100%"></a>

**Task:** Weekly planner page with priorities, appointments, and notes, printable on A4.

**Decision:** The page is a single-column, printable A4 weekly planner with one row per day, each row holding one priority line, one appointment line (with optional time), and one notes line, plus a full-width notes strip at the bottom.

<a href="days/2026-10-04/"><img src="days/2026-10-04/artifact-1.png" alt="Screenshot of today's asset" width="100%"></a>

[Open the day](days/2026-10-04/) · [Use it](https://isas1.github.io/daily-team/2026-10-04/) · [Archive](ARCHIVE.md)
<!-- TODAY:END -->

## This week

<!-- WEEK:START -->
**Season 1**, since 2026-10-01. The first season, so everyone is new. A new season with 8 new roles and 8 new methods is drafted every Monday.

### Vote on what gets built next

[Suggest a task](https://github.com/isas1/daily-team/issues/new?template=task-suggestion.yml) or vote with a thumbs-up on [open suggestions](https://github.com/isas1/daily-team/issues?q=is%3Aissue+is%3Aopen+label%3Atask-suggestion+sort%3Areactions-%2B1-desc). The most voted are screened every Monday.

| Votes | Suggestion |
|---|---|
| 1 | [Price in hours: enter your take-home pay per hour and any price, and see what it costs in hours a...](https://github.com/isas1/daily-team/issues/16) |
| 0 | [Gut check coin: type two options and flip, then say how the result made you feel, and the page te...](https://github.com/isas1/daily-team/issues/14) |
| 0 | [Estimate anything: break a question nobody can look up into small guesses with a low and high val...](https://github.com/isas1/daily-team/issues/15) |
<!-- WEEK:END -->

## Recent days

<!-- RECENT:START -->
| Date | Asset | Task | Team |
|---|---|---|---|
| [2026-10-04](days/2026-10-04/) | <a href="days/2026-10-04/"><img src="days/2026-10-04/artifact-1.png" alt="Weekly planner page with priorities, appointments, and notes, printable on A4." width="160"></a> | Weekly planner page with priorities, appointments, and notes, printable on A4. | Comic artist · Packaging designer · Exhibition designer · Printmaker |
| [2026-10-03](days/2026-10-03/) | <a href="days/2026-10-03/"><img src="days/2026-10-03/artifact-1.png" alt="Running pace calculator" width="160"></a> | Running pace calculator | Service designer · Product designer · Interaction designer · Choreographer |

[All 2 days](ARCHIVE.md)
<!-- RECENT:END -->

## How it works

1. **The team.** `team.sh` turns the date into four members, each with a role, a method, and a stance, plus a constraint and a task. The same date always gives the same team. Within a season no role or method repeats within 7 days, no constraint within 22 days, and no task within 61 days.
2. **The guest.** From season 2, member 4 is a guest who brings one method: a historical figure, a figure from myth, a character from an old book, an archetype, a person from the future, or a creature. Guests never speak as the figure. Real people and authors must have died at least 100 years ago, myths are used in their traditional form, and gods of living religions, brands, and modern franchises are excluded.
3. **The cast.** Every Monday a language model drafts the next season: 8 new roles, 8 new methods, and 2 new guests join, the longest-serving leave, and voted suggestions become tasks. Scripts check the draft and it opens as a pull request for review. Seasons start on a future Monday, so past days never change.
4. **The work.** Each morning a language model plays the team. The members propose, object, and decide, then build the task as one HTML file.
5. **The checks.** The file must have a title and a mobile layout, stay under 100 KB, and make no network requests. A file that fails is retried once, then marked "needs review".
6. **The record.** The workflow takes a screenshot, draws the team card, writes the day page, updates the archive and this README, and commits the result. Days that fail are recorded too.

## Take part

[Suggest a task](https://github.com/isas1/daily-team/issues/new?template=task-suggestion.yml), vote with a thumbs-up on open suggestions, or read [CONTRIBUTING.md](CONTRIBUTING.md).

## Run your own

Fork the repo, then add one secret:

- `OPENROUTER_API_KEY` for OpenRouter's free models (the default). Create the key with a credit limit.
- Or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` to use a Claude subscription, and set the repository variable `PROVIDER` to `claude`. Each day uses 2 to 5 requests from your plan's limits.

Optional variables: `MODEL`, `CLAUDE_MODEL` (default `claude-opus-5-5`), `ARTIFACTS` (0 to 4, default 1), `TZ`, and `PAGES` (`true` to publish the tools on GitHub Pages). To record a day by hand with your Claude login, run `sh daily.sh`. It commits and pushes.

The folder also works as a Claude Code skill: clone it into `~/.claude/skills/daily-team`, then use `/daily-team`.

## Safety

- Keys are passed only to the step that calls the model. They are never written to disk or printed.
- The Claude provider runs with no tools, no MCP servers, no user settings or hooks, and no CLAUDE.md, so the model can only return text.
- Every asset gets a Content-Security-Policy that blocks network requests. On GitHub Pages, assets run only inside a sandboxed frame.
- Free models can log prompts. Do not put private material in `brief.md`.
- See [SECURITY.md](SECURITY.md) to report a problem.

## License

Code and content: MIT.

Design: the Sam Creates design system, in [brand/](brand/). The fonts are Mozilla Headline and Mozilla Text under the SIL Open Font License 1.1; see [brand/fonts](brand/fonts).
