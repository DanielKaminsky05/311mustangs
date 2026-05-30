# Solid Waste

## Overview

```json
{
  "source_file": "/Users/tlam/311mustangs/docs/data/solid-waste/pickup-schedule-2026.csv",
  "rows": 418,
  "columns": [
    "_id",
    "calendar",
    "weekstarting",
    "greenbin",
    "garbage",
    "recycling",
    "yardwaste",
    "christmastree",
    "weekstarting__parsed",
    "greenbin_bool",
    "garbage_bool",
    "recycling_bool",
    "yardwaste_bool",
    "christmastree_bool",
    "active_stream_count"
  ],
  "date_stats": {
    "weekstarting": {
      "valid": 418,
      "missing_or_invalid": 0,
      "min": "2026-01-02 00:00:00",
      "max": "2026-12-31 00:00:00"
    }
  },
  "has_exact_lat_lon": false,
  "location_granularity": "Calendar/zone code only, not address geometry. Requires caller zone lookup or scripted demo zone selection.",
  "demo_feasibility": {
    "missed_garbage_auto_resolution": "MEDIUM/HIGH - excellent deterministic schedule table if demo supplies Calendar/zone",
    "geospatial_matching": "LOW - no address/lat/lon in this file",
    "citizen_response": "HIGH - easy to explain next pickup date and stream eligibility"
  }
}
```

## Column profile

| column | dtype | non_null | null | null_pct | unique | example_values |
| --- | --- | --- | --- | --- | --- | --- |
| _id | int64 | 418 | 0 | 0.0 | 418 | 1 \| 2 \| 3 \| 4 \| 5 |
| calendar | str | 418 | 0 | 0.0 | 8 | Tuesday1 \| Tuesday2 \| Wednesday1 \| Wednesday2 \| Thursday1 |
| weekstarting | str | 418 | 0 | 0.0 | 209 | 01/06/26 \| 01/13/26 \| 01/20/26 \| 01/27/26 \| 02/03/26 |
| greenbin | str | 418 | 0 | 0.0 | 4 | T \| W \| R \| F |
| garbage | str | 418 | 0 | 0.0 | 5 | 0 \| T \| W \| R \| F |
| recycling | str | 418 | 0 | 0.0 | 5 | T \| 0 \| W \| R \| F |
| yardwaste | str | 418 | 0 | 0.0 | 5 | 0 \| T \| W \| R \| F |
| christmastree | str | 418 | 0 | 0.0 | 5 | 0 \| T \| W \| R \| F |
| weekstarting__parsed | datetime64[us] | 418 | 0 | 0.0 | 209 | 2026-01-06 00:00:00 \| 2026-01-13 00:00:00 \| 2026-01-20 00:00:00 \| 2026-01-27 00:00:00 \| 2026-02-03 00:00:00 |
| greenbin_bool | bool | 418 | 0 | 0.0 | 2 | True \| False |
| garbage_bool | bool | 418 | 0 | 0.0 | 2 | False \| True |
| recycling_bool | bool | 418 | 0 | 0.0 | 2 | True \| False |
| yardwaste_bool | bool | 418 | 0 | 0.0 | 2 | False \| True |
| christmastree_bool | bool | 418 | 0 | 0.0 | 2 | False \| True |
| active_stream_count | int64 | 418 | 0 | 0.0 | 3 | 2 \| 3 \| 0 |

## Top calendars

| calendar | count |
| --- | --- |
| Thursday1 | 53 |
| Thursday2 | 53 |
| Tuesday1 | 52 |
| Tuesday2 | 52 |
| Wednesday1 | 52 |
| Wednesday2 | 52 |
| Friday1 | 52 |
| Friday2 | 52 |

## greenbin collection flags

| greenbin | count |
| --- | --- |
| R | 106 |
| T | 104 |
| W | 104 |
| F | 104 |

## garbage collection flags

| garbage | count |
| --- | --- |
| 0 | 209 |
| R | 53 |
| T | 52 |
| W | 52 |
| F | 52 |

## recycling collection flags

| recycling | count |
| --- | --- |
| 0 | 209 |
| R | 53 |
| T | 52 |
| W | 52 |
| F | 52 |

## yardwaste collection flags

| yardwaste | count |
| --- | --- |
| 0 | 258 |
| T | 40 |
| W | 40 |
| R | 40 |
| F | 40 |

## christmastree collection flags

| christmastree | count |
| --- | --- |
| 0 | 402 |
| T | 4 |
| W | 4 |
| R | 4 |
| F | 4 |

## Sample schedule rows

| calendar | weekstarting | greenbin | garbage | recycling | yardwaste | christmastree | active_stream_count |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tuesday1 | 01/06/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 01/13/26 | T | T | 0 | 0 | T | 3 |
| Tuesday1 | 01/20/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 01/27/26 | T | T | 0 | 0 | T | 3 |
| Tuesday1 | 02/03/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 02/10/26 | T | T | 0 | 0 | 0 | 2 |
| Tuesday1 | 02/17/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 02/24/26 | T | T | 0 | 0 | 0 | 2 |
| Tuesday1 | 03/03/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 03/10/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 03/17/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 03/24/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 03/31/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 04/07/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 04/14/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 04/21/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 04/28/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 05/05/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 05/12/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 05/19/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 05/26/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 06/02/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 06/09/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 06/16/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 06/23/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 06/30/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 07/07/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 07/14/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 07/21/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 07/28/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 08/04/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 08/11/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 08/18/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 08/25/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 09/01/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 09/08/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 09/15/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 09/22/26 | T | T | 0 | T | 0 | 3 |
| Tuesday1 | 09/29/26 | T | 0 | T | 0 | 0 | 2 |
| Tuesday1 | 10/06/26 | T | T | 0 | T | 0 | 3 |
