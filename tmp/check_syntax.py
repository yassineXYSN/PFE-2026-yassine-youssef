import ast
import sys
try:
    with open('backend/models/quiz.py', 'r') as f:
        ast.parse(f.read())
    print("OK")
except SyntaxError as e:
    print(f"Syntax error at line {e.lineno}: {e.msg}")
    sys.exit(1)