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
- automated tests in `tests/app.test.js`.

## Most recent development work

The latest merged work improved iPhone barcode scanning. The README notes multi-position/multi-angle analysis, frame confirmation to reduce false positives, and device-side processing without external image upload.

## Known uncertainty / human validation needed

The remaining uncertainty is primarily **real-device barcode scan reliability and speed on iPhone Safari**. Automated tests can cover logic and simulated camera behavior but cannot guarantee real-world focus, reflections, curved packaging, camera hardware, or Safari behavior.

When development work reaches this point, do not repeatedly ask the user for screenshots. First complete all code/test analysis that can be done autonomously, then request one concise device test covering:

1. JAN-13 on multiple products;
2. JAN-8 on multiple products;
3. approximate time-to-read;
4. one or two previously difficult barcodes;
5. confirmation that manual entry still works.

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

## Agent reporting format

At the end of a work cycle, report only:

- **Completed** — what changed and why it matters;
- **Validation** — tests/checks actually performed;
- **Remaining** — only meaningful known issues or next priority;
- **Need from user** — omit this section unless a genuine decision/device check is required.
