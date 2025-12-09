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
import subprocess
import sys

# Configuration
PORT = 8000
BASE_DIR = Path(__file__).parent.parent

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """
    Custom handler that serves files from the visualization directory
    Supports SPA routing for tab navigation
    """

    # SPA routes that should serve index.html
    SPA_ROUTES = ['/explore', '/compare-years', '/data-management']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        # Handle SPA routes - serve index.html for these paths
        clean_path = self.path.split('?')[0].rstrip('/')
        if clean_path in self.SPA_ROUTES or clean_path == '':
            self.path = '/index.html'
        return super().do_GET()

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

    def do_POST(self):
        if self.path == '/api/refresh-30':
            try:
                self.refresh_last_30_days()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "message": "Data refreshed"}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())
        elif self.path == '/api/refresh-5years':
            # Use SSE for progress streaming
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.end_headers()

            try:
                self.refresh_last_5_years_streaming()
            except Exception as e:
                self.send_sse_event('error', {'message': str(e)})
        else:
            self.send_error(404, "Not Found")

    def send_sse_event(self, event_type, data):
        """Send a Server-Sent Event"""
        message = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        self.wfile.write(message.encode())
        self.wfile.flush()

    def refresh_last_5_years_streaming(self):
        """Refresh last 5 years with progress streaming via SSE"""
        from datetime import datetime, timedelta
        import shutil

        # Step 1: Delete existing data
        self.send_sse_event('progress', {
            'step': 'init',
            'message': 'Poistetaan vanhaa dataa...',
            'percent': 0
        })

        raw_dir = BASE_DIR.parent / "data" / "raw"
        if raw_dir.exists():
            shutil.rmtree(raw_dir)
            raw_dir.mkdir(parents=True, exist_ok=True)

        # Step 2: Calculate date range and quarters
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=1850)

        # Generate quarters (same logic as fetch_historical_data.py)
        quarters = []
        current = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.min.time())

        while current <= end_dt:
            if current.month <= 3:
                quarter_end = datetime(current.year, 3, 31)
            elif current.month <= 6:
                quarter_end = datetime(current.year, 6, 30)
            elif current.month <= 9:
                quarter_end = datetime(current.year, 9, 30)
            else:
                quarter_end = datetime(current.year, 12, 31)

            if quarter_end > end_dt:
                quarter_end = end_dt

            quarters.append((current.strftime("%Y-%m-%d"), quarter_end.strftime("%Y-%m-%d")))
            current = quarter_end + timedelta(days=1)

        total_quarters = len(quarters)

        self.send_sse_event('progress', {
            'step': 'fetch',
            'message': f'Haetaan dataa FMI:stä ({total_quarters} jaksoa)...',
            'percent': 5,
            'total_quarters': total_quarters
        })

        # Step 3: Run fetch script with real-time output parsing
        script_path = BASE_DIR.parent / "scripts" / "fetch_historical_data.py"

        # Use -u flag for unbuffered output so SSE works in real-time
        process = subprocess.Popen(
            [sys.executable, '-u', str(script_path), '--start', start_date.isoformat(), '--end', end_date.isoformat()],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        quarter_count = 0
        for line in iter(process.stdout.readline, ''):
            line = line.strip()
            print(line)  # Log to server console

            # Parse progress from output
            if line.startswith("Jakso "):
                # "Jakso 1/21: 2020-01-01 - 2020-03-31"
                try:
                    parts = line.split("/")
                    quarter_count = int(parts[0].replace("Jakso ", ""))
                    # 5% for init, 80% for fetch, 15% for preprocessing
                    percent = 5 + int((quarter_count / total_quarters) * 80)
                    self.send_sse_event('progress', {
                        'step': 'fetch',
                        'message': f'Haetaan jaksoa {quarter_count}/{total_quarters}...',
                        'percent': percent,
                        'current_quarter': quarter_count,
                        'total_quarters': total_quarters
                    })
                except:
                    pass
            elif "[ok]" in line and "Haettiin" in line:
                # "    [ok] Haettiin 5234 riviä"
                try:
                    rows = int(line.split("Haettiin")[1].split("riviä")[0].strip())
                    self.send_sse_event('progress', {
                        'step': 'fetch',
                        'message': f'Jakso {quarter_count}/{total_quarters}: {rows} havaintoa',
                        'percent': 5 + int((quarter_count / total_quarters) * 80),
                        'rows_fetched': rows
                    })
                except:
                    pass

        process.wait()

        if process.returncode != 0:
            self.send_sse_event('error', {'message': 'Data-haku epäonnistui'})
            return

        # Step 4: Run preprocessing
        self.send_sse_event('progress', {
            'step': 'preprocess',
            'message': 'Esikäsitellään dataa...',
            'percent': 85
        })

        preprocess_path = BASE_DIR / "preprocessing" / "prepare_data.py"
        # Use -u flag for unbuffered output
        process = subprocess.Popen(
            [sys.executable, '-u', str(preprocess_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        for line in iter(process.stdout.readline, ''):
            line = line.strip()
            print(line)

            if "Loading weather data" in line:
                self.send_sse_event('progress', {
                    'step': 'preprocess',
                    'message': 'Ladataan raakadataa...',
                    'percent': 87
                })
            elif "Creating station-daily data" in line:
                self.send_sse_event('progress', {
                    'step': 'preprocess',
                    'message': 'Luodaan asemakohtaista dataa...',
                    'percent': 90
                })
            elif "Detecting anomalies" in line:
                self.send_sse_event('progress', {
                    'step': 'preprocess',
                    'message': 'Tunnistetaan anomalioita...',
                    'percent': 93
                })
            elif "winter" in line.lower():
                self.send_sse_event('progress', {
                    'step': 'preprocess',
                    'message': 'Lasketaan talvikausia...',
                    'percent': 96
                })

        process.wait()

        if process.returncode != 0:
            self.send_sse_event('error', {'message': 'Esikäsittely epäonnistui'})
            return

        # Done!
        self.send_sse_event('progress', {
            'step': 'done',
            'message': 'Valmis!',
            'percent': 100
        })
        self.send_sse_event('complete', {'status': 'success'})

    def refresh_last_30_days(self):
        script_path = BASE_DIR.parent / "scripts" / "refresh_recent_data.py"
        print(f"Running script: {script_path}")
        result = subprocess.run([sys.executable, str(script_path)], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Script failed: {result.stderr}")
            raise Exception(f"Script failed: {result.stderr}")
        print(f"Script output: {result.stdout}")

    def refresh_last_5_years(self):
        """Refresh last 5 years (~1850 days) of data"""
        from datetime import datetime, timedelta
        import shutil
        
        # Delete all existing data
        raw_dir = BASE_DIR.parent / "data" / "raw"
        if raw_dir.exists():
            print(f"Deleting existing data in {raw_dir}")
            shutil.rmtree(raw_dir)
            raw_dir.mkdir(parents=True, exist_ok=True)
        
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=1850)
        
        script_path = BASE_DIR.parent / "scripts" / "fetch_historical_data.py"
        print(f"Running script: {script_path} with range {start_date} to {end_date}")

        env = os.environ.copy()
        result = subprocess.run(
            [sys.executable, str(script_path), '--start', start_date.isoformat(), '--end', end_date.isoformat()],
            capture_output=True,
            text=True,
            env=env
        )
        if result.returncode != 0:
            print(f"Script failed: {result.stderr}")
            raise Exception(f"Script failed: {result.stderr}")
        print(f"Script output: {result.stdout}")
        
        # Run preprocessing
        preprocess_path = BASE_DIR / "preprocessing" / "prepare_data.py"
        print(f"Running preprocessing: {preprocess_path}")
        result = subprocess.run([sys.executable, str(preprocess_path)], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Preprocessing failed: {result.stderr}")
            raise Exception(f"Preprocessing failed: {result.stderr}")
        print(f"Preprocessing output: {result.stdout}")

    def fetch_date_range(self, start_date, end_date):
        """Fetch data for a specific date range"""
        script_path = BASE_DIR.parent / "scripts" / "fetch_historical_data.py"
        print(f"Running script: {script_path} with range {start_date} to {end_date}")

        # Set environment variables for the script
        env = os.environ.copy()
        env['FETCH_START_DATE'] = start_date
        env['FETCH_END_DATE'] = end_date

        result = subprocess.run(
            [sys.executable, str(script_path), '--start', start_date, '--end', end_date],
            capture_output=True,
            text=True,
            env=env
        )
        if result.returncode != 0:
            print(f"Script failed: {result.stderr}")
            raise Exception(f"Script failed: {result.stderr}")
        print(f"Script output: {result.stdout}")

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
            print(f"\nAvailable routes:")
            print(f"  http://localhost:{PORT}/explore         - Exploration view")
            print(f"  http://localhost:{PORT}/compare-years   - Compare Years view")
            print(f"  http://localhost:{PORT}/data-management - Data Management view")
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
