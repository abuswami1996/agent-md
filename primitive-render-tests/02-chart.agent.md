---
format: agent-md
version: 0.1
title: Chart Primitive Test
---

# Chart Primitive Test

::chart
type: line
title: Revenue and users by month
description: Multi-series line chart should show axes, legend, and two series.
data: data/sales.csv
x: month
y: [revenue, users]
legend: true
tooltip: true
height: 320
::

::chart
type: bar
title: Users by month
data: data/sales.csv
x: month
y: users
height: 260
::

::chart
type: area
title: Revenue area
data: data/sales.csv
x: month
y: revenue
height: 260
::

::chart
type: scatter
title: Users vs revenue
data: data/sales.csv
x: users
y: revenue
height: 260
::

::chart
type: pie
title: Revenue pie by month
data: data/sales.csv
label: month
value: revenue
height: 260
::
