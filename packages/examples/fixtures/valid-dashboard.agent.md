---
format: agent-md
version: 0.1
---
# Q4 Revenue Dashboard

::callout
type: decision
title: Local-only MVP
This dashboard uses only local inline data and local files.
:::

::metric
label: Total revenue
data: revenue
field: amount
aggregate: sum
format: currency
:::

::chart
type: line
title: Revenue by month
data: revenue
x: month
y: amount
:::

::table
data: revenue
columns: [month, segment, amount]
sortable: true
filterable: true
:::

```data revenue
month,segment,amount
Oct,SMB,100000
Oct,Enterprise,400000
Nov,SMB,120000
Nov,Enterprise,450000
Dec,SMB,140000
Dec,Enterprise,550000
```
