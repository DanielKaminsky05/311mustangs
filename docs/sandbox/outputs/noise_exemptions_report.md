# Noise Exemptions

## Overview

```json
{
  "source_file": "/Users/tlam/311mustangs/docs/data/noise-exemptions/Noise Exemption Permits - January 1 2024 to May 20 2025.csv",
  "rows": 2081,
  "columns": [
    "_id",
    "licence_number",
    "permit_type",
    "operating_name",
    "client_name",
    "address",
    "location_name",
    "ward",
    "issue_date",
    "expected_end_date",
    "actual_end_date",
    "public_conditions",
    "hours_of_operation",
    "issue_date__parsed",
    "expected_end_date__parsed",
    "actual_end_date__parsed",
    "has_address",
    "permit_window_days"
  ],
  "date_stats": {
    "issue_date": {
      "valid": 2081,
      "missing_or_invalid": 0,
      "min": "2023-12-20 00:00:00",
      "max": "2026-04-01 00:00:00"
    },
    "expected_end_date": {
      "valid": 2081,
      "missing_or_invalid": 0,
      "min": "2023-06-21 00:00:00",
      "max": "2026-05-01 00:00:00"
    },
    "actual_end_date": {
      "valid": 1942,
      "missing_or_invalid": 139,
      "min": "2023-06-22 00:00:00",
      "max": "2025-07-26 00:00:00"
    }
  },
  "has_exact_lat_lon": false,
  "location_granularity": "Street address only; geocoding needed for meter-level matching, but address/name matching is enough for scripted demo cases.",
  "demo_feasibility": {
    "noise_auto_resolution": "HIGH - permit type/address/date window directly supports evidence-backed auto-resolve",
    "bylaw_escalation_without_permit": "HIGH - negative lookup can escalate if no active permit matches",
    "scheduling_constraints": "MEDIUM - date window useful; hours_of_operation/public_conditions sparse must be checked"
  }
}
```

## Column profile

