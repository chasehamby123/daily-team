---
name: daily-team
description: Show today's creative team and task, have the team plan it, or build it as an HTML tool. The team and task are drawn from the date, so they change every day. Use when the user asks for today's team, today's task, a creative team, or new angles on a brief.
argument-hint: "[build [1-4]] [brief]"
allowed-tools: Bash(sh *), Bash(cat *)
---

# Daily team

!`sh "${CLAUDE_SKILL_DIR}/team.sh"`

Request: $ARGUMENTS

- Empty request: print the team and task above as written and stop.
- A brief: follow "Work the brief" with that brief instead of the task.
- `build`, an optional count from 1 to 4, then an optional brief: follow "Work the brief" for the brief, or for today's task if there is none. Then follow "Build an artifact" once per artifact, with member 1 leading the first, member 2 the second, and so on. Write each file to `days/<date>/artifact-<n>.html` in the current directory instead of printing it, and give the user the path.

If the team above is missing or shows an error, run `sh team.sh` from this skill's folder and use its output.

!`cat "${CLAUDE_SKILL_DIR}/prompt.md"`
