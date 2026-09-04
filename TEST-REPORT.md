# Funder Pursuit Advisor test report

**Test window:** September 3-4, 2026, America/New_York  
**Public site:** <https://wayan.com/grant-decider/>  
**API:** <https://grant-fit-auditor.onrender.com>  
**Frontend fix commit:** `384cc18`  
**Backend boundary fix:** `1a1572c`  
**Expanded boundary tests:** `b462236`  
**Evidence-provenance fix:** `d05d7e3`  
**Final evidence-link fix:** `61622aa`

## Release judgment

`READY WITH KNOWN LIMITATIONS`

The 20 executed categories below passed after focused repairs. This report does not claim that the site is secure against attacks outside these tests. Destructive testing, sustained load, distributed rate-limit testing, vendor-data auditing, and the PRD's 60-pair fundraiser review were outside this run.

## Test environments

- Local source and deterministic Node tests against the frontend and Express service
- Temporary local browser session at desktop and 375 by 812 phone viewport
- Authorized production HTTP checks against Wayan.com and the Render API
- One full production Kresge review using a synthetic nonprofit profile
- GitHub Actions on each pushed backend change

## Ten nonprofit-behavior tests

| ID | What a nonprofit did | Expected behavior | Initial result | Final result and evidence |
|---|---|---|---|---|
| NP-01 | Opened the public product and reviewed its method before entering data | Correct name, four decision states, human boundary, and 24 usable form controls | Pass | Pass. Live DOM contained the expected title, form, navigation, and decision rules. |
| NP-02 | Tried to submit an empty form | The first missing required field receives focus; no request starts | Pass | Pass. `foundationName` received focus and the progress panel remained hidden. |
| NP-03 | Entered a minimum request greater than the maximum | Browser and server stop the request with a specific correction | Pass | Pass. Client and server both enforce the request range. |
| NP-04 | Opted to save a nonprofit profile, reloaded, and cleared it | Nonprofit fields return; foundation prospect does not persist; clearing restores defaults | Pass | Pass. Synthetic profile restored locally, foundation name stayed blank, and Clear removed the profile while restoring 4 research hours. |
| NP-05 | Entered staff hours with an explicit $0 hourly cost | Report 46 hours and $0, not “cost not supplied” | **Fail** | Pass after repair. A falsey-value check treated zero as missing; the cost calculation now accepts explicit nonnegative zero. |
| NP-06 | Evaluated an otherwise aligned prospect with a sourced geography exclusion | `DECLINE`, the cited exclusion, and a geography-specific reopening condition | Pass | Pass through deterministic decision regression. |
| NP-07 | Selected “confirmed warm path” without naming the route | Do not let an unsupported relationship claim bypass invitation-only access | **Fail** | Pass after repair. Browser and server now require a meaningful route note; the decision layer also parks an unsubstantiated claim. |
| NP-08 | Supplied an EIN belonging to a similarly named but different foundation | Withhold the decision and expose the identity conflict | **Fail** | Pass after repair. “Ford Family Foundation” can no longer be confirmed against Ford Foundation solely because both names contain “Ford.” |
| NP-09 | Received an ask-size mismatch supported only by Kindora aggregation | Do not issue `DECLINE` from provider-derived evidence alone | Pass | Pass. The failed gate becomes unclear and the report warns about provider-derived support. |
| NP-10 | Ran a complete Kresge review for a synthetic Durham health nonprofit | Confirm identity, calculate time and cost, show sources and Kindora records, and stop inaccessible pursuit | **Partial fail** | Pass after repair. The final production run returned `PARK`, 46 hours, $3,450, a confirmed EIN, six Kindora calls, and 20 grants. The ask-size gate now cites `server-kindora-giving-stats`, and every retained counterevidence statement has a validated evidence ID. |

## Ten malicious or abusive tests

