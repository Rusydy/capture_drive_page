# Capture Google Drive PDF (view-only) pages

Save selected pages from the linked Google Drive PDF (view-only) as JPG screenshots and one combined PDF. Results go in `output/` in this project.

Requires Node.js 22.14+ and Google Chrome on macOS. Set `DRIVE_URL` in `.env` to the Google Drive PDF viewer link. Copy `.env.example` to `.env` if starting from a fresh clone. Use only if you have permission to reproduce the document.

```bash
npm ci
npm run capture -- --page 1       # one page (also the default)
npm run capture -- --to 25        # pages 1 through 25
npm run capture -- --range 9 10   # an inclusive range
npm run capture -- --all          # every page
```

PDFs are named `page-N.pdf` or `pages-START-END.pdf`. Individual screenshots are `page-N.jpg`. Running a capture again replaces files with the same names.

The script uses the installed Google Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

```bash
npm run ci
```
