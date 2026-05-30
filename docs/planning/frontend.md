# Frontend Planning Notes

## Main feedback

Keep the frontend intentionally thin. The project should not become a mobile-app build. The UI should demonstrate the resolution engine clearly and quickly.

Recommended frontend surfaces:

1. citizen submission view
2. operator dashboard
3. schedule/dispatch view
4. evidence/explanation panel

If time is tight, replace the mobile app with a responsive web form that looks like a mobile flow.

## Citizen submission flow

The user-facing view should simulate a 311 request submission.

Fields worth supporting:

- issue category
- free-text description
- address or lat/lon
- optional photo upload placeholder
- timestamp, ideally automatic
- contact/status preference placeholder

The output shown to the user should depend on triage result:

- known issue: “This has already been reported / work is underway.”
- duplicate: “We found a matching open request nearby and attached your report.”
- auto-scheduled: “This has been queued for city operations.”
- human review: “This requires operator review.”

Do not overbuild authentication, profiles, notifications, or native mobile functionality unless everything else is already done.

## Operator dashboard

This is more important than the citizen UI.

The operator dashboard should show:

- incoming requests
- triage decision
- priority/urgency score
- duplicate score
- known-issue/open-data match score
- schedule status
- human approval state
- evidence used by the engine

Useful request states:

```text
NEW
AUTO_RESOLVED
DUPLICATE
HUMAN_REVIEW
AUTO_SCHEDULED
APPROVED
REJECTED
DISPATCHED
```

## Evidence panel

This is critical for credibility.

For every decision, show why it happened:

- matched 311 historical/open request
- semantic similarity
- geographic distance
- matching dataset record
- active permit or known watermain break
- scheduler constraint or conflict
- confidence score

Example display:

```text
Decision: DUPLICATE
Reason:
- 0.91 semantic similarity to open request #1842
- 73 meters away
- same category: pothole
- original request still open
Action: attach to existing issue, do not dispatch new crew
```

## Schedule/dispatch view

The schedule view should show proposed operations, not just requests.

Useful columns:

- operation id
- crew
- category
- location
- scheduled start/end
- route order
- priority
- reason scheduled
- conflicts avoided
- approval status

A map is nice, but a table with route order is enough for MVP. If using a map, show markers and route lines only after the engine works.

## Demo scenarios to support

Build the UI around 3–4 scripted cases:

1. duplicate pothole request
2. known watermain/flooding issue
3. noise complaint with/without permit
4. low-priority graffiti/sign cleanup batched into optimized route

These scenarios are easier for judges to understand than generic random submissions.

## Frontend priorities

High priority:

- submit request
- show triage result
- show evidence
- show schedule queue
- approve/reject proposed operation

Medium priority:

- map visualization
- before/after FIFO vs optimized route comparison
- filtering by category/status

Low priority:

- real mobile app
- login/auth
- push notifications
- complex profile management
- full image analysis UI
