import sys
import os

# Menambahkan root directory ke Python path agar folder 'backend' bisa di-import
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.server import app
