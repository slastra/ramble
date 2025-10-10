#!/usr/bin/env python3
"""
Test script for SSE endpoint
Connects to the Nuxt server's SSE endpoint and monitors the connection
"""

import requests
import time
import sys

def test_sse_endpoint(url, username):
    """Test SSE endpoint connection"""
    full_url = f"{url}/events?username={username}"

    print(f"Testing SSE endpoint: {full_url}")
    print("=" * 60)

    try:
        # Make SSE request with stream=True
        response = requests.get(
            full_url,
            headers={
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            },
            stream=True,
            timeout=60  # 60 second timeout
        )

        print(f"✓ Connection established")
        print(f"  Status Code: {response.status_code}")
        print(f"  Headers:")
        for header, value in response.headers.items():
            print(f"    {header}: {value}")
        print()

        if response.status_code != 200:
            print(f"✗ Error: Expected 200, got {response.status_code}")
            print(f"  Response: {response.text}")
            return False

        # Check Content-Type
        content_type = response.headers.get('Content-Type', '')
        if 'text/event-stream' not in content_type:
            print(f"✗ Warning: Content-Type is '{content_type}', expected 'text/event-stream'")

        print("Listening for SSE events (Ctrl+C to stop)...")
        print("-" * 60)

        start_time = time.time()
        event_count = 0
        last_event_time = start_time

        # Read SSE stream
        for line in response.iter_lines(decode_unicode=True):
            current_time = time.time()
            elapsed = current_time - start_time
            since_last = current_time - last_event_time

            if line:
                event_count += 1
                last_event_time = current_time
                print(f"[{elapsed:.1f}s] ({since_last:.3f}s since last) {line}")

            # Check if connection is staying alive
            if elapsed > 5 and event_count == 0:
                print(f"\n✗ No events received after {elapsed:.1f} seconds")
                print("  Connection might be closing immediately")
                return False

        # If we get here, the connection closed
        elapsed = time.time() - start_time
        print()
        print(f"✗ Connection closed after {elapsed:.1f} seconds")
        print(f"  Total events received: {event_count}")

        if elapsed < 1.0:
            print("  ⚠️  Connection closed very quickly - likely an error")
            return False

        return event_count > 0

    except requests.exceptions.Timeout:
        print("✓ Connection timed out after 60 seconds (this is expected for testing)")
        return True
    except requests.exceptions.ConnectionError as e:
        print(f"✗ Connection error: {e}")
        return False
    except KeyboardInterrupt:
        print("\n\n✓ Test interrupted by user (connection was alive)")
        return True
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    if len(sys.argv) > 1:
        server_url = sys.argv[1]
    else:
        server_url = "http://localhost:3000"

    if len(sys.argv) > 2:
        username = sys.argv[2]
    else:
        username = "test-user"

    print("SSE Endpoint Test")
    print("=" * 60)
    print(f"Server: {server_url}")
    print(f"Username: {username}")
    print()

    success = test_sse_endpoint(server_url, username)

    print()
    print("=" * 60)
    if success:
        print("✓ SSE endpoint appears to be working correctly")
        sys.exit(0)
    else:
        print("✗ SSE endpoint has issues")
        sys.exit(1)

if __name__ == '__main__':
    main()
