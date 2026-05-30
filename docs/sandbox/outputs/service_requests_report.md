# Service Requests

## Overview

```json
{
  "source_file": "/Users/tlam/311mustangs/docs/data/service-requests/SR2026.csv",
  "rows": 190511,
  "columns": [
    "creation_date",
    "status",
    "first_3_chars_of_postal_code",
    "intersection_street_1",
    "intersection_street_2",
    "ward",
    "service_request_type",
    "division",
    "section",
    "creation_date__parsed",
    "demo_bucket"
  ],
  "date_stats": {
    "creation_date": {
      "valid": 190511,
      "missing_or_invalid": 0,
      "min": "2026-01-01 00:21:51",
      "max": "2026-04-30 23:58:21"
    }
  },
  "csv_repaired_rows": 5447,
  "csv_short_rows_padded": 0,
  "has_exact_lat_lon": false,
  "location_granularity": "Postal FSA / intersection fields only; useful for embeddings and category priors, weaker for meter-level geospatial matching.",
  "demo_feasibility": {
    "embedding_training_or_index": "HIGH - 190k+ textual/category records",
    "duplicate_detection": "MEDIUM - semantic duplicate demos possible, but precise distance is limited unless intersection fields are geocoded",
    "priority_priors": "HIGH - use service type/division/section/status/category frequency as deterministic features",
    "scheduling_locations": "LOW/MEDIUM - requires geocoding intersections or synthetic coordinates for demo operations"
  }
}
```

## Column profile

| column | dtype | non_null | null | null_pct | unique | example_values |
| --- | --- | --- | --- | --- | --- | --- |
| creation_date | str | 190511 | 0 | 0.0 | 187334 | 2026-01-01 00:21:51.0000000 \| 2026-01-01 00:24:48.0000000 \| 2026-01-01 00:27:38.0000000 \| 2026-01-01 00:29:23.0000000 \| 2026-01-01 00:32:12.0000000 |
| status | str | 190511 | 0 | 0.0 | 6 | Completed \| Closed \| In Progress \| New \| Cancelled |
| first_3_chars_of_postal_code | str | 190511 | 0 | 0.0 | 100 | M4L \| M1C \| Intersection \| M2N \| M8Y |
| intersection_street_1 | str | 190511 | 0 | 0.0 | 4615 |  \| Leslie St \| Lawrence Ave E \| Frederick St \| Earlthorpe Cres |
| intersection_street_2 | str | 190511 | 0 | 0.0 | 4237 |  \| Finch Ave E \| Greencrest Crct \| The Esplanade \| Lynnbrook Dr |
| ward | str | 190511 | 0 | 0.0 | 26 | Beaches-East York (19) \| Scarborough-Rouge Park (25) \| Don Valley North (17) \| Willowdale (18) \| Scarborough-Guildwood (24) |
| service_request_type | str | 190511 | 0 | 0.0 | 533 | Stray - Confined \| Property Standards and Maintenance Violations \| Clean up Debris on Road \| Sewer Service Line-Blocked \| Traffic Signal Repair |
| division | str | 190511 | 0 | 0.0 | 8 | Municipal Licensing & Standards \| Transportation Services \| Toronto Water \| Solid Waste Management Services \| Environment, Climate & Forestry |
| section | str | 190511 | 0 | 0.0 | 24 | Toronto Animal Services \| Investigation Services \| Road Operations \| District Ops \| TMC |
| creation_date__parsed | datetime64[ns] | 190511 | 0 | 0.0 | 187334 | 2026-01-01 00:21:51 \| 2026-01-01 00:24:48 \| 2026-01-01 00:27:38 \| 2026-01-01 00:29:23 \| 2026-01-01 00:32:12 |
| demo_bucket | str | 190511 | 0 | 0.0 | 3 | other \| potential_human_or_urgent \| potential_demo_low_priority |

## Top service request types

| service_request_type | count |
| --- | --- |
| Road Pothole / Road Damage | 17347 |
| Sidewalk Snow Clearing Required | 11262 |
| Road Plowing Request | 10933 |
| Driveway Blocked By Plowed Snowbank | 6956 |
| Residential Bin Lid Damaged | 5590 |
| Property Standards and Maintenance Violations | 5549 |
| Injured - Wildlife | 2876 |
| Res / Garbage / Not Picked Up | 2841 |
| Catch Basin - Blocked / Flooding | 2604 |
| Sewer Service Line-Blocked | 2457 |
| Pick up Dead Wildlife | 2355 |
| Clean up Debris on Road | 2309 |
| Traffic Signal Repair | 2147 |
| Outcome of Service - Complaint - Road Operations | 2133 |
| Boulevard Plow Damage | 2111 |
| Residential Bin Body or Handle Damaged | 2097 |
| Clean up Illegal Dumping on City Road Allowance | 2072 |
| Res / Organic Green Bin / Not Picked Up | 1854 |
| Residential Oversized/Electronics Item Day Collection Not Picked Up | 1726 |
| Waste or Illegal Dumping on Private Property | 1722 |
| Residential - Garbage Day Collection - Not Picked Up | 1689 |
| Icy Sidewalk Needs Salting | 1639 |
| Missing/Damaged/Faded/Relocating Street Name or Traffic Signs | 1629 |
| Residential: Garbage Bin: Missing | 1576 |
| Replace Missing Residential Organic Bin | 1568 |
| Amplified or Musical Instrument Noise | 1563 |
| Report an Encroachment on City Property | 1489 |
| Zoning Regulations Violations | 1461 |
| General Pruning | 1454 |
| Snow Removal - Sightline Problem | 1406 |

