import threading
import time
import sys
import urllib.request

import uvicorn
import webview

PORT = 8000


def start_server():
    uvicorn.run(
        "backend.main:app",
        host="127.0.0.1",
        port=PORT,
        log_level="warning",
    )


def wait_for_server(timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}", timeout=1)
            return True
        except Exception:
            time.sleep(0.2)
    return False


if __name__ == "__main__":
    thread = threading.Thread(target=start_server, daemon=True)
    thread.start()

    if not wait_for_server():
        print("ERROR: Server failed to start within 10 seconds.")
        sys.exit(1)

    webview.create_window(
        title="LeadHunter",
        url=f"http://127.0.0.1:{PORT}",
        width=1400,
        height=860,
        min_size=(900, 600),
    )
    webview.start()
