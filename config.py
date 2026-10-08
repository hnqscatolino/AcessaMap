import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

GOOGLE_MAPS_BROWSER_KEY = os.getenv(
    "GOOGLE_MAPS_BROWSER_KEY", ""
).strip()

GOOGLE_PLACES_API_KEY = os.getenv(
    "GOOGLE_PLACES_API_KEY", ""
).strip()

MAP_PROVIDER = os.getenv(
    "MAP_PROVIDER", "osm"
).strip().lower()

if MAP_PROVIDER not in ("osm", "google"):
    raise ValueError("Provedor de mapas inválido")