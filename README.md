# Character Reference Builder

A small client-side tool for drafting a character reference letter for a
UK Crown Court defendant: fill in a form, watch a live preview of the
letter, sign it on screen, and download a formatted PDF. No backend —
everything runs in the browser.

## Files

```
index.html   structure/markup, all the form fields
styles.css   colours, fonts, layout (see comments at the top)
app.js       form state, live preview, signature capture, PDF export
```

## Running it locally

Just open `index.html` in a browser — there's no build step. If your
browser blocks local file access for the fonts/PDF library, serve it
with any static server, e.g.:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploying to GitHub Pages

1. Create a new GitHub repository and push these three files (plus this
   README) to it, e.g.:
   ```bash
   git init
   git add .
   git commit -m "Character reference builder"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a
   branch", branch `main`, folder `/ (root)`.
4. Save. GitHub will give you a URL like
   `https://<you>.github.io/<repo>/` within a minute or two.

No configuration files are needed — `index.html` at the repo root is all
GitHub Pages requires.

## Customising

**Add a field** (e.g. "how long you've known the defendant"):
1. In `index.html`, copy an existing `.field` block and give the input a
   new `id`.
2. In `app.js`, add the key to the `state` object at the top and to the
   `simpleFields` array so it's wired up automatically.
3. Add a line for it in `renderPreview()` so it shows in the live
   preview, and in `buildPdfBlob()` so it appears in the PDF.
4. If it should be required before the PDF can be downloaded, add its
   key to `requiredFields` and a short label to `fieldLabels`.

**Change the letter's wording, order, or template structure:**
Edit `renderPreview()` and `buildPdfBlob()` in `app.js` — they're built
to mirror each other line by line, so change both together or the
on-screen preview will stop matching the downloaded PDF.

**Change fonts:**
- UI font (labels, buttons): the `--font` used in `body` in
  `styles.css`, currently Inter.
- Letter/document font: `.paper-wrap` in `styles.css`, currently Source
  Serif 4. To change the actual PDF font too, see the comment above
  `doc.setFont(...)` in `buildPdfBlob()` — jsPDF only has
  Helvetica/Times/Courier built in, so an exact match in the PDF needs a
  font embedded as base64 (jsPDF's "Add Custom Fonts" docs cover this).
- Signature font: search for `Dancing Script` in both files.
- Whichever fonts you use, update the Google Fonts `<link>` tag in
  `index.html` to match.

**Change colours/layout:**
The palette is defined as CSS variables at the top of `styles.css`
(`--bg`, `--ink`, `--accent`, etc.), including a dark-mode variant.
Layout (the two-column grid, spacing, card styling) is further down the
same file.

## Notes

- Nothing is saved or sent anywhere — all data lives in memory in the
  visitor's browser tab until they download the PDF.
- This produces a solid first draft of a standard-format letter; it
  isn't legal advice, and it's worth having a solicitor glance over the
  final letter before it's submitted to the court.
