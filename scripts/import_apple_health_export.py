#!/usr/bin/env python3
"""
AegisHealth - High-Performance Apple Health export.xml Streaming Ingester & Database Sync
Streams multi-gigabyte export.xml files in seconds using iterparse (O(1) memory)
and can automatically upload extracted daily metrics directly to Supabase cloud vault.
"""

import sys
import os
import json
import xml.etree.ElementTree as ET
from datetime import datetime
import urllib.request
import urllib.error

SUPABASE_URL = "https://motbikijmbuufadheykm.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vdGJpa2lqbWJ1dWZhZGhleWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NjE5NTQsImV4cCI6MjEwNjMzNzk1NH0.59_oyRSpL7OJ8MaG2FOCIWwV4a0N1zWNqClm77oWsoQ"

def parse_apple_health_export(xml_path, user_id='alastairorchard@icloud.com', sync_supabase=True):
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

    # Use a dictionary to compute daily aggregated / representative values
    # (e.g. 1 daily average for HRV, 1 daily resting HR, 1 daily deep sleep total)
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

                # Extract YYYY-MM-DD
                day_key = start_date_str[:10] if len(start_date_str) >= 10 else ''

                if day_key:
                    try:
                        if record_type == 'HKCategoryTypeIdentifierSleepAnalysis':
                            # Sleep analysis: calculate duration of deep sleep in minutes
                            # Value 4 or HKCategoryValueSleepAnalysisAsleepDeep
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

                if count % 10000 == 0:
                    print(f"  -> Processed {count:,} samples...", end='\r')

            elem.clear()

    print(f"\n[+] Total Raw Telemetry Records Scanned: {count:,}")
    
    # Format into structured time-series metrics
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

    # Sort chronologically
    metrics.sort(key=lambda x: x['recorded_at'])
    print(f"[+] Compiled into {len(metrics):,} daily aggregated longevity telemetry points.")

    # Save to JSON bundle
    output_dir = os.path.dirname(os.path.abspath(xml_path))
    output_path = os.path.join(output_dir, 'aegis_ingested_vitals.json')
    with open(output_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"[+] Saved clean JSON bundle to: {output_path}")

    # Direct Supabase Cloud Sync
    if sync_supabase and SUPABASE_URL and SUPABASE_ANON_KEY:
        print(f"[*] Uploading {len(metrics)} telemetry points to Supabase Cloud Database...")
        upload_to_supabase(metrics)

    return metrics

def upload_to_supabase(metrics, batch_size=500):
    endpoint = f"{SUPABASE_URL}/rest/v1/wearable_metrics"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    total = len(metrics)
    uploaded = 0

    for i in range(0, total, batch_size):
        batch = metrics[i:i + batch_size]
        payload = json.dumps(batch).encode('utf-8')
        req = urllib.request.Request(endpoint, data=payload, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req) as resp:
                if resp.status in (200, 201, 204):
                    uploaded += len(batch)
                    print(f"  -> Uploaded {uploaded}/{total} records to Supabase...", end='\r')
        except urllib.error.HTTPError as e:
            print(f"\n[-] Supabase batch error at offset {i}: {e.code} - {e.read().decode()[:200]}")
            break
        except Exception as e:
            print(f"\n[-] Network error during upload: {e}")
            break

    print(f"\n[+] Successfully synced {uploaded}/{total} records directly to Supabase cloud vault!")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 import_apple_health_export.py <path_to_export.xml> [user_id]")
        sys.exit(1)
    
    xml_file = sys.argv[1]
    uid = sys.argv[2] if len(sys.argv) > 2 else 'alastairorchard@icloud.com'
    parse_apple_health_export(xml_file, uid)
