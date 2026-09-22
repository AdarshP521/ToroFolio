import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), 'torofolio.db')

def execute_query(query):
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(query)
        
        if query.strip().upper().startswith("SELECT"):
            rows = cursor.fetchall()
            if not rows:
                print("No rows returned.")
                conn.close()
                return
                
            columns = rows[0].keys()
            header_str = " | ".join(columns)
            print(header_str)
            print("-" * len(header_str))
            
            for row in rows:
                print(" | ".join(str(row[col]) for col in columns))
        else:
            conn.commit()
            print(f"Query executed successfully. Rows affected: {cursor.rowcount}")
            
        conn.close()
    except Exception as e:
        print(f"Error executing query: {e}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python run_sql.py \"YOUR SQL QUERY\"")
        print("Example: python run_sql.py \"SELECT email, name, wallet_balance FROM users\"")
    else:
        query = " ".join(sys.argv[1:])
        execute_query(query)
