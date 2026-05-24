import re
import sys

def cleanup_markdown(content):
    # 1. Remove empty tables like:
    # |  |
    # | --- |
    content = re.sub(r'\|\s*\|\s*\n\|\s*---\s*\|', '', content)
    
    # 2. Fix empty blockquotes or blockquotes with just whitespace
    content = re.sub(r'>\s*\n', '', content)
    
    # 3. Clean up code blocks
    lines = content.split('\n')
    cleaned_lines = []
    in_code_block = False
    code_block_lines = []
    code_lang = ""
    
    for line in lines:
        if line.strip().startswith('```'):
            if not in_code_block:
                in_code_block = True
                code_lang = line.strip()
                code_block_lines = []
            else:
                in_code_block = False
                # We have collected all code block lines. Let's clean them.
                # Remove leading/trailing empty lines
                while code_block_lines and not code_block_lines[0].strip():
                    code_block_lines.pop(0)
                while code_block_lines and not code_block_lines[-1].strip():
                    code_block_lines.pop()
                
                # Check if there is a common indentation
                non_empty_lines = [l for l in code_block_lines if l.strip()]
                common_indent = 999
                for l in non_empty_lines:
                    indent = len(l) - len(l.lstrip())
                    if indent < common_indent:
                        common_indent = indent
                
                if common_indent != 999 and common_indent > 0:
                    cleaned_code = []
                    for l in code_block_lines:
                        if l.strip():
                            cleaned_code.append(l[common_indent:])
                        else:
                            cleaned_code.append("")
                    code_block_lines = cleaned_code
                
                # Remove consecutive empty lines within code block
                final_code_lines = []
                last_empty = False
                for l in code_block_lines:
                    if not l.strip():
                        if not last_empty:
                            final_code_lines.append("")
                            last_empty = True
                    else:
                        final_code_lines.append(l)
                        last_empty = False
                
                cleaned_lines.append(code_lang)
                cleaned_lines.extend(final_code_lines)
                cleaned_lines.append('```')
        elif in_code_block:
            line_cleaned = re.sub(r'<br\s*/?>', '\n', line)
            line_cleaned = re.sub(r'<br\s*[^>]*', '\n', line_cleaned)
            line_cleaned = line_cleaned.replace('<br', '')
            for split_line in line_cleaned.split('\n'):
                code_block_lines.append(split_line)
        else:
            cleaned_lines.append(line)
            
    content = '\n'.join(cleaned_lines)
    
    # 4. Collapse three or more consecutive newlines
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    # 5. Fix bullet points having extra indents or spacing
    content = re.sub(r'\n\s*-\s+', '\n- ', content)
    content = re.sub(r'\n\s*\*\s+', '\n- ', content)
    
    # 6. Ensure blockquotes are clean and have appropriate space
    content = re.sub(r'>\s+\[!NOTE\]\s*\n>\s*', r'> [!NOTE]\n> ', content)
    content = re.sub(r'>\s+\[!WARNING\]\s*\n>\s*', r'> [!WARNING]\n> ', content)
    
    # 7. Strip whitespace at ends
    return content.strip() + '\n'

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python cleanup.py file.md")
        sys.exit(1)
        
    filepath = sys.argv[1]
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    cleaned = cleanup_markdown(content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(cleaned)
        
    print(f"Cleaned up {filepath}")
