# Logs To Fix

Running list of issues / follow-ups discovered during testing. Prioritised by severity tag.

## Read Mode

- **(critical) Paper / page look while reading still needs a pass.** The current paper surface in the reader (`.book-page`) isn't where we want it aesthetically — typography balance, drop cap proportion, margin rhythm, and contrast with the surrounding stage all need refinement. Defer a dedicated styling pass.
  - Change the **layout toggle icon** (upper-right of the paper — `.book-page__layout-toggle`, switches between paginated and continuous). The current glyphs don't read clearly as "page view" vs "infinite scroll" — design and swap the two icons during the paper-look pass.

- **(deferred feature) Customisable "next document" target at end-of-book.** When the reader reaches the last page of the last document, allow the user to configure which document to continue to next (including docs outside the current book / folder). Requires: a persistent mapping (per-doc next-target), UI to pick the target, and honouring the mapping in the cross-doc popup flow. Large — plan separately.
