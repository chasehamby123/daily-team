# Contributing

## Suggest a task

[Open a suggestion](https://github.com/isas1/daily-team/issues/new?template=task-suggestion.yml). Vote for others with a thumbs-up reaction.

Every Monday the open suggestions with the most votes are screened, up to 20. Accepted ones are rewritten in the house style and join the task pool for the season that starts the following Monday. Each suggestion gets a comment with the outcome and is closed.

A task is accepted when it is:

- one specific tool that fits in a single HTML file and works offline;
- useful to a broad audience, with a concrete output;
- free of medical, legal, and investment advice;
- free of names of real people, companies, brands, and products;
- not already in the pool.

## How the team changes

Each Monday a language model drafts the next season: 8 new roles, 8 new methods, 2 constraints, and 6 tasks, with the oldest of each retired. Scripts check the draft, and it opens as a pull request. Nothing reaches the daily runs until the maintainer merges it. A season starts on a future Monday, so recorded days never change.

## Code

Run `node --test test.mjs` before opening a pull request. Keep to plain wording: the tests reject the words listed in `prompt.md`.
