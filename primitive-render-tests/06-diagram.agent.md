---
format: agent-md
version: 0.1
title: Diagram Primitive Test
---

# Diagram Primitive Test

::diagram
type: flowchart
title: Inline flowchart
direction: LR
source: |
  A[Draft] --> B[Validate]
  B --> C[Convert]
  C --> D[Inspect]
height: 260
::

::diagram
type: sequence
title: Inline sequence
source: |
  sequenceDiagram
    participant User
    participant Agent
    participant Browser
    User->>Agent: request primitive test
    Agent->>Browser: inspect rendering
height: 300
::

::diagram
type: flowchart
title: External flowchart file
src: diagrams/external-flow.mmd
direction: LR
height: 260
::
