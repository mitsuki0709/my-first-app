# Project State — 期限みまもり

## Current objective

Reach a stable, practical **Ver.1** while minimizing repeated user/Codex back-and-forth. The development agent should independently assess the repository, choose the next safe task, implement it, validate it, and continue until a genuine user decision or real-device check is required.

## Current product state

Implemented core capabilities include:

- product registration;
- optional JAN input with JAN-8/JAN-13 validation;
- expiry-date entry and ordering;
- browser-local persistence via `localStorage`;
- remembered product names for previously used JAN codes;
- product editing;
- confirmed/unconfirmed state;
- deletion;
- camera barcode scanning;
- fallback in-app JAN decoding for environments such as iPhone Safari where `BarcodeDetector` may not be available;
- Safari fallback analysis in both horizontal and vertical scan directions so a JAN rotated about 90 degrees can still be decoded;
- storage-safe core changes: registration, confirmed/unconfirmed changes, and deletion update the in-memory/UI state only after browser storage succeeds; JAN registration rolls product storage back if catalog storage fails;
- automated tests in `tests/app.test.js` plus orientation coverage in `tests/scanner-orientation.test.js`.

## Most recent development work

A real-device check on iPhone Safari found two barcodes that did not read:

- `4954540122035` — a valid JAN-13 on a curved tube. The supplied photo shows the barcode about 90 degrees from the scanner's previously preferred orientation, with curvature/reflection also present. This is a supported format and is treated as a genuine reliability failure.
- `(01)04987138801791` — a GS1 barcode carrying a GTIN-14, not a JAN-8/JAN-13 symbol. This remains outside Ver.1 scope and is not treated as a JAN scanner regression.

To address the supported JAN failure without adding dependencies or external services, the Safari fallback now searches both image axes. Existing horizontal scanning remains first, so normal scans keep the previous fast path; vertical analysis is attempted only if the horizontal search does not decode the frame. Scanner guidance was updated to allow either orientation.

A focused local algorithm check confirmed the two-orientation search decodes the existing synthetic JAN-13 in both normal and 90-degree-rotated layouts. Repository coverage for those two cases was added in `tests/scanner-orientation.test.js`.

Core persistence was previously hardened for practical Ver.1 use. Registration, confirmed/unconfirmed changes, and deletion avoid showing a successful state when `localStorage` fails. JAN registration also preserves previous product data if the associated JAN-name catalog cannot be saved.

The prior baseline suite passed **51/51 tests** with `node --test tests/app.test.js` before this orientation change. The new orientation logic was separately exercised with the focused local check above; a full repository regression run should be repeated before merge/release review.

## Known uncertainty / human validation needed

The main remaining Ver.1 uncertainty is **real-device barcode scan reliability and speed on iPhone Safari after the orientation improvement**. Automated tests cannot guarantee focus, reflections, curved packaging, camera hardware, or Safari behavior.

The next device validation should use the updated build and cover:

1. the previously failing JAN-13 `4954540122035`;
2. at least one ordinary JAN-13;
3. at least one JAN-8;
4. approximate time-to-read;
5. confirmation that manual entry still works.

The GS1/GTIN-14 sample `(01)04987138801791` is intentionally not part of the Ver.1 pass/fail gate because GS1 barcode support is not currently a product requirement.

Record the result here after the user reports it.

## Product constraints

- Prefer zero additional recurring cost.
- Avoid external APIs/services unless they solve a demonstrated problem and the user approves them.
- Keep barcode/image processing on-device where practical.
- Preserve simple deployment and maintenance.
- Prioritize usefulness and reliability over feature count or visual polish.

## Prioritization rule

When no explicit user task is supplied, choose the next task by this order:

1. blocker preventing normal use;
2. data loss/corruption risk;
3. failure in a core Ver.1 flow;
4. high-frequency usability problem;
5. missing regression coverage for core behavior;
6. performance/reliability improvement supported by evidence;
7. documentation/cleanup needed for maintainability;
8. cosmetic enhancement.

Do not invent large new features just to stay busy.

## Definition of practical Ver.1

Ver.1 is practical when all of the following are true:

- a user can register a product quickly;
- JAN-8/JAN-13 can be entered manually and, on supported real devices, scanned by camera with acceptable reliability;
- product name and expiry date can be corrected by editing;
- registered data persists after reload in the same browser;
- near-expiry items are easy to identify;
- confirm/delete flows work reliably;
- automated regression tests pass;
- known limitations are documented;
- no paid infrastructure is required for the baseline product.

The current development branch contains the orientation reliability fix and remains unmerged/unpublished. Real-device validation of that updated build plus a full regression run are the remaining release-readiness gates before considering Ver.1 ready for merge/publication review.

## Agent reporting format

At the end of a work cycle, report only:

- **Completed** — what changed and why it matters;
- **Validation** — tests/checks actually performed;
- **Remaining** — only meaningful known issues or next priority;
- **Need from user** — omit this section unless a genuine decision/device check is required.
