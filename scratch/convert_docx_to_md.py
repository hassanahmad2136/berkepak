import re
import sys
from html.parser import HTMLParser

class DocxHtmlToMarkdown(HTMLParser):
    def __init__(self):
        super().__init__()
        self.md = []
        self.in_bold = False
        self.in_list = False
        self.in_table = False
        self.current_row = []
        self.current_text = ""
        self.list_depth = 0
        self.table_data = []
        self.in_code = False
        self.code_lines = []
        self.in_table_cell = False
        self.current_cell_paragraphs = 0
        self.in_courier = False
        self.in_style = False
        self.in_head = False
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        style = attrs_dict.get('style', '')
        cls = attrs_dict.get('class', '')
        
        if tag == 'style':
            self.in_style = True
        elif tag == 'head':
            self.in_head = True
        elif tag == 'b' or tag == 'strong':
            self.in_bold = True
            self.current_text += "**"
        elif tag == 'ul':
            self.in_list = True
            self.list_depth += 1
        elif tag == 'li':
            if self.in_table_cell:
                self.current_text += "<br> - "
            else:
                self.current_text += "\n" + "  " * (self.list_depth - 1) + "- "
        elif tag == 'table':
            self.in_table = True
            self.table_data = []
        elif tag == 'tr':
            self.current_row = []
        elif tag == 'td':
            self.current_text = ""
            self.in_table_cell = True
            self.current_cell_paragraphs = 0
        elif tag == 'p':
            is_courier_styled = 'Courier' in style or cls in ['p31', 'p36', 'p37']
            
            # Detect if inline or class style indicates Courier or code styling
            if is_courier_styled and not self.in_table:
                if not self.in_code:
                    self.in_code = True
                    self.code_lines = []
            else:
                if self.in_code:
                    self.in_code = False
                    if self.code_lines:
                        lang = "javascript"
                        code_str = "\n".join(self.code_lines)
                        if any(kw in code_str for kw in ["CREATE TABLE", "ALTER TABLE", "CREATE POLICY"]):
                            lang = "sql"
                        self.md.append(f"\n```{lang}\n{code_str}\n```\n")
                    self.code_lines = []
            
            # If in table cell and is Courier styled, wrap text in backticks
            if self.in_table_cell:
                if is_courier_styled:
                    self.in_courier = True
                    self.current_text += "`"
                else:
                    self.in_courier = False
                
                # Add separator between paragraphs
                if self.current_text and self.current_text.strip() not in ["`", ""]:
                    prev_text = self.current_text.strip()
                    # If previous paragraph was a short bold text (like "Task", "Classify")
                    if prev_text.startswith("**") and prev_text.endswith("**") and len(prev_text) < 40 and not prev_text.endswith(" |**"):
                        self.current_text = self.current_text.strip() + " | "
                    else:
                        self.current_text += " <br> "
            
            self.current_cell_paragraphs += 1

    def handle_endtag(self, tag):
        if tag == 'style':
            self.in_style = False
        elif tag == 'head':
            self.in_head = False
        elif tag == 'b' or tag == 'strong':
            self.in_bold = False
            self.current_text += "**"
        elif tag == 'ul':
            self.list_depth -= 1
            if self.list_depth == 0:
                self.in_list = False
        elif tag == 'li':
            pass
        elif tag == 'td':
            self.in_table_cell = False
            self.current_row.append(self.current_text.strip())
            self.current_text = ""
        elif tag == 'tr':
            self.table_data.append(self.current_row)
        elif tag == 'table':
            self.in_table = False
            if self.table_data:
                # Check if it is a single cell table and looks like a code block or warning callout
                if len(self.table_data) == 1 and len(self.table_data[0]) == 1:
                    cell_content = self.table_data[0][0].strip()
                    is_code = False
                    code_keywords = ["//", "const ", "await ", "function", "import ", "ALTER TABLE", "CREATE POLICY", "CREATE TRIGGER", "SELECT ", "gql`", "query {"]
                    if any(kw in cell_content for kw in code_keywords) or cell_content.count('\n') > 3:
                        if not any(header in cell_content for header in ["Strategic Rationale", "Critical Pre-Condition", "Order of Operations"]):
                            is_code = True
                    
                    if is_code:
                        lang = "javascript"
                        if any(kw in cell_content for kw in ["ALTER TABLE", "CREATE POLICY", "CREATE TRIGGER", "--"]):
                            lang = "sql"
                        
                        # Clean backticks wrapped around each line, preserving internal backticks
                        lines = cell_content.split('\n')
                        cleaned_lines = []
                        for l in lines:
                            l_strip = l.strip()
                            # Clean leading/trailing backticks and bold marks
                            if l_strip.startswith("`") and l_strip.endswith("`"):
                                l_strip = l_strip[1:-1]
                            l_strip = l_strip.replace("**", "")
                            cleaned_lines.append(l_strip)
                        cell_content_clean = "\n".join(cleaned_lines)
                        self.md.append(f"\n```{lang}\n{cell_content_clean}\n```\n")
                    else:
                        # Callout box
                        if "⚠" in cell_content or "Critical" in cell_content or "Mandatory" in cell_content:
                            self.md.append(f"\n> [!WARNING]\n> " + cell_content.replace("\n", "\n> ") + "\n")
                        elif "Strategic Rationale" in cell_content:
                            self.md.append(f"\n> [!NOTE]\n> " + cell_content.replace("\n", "\n> ") + "\n")
                        else:
                            self.md.append(f"\n> " + cell_content.replace("\n", "\n> ") + "\n")
                else:
                    table_md = []
                    
                    # Split cells on " | " if present
                    normalized_table = []
                    for row in self.table_data:
                        norm_row = []
                        for cell in row:
                            if " | " in cell:
                                norm_row.extend(cell.split(" | "))
                            else:
                                norm_row.append(cell)
                        normalized_table.append(norm_row)
                    
                    max_cols = max(len(row) for row in normalized_table)
                    
                    # Create header
                    headers = normalized_table[0]
                    if len(headers) < max_cols:
                        headers += [""] * (max_cols - len(headers))
                    
                    # Clean column names in headers (e.g. remove <br> and wrap in bold)
                    headers_clean = []
                    for h in headers:
                        h_clean = h.replace("<br>", "").strip()
                        if h_clean and not (h_clean.startswith("**") and h_clean.endswith("**")):
                            h_clean = f"**{h_clean}**"
                        headers_clean.append(h_clean)
                    
                    table_md.append("| " + " | ".join(headers_clean) + " |")
                    table_md.append("| " + " | ".join(["---"] * len(headers_clean)) + " |")
                    
                    for row in normalized_table[1:]:
                        if len(row) < max_cols:
                            row += [""] * (max_cols - len(row))
                        # Clean cells
                        row_cleaned = []
                        for cell in row[:max_cols]:
                            # Clean up leaked tags
                            c_clean = cell.replace('\n', ' ').strip()
                            # Clean up leading `<br>`
                            if c_clean.startswith("<br>"):
                                c_clean = c_clean[4:].strip()
                            row_cleaned.append(c_clean)
                        table_md.append("| " + " | ".join(row_cleaned) + " |")
                    
                    self.md.append("\n" + "\n".join(table_md) + "\n")
        elif tag == 'p':
            if self.in_courier and self.in_table_cell:
                self.current_text += "`"
                self.in_courier = False
                
            if self.in_code:
                self.code_lines.append(self.current_text.strip())
            else:
                if not self.in_table_cell:
                    text = self.current_text.strip()
                    if text:
                        text = text.replace("****", "")
                        # Headings
                        if re.match(r'^\d{2}\s+[A-Z\s\-\:\→]+$', text):
                            self.md.append(f"\n# {text}\n")
                        elif re.match(r'^\d\.\d\s+.*', text):
                            self.md.append(f"\n## {text}\n")
                        elif re.match(r'^\d+\.\s+.*', text):
                            self.md.append(f"\n## {text}\n")
                        else:
                            if text.startswith("**") and text.endswith("**") and len(text) < 100:
                                self.md.append(f"\n### {text.replace('**', '')}\n")
                            else:
                                self.md.append(text)
            
            # Reset current text if not in table cell
            if not self.in_table_cell:
                self.current_text = ""

    def handle_data(self, data):
        if self.in_style or self.in_head:
            return
        data = data.replace('\xa0', ' ')
        self.current_text += data

