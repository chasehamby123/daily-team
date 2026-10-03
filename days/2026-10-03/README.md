# 2026-10-03: Running pace calculator

[Today](../../README.md) · [Archive](../../ARCHIVE.md)

<img src="team.svg" alt="Team for 2026-10-03: Service designer · Product designer · Interaction designer · Choreographer" width="100%">

**Task:** Running pace calculator: distance and time give pace per km and per mile and projected times for 5 km, 10 km, half, and full marathon.

**Constraint:** Has a dark mode that follows the system setting.

**Decision:** The page calculates running pace from distance and time, providing per‑km and per‑mile pace plus projected times for 5 km, 10 km, half and full marathon.

## Asset

<a href="artifact-1.html"><img src="artifact-1.png" alt="Screenshot of artifact-1.html" width="100%"></a>

[artifact-1.html](artifact-1.html), led by Service designer. Model: cohere/north-mini-code:free.

## Team plan

Proposals
Service designer
- Give each idea 20 minutes, then move on.
- Question the brief: clarify distance and time inputs.
- Ensure dark mode follows system setting.
- Test each input scenario within the time limit.
- Document findings for iteration.

Product designer
- List assumptions: inputs are numeric, dark mode is system‑based.
- Validate each assumption with unit tests.
- Plan delivery to users via onboarding tooltip.
- Include error handling for non‑numeric entries.
- Align output format with user expectations.

Interaction designer
- Build minimal MVP: input fields for distance and time.
- Compute pace per km and per mile.
- Display projected times for 5km, 10km, half, full.
- Ensure responsive layout and dark mode.
- Validate UI quality with usability testing.

Choreographer
- Remove one UI element per pass until core calculation fails.
- Restore the last removed element to test necessity.
- Iterate over dark mode toggle and input labels.
- Identify minimal set needed for functionality.
- Keep remaining elements simple and clear.

Objections
Member 1 objects to Member 2: assumptions overlook user context.
Member 2 objects to Member 3: MVP scope may miss edge cases.
Member 3 objects to Member 4: iterative removal may discard useful feedback mechanisms.
Member 4 objects to Member 1: 20‑minute per idea limit may hinder deep exploration.

Decision
The page calculates running pace from distance and time, providing per‑km and per‑mile pace plus projected times for 5 km, 10 km, half and full marathon. It answers objections from Member 1 and Member 2, accepts the objection from Member 3, and rejects the objection from Member 4.

Next steps
Add unit tests for input validation and dark mode behavior.
Implement responsive UI with tooltips and error messages.
Conduct usability testing with real users to verify calculations.

## Team

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

Provider: openrouter. Model: cohere/north-mini-code:free.
