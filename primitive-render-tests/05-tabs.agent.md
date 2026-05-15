---
format: agent-md
version: 0.1
title: Tabs Primitive Test
---

# Tabs Primitive Test

::tabs
default: Second
variant: pill
:::tab
label: First

## First Tab

This is the first tab body.

::metric
label: First tab revenue
data: data/sales.csv
field: revenue
aggregate: avg
format: currency
::

:::
:::tab
label: Second

## Second Tab

This tab should be selected by default.

::table
title: Nested table
data: data/sales.csv
columns: [month, revenue]
pageSize: 2
::

:::
::