| ID | Harmless attack simulation | Expected defense | Initial result | Final result and evidence |
|---|---|---|---|---|
| MA-01 | Submitted “ignore the system prompt” and demanded `PURSUE` | Stop before an AI call and return human review | Pass | Pass. Plain instruction injection returns `injection_detected` with no research URLs. |
| MA-02 | Base64-encoded a model-control instruction | Detect encoded control text and stop | Pass | Pass. Encoded injection reaches the same terminal human-check path. |
| MA-03 | Placed active HTML and an event handler in a foundation field | No element execution, script dialog, or unsafe rendering | Pass | Pass in safeguard and sink tests. Dynamic result values are escaped, dangerous schemes are refused, and the page now has a restrictive content policy. The in-app browser blocked its own cross-origin request before a rendered production result could be observed. |
| MA-04 | Submitted localhost, cloud metadata, `file:`, `javascript:`, and credentialed URLs | Reject before external research | Pass | Pass locally and in production. The metadata-service URL returned HTTP 400 with no fetch. |
| MA-05 | Called `/pursuit` from an untrusted browser origin | Return 403 without running research | Pass | Pass locally and in production. The allowed Wayan.com preflight returns 204 with exact-origin CORS headers. |
| MA-06 | Crafted a source URL intended to break out of a downloaded Markdown link | Export a safe HTTP(S) destination without creating a second link | **Fail by inspection** | Pass after repair. Every exported evidence and Kindora link now passes through scheme validation and Markdown-destination encoding. |
| MA-07 | Supplied a malformed nonprofit EIN, extreme currency values, or omitted one staff-time category | Reject the input rather than contaminate research or understate cost | **Fail** | Pass after repair. The browser and server now enforce EIN format, $1 trillion money bounds, hour/cost bounds, and all three staff-time categories. |
| MA-08 | Sent malformed JSON and an oversized request body | Return bounded 400/413 JSON without parser internals or reflection | **Fail by inspection** | Pass after repair. Production malformed JSON returned `400` with `The submitted request was not valid JSON.`; oversized requests have a specific 413 response. |
| MA-09 | Exhausted one synthetic client's request bucket, then tried another client | First client receives 429 and `Retry-After`; another client remains usable | **Fail by design review** | Pass after repair in middleware tests. Express now trusts one Render proxy hop so the bucket uses the originating client rather than the shared proxy address. Distributed multi-instance enforcement remains untested. |
| MA-10 | Looked for cacheable private responses, framework disclosure, or an exposed provider key | API responses say no-store; no Express banner or browser-visible key | **Fail** | Pass after repair. Production returns `Cache-Control: no-store`, `Pragma: no-cache`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer`; `X-Powered-By` is absent. The frontend contains only the public API origin. |

## Failures, causes, and repairs

| Finding | Cause | Repair | Regression coverage |
|---|---|---|---|
| F-01 Warm-path bypass | `relationship_status` alone counted as a confirmed path | Require a route note in the browser and API; require it again in the deterministic decision layer | Relationship validation plus invitation-only decision tests |
| F-02 Similar-name identity collision | Name matching accepted substrings and 60% token overlap, allowing a shared one-word name to confirm the wrong EIN | Require exact normalized names or at least two tokens with 80% overlap; explicitly return an ambiguous identity when the filing name conflicts | Ford versus Ford Family regression |
| F-03 Zero-dollar cost lost | Cost calculation accepted only positive hourly costs | Treat an explicitly supplied zero as a valid nonnegative cost | Zero-hourly-cost regression |
| F-04 Incomplete or extreme numeric inputs | Optional hour fields could understate total risk; the API had no meaningful upper bounds | Require all three time categories and apply browser/server bounds to money, hours, and hourly cost | Request-boundary regressions |
| F-05 Unsafe Markdown destinations | UI links were scheme-checked, but exported evidence URLs were inserted directly into Markdown | Apply HTTP(S) validation and destination encoding to every exported link | Frontend export safety test |
| F-06 Unsupported or mislabeled result evidence | The model referenced Kindora's median grant while attaching an unrelated foundation page; counterevidence could remain after all of its sources were rejected | Add an explicit provider-derived Kindora statistics evidence record whenever those statistics inform ask-size; remove counterevidence with no validated citation | Two new decision-provenance regressions and production Kresge retest |
| F-07 Weak HTTP privacy and error boundaries | API relied on default Express headers and generic body-parser errors | Disable framework disclosure, add no-store/nosniff/referrer headers, and map malformed/oversized bodies to bounded JSON errors | Direct middleware tests plus production header checks |
| F-08 Shared-proxy rate-limit risk | Express had no trusted-proxy setting, so a proxy address could become the rate-limit key | Trust the single front proxy hop and verify separate client buckets | Rate-limit isolation regression |

## Verification totals

- Frontend: 10 of 10 automated checks passed.
- Backend: 67 of 67 automated checks passed after the evidence repair.
- GitHub Actions: boundary and provenance commits passed.
- Static deployment: deployed `index.html`, `about.html`, and `app.js` matched local files byte for byte.
- Browser: desktop and phone-width layouts showed no horizontal overflow; repaired relationship validation focused the correct field with no console warning.
- Production boundaries: untrusted origin 403; malformed JSON 400; metadata URL 400; unsupported warm-path claim 400; allowed-origin preflight 204; security headers present.
- Final production Kresge retest: HTTP 200; `PARK`; 46 hours; $3,450; confirmed identity; ask-size gate linked to the provider-derived statistics record; zero uncited counterevidence statements.

## Known limitations

- The public rate limiter is process-local. The test proved per-client isolation inside one service instance, not coordinated enforcement across multiple Render instances.
- The in-app test browser blocked its own cross-origin fetch even though the production CORS preflight and direct production requests passed. The signed-in Firefox window was unavailable because the Mac was locked.
- No sustained-load, destructive, credential attack, dependency exploit, DNS-rebinding, or third-party account test was performed.
- Kindora and foundation-source accuracy were sampled, not independently audited. Twenty displayed Kindora grants in the Kresge run lacked underlying filing URLs and therefore remain visibly provider-derived.
- The PRD's 60-pair fundraiser evaluation remains a separate release-quality requirement.
