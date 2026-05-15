---
format: agent-md
version: 0.1
title: Query Primitive Test
---

# Query Primitive Test

::query
data: data/sales.csv
where:
  revenue:
    gte: 20000
select: [month, segment, revenue, users]
sort:
  by: revenue
  direction: desc
limit: 3
view: table
::

::query
data: data/sales.csv
where:
  segment: Enterprise
select: [month, revenue]
view: json
::
