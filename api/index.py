import sys
import os

# Masukkan root directory ke sys.path agar modul 'backend' dapat di-import
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.server import app
