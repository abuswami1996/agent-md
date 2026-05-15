---
format: agent-md
version: 0.1
title: Metric Primitive Test
---

# Metric Primitive Test

::metric
label: Total revenue
data: data/sales.csv
field: revenue
aggregate: sum
format: currency
delta: +18%
trend: up
description: Should aggregate five revenue rows and format as USD.
::

::metric
label: Segment count
data: data/sales.csv
field: segment
aggregate: count
description: Count aggregation should return the number of rows.
::
