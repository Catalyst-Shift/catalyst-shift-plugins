# Export scripts

The HTML templates are designed to be the source of truth. These scripts convert HTML output into PowerPoint or Word when the recipient needs an editable file in those formats.

## PDF (no script needed)

Open the HTML in Chrome, Cmd/Ctrl+P → **Save as PDF**. The templates are print-styled (`@page`, `@media print`) so they paginate cleanly on Letter.

## PPTX — `make_pptx.py`

Converts the deck template (or any HTML with `<section data-slide>` elements) into a PowerPoint deck. Each slide is captured as a 1280×720 PNG and placed full-bleed on a 16:9 slide. **Pixel-perfect, not editable text.**

```bash
pip install python-pptx playwright
playwright install chromium

python make_pptx.py path/to/deck.html path/to/output.pptx
```

If the recipient needs editable text shapes (not screenshots), open the HTML in Chrome, save the slides as individual images, and rebuild manually — or rewrite this script using the `pptx` shape API directly. The screenshot path was chosen for fidelity.

## DOCX — `make_docx.py`

Converts a Markdown file into a Catalyst Shift–styled Word doc. Use it for internal docs, or for proposals/SOWs that the client wants editable in Word.

```bash
pip install python-docx markdown beautifulsoup4

python make_docx.py input.md output.docx --title "Proposal — Acme"
```

The script applies CS color tokens and a clean type hierarchy (display/body/mono) within Word's constraints. It will not match the HTML templates pixel-for-pixel — it's optimized for editability.

## Workflow inside Claude Desktop

If Claude Desktop has code execution enabled, it can run these scripts directly after generating the HTML or Markdown source. Otherwise:

1. Claude generates the HTML/MD file in the working folder.
2. Teammate runs the script on their machine.
3. Final file lands next to the source.
