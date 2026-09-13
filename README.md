# Prep Tracker — RRB JE + CUET (Plain HTML/CSS/JS)

No install, no build tools, no npm, no git needed to use it.
Everything is saved in your browser (localStorage).

## Try it right now

Double-click `index.html`. It opens in your browser and works immediately.

## Put it online (GitHub Pages, no commands needed)

1. Create a repository on GitHub (or open your existing one).
2. Click **Add file → Upload files**.
3. Drag in these files: `index.html`, `style.css`, `app.js` (and this `README.md` if you like).
4. Scroll down, click **Commit changes**.
5. Go to **Settings → Pages**. Under "Build and deployment → Source", choose
   **Deploy from a branch**, then pick branch `main` and folder `/ (root)`. Save.
6. Wait a minute — your site will be live at:
   `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

## Mobile

The navigation moves to a top tab bar on phones, and every list (Daily Log,
Mock Tests, Syllabus) stacks its date / details / buttons vertically so
nothing overlaps on small screens.

## Backing up your data

Everything lives only in your browser. In the **Settings** tab:

- **Export full backup (JSON)** — keep this file safe.
- **Import backup** — restores from a previously exported file (replaces current data).
- **Export sessions (CSV)** — spreadsheet-friendly export of just your study log.

## Files

- `index.html` — page structure
- `style.css` — all styling (dark navy/black theme, mobile layout rules)
- `app.js` — all logic (storage, all 8 sections)
