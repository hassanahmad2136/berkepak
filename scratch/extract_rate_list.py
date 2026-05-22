import pypdf
import os

pdf_path = "/Users/abdullah/code/BerkePak/docs/RATE LIST - 1-1-2026.pdf"

if not os.path.exists(pdf_path):
    print("PDF not found at:", pdf_path)
    exit(1)

reader = pypdf.PdfReader(pdf_path)
print("Total Pages:", len(reader.pages))

for i, page in enumerate(reader.pages):
    print(f"\n--- PAGE {i+1} ---")
    text = page.extract_text()
    print(text)