## Top divisions

| division | count |
| --- | --- |
| Transportation Services | 92375 |
| Solid Waste Management Services | 45491 |
| Municipal Licensing & Standards | 28684 |
| Toronto Water | 14936 |
| Environment, Climate & Forestry | 5446 |
| 311 | 2031 |
| Parks and Recreation | 1547 |
| Solid Waste Management Services, Transfer | 1 |

## Top sections

| section | count |
| --- | --- |
| Road Operations | 79415 |
| Collections | 45138 |
| District Ops | 14578 |
| Investigation Services | 11569 |
| Toronto Animal Services | 9289 |
| TMC | 5704 |
| Bylaw Enforcement | 4729 |
| Right of Way (ROW) | 4494 |
| Forestry Operations | 4480 |
| Waste Enforcement | 2076 |
| Operations | 2031 |
| Traffic Ops | 1911 |
| Parks | 1547 |
| Tree Protection and Plan Review | 884 |
| Business Licensing Enforcement | 563 |
| Traffic Management | 563 |
| Business Operations Management | 512 |
| Parks Enforcement | 456 |
| Litter Operations | 242 |
| Traffic Safety | 134 |

## Top statuses

| status | count |
| --- | --- |
| Completed | 147188 |
| In Progress | 17105 |
| Cancelled | 15759 |
| New | 6156 |
| Closed | 2167 |
| Unknown | 2136 |

## Demo buckets

| demo_bucket | count |
| --- | --- |
| other | 92660 |
| potential_demo_low_priority | 67899 |
| potential_human_or_urgent | 29952 |

## Sample demo candidate records

| creation_date | status | first_3_chars_of_postal_code | intersection_street_1 | intersection_street_2 | ward | service_request_type | division | section | demo_bucket |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-01-01 00:27:38.0000000 | Completed | Intersection | Leslie St | Finch Ave E | Don Valley North (17) | Clean up Debris on Road | Transportation Services | Road Operations | potential_human_or_urgent |
| 2026-01-01 00:29:23.0000000 | Completed | M2N |  |  | Willowdale (18) | Sewer Service Line-Blocked | Toronto Water | District Ops | potential_human_or_urgent |
| 2026-01-01 00:32:12.0000000 | Closed | Intersection | Lawrence Ave E | Greencrest Crct | Scarborough-Guildwood (24) | Traffic Signal Repair | Transportation Services | TMC | potential_human_or_urgent |
| 2026-01-01 00:33:42.0000000 | Completed | M8Y |  |  | Etobicoke-Lakeshore (03) | Amplified or Musical Instrument Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
| 2026-01-01 00:34:02.0000000 | Completed | M6H |  |  | Davenport (09) | Residential Bin Lid Damaged | Solid Waste Management Services | Collections | potential_demo_low_priority |
| 2026-01-01 01:00:05.0000000 | Completed | M1P |  |  | Scarborough Centre (21) | Amplified or Musical Instrument Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
| 2026-01-01 01:06:16.0000000 | Completed | M6N |  |  | York South-Weston (05) | Animal Noise | Municipal Licensing & Standards | Toronto Animal Services | potential_demo_low_priority |
| 2026-01-01 01:23:36.0000000 | Completed | M9P |  |  | Etobicoke Centre (02) | Watermain-Possible Break | Toronto Water | District Ops | potential_human_or_urgent |
| 2026-01-01 01:27:56.0000000 | Completed | M4C |  |  | Beaches-East York (19) | Amplified or Musical Instrument Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
| 2026-01-01 01:29:11.0000000 | Completed | M5J |  |  | Spadina-Fort York (10) | Amplified or Musical Instrument Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
| 2026-01-01 01:35:28.0000000 | Completed | M4J |  |  | Toronto-Danforth (14) | Amplified or Musical Instrument Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
| 2026-01-01 01:36:46.0000000 | Completed | M1S |  |  | Scarborough North (23) | Unreasonable and Persistent Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
| 2026-01-01 01:37:01.0000000 | Completed | M4C |  |  | Beaches-East York (19) | Amplified or Musical Instrument Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
| 2026-01-01 01:40:04.0000000 | Completed | M6P |  |  | Parkdale-High Park (04) | Amplified or Musical Instrument Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
| 2026-01-01 02:11:25.0000000 | Completed | M9A |  |  | Etobicoke-Lakeshore (03) | Amplified or Musical Instrument Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
| 2026-01-01 02:12:24.0000000 | Completed | M1P |  |  | Scarborough Centre (21) | Unreasonable and Persistent Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
| 2026-01-01 02:13:59.0000000 | Completed | M2N |  |  | Willowdale (18) | Animal Noise | Municipal Licensing & Standards | Toronto Animal Services | potential_demo_low_priority |
| 2026-01-01 02:17:12.0000000 | Completed | M1P |  |  | Scarborough Centre (21) | Amplified or Musical Instrument Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
| 2026-01-01 02:30:03.0000000 | Completed | M6B |  |  | Eglinton-Lawrence (08) | Unreasonable and Persistent Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
| 2026-01-01 02:35:33.0000000 | Completed | M6B |  |  | Eglinton-Lawrence (08) | Unreasonable and Persistent Noise | Municipal Licensing & Standards | Bylaw Enforcement | potential_demo_low_priority |
