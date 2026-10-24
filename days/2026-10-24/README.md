# 2026-10-24: the red thread

[Today](../../README.md) · [Archive](../../ARCHIVE.md)

<img src="team.png" alt="Team for 2026-10-24: Animator · Front-end engineer · Fund manager raising capital · Sisyphus" width="100%">

**Task:** Before-and-after map: today's process as a list of steps becomes a side-by-side view marking the steps that could be removed or automated.

**Constraint:** Lowercase only.

**Season:** 2026-10-07

**Decision:** the page takes a fund manager's target raise and months in market, lays today's fundraising steps beside a filtered version, tags each step keep, automate, or remove, and shows partner hours, capital closed, and placement costs for the b...

## Asset

<a href="artifact-1.html"><img src="artifact-1.png" alt="Screenshot of artifact-1.html" width="100%"></a>

[artifact-1.html](artifact-1.html), led by Animator. Model: claude-opus-5-5.

## The session

### Pitch

**1 · Animator: the red thread**\
lay today's raise out as a strip of frames, one step per frame, left to right.\
now blow one thing up ten times: partner hours. a red thread runs under every frame, thick where hours burn.\
in the after strip the thread goes thin. removed frames turn grey and fold flat.\
shrink it ten times too. on a phone the whole strip collapses to one bar: hours before, hours after.\
one bold element. the thread. nothing else moves.

**2 · Front-end engineer: two columns, one row set**\
grid. left column today, right column after. same rows on both sides so the eye reads across.\
each row is one component: step name, partner hours, tag. three tags only: keep, automate, remove.\
one input set drives both columns. raise size, months in market.\
no canvas, no animation library. plain css, under 40kb, ships in a day.\
the thread can be a border. fine.

**3 · Fund manager raising capital: who actually writes**\
my last raise ran fourteen months. i met 120 lps. six wrote.\
show me that. the 114 who didn't, and what they cost my partners in hours.\
row one is the filter. cheque size and track record before anyone gets a call.\
if row one says "refine your deck" i close the tab. i have a deck.\
nine rows is homework. five.

**4 · Sisyphus: the stone that comes back**\
some steps you do once. some you do for every investor. those are the stone.\
the questionnaire. the follow-up note. the data room walk-through. same answers, sixty times.\
mark those rows with a count. done ×60. that is the weight.\
the after column does not flatten the hill. it makes the stone lighter: ai drafts the answers, a person signs.\
i'll wager the repeated rows are most of the hours.

### Clash

**4 · Sisyphus:** fund manager, i'll wager the questionnaire rows alone take more partner time than every first call combined. put your last raise in and see.

**3 · Fund manager raising capital:** eighteen data rooms, twelve hours each, 216. first calls, 120 at an hour and a half, 180. fine, you win that one. but the filter still goes first. that is the row i forward. that row.

**1 · Animator:** agreed, five rows. i'll keep the thread under all five and let it swell where the hours—

**2 · Front-end engineer:** —swell means an svg path per breakpoint. a border with three width classes does the same job. and put the shortcut in: placement agent on a $40k monthly retainer plus 2%, next to a 1.5% success share on filtered lps only. same inputs.

**3 · Fund manager raising capital:** placement agents. the last one billed nine months of retainer and brought me two family offices under $5m each. the success share i'd read. the retainer row, i want the total in big numbers. big.

**4 · Sisyphus:** engineer, ai drafts sixty questionnaires for maybe $300. someone has to put their name under each one. my wager: the fund manager won't let one go out unsigned.

**3 · Fund manager raising capital:** of course not. my coo signs every answer. the row says her title, not "ai".

**1 · Animator:** bad case. commits halve, six to three. the raise slips six months, fourteen to twenty. filtered path: 40 first calls, 22 second meetings, 10 data rooms with drafted answers. 156 partner hours against 531 today. per commit that's 52 hours, against 88 today. the hours hold.

**2 · Front-end engineer:** on hours, yes. on capital, no. three commits at $25m is $75m against a $200m target. the page says $75m. it doesn't round up.

**4 · Sisyphus:** animator, keep five rows. the ×60 stays on every repeated row. the fund manager calls it clutter. the wager stands.

### Decision

the page takes a fund manager's target raise and months in market, lays today's fundraising steps beside a filtered version, tags each step keep, automate, or remove, and shows partner hours, capital closed, and placement costs for the base case and the bad case.

Concept: the red thread

- Animator: the red thread under both columns, thick where partner hours burn, collapsing to one before-and-after bar under 480px.
- Front-end engineer: the two-column grid, one row component, three tags, a border-width thread in css, and the shortcut table with retainer path and success-share path on the same inputs.
- Fund manager raising capital: five rows, with the cheque-size and track-record filter as row one, and only two inputs: target raise and months in market.
- Sisyphus: ×60 counts on repeated rows, with ai-drafted questionnaire answers and "signed by coo" on the automate tag.
- Lost: the fund manager lost the argument to drop the ×60 counts, because the counts show that the repeated rows hold 216 of the 531 hours. the animator lost the svg thread to the engineer's border, because it does the same job at a fraction of the build time. the counts-as-clutter question is still open and goes to the first user test.
- Bad case: commits halve from six to three and the raise slips from fourteen to twenty months. partner hours drop from 531 to 156 and still hold. capital falls to $75m against $200m and the page shows that figure as is. the retainer path costs $800k in fees before any close. the success share costs nothing until first close, then 1.5% of $75m, which is $1.125m. the page holds on hours and on cost, and it states the capital shortfall in plain numbers.

### Build notes

1. build one row component (step, partner hours, ×count, tag, owner) and render five rows per column from a single json array: filter, first call, second meeting, data room and questionnaire, close.
2. wire the two inputs to the calculations. base case: 6 commits at $25m. bad case: 3 commits and +6 months. compute partner hours, $ closed, retainer total at $40k/month plus 2%, and success share at 1.5%. show both paths in one table.
3. set all page text lowercase. thread widths are 2px, 6px, and 12px borders. below 480px, collapse the grid to one bar per column showing 531 h and 156 h. keep the file under 40kb.

**Guest:** Sisyphus (myth; Greek myth). The method is drawn from public-domain history, myth, or literature, or invented. The guest speaks in character in original words, never quoting the source, and nothing here is endorsed by anyone.

## Team

```text
Team for 2026-10-24
Season: 2026-10-07

1. Animator
   Method: Try it ten times larger and ten times smaller.
   Stance: Adds one bold element.
   Temperament: Agrees fast, then quietly does it their own way.
2. Front-end engineer
   Method: Build a kit of parts, then assemble.
   Stance: Checks cost and time.
   Temperament: Impatient; cuts people off mid-sentence.
3. Fund manager raising capital (buyer; outerhaven) [buyer] [new]
   Method: Pain: Spends the raise on investors who will never commit. Walks when: It wastes partner time on people who will not write a cheque. Opens up when: Investors are filtered by cheque size and track record first.
   Stance: Cuts scope.
   Temperament: Gets louder the more sure they are.
4. Sisyphus (myth; Greek myth) [guest]
   Method: Make the task that will repeat lighter.
   Stance: Speaks for the user.
   Temperament: Turns every disagreement into a wager.

Constraint: Lowercase only.
Task: Before-and-after map: today's process as a list of steps becomes a side-by-side view marking the steps that could be removed or automated.
```

Provider: claude. Model: claude-opus-5-5.
