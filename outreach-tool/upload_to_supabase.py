#!/usr/bin/env python3
"""
Upload Google Maps scraper JSON data to Supabase.
Usage: python upload_to_supabase.py <path-to-your-json-file>

Handles both:
1. Basic Google Maps leads (for cold callers)
2. LinkedIn/Apollo Enriched leads (for your outreach)
"""

import json
import sys
import os
import requests
from urllib.parse import urlparse

# ─── Supabase Configuration ──────────────────────────────────────────
SUPABASE_URL = "https://zmygclofyxanprwklema.supabase.co"
SUPABASE_KEY = "eyJhbG...PhD0"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal"
}


def extract_domain(url):
    if not url:
        return ""
    try:
        parsed = urlparse(url.replace("order.online/store", ""))
        return parsed.netloc
    except Exception:
        return ""


def map_scraper_to_leads(data):
    """Map google-maps-scraper JSON to Supabase leads table columns."""
    leads = []

    for item in data:
        detailed_address = item.get("detailed_address", {}) or {}
        city = detailed_address.get("city", "") or ""

        owner = item.get("owner", {}) or {}
        owner_name = owner.get("name", "")
        owner_role = owner.get("title", "") or owner.get("role", "")
        owner_linkedin = owner.get("linkedin_url", "")
        owner_snippet = owner.get("snippet", "")

        lead = {
            "title": item.get("name", ""),
            "category_name": item.get("main_category", ""),
            "categories": ", ".join(item.get("categories", [])) if item.get("categories") else None,
            "phone": item.get("phone", ""),
            "address": item.get("address", ""),
            "city": city,
            "postal_code": detailed_address.get("postal_code", ""),
            "country_code": detailed_address.get("country_code", ""),
            "website": item.get("website", ""),
            "total_score": item.get("rating", 0),
            "reviews_count": item.get("reviews", 0),
            "place_id": item.get("place_id", ""),
            "is_advertisement": item.get("is_spending_on_ads", False),
            "search_string": item.get("query", ""),
            "url": item.get("link", "") or item.get("url", ""),
            "domain": extract_domain(item.get("website", "")),
            "source": "google_maps",
            "status": "new",
            "ad_running": item.get("is_spending_on_ads", False),
            "source_details": json.dumps({
                "rating": item.get("rating"),
                "reviews": item.get("reviews"),
                "competitors": item.get("competitors", []),
                "coordinates": item.get("coordinates", {}),
            }),
            # Owner enrichment
            "owner_name": owner_name if owner_name else None,
            "owner_role": owner_role if owner_role else None,
            "owner_linkedin_url": owner_linkedin if owner_linkedin else None,
            "owner_snippet": owner_snippet if owner_snippet else None,
            "owner_found": bool(owner_name),
        }

        # Clean empty strings
        for k, v in list(lead.items()):
            if v == "":
                lead[k] = None

        leads.append(lead)

    return leads


def map_enriched_leads(data):
    """Extract LinkedIn/Apollo enrichment data into linkedin_leads records."""
    enriched = []

    for item in data:
        place_id = item.get("place_id", "")
        owner = item.get("owner", {}) or {}
        leads_array = item.get("leads", []) or []

        # Owner enrichment (from LinkedIn/SerpAPI)
        if owner.get("name"):
            record = {
                "place_id": place_id,
                "lead_name": owner.get("name", ""),
                "title": owner.get("title", "") or owner.get("role", "") or None,
                "email": owner.get("email", "") or None,
                "email_status": "verified" if owner.get("email") else "not_found",
                "linkedin_url": owner.get("linkedin_url", "") or None,
                "source": "linkedin_owner_search",
            }
            enriched.append({k: (v if v != "" else None) for k, v in record.items()})

        # Apollo enriched leads
        for lead_item in leads_array:
            record = {
                "place_id": place_id,
                "lead_name": lead_item.get("name", ""),
                "title": lead_item.get("title", "") or None,
                "email": lead_item.get("email", "") or None,
                "email_status": "verified" if lead_item.get("email") else "not_found",
                "linkedin_url": (
                    lead_item.get("linkedin_url", "")
                    or lead_item.get("linkedin", "")
                    or None
                ),
                "source": "apollo_enrichment",
            }
            enriched.append({k: (v if v != "" else None) for k, v in record.items()})

    return enriched


