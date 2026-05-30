## Solution Proposal

Create a proof of concept demo solution with the following components:

- mobile app: represents the POV from the user that uses a 
- web dashboard: represents the POV from the 311 scheduling operator
- backend: a single scheduling backend + live queue of the scheduled 
- database(proof of concept SQLite): for storing/durable execution
- vector database: for storing vector embeddings for the embedding pipeline 
- inference machine: DGX Spark 

We create a full end to end solution from an agent augmented service request submission via the mobile app to globally optimal deployment scheduling.

When a service request is submitted:

1. the service form is vector embedded and goes through our custom ranking pipeline to determine the following. **Note that no LLMs opaque reasoning is used for ranking the priority of the calls and it is through our scoring engine built on embeddings**:
    1. priority classification: “How urgent is this issue? Will this require a human directly, or is it a minor issue?”
    2. Uniqueness & Similarity to existing issues (NNS + metadata filtering): Deduplicate issues - “has this issue been reported already, and does it require a trained and experienced human operator to make executive decisions?”

We are delivering a full comprehensive system that drives deployment and operation speed up by optimizing the slowness of a bureaucratic system only for low urgency and low priority items using AI agents as operations orchestrators. 

After “ranking”, the call either:
- Gets routed to a human operator to take over 
- Gets identified as an existing item that is already marked as in progress or registered in the system
- Gets marked as a low priority (significance) and low urgency item, which our system then takes into action and schedules directly in the system.

### Scheduling 

In classical scheduling, sequential operations (note that there can be multiple categories of sequential operations for each team) are scheduled. We model the workflow as a DAG, and connect relationships (time and geospatial metadata) to a multi layer network representing information/metadata related to said operation represented in the DAG as a single node.

- time: when the operation was scheduled for. This may be redundant because the DAG may already inherently represent that
- space: street categorical groupings, longitude and latitude (depends on frontend information)
- closeness in semantic meaning: how closely connected 

> NOTE: the agent does not traverse the graph directly; the agent calls a tool and the underlying graph engine uses this.

Key decision: Graph Query Language or pure SQLite for fast iteration speed and simplifity?

QUESTION: in addition to the graph, we require a grounded way to make sure that the agent plans properly and that this DAG is optimal. This cannot be a gimmick and requires fleshing out.

1. **for low priority decisions**: the agent starts asynchronously and the frontend dashboard receives incoming operations that the operator simply approves
2. **for high priority or important decisions**: the human is required to start and oversee the entire scheduling and planning process.

### Data Usage Proposal: QUESTION 

One of the main requirements is that the agent must be grounded in real data from the Toronto Open Data Portal.

After scraping 543 datasets, I have filtered out the below and put some suggestions on how to leverage the DGX Spark to its max for this system to maximize the potential grading for this judging criteria:

- 311 Service Requests - Customer Initiated: Use historical data to fine-tune your embedding model on what a "high priority" vs. "low priority" 311 call looks like.
- Watermain Breaks & Road Resurfacing Program: If a caller reports a flooded street, the agent checks the open data. If there is already a known watermain break at their coordinates, the agent informs the caller and drops the call from the queue entirely (saving operator time).
- Noise Exemption Permits: If a caller complains about construction noise at 2 AM, the agent checks this dataset. If the site has a permit, it auto-resolves the call. If not, it bumps the priority up for a bylaw officer.
- Utility Cut Permits: If the agent tries to schedule a graffiti cleanup crew, it checks this dataset to ensure they aren't sending a city vehicle into an active construction zone. 
- Solid Waste Collection Schedule: To auto-resolve "missed garbage" complaints based on the caller's zone.

I have 30 hours and 1 DGX Spark capable of running 200B quantized models.

