---
format: agent-md
version: 0.1
title: Form Primitive Test
---

# Form Primitive Test

::form
title: Scenario form
description: Controls should render with the declared input types.
submitLabel: Save locally
fields:
  - name: scenario_name
    label: Scenario name
    type: text
    default: Base case
  - name: adoption_rate
    label: Adoption rate
    type: number
    default: 0.42
    min: 0
    max: 1
    step: 0.01
  - name: segment
    label: Segment
    type: select
    options: [SMB, Enterprise, Public Sector]
    default: Enterprise
  - name: include_risk
    label: Include risk adjustment
    type: checkbox
    default: true
  - name: review_date
    label: Review date
    type: date
    default: 2026-05-15
::
