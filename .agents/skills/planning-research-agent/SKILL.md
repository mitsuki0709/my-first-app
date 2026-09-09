# Planning & Research Agent Skill

Use this skill whenever the user asks what should be built, requests problem or market discovery, brings an idea for evaluation, asks for competitor research, or asks to continue an opportunity that has not yet been approved for development.

## Goal

Find problems worth solving, reject weak ideas, and reduce uncertainty before code is written. Optimize for a combination of real user benefit and sustainable economics—not idea count, novelty, AI usage, or market size alone.

## 1. Establish state

Read in this order:

1. `AGENTS.md`;
2. `docs/PROJECT_STATE.md`;
3. `docs/RESEARCH_STATE.md`, if present;
4. `docs/OPPORTUNITY_BACKLOG.md`, if present;
5. `docs/REJECTED_IDEAS.md`, if present;
6. `docs/PROJECT_BRIEF.md`, if present;
7. `README.md` and relevant code/tests when assessing reuse or feasibility.

Do not assume a brief authorizes implementation. The status and evidence gate control the transition.

## 2. Start from a problem

For each candidate, identify:

- the specific user;
- what happens and how often;
- severity and measurable loss;
- current workaround and what remains unsolved;
- the value of solving it;
- why the problem persists.

Distinguish weak convenience from strong need. Give priority to frequent time loss, recurring mistakes, labor cost, waste, missed revenue, safety/mental burden, or an existing budget. Do not add AI when ordinary software is safer or simpler.

## 3. Research evidence

Prefer sources in this order: public agencies, official company material, industry bodies, filings/IR, major reporting, market research, specialist media, verified reviews, then social posts/forums.

For every material claim, label it as:

- **Fact** — supported by a cited, reviewable source;
- **Inference** — a reasoned conclusion from facts;
- **Hypothesis** — unverified and requiring a named test.

Record source date and retrieval date when recency matters. If live research is unavailable, state the limitation, avoid asserting changing figures or prices, and place source re-verification in the next steps. Never promote an opportunity merely because desk research looks favorable.

## 4. Compare alternatives and competitors

Generate multiple solution approaches per meaningful problem when practical and select the smallest approach with the largest testable value.

Compare direct products and substitutes such as paper, spreadsheets, memory, telephone, and existing workflows. Capture target users, core functions, price or “not public,” strengths, weaknesses, adoption burden, user complaints when evidenced, and the gap we could credibly serve. Competition can prove demand; it is not an automatic rejection.

## 5. Score and decide

Score each opportunity out of 100:

| Dimension | Points |
| --- | ---: |
| Problem size | 20 |
| Problem-solving effect | 20 |
| Usage intent | 12 |
| Value relative to price | 12 |
| Feasibility | 12 |
| Small-scale testability | 10 |
| Differentiation / unresolved gap | 7 |
| Sustainable revenue | 7 |

Also assign confidence (`High`, `Medium`, or `Low`) and explain the weakest assumptions. Scores prioritize research; they do not prove demand. Reject or hold a high-scoring idea when legal/safety risk, acquisition difficulty, operational cost, weak payment intent, lack of repeat use, or an adequate existing solution is decisive.

Use these score bands as decision aids:

- **80–100** — highly promising, but still `VALIDATE` until real-user evidence passes the gate;
- **70–79** — promising; conduct additional research or a small validation;
- **60–69** — hold pending one explicit hypothesis test;
- **0–59** — reject by default.

Confidence means: **High** for multiple reliable sources plus concrete target-user evidence, **Medium** when market/problem evidence exists but usage or payment intent remains unverified, and **Low** when the case is mainly hypotheses.

## 6. Opportunity state machine

Use exactly these states in `docs/OPPORTUNITY_BACKLOG.md` and the leading opportunity documents:

- **DISCOVERY** — a problem candidate without enough background evidence.
- **RESEARCHING** — desk research and alternative/competitor analysis are incomplete.
- **VALIDATE** — the important uncertainty requires interviews, workflow observation, a prototype, concierge test, or payment-intent test.
- **READY_FOR_MVP** — real target users have completed the predefined validation, evidence meets the recorded success gate, a buildable MVP and stop conditions exist, and no unresolved approval blocks development transition.
- **HOLD** — intentionally deferred pending a named change or evidence.

Hard rules:

1. A high score, completed research document, detailed MVP, or created `PROJECT_BRIEF.md` is **not** enough for `READY_FOR_MVP`.
2. Do not mark actual demand as validated from surveys about hypothetical interest alone. Prefer observed work, repeated use, concrete commitments, or payment behavior.
3. Keep an opportunity in `VALIDATE` until its stated evidence gate has actually passed.
4. When evidence fails a stop condition, reject it or return it to research; do not lower the price or change metrics merely to preserve it.
5. Material changes to target user, product purpose, cost, privacy, external services, publishing, or production remain subject to `AGENTS.md` approval even after validation.

## 7. Design validation before development

Define the smallest test for:

- whether the problem occurs;
- current frequency, time, mistakes, or monetary loss;
- whether the proposed workflow improves it;
- repeat usage;
- willingness to pay or make another concrete commitment.

Set numeric success and stop conditions before the test. Prefer interviews about recent behavior and observation of current work over “Would you use this?” questions. A no-code, paper, spreadsheet, existing-product, or manually assisted test is preferred when it can answer the question without product code.

## 8. Pricing and business model

Work in this order: user outcome → measurable benefit → alternative cost → ability to pay → price. Choose a charging unit that matches delivered value. Treat all untested prices as hypotheses. Do not build billing or purchase services without approval.

## 9. Maintain project memory

- `docs/RESEARCH_STATE.md`: current theme, facts/inferences/hypotheses, research completed and missing, candidate comparison, first choice, validation design, risks, and next action.
- `docs/OPPORTUNITY_BACKLOG.md`: one row per opportunity with score, confidence, state, and next gate.
- `docs/REJECTED_IDEAS.md`: rejected idea, reason, date, and a concrete reconsideration condition.
- `docs/PROJECT_BRIEF.md`: only the current first-choice opportunity. While it is unvalidated, show `VALIDATE — validation incomplete; development transition not approved` prominently and describe it as a future handoff draft.
- `docs/PROJECT_STATE.md`: keep the existing product's state separate from opportunity discovery and record whether development transition is permitted.

Status must agree across all documents. Update the date when research status or evidence changes.

## 10. Development handoff gate

Only change the leading opportunity to `READY_FOR_MVP` when all are true and recorded:

- problem, target user, and current workaround are supported by target-user evidence;
- the predefined validation success conditions passed;
- solution and differentiation are clear;
- the MVP is feasible and small-testable;
- success metrics, stop conditions, price hypothesis, and key risks exist;
- no fatal legal, safety, operational, acquisition, or reliability issue remains;
- required user approval under `AGENTS.md` has been obtained.

At handoff, record the validation date, sample, measurements, and decision in both `RESEARCH_STATE.md` and `PROJECT_BRIEF.md`. Until then, the development agent must not implement the proposed opportunity features.

## 11. Standard output

Use this structure for substantial research:

1. Conclusion
2. Problems found
3. Market and users
4. Existing services and competitors
5. Three to five candidates
6. 100-point comparison
7. First choice
8. Recommendation rationale
9. MVP hypothesis
10. Validation method, success gate, and stop conditions
11. Pricing and revenue hypothesis
12. Risks and evidence gaps
13. Next actions

Report clearly whether each major statement is fact, inference, or hypothesis, and state the opportunity status. If no candidate is strong enough, conclude “do not build yet.”
