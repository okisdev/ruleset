# Ruleset

Surge rule library for gateway profiles, and a catalog of who each domain belongs to.

Two first-party routing layers. The overlay handles tunnel transport, path faults, policy pins and false-positive repairs. The library groups services and categories by the policy they need in a Surge profile.

Both come from one source. Each service in [`source/`](source/README.md) names its rules and the lists they route through, so the rule sets and the [service catalog](catalog/README.md) cannot disagree. The catalog names the service, owner and category of a domain, independent of policy and rule order.

## Overlay

A rule earns a place here when it must precede general service classification:

- Tunnel transport. Tailnet address space and tunnel edge traffic need rules ahead of service classification.
- Path faults. Destinations that fail through one exit region and succeed through another need a specific policy.
- Pins. Apple push and iCloud content stay direct whatever policy the profile puts the company-wide Apple set on. A proxy policy reselection interrupts push, and the profile's QUIC block can break content transfers. The iCloud content guard prefers TCP because QUIC can transfer slowly without triggering a fallback.
- False positives to repair. Services that the reject layer kills. Each patch names the symptom.
- Categories with dedicated policies, including AI and Apple.

## Library

Service and category files under [`config/Surge/Library/`](config/Surge/Library/). Apple is direct by default with four named exceptions. Mainland services have company files; mainland addresses that no file names are handled by the `.cn` rule and `GEOIP,CN`. Named foreign services that need a specific kind of policy have their own file. Everything else falls through to `FINAL`, which is a proxy, so a foreign service gets a file only when its policy or matching differs from that.

## The one imported layer

The reject layer is imported from [ruleset.skk.moe](https://ruleset.skk.moe) on purpose. It is a hundred thousand tracker and advertising names maintained daily, and owning it would buy nothing. The profile places it after the overlay's repairs and before every service list, so a company suffix never shields its telemetry hosts. Suspected collateral goes on [`config/Surge/Rescue/WATCHLIST.md`](config/Surge/Rescue/WATCHLIST.md) first and into a repair file once a symptom is reproduced.

## What does not belong here

- Another project's rule dump, converted or vendored.
- Rewrite, MITM, and unlock scripts.
- Policy groups. A file says what kind of policy it expects, such as DIRECT, a proxy or a mainland policy, and the profile that references it binds that to its own groups. Group names differ from one profile to the next, so no file, document or snippet here names one.
- General settings. DNS, QUIC policy and MITM live in the profile. A `.list` file carries rules only.
- Anything a rule set cannot express. Logical rules and platform directives live inline in the profile; [`config/Surge/README.md`](config/Surge/README.md) lists them.

## Layout

```
source/                   the only hand-edited rules: lists and services
scripts/build.mjs         generates config/ and catalog/ from source/, --check verifies them
catalog/                  service, owner and category of each domain, client neutral
config/
└── Surge/
    ├── AI/               owned AI category, foreign and mainland
    ├── Apple/            push and content pinned direct, Intelligence to AI
    ├── GitHub/           every GitHub host on one proxy policy
    ├── Infrastructure/   tunnel transport
    ├── Registries/       official registries, distro archives, toolchains
    ├── Rescue/           false positive repairs, plus the watchlist
    ├── Tailscale/        tailnet space, coordination, and the direct domains
    └── Library/          first-party classification
```

`config/` is keyed by client, so a second client gets a sibling directory rather than a reshuffle. `catalog/` belongs to no client. Their rule sets, the library index and the catalog are generated: change [`source/`](source/README.md), run `node scripts/build.mjs`, and commit the source with its output.

Start with [`config/Surge/README.md`](config/Surge/README.md) for the order the files must be referenced in and the policy each kind of file expects.

## Consumer

A profile references these files by URL, in the documented order, and binds each one to a policy of its own. A change inside a file reaches every device on the next profile refresh without touching the profile; a new, moved or removed file, or a change to the policy a file expects, needs every profile that references it updated.
