# Ruleset

This repository publishes routing rules for Surge and mihomo, along with a service catalog that identifies domain owners. Both clients use the same source rules and profile order.

## Published rulesets

The base URL is `https://ruleset.harisfox.com/latest/`. It serves the ruleset from the most recent successful deployment of `main`.

Read `manifest.json` at the base URL. Its ordered `lists` array gives each list’s source path, title, expected policy, SNI flag and paths for both clients. Append the entry’s `surge` or `mihomo` path to the base URL, bind the policy to a profile group and reference the lists in array order. The first matching list wins.

| Artifact | Path relative to the base URL | Use |
| --- | --- | --- |
| Manifest | `manifest.json` | Discover policies and list order |
| Surge list | `surge/AI/AI.list` | Reference the list with `RULE-SET` and use `extended-matching` when `sni` is true |
| mihomo provider | `mihomo/AI/AI.yaml` | Configure a YAML rule provider with `behavior: classical` |
| Service catalog | `catalog/services.json` | Identify a service by its longest matching domain |
| Protected hosts | `protected.json` | Identify hosts that must remain reachable and the reasons they are protected |

## Routing layers

The overlay covers tunnel transport, path faults, Apple push and iCloud content pins, AI services, GitHub and registries. These lists take precedence over more general service rules. The library covers local traffic, reject rules, direct services, named platforms and address ranges. Profiles supply their own policy groups, inline transport guards, geographic fallback and final route. The Surge guide explains where those profile rules fit. [Surge profile guide](docs/surge.md) · [Library guide](docs/library.md)

The reject lists cover app telemetry, ad SDKs and HTTP DNS bypasses. Include a whole zone when its only purpose is advertising or analytics. Inside a company’s shared zone, include a specific host once its purpose has been confirmed on the gateway. Record functional hosts in the protected host list when narrowing a reject rule.

Domain ownership is independent of routing policy and order. The catalog identifies a service, its owner when applicable, and its category. [Service catalog](docs/catalog.md)

## Build

Edit the lists, services and protected hosts under `source/`. Run the build and tests from the repository root.

```sh
node scripts/build.mjs && node --test
```

The build writes both client targets, the catalog, protected hosts and the manifest under `dist/`. The Worker bundles these files as static assets. Git ignores the generated files. Run `node scripts/build.mjs --check` to verify an existing output tree. [Source format](source/README.md)
