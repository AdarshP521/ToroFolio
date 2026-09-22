import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), 'torofolio.db')

def view_table(table_name):
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get column names
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = [col[1] for col in cursor.fetchall()]
        
        if not columns:
            print(f"Table '{table_name}' does not exist or has no columns.")
            conn.close()
            return
            
        cursor.execute(f"SELECT * FROM {table_name};")
        rows = cursor.fetchall()
        
        print(f"\n=== Table: {table_name} ({len(rows)} records) ===")
        # Print header
        header_str = " | ".join(columns)
        print(header_str)
        print("-" * len(header_str))
        
        for row in rows:
            print(" | ".join(str(row[col]) for col in columns))
            
        conn.close()
    except Exception as e:
        print(f"Error reading database: {e}")

def main():
    if not os.path.exists(DB_PATH):
        print(f"Database file not found at: {DB_PATH}")
        return
        
    print(f"Found SQLite Database at: {DB_PATH}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()
    
    if not tables:
        print("No tables found in the database.")
        return
        
    print("\nAvailable Tables:")
    for i, table in enumerate(tables, 1):
        print(f"  [{i}] {table}")
        
    print("\nTo view a table, run this script with the table name, e.g.:")
    print(f"  python view_db.py users")
    print(f"  python view_db.py orders")
    print(f"  python view_db.py holdings")
    print("-" * 50)
    
    # If a table name is passed as argument, show it
    if len(sys.argv) > 1:
        target_table = sys.argv[1]
        view_table(target_table)
    else:
        # Default to showing users if no argument provided
        view_table('users')

if __name__ == '__main__':
    main()
