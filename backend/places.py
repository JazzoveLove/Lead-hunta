import os
import httpx
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
PLACES_URL = "https://places.googleapis.com/v1/places:searchText"


async def search_places(query: str, city: str) -> list[dict]:
    text_query = f"{query} {city}"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": (
            "places.displayName,"
            "places.formattedAddress,"
            "places.nationalPhoneNumber,"
            "places.userRatingCount,"
            "places.primaryTypeDisplayName,"
            "places.websiteUri,"
            "nextPageToken"
        ),
    }

    all_places = []
    page_token = None

    async with httpx.AsyncClient() as client:
        for _ in range(3):  # max 3 pages = 60 results
            body = {
                "textQuery": text_query,
                "languageCode": "pl",
                "pageSize": 20,
            }
            if page_token:
                body["pageToken"] = page_token

            response = await client.post(PLACES_URL, json=body, headers=headers)
            response.raise_for_status()
            data = response.json()

            all_places.extend(data.get("places", []))

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    leads = []
    for place in all_places:
        website = place.get("websiteUri", "")
        if website and "facebook.com" not in website:
            continue  # ma prawdziwą stronę — pomijamy
        website_status = "tylko_facebook" if "facebook.com" in website else "bez_strony"
        leads.append({
            "name": place.get("displayName", {}).get("text", ""),
            "address": place.get("formattedAddress", ""),
            "phone": place.get("nationalPhoneNumber", ""),
            "reviews_count": place.get("userRatingCount", 0),
            "category": place.get("primaryTypeDisplayName", {}).get("text", query),
            "city": city,
            "status": "Nowy",
            "notes": "",
            "website_status": website_status,
        })
    return leads
