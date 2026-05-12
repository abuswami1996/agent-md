---
format: agent-md
version: 0.1
title: Revenue Command Center
owner: GTM Analytics
---

# Revenue Command Center

::callout
type: decision
title: Local-first executive dashboard
This dashboard intentionally uses only inline data blocks and project-local files. It demonstrates every Agent Markdown primitive in one document: metrics, charts, tables, diagrams, maps, timelines, tabs, callouts, embeds, forms, queries, and registered component fallback behavior.
:::

::tabs
default: Executive
variant: pill
::::tab
label: Executive

## Board Snapshot

::metric
label: Total ARR
data: revenue
field: arr
aggregate: sum
format: currency
delta: +18% YoY
trend: up
description: Sum of ARR across all monthly segment records.
:::

::metric
label: Active Customers
data: accounts
field: active
aggregate: sum
delta: +31
trend: up
description: Active account count across segments.
:::

::metric
label: Average NRR
data: revenue
field: nrr
aggregate: avg
format: percent
delta: +4 pts
trend: up
:::

::chart
type: line
title: ARR by month
description: Multi-series line chart using inline CSV data.
data: revenue
x: month
y: [arr, expansion, new_business]
legend: true
tooltip: true
height: 360
:::

::chart
type: pie
title: Revenue mix by segment
data: segment_mix
label: segment
value: arr
legend: true
tooltip: true
height: 320
:::

::callout
type: risk
title: Watch item
Enterprise growth is strong, but the West region now represents more than half of open pipeline. Regional concentration should be reviewed before the next forecast commit.
:::

::::
::::tab
label: Pipeline

## Pipeline Quality

::chart
type: bar
title: Pipeline value by stage
data: ../data/pipeline.csv
x: stage
y: value
xLabel: Stage
yLabel: Pipeline value
height: 320
:::

::chart
type: area
title: Accounts by stage
data: ../data/pipeline.csv
x: stage
y: accounts
height: 280
:::

::table
title: Pipeline table
data: ../data/pipeline.csv
columns: [stage, accounts, value, conversion, owner]
sortable: true
filterable: true
pagination: true
pageSize: 10
search: true
:::

::query
data: ../data/pipeline.csv
where:
  owner: Sales
select: [stage, accounts, value, conversion]
sort:
  by: value
  direction: desc
limit: 5
view: table
:::

::component
name: Funnel
props:
  data: ../data/pipeline.csv
  stage: stage
  value: accounts
  conversion: conversion
:::

::::
::::tab
label: Customers

## Customer Geography and Health

::map
title: Customer locations
data: ../data/customer-locations.csv
lat: latitude
lon: longitude
label: customer
value: arr
height: 420
center: [39.5, -98.35]
zoom: 4
:::

::map
title: Sales regions from GeoJSON
data: ../data/regions.geojson
height: 360
:::

::chart
type: scatter
title: Customer ARR vs health
data: ../data/customer-locations.csv
x: health
y: arr
xLabel: Health score
yLabel: ARR
height: 320
:::

::query
data: ../data/customer-locations.csv
where:
  arr:
    gte: 400000
select: [customer, segment, arr, health]
sort:
  by: arr
  direction: desc
view: cards
limit: 10
:::

::::
::::tab
label: Operations

## Operating Cadence

::diagram
type: flowchart
title: Agent Markdown feedback loop
src: ../diagrams/revenue-loop.mmd
direction: LR
height: 260
:::

::diagram
type: sequence
title: Weekly dashboard refresh
source: |
  sequenceDiagram
    participant Analyst
    participant Agent
    participant Validator
    participant Viewer
    Analyst->>Agent: Ask for dashboard update
    Agent->>Validator: agent-md validate
    Validator-->>Agent: diagnostics
    Agent->>Viewer: serve local dashboard
    Viewer-->>Analyst: interactive report
height: 320
:::

::timeline
layout: vertical
sort: asc
events:
  - date: 2026-01-05
    title: FY planning kickoff
    description: Board model and GTM assumptions loaded into local files.
    group: Planning
  - date: 2026-02-12
    title: Enterprise pipeline review
    description: High-value opportunities moved into commit review.
    group: Pipeline
  - date: 2026-03-20
    title: Regional expansion decision
    description: West and East coverage reviewed from local GeoJSON and account data.
    group: Strategy
  - date: 2026-04-10
    title: Dashboard packaged for agents
    description: Agent skill, examples, and validation workflow prepared.
    group: Enablement
:::

::form
title: Scenario inputs
description: Client-side-only controls for planning discussions. Values do not submit or mutate files.
submitLabel: Recalculate locally
fields:
  - name: growth_rate
    label: Growth rate
    type: number
    default: 0.18
    min: 0
    max: 1
    step: 0.01
  - name: segment
    label: Segment focus
    type: select
    options: [SMB, Mid-market, Enterprise, Strategic]
    default: Enterprise
  - name: include_risk
    label: Include risk adjustment
    type: checkbox
    default: true
  - name: review_date
    label: Review date
    type: date
    default: 2026-05-12
:::

::::
::::tab
label: Source Artifacts

## Local Artifacts

::embed
title: Executive summary artifact
src: ../artifacts/executive-summary.md
mode: preview
caption: Markdown artifact loaded from the local project.
height: 260
:::

::embed
title: Forecast assumptions artifact
src: ../artifacts/forecast.json
mode: preview
caption: JSON artifact rendered as a controlled local embed.
height: 260
:::

::table
title: Revenue source table
data: revenue
columns: [month, segment, arr, expansion, new_business, churn, nrr]
sortable: true
filterable: true
pagination: true
pageSize: 12
search: true
:::

::table
title: Account source table
data: accounts
columns: [segment, active, new, churned, health]
sortable: true
filterable: true
pagination: true
:::

::::
:::

## Inline Data Sources

```data revenue
month,segment,arr,expansion,new_business,churn,nrr
Jan,SMB,120000,18000,22000,6000,1.08
Jan,Mid-market,280000,36000,42000,9000,1.12
Jan,Enterprise,540000,92000,76000,18000,1.18
Jan,Strategic,680000,140000,85000,22000,1.21
Feb,SMB,128000,19000,24000,5000,1.09
Feb,Mid-market,305000,42000,48000,11000,1.13
Feb,Enterprise,585000,110000,88000,16000,1.21
Feb,Strategic,742000,155000,94000,24000,1.23
Mar,SMB,141000,23000,26000,7000,1.1
Mar,Mid-market,328000,46000,53000,10000,1.14
Mar,Enterprise,641000,128000,97000,19000,1.24
Mar,Strategic,811000,172000,108000,26000,1.26
Apr,SMB,154000,25000,28000,8000,1.11
Apr,Mid-market,351000,52000,58000,12000,1.16
Apr,Enterprise,706000,145000,106000,21000,1.27
Apr,Strategic,899000,193000,121000,27000,1.29
```

```json data=segment_mix
[
  {"segment": "SMB", "arr": 154000},
  {"segment": "Mid-market", "arr": 351000},
  {"segment": "Enterprise", "arr": 706000},
  {"segment": "Strategic", "arr": 899000}
]
```

```yaml data=accounts
- segment: SMB
  active: 124
  new: 18
  churned: 4
  health: 81
- segment: Mid-market
  active: 86
  new: 14
  churned: 3
  health: 84
- segment: Enterprise
  active: 42
  new: 9
  churned: 1
  health: 89
- segment: Strategic
  active: 19
  new: 4
  churned: 0
  health: 93
```