| column | dtype | non_null | null | null_pct | unique | example_values |
| --- | --- | --- | --- | --- | --- | --- |
| _id | int64 | 2081 | 0 | 0.0 | 2081 | 1 \| 2 \| 3 \| 4 \| 5 |
| licence_number | str | 2081 | 0 | 0.0 | 2081 | P455317138 \| P455343026 \| P455355217 \| P455363392 \| P455363904 |
| permit_type | str | 2081 | 0 | 0.0 | 14 | AMPLIFIED SOUND \| CONTINUOUS POUR AND/OR LARGE CRANE \| CONSTRUCTION \| OTHER SOUND \| CONTINUOUS POUR |
| operating_name | str | 2066 | 15 | 0.72 | 1714 | LEAFS AND RAPTORS PLAYOFFS- VIEWING PARTY \| 227 GERRARD ST E \| SCRIVENER SQUARE NOMINEE INC. (THE JAMES) \| SCRIVENER SQUARE NOMINEE INC (THE JAMES) \| ESPLANADE TRANSFORMER STATION |
| client_name | str | 1919 | 162 | 7.78 | 931 | MAPLE LEAF SPORTS & ENTERTAINMENT LTD \| CABEDGE DEVELOPMENTS INC \| SCRIVENER SQUARE NOMINEE INC \| MCNALLY CONSTRUCTION INC \| MATTAMY (BLOOR) LTD |
| address | str | 2081 | 0 | 0.0 | 956 |  BREMNER BLVD, TORONTO, ON H0H 0H0 \| 227 GERRARD ST E, TORONTO, ON M5A 2E9 \|  5 SCRIVENER SQ, TORONTO, ON M5S 2B7 \| 5 SCRIVENER SQ, TORONTO, ON M5S 2B7 \| 106 LOWER SHERBOURNE ST, TORONTO, ON M5A 2P4 |
| location_name | str | 688 | 1393 | 66.94 | 211 | WOODBINE BEACH PARK \| COLLEGE PARK \| SUNNYSIDE PARK \| ALLAN GARDENS \| OAKDALE PARK |
| ward | float64 | 1914 | 167 | 8.02 | 25 | 13.0 \| 11.0 \| 10.0 \| 4.0 \| 1.0 |
| issue_date | str | 2081 | 0 | 0.0 | 515 | 2024-04-24 \| 2024-01-01 \| 2024-01-10 \| 2024-02-01 \| 2023-12-20 |
| expected_end_date | str | 2081 | 0 | 0.0 | 502 | 2023-06-21 \| 2024-07-01 \| 2024-05-01 \| 2024-06-10 \| 2024-08-01 |
| actual_end_date | str | 1942 | 139 | 6.68 | 423 | 2023-06-22 \| 2024-07-02 \| 2024-05-02 \| 2024-06-11 \| 2024-08-02 |
| public_conditions | str | 139 | 1942 | 93.32 | 47 | Additional Location InformationToronto Island Park - Hanlan's Point under Condition.s and site address to include, LAKESHORE AVE #464. \| - Sound level emitted from any equipment shall not exceed a sound level of 85 dB(A) or 105 dB(C) when measured 20m from the source.- Where sound exceeds the levels specified above, the applicant shall comply with any request made by a Police Officer or Bylaw Enforcement Officer to ensure compliance - No equipment other than equipment approved under the exemption permit shall be used by the applicant.-6am to 7am general construction and delivery activities only including crane use to hoist materials, rebar and wall forms.  \| - Sound level emitted from any equipment shall not exceed a sound level of 85 dB(A) or 105 dB(C) when measured from the lot line of the property.- Where sound exceeds the levels specified above, the applicant shall comply with any request made by a Police Officer or Bylaw Enforcement Officer to ensure compliance - No equipment other than equipment approved under the exemption permit shall be used by the applicant.- Permit holder must comply with the submitted noise mitigation plan- Speakers positioned facing away from residential areas. \| - Sound level emitted from any equipment shall not exceed a sound level of 85 dB(A) or 105 dB(C) when measured from the lot line of the property.- Where sound exceeds the levels specified above, the applicant shall comply with any request made by a Police Officer or Bylaw Enforcement Officer to ensure compliance - No equipment other than equipment approved under the exemption permit shall be used by the applicant.-Noise Mitigation Plan: your event/activity must comply with the submitted noise mitigation plan \| - Sound level emitted from any equipment shall not exceed a sound level of 85 dB(A) or 105 dB(C) when measured from the lot line of the property.- Where sound exceeds the levels specified above, the applicant shall comply with any request made by a Police Officer or Bylaw Enforcement Officer to ensure compliance - No equipment other than equipment approved under the exemption permit shall be used by the applicant.* This exemption permit is ONLY valid in conjunction with the approved dates and times on a valid Parks Permit. |
| hours_of_operation | str | 983 | 1098 | 52.76 | 980 | HOURS OF OPERATION:June 27, July 12, July 13, 2024Set up: 7PM - 8PM           Event: 8PM - 10:30PM                           Tear down: 10:30PM - 10:45PM \| HOURS OF OPERATION:Setup: 03/08/2024, 8:00AM - 12:00PMEvent: 03/08/2024, 1:00PM - 9:00PMTeardown: 03/08/2024, 9:00PM - 11:00PM \| HOURS OF OPERATION:SET UP: AUGUST 29 2024 4PM-6PM    EVENT: AUGUST 29 2024 6PM-10PMTEAR DOWN:AUGUST 29 2024 10PM-10:30PM \| HOURS OF OPERATION:Aug 1 2024 to Aug 31 20246am to 11pm \| HOURS OF OPERATION:PARTY DETAILS:SET UP: 01/08/2024 - FROM 6PM TO 9PMEVENT: 03/08/2024 - 7PM TO 12AM AND 05/08/2024 - 5PM TO 12AMTEAR DOWN: 06/08/2024 - FROM 12PM TP 2PM |
| issue_date__parsed | datetime64[us] | 2081 | 0 | 0.0 | 515 | 2024-04-24 00:00:00 \| 2024-01-01 00:00:00 \| 2024-01-10 00:00:00 \| 2024-02-01 00:00:00 \| 2023-12-20 00:00:00 |
| expected_end_date__parsed | datetime64[us] | 2081 | 0 | 0.0 | 502 | 2023-06-21 00:00:00 \| 2024-07-01 00:00:00 \| 2024-05-01 00:00:00 \| 2024-06-10 00:00:00 \| 2024-08-01 00:00:00 |
| actual_end_date__parsed | datetime64[us] | 1942 | 139 | 6.68 | 423 | 2023-06-22 00:00:00 \| 2024-07-02 00:00:00 \| 2024-05-02 00:00:00 \| 2024-06-11 00:00:00 \| 2024-08-02 00:00:00 |
| has_address | bool | 2081 | 0 | 0.0 | 1 | True |
| permit_window_days | int64 | 2081 | 0 | 0.0 | 207 | -308 \| 182 \| 121 \| 152 \| 588 |

