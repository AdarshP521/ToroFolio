import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), 'torofolio.db')

def delete_user(email_or_phone):
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        # Enable foreign key support so CASCADE deletes work on holdings, orders, etc.
        conn.execute("PRAGMA foreign_keys = ON;")
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM users WHERE email = ? OR phone = ?;", (email_or_phone, email_or_phone))
        conn.commit()
        
        if cursor.rowcount > 0:
            print(f"Success: User matching '{email_or_phone}' and all their holdings, orders, and watchlists have been deleted.")
        else:
            print(f"No user found matching email or phone '{email_or_phone}'.")
            
        conn.close()
    except Exception as e:
        print(f"Error deleting user: {e}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python delete_user.py <user_email_or_phone>")
        print("Example (Email): python delete_user.py guest@torofolio.com")
        print("Example (Phone): python delete_user.py 8476987403")
    else:
        email_or_phone = sys.argv[1]
        delete_user(email_or_phone)
