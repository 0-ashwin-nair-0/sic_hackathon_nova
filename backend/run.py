#!/usr/bin/env python3
"""Run Flask server with auto-reload"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app

if __name__ == '__main__':
    print("Starting Flask server with auto-reload...")
    print("Press Ctrl+C to stop")
    app.run(host='127.0.0.1', port=5000, debug=True, use_reloader=False)