## Top permit types

| permit_type | count |
| --- | --- |
| AMPLIFIED SOUND | 969 |
| AMPLIFIED SOUND (LEVEL 1) | 283 |
| CONSTRUCTION | 176 |
| AMPLIFIED SOUND (LEVEL 3) | 151 |
| CONTINUOUS POUR AND/OR LARGE CRANE | 139 |
| CONTINUOUS POUR | 104 |
| AMPLIFIED SOUND (LEVEL 2) | 80 |
| CONSTRUCTION (LEVEL 3) | 79 |
| LARGE CRANE | 53 |
| CONSTRUCTION (LEVEL 1) | 22 |
| CONSTRUCTION (LEVEL 2) | 19 |
| OTHER SOUND | 3 |
| OTHER SOUND (LEVEL 2) | 2 |
| OTHER SOUND (LEVEL 1) | 1 |

## Top wards

| ward | count |
| --- | --- |
| 10.0 | 360 |
| 11.0 | 217 |
| 13.0 | 177 |
| <NULL> | 167 |
| 12.0 | 117 |
| 19.0 | 107 |
| 15.0 | 85 |
| 18.0 | 79 |
| 4.0 | 78 |
| 9.0 | 73 |
| 3.0 | 73 |
| 14.0 | 63 |
| 21.0 | 56 |
| 6.0 | 55 |
| 8.0 | 43 |
| 24.0 | 43 |
| 2.0 | 42 |
| 17.0 | 36 |
| 23.0 | 36 |
| 7.0 | 32 |
| 1.0 | 29 |
| 16.0 | 26 |
| 25.0 | 25 |
| 5.0 | 23 |
| 20.0 | 23 |
| 22.0 | 16 |

## Rows with address

| has_address | count |
| --- | --- |
| True | 2081 |

## Top operating names

| operating_name | count |
| --- | --- |
| <NULL> | 15 |
| 1 BLOOR ST W | 9 |
| 235 BALLIOL ST | 8 |
| PRIDE FESTIVAL 2024 | 8 |
| MOVIE NIGHT | 8 |
| MOVIE NIGHT IN THE PARK | 7 |
| 155 BALMORAL AVE | 7 |
| WEDDING | 7 |
| SUMMER MUSIC IN THE PARK | 7 |
| FORMA | 6 |
| 4800 YONGE ST | 6 |
| 30 MERTON ST | 6 |
| MOVIE IN THE PARK | 6 |
| BRETTON PLACE TOWER | 5 |
| BEACHES INTERNATIONAL JAZZ FESTIVAL | 5 |
| 240 MARKLAND DR | 5 |
| EID PRAYER | 5 |
| 5251 DUNDAS ST W | 4 |
| COMMUNITY MOVIE NIGHT | 4 |
| ICE CREAM IN THE PARK | 4 |

## Sample permit demo candidates

