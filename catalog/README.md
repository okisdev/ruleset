# Service catalog

`services.json` says who a domain belongs to, independent of routing policy and rule order. It is generated from [`../source`](../source/README.md); do not edit it by hand.

```
https://raw.githubusercontent.com/okisdev/ruleset/main/catalog/services.json
```

- `owners`: companies with two or more services, each with an `id`, a `name` and an optional `zh`.
- `services`: each with an `id`, a `name`, an optional `zh`, an optional `owner`, a `category`, and its `domains`.
- A host matches the longest domain that equals it or ends in `.` plus it. A domain belongs to one service.
