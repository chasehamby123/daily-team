---
name: daily-team
description: Show today's creative team, put it to work on a brief, or have it build HTML artifacts. The team is drawn from the date, so it changes every day. Use when the user asks for today's team, a creative team, or new angles on a brief.
argument-hint: "[build [1-4]] [brief]"
allowed-tools: Bash(sh *), Bash(cat *)
---

# Daily team

!`sh "${CLAUDE_SKILL_DIR}/team.sh"`

Request: $ARGUMENTS

- Empty request: print the team above as written and stop. Do not invent a brief.
- A brief: follow "Work the brief".
- `build`, an optional count from 1 to 4, then a brief: follow "Work the brief", then "Build an artifact" once per artifact, with member 1 leading the first, member 2 the second, and so on. Write each file to `days/<date>/artifact-<n>.html` in the current directory instead of printing it.

If the team above is missing or shows an error, run `sh team.sh` from this skill's folder and use its output.

!`cat "${CLAUDE_SKILL_DIR}/prompt.md"`
