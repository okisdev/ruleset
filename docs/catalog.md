# Service catalog

The build generates `dist/catalog/services.json` from the service definitions. The catalog identifies domain owners independently of routing policy and profile order. [Source format](../source/README.md#services)

Append `catalog/services.json` to the published base URL to retrieve the catalog. [Published rulesets](../README.md#published-rulesets)

- `owners` contains companies with two or more services. Each owner has an `id`, a `name` and an optional `zh`.
- `services` contains entries with an `id`, a `name`, an optional `zh`, an optional `owner`, a `category` and its `domains`.
- A host matches the longest catalog domain equal to the host or one of its label suffixes. A domain belongs to one service.
