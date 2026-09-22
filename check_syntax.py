"""Comprehensive bracket matcher and CSS overlay checker for debugging."""

import re

print("=" * 60)
print("PHASE 1: JavaScript Bracket Matching (app.js)")
print("=" * 60)

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.split('\n')

stack = []
errors = []
in_single_quote = False
in_double_quote = False
in_template = False
in_block_comment = False
escape_next = False

for line_idx, line in enumerate(lines):
    for char_idx, ch in enumerate(line):
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and (in_single_quote or in_double_quote or in_template):
            escape_next = True
            continue

        # Line comment
        if not in_single_quote and not in_double_quote and not in_template and not in_block_comment:
            if ch == '/' and char_idx + 1 < len(line) and line[char_idx + 1] == '/':
                break

        # Block comment
        if not in_single_quote and not in_double_quote and not in_template:
            if not in_block_comment and ch == '/' and char_idx + 1 < len(line) and line[char_idx + 1] == '*':
                in_block_comment = True
                continue
            if in_block_comment:
                if ch == '*' and char_idx + 1 < len(line) and line[char_idx + 1] == '/':
                    in_block_comment = False
                continue

        if in_block_comment:
            continue

        # Strings
        if ch == "'" and not in_double_quote and not in_template:
            in_single_quote = not in_single_quote
            continue
        if ch == '"' and not in_single_quote and not in_template:
            in_double_quote = not in_double_quote
            continue
        if ch == '`' and not in_single_quote and not in_double_quote:
            in_template = not in_template
            continue

        if in_single_quote or in_double_quote or in_template:
            continue

        # Bracket matching
        if ch in '({[':
            stack.append((ch, line_idx + 1))
        elif ch in ')}]':
            expected = {'(': ')', '{': '}', '[': ']'}
            if not stack:
                errors.append(f'Line {line_idx + 1}: Unexpected closing "{ch}" with no matching opener')
            else:
                opener, opener_line = stack.pop()
                if expected[opener] != ch:
                    errors.append(f'Line {line_idx + 1}: Mismatched "{ch}" (expected "{expected[opener]}" for "{opener}" from line {opener_line})')

if stack:
    for opener, opener_line in stack:
        errors.append(f'Line {opener_line}: Unclosed "{opener}"')

if errors:
    print("SYNTAX ERRORS FOUND:")
    for e in errors:
        print(f"  !! {e}")
else:
    print("OK: No bracket errors found.")
print(f"Total lines: {len(lines)}")

print()
print("=" * 60)
print("PHASE 2: CSS Overlay / Pointer-Events Check (styles.css)")
print("=" * 60)

with open('styles.css', 'r', encoding='utf-8') as f:
    css_lines = f.readlines()

for i, line in enumerate(css_lines):
    stripped = line.strip()
    if 'pointer-events' in stripped:
        print(f"  Line {i+1}: {stripped}")
    if 'z-index' in stripped and ('100' in stripped or '99' in stripped):
        print(f"  Line {i+1}: {stripped}")

print()
print("=" * 60)
print("PHASE 3: HTML Overlay Check (index.html)")
print("=" * 60)

with open('index.html', 'r', encoding='utf-8') as f:
    html_lines = f.readlines()

for i, line in enumerate(html_lines):
    stripped = line.strip()
    if 'modal-overlay' in stripped or 'position: fixed' in stripped:
        print(f"  Line {i+1}: {stripped}")
    if 'z-index' in stripped:
        print(f"  Line {i+1}: {stripped}")

# Check if auth-screen is properly hidden
for i, line in enumerate(html_lines):
    if 'id="auth-screen"' in line:
        print(f"\n  Auth screen tag (line {i+1}): {line.strip()}")
    if 'id="app-shell"' in line:
        print(f"  App shell tag (line {i+1}): {line.strip()}")

print()
print("=" * 60)
print("PHASE 4: Searching for potential crash points in app.js")
print("=" * 60)

# Check for bare firebase references outside of if-guards
with open('app.js', 'r', encoding='utf-8') as f:
    js_lines = f.readlines()

for i, line in enumerate(js_lines):
    stripped = line.strip()
    # Skip comments
    if stripped.startswith('//') or stripped.startswith('/*'):
        continue
    # Look for firebase usage without guard
    if 'firebase.' in stripped and 'isFirebaseConnected' not in stripped:
        # Check if it's inside an if(isFirebaseConnected) block
        # Simple heuristic: check nearby lines
        context_start = max(0, i - 5)
        context = ''.join(js_lines[context_start:i])
        if 'isFirebaseConnected' not in context and 'configStr' not in context:
            print(f"  Line {i+1}: UNGUARDED firebase access: {stripped[:80]}")

print()
print("DONE - Diagnostic complete.")
