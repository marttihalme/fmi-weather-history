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
import threading

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
        if self.path == '/api/fetch-range':
            # Parse request body for date range
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8') if content_length else '{}'
            try:
                params = json.loads(body)
            except:
                params = {}

            start_date = params.get('start_date')
            end_date = params.get('end_date')

            if not start_date or not end_date:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "start_date and end_date required"}).encode())
                return

            # Use SSE for progress streaming
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.end_headers()

            try:
                self.fetch_date_range_streaming(start_date, end_date)
            except Exception as e:
                self.send_sse_event('error', {'message': str(e)})

        elif self.path == '/api/delete-all-data':
            try:
                self.delete_all_data()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "message": "All data deleted"}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())
        else:
            self.send_error(404, "Not Found")

    def send_sse_event(self, event_type, data):
        """Send a Server-Sent Event"""
        message = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        self.wfile.write(message.encode())
        self.wfile.flush()

    def fetch_date_range_streaming(self, start_date, end_date):
        """Fetch data for date range with progress streaming via SSE"""
        from datetime import datetime, timedelta

        self.send_sse_event('progress', {
            'step': 'init',
            'message': 'Valmistellaan hakua...',
            'percent': 0
        })

        # Parse dates
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")

        # Generate quarters for the date range
        quarters = []
        current = start_dt

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
        total_days = (end_dt - start_dt).days + 1

        self.send_sse_event('progress', {
            'step': 'fetch',
            'message': f'Haetaan dataa FMI:stä ({total_days} päivää, {total_quarters} jaksoa)...',
            'percent': 2,
            'total_quarters': total_quarters,
            'total_days': total_days
        })

        # Run fetch script with merge mode
        script_path = BASE_DIR.parent / "scripts" / "fetch_historical_data.py"

        process = subprocess.Popen(
            [sys.executable, '-u', str(script_path), '--start', start_date, '--end', end_date, '--merge'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        quarter_count = 0
        total_rows = 0
        while True:
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            if line:
                line = line.strip()
                print(line)

                if line.startswith("Jakso "):
                    try:
                        parts = line.split("/")
                        quarter_count = int(parts[0].replace("Jakso ", ""))
                        date_part = line.split(": ")[1] if ": " in line else ""
                        percent = 2 + int((quarter_count / total_quarters) * 68)
                        self.send_sse_event('progress', {
                            'step': 'fetch',
                            'message': f'Haetaan jaksoa {quarter_count}/{total_quarters}: {date_part}',
                            'percent': percent,
                            'current_quarter': quarter_count,
                            'total_quarters': total_quarters
                        })
                    except:
                        pass
                elif "[ok]" in line and "Haettiin" in line:
                    try:
                        rows = int(line.split("Haettiin")[1].split("riviä")[0].strip())
                        total_rows += rows
                        self.send_sse_event('progress', {
                            'step': 'fetch',
                            'message': f'Jakso {quarter_count}/{total_quarters}: +{rows} havaintoa (yht. {total_rows})',
                            'percent': 2 + int((quarter_count / total_quarters) * 68),
                            'rows_fetched': total_rows
                        })
                    except:
                        pass
                elif "Yhdistetään" in line or "Tallennettu" in line:
                    self.send_sse_event('progress', {
                        'step': 'fetch',
                        'message': line,
                        'percent': 70
                    })

        process.wait()

        if process.returncode != 0:
            self.send_sse_event('error', {'message': 'Data-haku epäonnistui'})
            return

        # Run preprocessing
        self.send_sse_event('progress', {
            'step': 'preprocess',
            'message': 'Esikäsitellään dataa...',
            'percent': 72
        })

        preprocess_path = BASE_DIR / "preprocessing" / "prepare_data.py"
        process = subprocess.Popen(
            [sys.executable, '-u', str(preprocess_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        while True:
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            if line:
                line = line.strip()
                print(line)

                if "Loading weather data" in line or "Loaded" in line:
                    self.send_sse_event('progress', {
                        'step': 'preprocess',
                        'message': 'Ladataan raakadataa...',
                        'percent': 74
                    })
                elif "Creating station-daily" in line or "station-daily" in line.lower():
                    self.send_sse_event('progress', {
                        'step': 'preprocess',
                        'message': 'Luodaan asemakohtaista dataa...',
                        'percent': 78
                    })
                elif "zone summar" in line.lower():
                    self.send_sse_event('progress', {
                        'step': 'preprocess',
                        'message': 'Luodaan vyöhykeyhteenvetoja...',
                        'percent': 82
                    })
                elif "station location" in line.lower():
                    self.send_sse_event('progress', {
                        'step': 'preprocess',
                        'message': 'Päivitetään asematiedot...',
                        'percent': 85
                    })
                elif "anomal" in line.lower():
                    self.send_sse_event('progress', {
                        'step': 'preprocess',
                        'message': 'Käsitellään anomalioita...',
                        'percent': 88
                    })
                elif "winter" in line.lower():
                    self.send_sse_event('progress', {
                        'step': 'preprocess',
                        'message': 'Analysoidaan talvikausia...',
                        'percent': 91
                    })
                elif "RUNNING ANALYSIS" in line or "Running analysis" in line:
                    self.send_sse_event('progress', {
                        'step': 'analyze',
                        'message': 'Ajetaan analyysejä...',
                        'percent': 94
                    })
                elif "analyze_data.py" in line:
                    self.send_sse_event('progress', {
                        'step': 'analyze',
                        'message': 'Analysoidaan säädataa...',
                        'percent': 96
                    })
                elif "completed" in line.lower() or "ALL PROCESSING COMPLETE" in line or "VALMIIT" in line:
                    self.send_sse_event('progress', {
                        'step': 'done',
                        'message': 'Analyysit valmiit!',
                        'percent': 99
                    })

        process.wait()

        if process.returncode != 0:
            self.send_sse_event('error', {'message': 'Esikäsittely epäonnistui'})
            return

        # Done!
        self.send_sse_event('progress', {
            'step': 'done',
            'message': f'Valmis! Haettiin {total_rows} havaintoa.',
            'percent': 100
        })
        self.send_sse_event('complete', {'status': 'success', 'rows': total_rows})

    def delete_all_data(self):
        """Delete all weather data and analysis files"""
        import shutil

        deleted = []

        # Delete raw data
        raw_dir = BASE_DIR.parent / "data" / "raw"
        if raw_dir.exists():
            shutil.rmtree(raw_dir)
            raw_dir.mkdir(parents=True, exist_ok=True)
            deleted.append("data/raw")

        # Delete analysis data
        analysis_dir = BASE_DIR.parent / "data" / "analysis"
        if analysis_dir.exists():
            shutil.rmtree(analysis_dir)
            analysis_dir.mkdir(parents=True, exist_ok=True)
            deleted.append("data/analysis")

        # Delete visualization data (JSON files)
        viz_data_dir = BASE_DIR / "data"
        if viz_data_dir.exists():
            for f in viz_data_dir.glob("*.json"):
                f.unlink()
                deleted.append(f"visualization/data/{f.name}")
            for f in viz_data_dir.glob("*.json.gz"):
                f.unlink()
                deleted.append(f"visualization/data/{f.name}")

        print(f"Deleted: {deleted}")
        return deleted

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

    # Use ThreadingTCPServer for better Ctrl+C handling on Windows
    class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
        allow_reuse_address = True
        daemon_threads = True

    httpd = ThreadedTCPServer(("", PORT), CustomHTTPRequestHandler)

    print(f"\n✓ Server running at http://localhost:{PORT}")
    print(f"\nAvailable routes:")
    print(f"  http://localhost:{PORT}/explore         - Exploration view")
    print(f"  http://localhost:{PORT}/compare-years   - Compare Years view")
    print(f"  http://localhost:{PORT}/data-management - Data Management view")
    print(f"\nPress Ctrl+C to stop")
    print("-" * 60)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n" + "=" * 60)
        print("Server stopped by user")
        print("=" * 60)
    finally:
        httpd.shutdown()
        httpd.server_close()


if __name__ == "__main__":
    main()