def map_tech_stack(data):
    """Extract tech stack data into tech_stack records."""
    tech_records = []

    for item in data:
        ts = item.get("tech_stack", {}) or {}
        if ts:
            tech_stack_str = ", ".join(ts.get("tech_stack", [])) if ts.get("tech_stack") else None
            record = {
                "place_id": item.get("place_id", ""),
                "running_google_ads": bool(ts.get("google_ads", False)),
                "running_fb_ads": bool(ts.get("facebook_ads", False)),
                "tech_stack": tech_stack_str,
            }
            tech_records.append(record)

    return tech_records


def upload_leads(leads):
    """Upload leads to Supabase using REST API (upsert on place_id)."""
    success_count = 0
    error_count = 0

    for lead in leads:
        # Try POST (create or update via merge-duplicates)
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/leads",
            headers=HEADERS,
            json=lead,
        )

        if response.status_code in (200, 201):
            success_count += 1
            print(f"✓ Lead: {lead['title']}")
            if lead.get("owner_name"):
                print(f"  Owner: {lead['owner_name']}")
        else:
            # Try PATCH for existing records
            response = requests.patch(
                f"{SUPABASE_URL}/rest/v1/leads",
                headers={k: v for k, v in HEADERS.items() if k != "Prefer"},
                params={"place_id": f"eq.{lead['place_id']}"},
                json=lead,
            )
            if response.status_code in (200, 201, 204):
                success_count += 1
                print(f"✓ Lead updated: {lead['title']}")
            else:
                error_count += 1
                print(f"✗ Error: {lead['title']} - {response.text[:150]}")

    print(f"\nLeads: {success_count} succeeded, {error_count} failed")
    return success_count, error_count


def upload_enriched_leads(enriched_leads):
    """Upload enriched leads to linkedin_leads table."""
    success_count = 0
    error_count = 0

    for record in enriched_leads:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/linkedin_leads",
            headers=HEADERS,
            json=record,
        )

        if response.status_code in (200, 201):
            success_count += 1
            source_tag = "LinkedIn" if "linkedin" in record.get("source", "") else "Apollo"
            print(f"  → Enriched: {record.get('lead_name')} [{source_tag}]")
        elif "duplicate" in response.text.lower() or response.status_code == 409:
            success_count += 1  # Skip duplicates
        else:
            error_count += 1
            print(f"  ✗ Error: {record.get('lead_name')} - {response.text[:150]}")

    print(f"\nEnriched leads: {success_count} succeeded, {error_count} failed")
    return success_count, error_count


def upload_tech_stack(tech_records):
    """Upload tech stack data to tech_stack table."""
    success_count = 0
    error_count = 0

    for record in tech_records:
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/tech_stack",
            headers=HEADERS,
            json=record,
        )

        if response.status_code in (200, 201):
            success_count += 1
        elif "duplicate" in response.text.lower() or response.status_code == 409:
            # Try update
            resp2 = requests.patch(
                f"{SUPABASE_URL}/rest/v1/tech_stack",
                headers={k: v for k, v in HEADERS.items() if k != "Prefer"},
                params={"place_id": f"eq.{record['place_id']}"},
                json=record,
            )
            if resp2.status_code in (200, 204):
                success_count += 1
            else:
                error_count += 1
        else:
            error_count += 1

    print(f"Tech stack: {success_count} succeeded, {error_count} failed")
    return success_count, error_count


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python upload_to_supabase.py <path-to-json-file>")
        sys.exit(1)

    json_file_path = sys.argv[1]

    if not os.path.exists(json_file_path):
        print(f"Error: File '{json_file_path}' not found")
        sys.exit(1)

    print(f"Reading from: {json_file_path}")

    with open(json_file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        data = [data]

    print(f"Found {len(data)} leads in the file\n")

    # 1. Upload main leads
    print("=== Uploading Google Maps leads ===")
    leads = map_scraper_to_leads(data)
    upload_leads(leads)

    # 2. Upload enriched LinkedIn/Apollo leads
    print("\n=== Uploading enriched leads ===")
    enriched = map_enriched_leads(data)
    upload_enriched_leads(enriched)

    # 3. Upload tech stack data
    print("\n=== Uploading tech stack data ===")
    tech_records = map_tech_stack(data)
    if tech_records:
        upload_tech_stack(tech_records)
    else:
        print("No tech stack data found")

    print("\n✅ Done!")