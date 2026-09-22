from pathlib import Path
import fitz

inputs = [
    Path("attached_assets/Conditions_Generales_Jatek_FR.docx_1790089883513.PDF"),
    Path("attached_assets/Politique_de_Confidentialite_Jatek_FR.docx_1790089883541.PDF"),
]
output_dir = Path(".agents/outputs/legal-pdf-renders")
output_dir.mkdir(parents=True, exist_ok=True)

for source in inputs:
    document = fitz.open(source)
    target_dir = output_dir / source.stem
    target_dir.mkdir(parents=True, exist_ok=True)
    print(f"{source.name}: {document.page_count} pages")
    for page_number, page in enumerate(document, start=1):
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        output = target_dir / f"page-{page_number}.png"
        pixmap.save(output)
        print(output)