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

Real-device validation on iPhone Safari established the practical Ver.1 camera baseline:

- ordinary flat, undamaged JAN barcodes read in approximately **1 second**;
- `4954540122035`, a valid JAN-13 on a partially indented/curved hand-cream tube, still does not read reliably after orientation support was added; the physical barcode area is deformed and may also be scratched, so this is documented as a difficult/unsupported physical condition rather than a normal flat-barcode regression;
- `(01)04987138801791` is a GS1 barcode carrying a GTIN-14 rather than a JAN-8/JAN-13 symbol and remains outside Ver.1 scope.

The Safari fallback searches both image axes. Existing horizontal scanning remains first, with vertical analysis used when needed, so normal scans retain the fast path.

Core persistence was previously hardened for practical Ver.1 use. Registration, confirmed/unconfirmed changes, and deletion avoid showing a successful state when `localStorage` fails. JAN registration also preserves previous product data if the associated JAN-name catalog cannot be saved.

The baseline suite passed **51/51 tests** with `node --test tests/app.test.js` before the orientation change, and focused orientation coverage was added for normal and 90-degree-rotated JAN layouts. The orientation build has since been merged to `main` and published through the existing GitHub Pages deployment.

## Known limitations

- Strong curvature, dents, scratches, folds, glare, blur, or otherwise physically distorted barcodes may not scan reliably. Manual JAN entry is the fallback for these cases.
- GS1/GTIN-14 formats such as `(01)04987138801791` are not supported in Ver.1; Ver.1 targets JAN-8/JAN-13.
- Camera performance still depends on device hardware, focus, lighting, and browser behavior.

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

### Ver.1 readiness

**Practical Ver.1 is considered ready from the camera/usability perspective.** Ordinary flat barcodes read in about one second on the tested iPhone Safari environment, which is acceptable for the intended baseline. The remaining unreadable curved/damaged sample is documented as a physical-condition limitation with manual entry available as fallback.

Before declaring a final tagged/release milestone, run the complete automated regression suite once more against current `main`. No further scanner tuning should be made solely for the deformed hand-cream barcode unless broader real-world evidence shows the same failure on ordinary flat JAN barcodes.

## Agent reporting format

At the end of a work cycle, report only:

- **Completed** — what changed and why it matters;
- **Validation** — tests/checks actually performed;
- **Remaining** — only meaningful known issues or next priority;
- **Need from user** — omit this section unless a genuine decision/device check is required.