| licence_number | permit_type | operating_name | client_name | address | ward | issue_date | expected_end_date | actual_end_date | hours_of_operation | public_conditions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P455317138 | AMPLIFIED SOUND | LEAFS AND RAPTORS PLAYOFFS- VIEWING PARTY | MAPLE LEAF SPORTS & ENTERTAINMENT LTD |  BREMNER BLVD, TORONTO, ON H0H 0H0 | nan | 2024-04-24 | 2023-06-21 | 2023-06-22 | nan | nan |
| P455343026 | CONTINUOUS POUR AND/OR LARGE CRANE | 227 GERRARD ST E | CABEDGE DEVELOPMENTS INC | 227 GERRARD ST E, TORONTO, ON M5A 2E9 | 13.0 | 2024-01-01 | 2024-07-01 | 2024-07-02 | nan | nan |
| P455355217 | CONTINUOUS POUR AND/OR LARGE CRANE | SCRIVENER SQUARE NOMINEE INC. (THE JAMES) | SCRIVENER SQUARE NOMINEE INC |  5 SCRIVENER SQ, TORONTO, ON M5S 2B7 | 11.0 | 2024-01-01 | 2024-07-01 | 2024-07-02 | nan | nan |
| P455363392 | CONSTRUCTION | SCRIVENER SQUARE NOMINEE INC (THE JAMES) | SCRIVENER SQUARE NOMINEE INC | 5 SCRIVENER SQ, TORONTO, ON M5S 2B7 | 11.0 | 2024-01-01 | 2024-05-01 | 2024-05-02 | nan | nan |
| P455363904 | CONSTRUCTION | ESPLANADE TRANSFORMER STATION | MCNALLY CONSTRUCTION INC | 106 LOWER SHERBOURNE ST, TORONTO, ON M5A 2P4 | 10.0 | 2024-01-10 | 2024-06-10 | 2024-06-11 | nan | nan |
| P455371409 | CONTINUOUS POUR AND/OR LARGE CRANE | 1660 BLOOR ST WEST | MATTAMY (BLOOR) LTD | 1660 BLOOR ST W, TORONTO, ON M6P 1A8 | 4.0 | 2024-02-01 | 2024-08-01 | 2024-08-02 | nan | nan |
| P455373016 | CONSTRUCTION | RICHGROVE PHASE III | MINTO COMMUNITIES INC | 610 MARTIN GROVE RD, TORONTO, ON M9R 0A4 | 1.0 | 2023-12-20 | 2025-07-30 | nan | nan | nan |
| P455373022 | AMPLIFIED SOUND | RECORD BREAKER COLD PLUNGE OF JACK.ORG | UNBOUNDED | 1675 LAKE SHORE BLVD E, TORONTO, ON M4L 3W6 | 19.0 | 2024-01-01 | 2024-01-02 | 2024-01-03 | nan | nan |
| P455373196 | CONSTRUCTION | ONE DELISLE | MULTIPLEX CONSTRUCTION CANADA LTD | 1 DELISLE AVE, TORONTO, ON M4V 3C7 | 12.0 | 2024-01-05 | 2024-04-05 | 2024-04-06 | nan | nan |
| P455373358 | AMPLIFIED SOUND | NHL ALLSTAR LEAFS OUTDOOR PRACTICE | MAPLE LEAF SPORTS & ENTERTAINMENT LTD | 100 QUEEN ST W, MAIN, TORONTO, ON M5H 2N1 | 10.0 | 2024-01-28 | 2024-02-14 | 2024-02-15 | nan | nan |
| P455373370 | CONSTRUCTION | TOWER CRANE RASIE AT 1 BLOOR ST W | MIZRAHI DEVELOPMENTS | 1 BLOOR ST W, TORONTO, ON M4W 1A3 | 11.0 | 2024-01-12 | 2024-02-07 | 2024-02-08 | nan | nan |
| P455373803 | AMPLIFIED SOUND | FREE FITNESS CLASSES IN ST JAMES PARK | ST LAWRENCE MARKET BUSINESS IMPROVEMENT AREA | 120 KING ST E, TORONTO, ON M5C 1G6 | 13.0 | 2024-07-02 | 2024-08-28 | 2024-08-29 | nan | nan |
| P455373918 | CONSTRUCTION | SHORING, EXCAVATION AND FORMING ACTIVITIES AT 30 MERTON ST | SKYGRID CONSTRUCTION INC | 30 MERTON ST, TORONTO, ON M4S 1A1 | 12.0 | 2024-01-06 | 2024-04-07 | 2024-04-08 | nan | nan |
| P455376389 | CONSTRUCTION | 1040 DUFFERIN ST - BELL CANADA | AMHEREST CRANE RENTALS LTD | 1040 DUFFERIN ST, TORONTO, ON M6H 4B6 | 9.0 | 2024-01-06 | 2024-01-07 | 2024-01-08 | nan | nan |
| P455379380 | AMPLIFIED SOUND | SKATES AND SOUNDS | DOWNTOWN YONGE BUSINESS IMPROVEMENT AREA | 420 YONGE ST, TORONTO, ON H0H 0H0 | 11.0 | 2024-02-02 | 2024-02-24 | 2024-02-25 | nan | nan |
| P455380626 | CONTINUOUS POUR AND/OR LARGE CRANE | CONCRETE POURS AT 23 SPADINA AVE | RELIANCE CONSTRUCTION TORONTO INC | 23 SPADINA AVE, TORONTO, ON M5V 3M5 | 10.0 | 2024-01-02 | 2024-04-13 | 2024-04-14 | nan | nan |
| P455400197 | CONTINUOUS POUR AND/OR LARGE CRANE | 980 DUFFERIN ST | BLOOR DUFFERIN CONSTRUCTION MANAGEMENT INC | 980 DUFFERIN ST, TORONTO, ON M6H 4B4 | 9.0 | 2024-02-22 | 2024-07-01 | 2024-07-02 | nan | nan |
| P455400304 | AMPLIFIED SOUND | ST PATRICK'S PARADE TORONTO | ST PATRICK'S PARADE SOCIETY OF TORONTO |  BLOOR/YONGE, TORONTO, ON H0H 0H0 | nan | 2024-03-17 | 2024-03-18 | 2024-03-19 | nan | nan |
| P455400318 | CONTINUOUS POUR AND/OR LARGE CRANE | DEVELOPMENT ON THE LANDS NORTH OF DANFORTH GO STATION | 6 DAWES CONSTRUCTION MANAGEMENT INC | 6 DAWES RD, TORONTO, ON M4C 5A7 | 19.0 | 2024-01-05 | 2024-06-08 | 2024-06-09 | nan | nan |
| P455356027 | AMPLIFIED SOUND | 2023 TORONTO CHINATOWN LUNAR NEW YEAR CELEBRATIONS | CHINATOWN BUSINESS IMPROVEMENT AREA | 222 SPADINA AVE, TORONTO, ON M5T 3B3 | 10.0 | 2024-01-20 | 2024-02-12 | 2024-02-13 | nan | nan |
| P455370689 | CONTINUOUS POUR AND/OR LARGE CRANE | FORMA | GG DUCAN INC | 266-270 KING ST W, TORONTO, ON M5V 1H8 | 10.0 | 2024-01-05 | 2024-02-14 | 2024-02-15 | nan | nan |
| P455371508 | AMPLIFIED SOUND | MPP RAKOCEVIC SKATING PARTY | MPP TOM RAKOCEVIC | 65 MARY CHAPMAN BLVD, TORONTO, ON M9M 0B7 | 7.0 | 2024-01-07 | 2024-01-08 | 2024-01-09 | nan | nan |
| P455371672 | AMPLIFIED SOUND | POLAR BEAR DIP | BOOST CHILD & YOUTH ADVOCACY CENTRE | 1755 LAKE SHORE BLVD W, TORONTO, ON M6S 5A3 | 4.0 | 2024-01-01 | 2024-01-02 | 2024-01-03 | nan | nan |
| P455371804 | CONSTRUCTION | CONCORD CANADA HOUSE | RELIANCE CONSTRUCTION TORONTO INC | 23 SPADINA AVE, TORONTO, ON M5V 3M5 | 10.0 | 2024-01-04 | 2024-06-30 | 2024-07-01 | nan | nan |
| P455372273 | AMPLIFIED SOUND | SISTERS IN SPIRIT VIGIL | NATIVE WOMEN'S RESOURCE CENTRE OF TORONTO | 160 GERRARD ST E, TORONTO, ON M5A 2E5 | 13.0 | 2024-10-04 | 2024-10-05 | 2024-10-06 | nan | nan |
