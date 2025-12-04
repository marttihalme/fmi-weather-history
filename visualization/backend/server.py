#!/usr/bin/env python3
"""
Simple HTTP server for Finnish Weather Visualization System
Serves static files and provides progress tracking for data fetcher
"""

import http.server
import socketserver
import json
import os
from pathlib import Path

# Configuration
PORT = 8000
BASE_DIR = Path(__file__).parent.parent

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """
    Custom handler that serves files from the visualization directory
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

        # Cache control for JSON data files
        if self.path.endswith('.json'):
            self.send_header('Cache-Control', 'no-cache, must-revalidate')

        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def log_message(self, format, *args):
        # Custom logging format
        print(f"[{self.log_date_time_string()}] {format % args}")


def main():
    """Start the HTTP server"""

    print("=" * 60)
    print("Finnish Weather Visualization - HTTP Server")
    print("=" * 60)
    print(f"\nServing from: {BASE_DIR}")
    print(f"Server URL: http://localhost:{PORT}")
    print(f"\nPress Ctrl+C to stop the server\n")

    # Check if essential data files exist
    data_dir = BASE_DIR / "data"
    essential_files = [
        "daily_zone_summary.json",
        "station_locations.json",
        "anomalies.json",
        "winter_starts.json"
    ]

    print("Checking data files:")
    all_present = True
    for filename in essential_files:
        filepath = data_dir / filename
        if filepath.exists():
            size_kb = filepath.stat().st_size / 1024
            print(f"  ✓ {filename} ({size_kb:.1f} KB)")
        else:
            print(f"  ✗ {filename} (MISSING)")
            all_present = False

    # Check for optional precomputed grids
    grids_file = data_dir / "precomputed_grids.json"
    if grids_file.exists():
        size_mb = grids_file.stat().st_size / (1024 * 1024)
        print(f"  ✓ precomputed_grids.json ({size_mb:.1f} MB) [OPTIONAL]")
    else:
        print(f"  ○ precomputed_grids.json (not available - will use real-time interpolation)")

    if not all_present:
        print("\n⚠️  WARNING: Some essential data files are missing!")
        print("   Run preprocessing scripts first:")
        print("   1. python preprocessing/prepare_data.py")
        print("   2. python preprocessing/generate_grids.py")
        print()

    print("\n" + "=" * 60)
    print("Server starting...")
    print("=" * 60)

    # Create and start server
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        try:
            print(f"\n✓ Server running at http://localhost:{PORT}")
            print(f"✓ Open in browser: http://localhost:{PORT}/index.html")
            print(f"\nServer logs:")
            print("-" * 60)
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n" + "=" * 60)
            print("Server stopped by user")
            print("=" * 60)
            httpd.shutdown()


if __name__ == "__main__":
    main()