def clean_markdown(md_text):
    md_text = re.sub(r'\n{3,}', '\n\n', md_text)
    md_text = re.sub(r'\*\*([^*]+)\*\*\s+\*\*([^*]+)\*\*', r'**\1 \2**', md_text)
    md_text = re.sub(r'```javascript\s*```', '', md_text)
    md_text = re.sub(r'```sql\s*```', '', md_text)
    # Remove empty lines around code block fences
    md_text = re.sub(r'\n{3,}', '\n\n', md_text)
    return md_text.strip()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert.py input.html output.md")
        sys.exit(1)
        
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        html_content = f.read()
        
    parser = DocxHtmlToMarkdown()
    parser.feed(html_content)
    
    if parser.in_code and parser.code_lines:
        lang = "javascript"
        code_str = "\n".join(parser.code_lines)
        if "CREATE TABLE" in code_str or "ALTER TABLE" in code_str or "CREATE POLICY" in code_str:
            lang = "sql"
        code_block = f"\n```{lang}\n" + code_str + "\n```\n"
        parser.md.append(code_block)
        
    markdown_output = "\n\n".join(parser.md)
    markdown_output = clean_markdown(markdown_output)
    
    with open(sys.argv[2], 'w', encoding='utf-8') as f:
        f.write(markdown_output)
    print(f"Successfully converted {sys.argv[1]} to {sys.argv[2]}")
