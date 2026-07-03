# SOVEREIGN RUNTIME DESKTOP AGENT FOR USER: billing_user
import os, time, requests
from PIL import ImageGrab

CLOUD_SERVER_URL = "https://your-private-ai.com"
USER_ACCESS_TOKEN = "Sovereign_8f949c36bbce5994017f5d88b91cda5a"

print("🔒 Sovereign Client Agent Active for billing_user. Awaiting browser cloud commands...")
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
