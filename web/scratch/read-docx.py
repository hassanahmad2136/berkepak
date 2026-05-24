import zipfile
import xml.etree.ElementTree as ET
import os

docx_path = "/Users/abdullah/code/BerkePak/docs/PRD_ Berke Pak Fabrics Web App V2.docx"
output_path = "/Users/abdullah/code/BerkePak/web/scratch/PRD_text.txt"

def extract_text_from_docx(docx_file):
    try:
        # A docx file is a zip archive
        with zipfile.ZipFile(docx_file) as docx:
            # The main content is in word/document.xml
            xml_content = docx.read('word/document.xml')
            
        root = ET.fromstring(xml_content)
        
        # Define namespaces
        namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        
        text_lines = []
        # Find all paragraph elements
        for paragraph in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            para_text = ""
            # Find all text elements in the paragraph
            for text_el in paragraph.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
                if text_el.text:
                    para_text += text_el.text
            
            if para_text.strip():
                text_lines.append(para_text)
                
        return "\n\n".join(text_lines)
    except Exception as e:
        return f"Error extracting text: {e}"

if __name__ == "__main__":
    if not os.path.exists(docx_path):
        print(f"Error: File not found at {docx_path}")
    else:
        text = extract_text_from_docx(docx_path)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Successfully extracted document text to {output_path}!")
        print("First 1000 characters of the PRD:\n")
        print(text[:1000])
