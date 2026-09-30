#!/usr/bin/env python3
"""
AegisHealth - High-Performance Apple Health export.xml Streaming Ingester & Database Sync
Streams multi-gigabyte export.xml files in seconds using iterparse (O(1) memory)
and automatically uploads extracted daily metrics directly to Supabase cloud vault.
"""

import sys
import os
import json
import xml.etree.ElementTree as ET
from datetime import datetime
import urllib.request
import urllib.error

SUPABASE_URL = "https://motbikijmbuufadheykm.supabase.co"

def parse_apple_health_export(xml_path, user_id='alastairorchard@icloud.com', anon_key=None):
    if not os.path.exists(xml_path):
        print(f"[-] Error: File '{xml_path}' not found.")
        return []

    print(f"[*] Opening Apple Health Export: {xml_path}")
    print(f"[*] Target User: {user_id}")
    
    TARGET_TYPES = {
        'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': ('hrv_sdnn', 'ms'),
        'HKQuantityTypeIdentifierRestingHeartRate': ('resting_heart_rate', 'bpm'),
        'HKQuantityTypeIdentifierVO2Max': ('vo2_max', 'mL/kg/min'),
        'HKQuantityTypeIdentifierActiveEnergyBurned': ('active_energy_kcal', 'kcal'),
        'HKQuantityTypeIdentifierOxygenSaturation': ('spo2', '%'),
        'HKQuantityTypeIdentifierRespiratoryRate': ('resp_rate', 'breaths/min'),
        'HKCategoryTypeIdentifierSleepAnalysis': ('sleep_deep_min', 'min')
    }

    daily_aggregates = {}
    count = 0

    print("[*] Streaming XML elements with iterparse...")
    context = ET.iterparse(xml_path, events=('end',))
    
    for event, elem in context:
        if elem.tag == 'Record':
            record_type = elem.attrib.get('type')
            if record_type in TARGET_TYPES:
                metric_key, default_unit = TARGET_TYPES[record_type]
                start_date_str = elem.attrib.get('startDate', '')
                value_str = elem.attrib.get('value', '0')
                unit = elem.attrib.get('unit', default_unit)
                device = elem.attrib.get('sourceName', 'Apple Watch')

                day_key = start_date_str[:10] if len(start_date_str) >= 10 else ''

                if day_key:
                    try:
                        if record_type == 'HKCategoryTypeIdentifierSleepAnalysis':
                            val_raw = str(value_str).lower()
                            if 'deep' in val_raw or val_raw == '4' or 'asleep' in val_raw:
                                end_date_str = elem.attrib.get('endDate', '')
                                if start_date_str and end_date_str:
                                    t0 = datetime.fromisoformat(start_date_str.replace(' ', 'T')[:19])
                                    t1 = datetime.fromisoformat(end_date_str.replace(' ', 'T')[:19])
                                    dur_min = (t1 - t0).total_seconds() / 60.0
                                    k = (day_key, 'sleep_deep_min')
                                    daily_aggregates[k] = daily_aggregates.get(k, 0.0) + dur_min
                        else:
                            num_val = float(value_str)
                            if num_val > 0:
                                k = (day_key, metric_key)
                                if k not in daily_aggregates:
                                    daily_aggregates[k] = {'sum': num_val, 'count': 1, 'unit': unit, 'device': device, 'date': start_date_str}
                                else:
                                    daily_aggregates[k]['sum'] += num_val
                                    daily_aggregates[k]['count'] += 1
                        count += 1
                    except Exception:
                        pass

                if count % 20000 == 0:
                    print(f"  -> Processed {count:,} samples...", end='\r')

            elem.clear()

    print(f"\n[+] Total Raw Telemetry Records Scanned: {count:,}")
    
    metrics = []
    for (day, metric_type), data in daily_aggregates.items():
        if metric_type == 'sleep_deep_min':
            val = round(data, 1)
            metrics.append({
                'user_id': user_id,
                'metric_type': 'sleep_deep_min',
                'value': val,
                'unit': 'min',
                'device_source': 'Apple Watch Ultra 4',
                'recorded_at': f"{day}T07:00:00Z"
            })
        else:
            avg_val = round(data['sum'] / data['count'], 2)
            metrics.append({
                'user_id': user_id,
                'metric_type': metric_type,
                'value': avg_val,
                'unit': data['unit'],
                'device_source': data['device'],
                'recorded_at': data['date']
            })

    metrics.sort(key=lambda x: x['recorded_at'])
    print(f"[+] Compiled into {len(metrics):,} daily aggregated longevity telemetry points.")

    output_dir = os.path.dirname(os.path.abspath(xml_path))
    output_path = os.path.join(output_dir, 'aegis_ingested_vitals.json')
    with open(output_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"[+] Saved clean JSON bundle to: {output_path}")

    # Upload to Supabase
    if anon_key:
        upload_to_supabase_vault(metrics, user_id, anon_key)

    return metrics

def upload_to_supabase_vault(metrics, user_id, anon_key):
    url = f"{SUPABASE_URL}/rest/v1/aegis_user_vaults"
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    # Fetch existing user vault
    existing_vault = {}
    try:
        get_req = urllib.request.Request(f"{url}?user_email=eq.{user_id}&select=vault_payload", headers=headers)
        with urllib.request.urlopen(get_req) as resp:
            rows = json.loads(resp.read().decode())
            if rows and len(rows) > 0 and rows[0].get("vault_payload"):
                existing_vault = rows[0]["vault_payload"]
    except Exception as e:
        print("[-] Fetch notice:", e)

    existing_vault["user_email"] = user_id
    existing_vault["wearableMetrics"] = metrics
    existing_vault["updated_at"] = datetime.utcnow().isoformat() + "Z"
    if "user_profile" not in existing_vault:
        existing_vault["user_profile"] = {"fullName": user_id.split('@')[0], "email": user_id, "onboardingCompleted": True}
    if "biomarkers" not in existing_vault:
        existing_vault["biomarkers"] = []
    if "labDocuments" not in existing_vault:
        existing_vault["labDocuments"] = []

    payload = json.dumps([{
        "user_email": user_id,
        "vault_payload": existing_vault,
        "updated_at": datetime.utcnow().isoformat() + "Z"
    }]).encode("utf-8")

    print(f"[*] Uploading complete {len(metrics)} vitals bundle to Supabase ({len(payload):,} bytes)...")
    try:
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req) as resp:
            print(f"[+] SUCCESS! Synced all {len(metrics):,} Apple Health points directly to Supabase Cloud (Status: {resp.status})")
    except Exception as e:
        print(f"[-] Supabase sync error: {e}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 import_apple_health_export.py <path_to_export.xml> [user_id] [anon_key]")
        sys.exit(1)
    
    xml_file = sys.argv[1]
    uid = sys.argv[2] if len(sys.argv) > 2 else 'alastairorchard@icloud.com'
    key = sys.argv[3] if len(sys.argv) > 3 else None
    parse_apple_health_export(xml_file, uid, key)
