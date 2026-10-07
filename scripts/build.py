#!/usr/bin/env python3
"""Stage a static Pages site and generate an optional self-contained dashboard."""
from pathlib import Path
import html
import shutil

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_FILES = ("index.html", "simulation.js", "app.js", "styles.css", "README.md", "EXPLANATION.md", "LICENSE")


def main():
    destination = ROOT / "dist"
    destination.mkdir(exist_ok=True)
    for name in PUBLIC_FILES:
        shutil.copyfile(ROOT / name, destination / name)
    (destination / ".nojekyll").touch()
    source = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    engine = (ROOT / "simulation.js").read_text(encoding="utf-8")
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    source = source.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
    source = source.replace('  <script src="simulation.js" defer></script>\n', '')
    source = source.replace('  <script src="app.js" defer></script>\n', '')
    source = source.replace('href="EXPLANATION.md"', 'href="#full-theory"')
    source = source.replace('href="README.md"', 'href="#repository-guide"')
    source = source.replace('href="./index.html"', 'href="#page-title"')
    docs = '<section style="max-width:1100px;margin:30px auto;padding:20px" aria-label="Complete documentation">'
    for filename, anchor, title in (("EXPLANATION.md", "full-theory", "Full theoretical paper"), ("README.md", "repository-guide", "Repository guide")):
        docs += '<details id="' + anchor + '"><summary>' + title + '</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.8 system-ui">'
        docs += html.escape((ROOT / filename).read_text(encoding="utf-8")) + '</pre></details>'
    docs += '</section>'
    source = source.replace('</body>', docs + '\n<script>\n' + engine + '\n</script>\n<script>\n' + app + '\n</script>\n</body>')
    (destination / "asi-dynamics-lab-standalone.html").write_text(source, encoding="utf-8")
    print("Staged public files and standalone HTML in " + str(destination))


if __name__ == "__main__":
    main()
