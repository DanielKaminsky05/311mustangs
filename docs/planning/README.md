# Resolution Engine Planning Notes


## Context 

The 311 service is fundamentally bottlenecked by the fact that humans need to review a massive incoming stream of service requests and go through a bueraucratic process to be able to deploy actual operations to resolve this. This creates 2 problems:

1. human review is slow and bottlenecked 
2. operation decisions may not be optimal because the human may brainstorm locally optimal solutions but fail at a globally efficient solution that does not stall the city's daily normal operations (ie. road fix schedulings may sound coherent on its own but paralyze an entire traffic route)


This folder is a working dump of sanity-check feedback and implementation directions for the 311 Mustangs resolution engine concept.

The goal is to keep the idea space broad while separating concerns enough that each area can be iterated independently.

## Component notes

- [Frontend](./frontend.md) — mobile/user submission flow and operator dashboard feedback
- [Backend](./backend.md) — API, data model, scoring, scheduling, storage, and integration notes
- [Agent](./agent.md) — agent boundaries, tool-calling behavior, human approval model, and explanation layer
- [NVIDIA / DGX Spark](./nvidia.md) — DGX Spark story, NVIDIA ecosystem usage, and judging-aligned implementation directions
