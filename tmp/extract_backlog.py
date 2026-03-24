import subprocess
import sys

try:
    import pandas as pd
except ImportError:
    print("Installing pandas and openpyxl...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pandas", "openpyxl"])
    import pandas as pd

excel_path = r"c:\Users\yassine\Documents\GitHub\PFE-2026-yassine-youssef\tmp\Backlog_HumatiQ.xlsx"
csv_path = r"c:\Users\yassine\Documents\GitHub\PFE-2026-yassine-youssef\tmp\parsed_backlog.csv"

try:
    df = pd.read_excel(excel_path)
    df.to_csv(csv_path, index=False)
    print(f"Successfully extracted {len(df)} rows to {csv_path}")
except Exception as e:
    print(f"Error reading Excel: {e}")
