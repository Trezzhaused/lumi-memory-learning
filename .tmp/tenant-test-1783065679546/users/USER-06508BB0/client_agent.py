# SOVEREIGN RUNTIME DESKTOP AGENT FOR USER: alpha_leader
import os, time, requests
from PIL import ImageGrab

CLOUD_SERVER_URL = "https://your-private-ai.com"
USER_ACCESS_TOKEN = "Sovereign_f7f11eac356f9038fdfff6085b77b0d3"

print("🔒 Sovereign Client Agent Active for alpha_leader. Awaiting browser cloud commands...")
while True:
    try:
        res = requests.get(f"{CLOUD_SERVER_URL}/fetch_task", headers={"X-Auth-Token": USER_ACCESS_TOKEN}, timeout=10)
        if res.status_code == 200:
            task = res.json()
            if task.get("action") == "SCREEN_CAPTURE":
                ImageGrab.grab().save("C:\\SovereignAI\\temp.png")
                with open("C:\\SovereignAI\\temp.png", "rb") as f:
                    requests.post(f"{CLOUD_SERVER_URL}/upload_screen", headers={"X-Auth-Token": USER_ACCESS_TOKEN}, files={"file": f})
                os.remove("C:\\SovereignAI\\temp.png")
    except Exception:
        time.sleep(5)
