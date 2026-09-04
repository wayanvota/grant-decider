# Funder Pursuit Advisor

Funder Pursuit Advisor helps a nonprofit decide whether one foundation deserves research, cultivation, relationship-building, and proposal time. The useful output is a source-backed decision, including a defensible `DECLINE` or `PARK`, not a longer prospect list.

The public site is intended for:

```text
https://wayan.com/grant-decider/
```

The legacy URL is retained, but the user-facing product name is Funder Pursuit Advisor. Grant Fit Auditor remains a separate companion tool for evaluating a specific grant opportunity with published guidelines.

## Decision contract

The tool returns one of four states:

- `DECLINE`: a sourced hard gate fails.
- `PARK`: active pursuit should stop until a named trigger changes.
- `PURSUE`: the evidence supports one bounded next step within a user-supplied time ceiling.
- `NEEDS HUMAN CHECK`: identity, source coverage, or a material fact cannot be verified responsibly.

There is no numeric fit score. The research engine extracts public evidence; deterministic service rules apply the final status. Kindora supplies bounded structured identity, 990, itemized-grant, giving-statistics, and exact-foundation open-program records. Its data is attributed and treated as provider-derived unless an underlying source link is present. Every completed result includes direct source links, hard-gate findings, access, observed grant patterns, counterevidence, missing evidence, research cutoff, filing periods, hours at risk, and cost at risk when supplied.

## Architecture

- `index.html`: accessible nonprofit profile, foundation input, progress state, and evidence-led result.
- `about.html`: method, evidence limits, privacy, and human boundaries.
- `styles.css`: warm editorial interface based on the shared Intercom-inspired design standard.
- `app.js`: form handling, optional browser-only profile storage, result rendering, and Markdown or JSON export.
- `config.js`: server-side research API location.
- `docs/funder-pursuit-agent-prd.md`: approved product requirements and release boundaries.
- `test/site.test.js`: static product-contract and safety checks.
- `TEST-REPORT.md`: 20-case nonprofit-behavior and adversarial release verification.

The public research service is shared with Grant Fit Auditor. `POST /pursuit` uses the existing server-side OpenAI credential, disables OpenAI response storage, queries public sources, and does not keep a server-side nonprofit profile or decision history. It also calls Kindora's read-only public MCP through a fixed six-tool allowlist and sends only the foundation identity and bounded search arguments. The nonprofit profile is not sent to Kindora.

## Local check

```bash
npm test
python3 -m http.server 4173
```

Open `http://localhost:4173`. Production browser calls are restricted to Wayan.com; the service permits localhost during non-production development only.

## Boundaries

The first release handles one nonprofit and one foundation at a time. It does not contact funders, infer private relationships, draft outreach, write proposals, predict win probability, use authenticated data, or take external action. A nonprofit leader must inspect decisive evidence and make the final pursuit decision.

## License

Released under the 0BSD license. See `LICENSE`.
