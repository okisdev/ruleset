# Ruleset

Surge rule library for gateway profiles, and a catalog of who each domain belongs to.

Two first-party routing layers. The overlay handles tunnel transport, path faults and policy pins. The library groups services and categories by the policy they need in a Surge profile.

Both come from one source. Each service in [`source/`](source/README.md) names its rules and the lists they route through, so the rule sets and the [service catalog](catalog/README.md) cannot disagree. The catalog names the service, owner and category of a domain, independent of policy and rule order.

## Overlay

A rule earns a place here when it must precede general service classification:

- Tunnel transport. Tailnet address space and tunnel edge traffic need rules ahead of service classification.
- Path faults. Destinations that fail through one exit region and succeed through another need a specific policy.
- Pins. Apple push and iCloud content stay direct whatever policy the profile puts the company-wide Apple set on. A proxy policy reselection interrupts push, and the profile's QUIC block can break content transfers. The iCloud content guard prefers TCP because QUIC can transfer slowly without triggering a fallback.
- Categories with dedicated policies, including AI and Apple.

## Library

Service and category files under [`config/Surge/Library/`](config/Surge/Library/). Apple is direct by default with four named exceptions. Mainland services have company files; mainland addresses that no file names are handled by the `.cn` rule and `GEOIP,CN`. Named foreign services that need a specific kind of policy have their own file. Everything else falls through to `FINAL`, which is a proxy, so a foreign service gets a file only when its policy or matching differs from that.

## Reject layer

Every rule is first party; no profile references another project's list. The reject sets under `Library/Reject/` block app telemetry, ad SDKs and HTTP DNS bypasses, not web advertising at large, which belongs to a browser content blocker. Two kinds of name enter them:

- A zone whose only purpose is serving or measuring ads or analytics is named whole, ahead of being seen.
- A host inside a company's own zone is named exactly, and only after the gateway has seen it and its purpose is known. A guess here breaks the app the zone belongs to.

[`source/protected.json`](source/protected.json) lists hosts an app needs, with the reason; the build fails when any reject set matches one. A suspected false positive is tested by switching the reject policy, fixed by narrowing the rule, and recorded there.

## What does not belong here

- Another project's rule dump, converted or vendored.
- Rewrite, MITM, and unlock scripts.
- Policy groups. A file says what kind of policy it expects, such as DIRECT, a proxy or a mainland policy, and the profile that references it binds that to its own groups. Group names differ from one profile to the next, so no file, document or snippet here names one.
- General settings. DNS, QUIC policy and MITM live in the profile. A `.list` file carries rules only.
- Anything a rule set cannot express. Logical rules and platform directives live inline in the profile; [`config/Surge/README.md`](config/Surge/README.md) lists them.

## Layout

```
source/                   the only hand-edited rules: lists, services and protected hosts
scripts/build.mjs         generates config/ and catalog/ from source/, --check verifies them
catalog/                  service, owner and category of each domain, client neutral
config/
└── Surge/
    ├── AI/               owned AI category, foreign and mainland
    ├── Apple/            push and content pinned direct, Intelligence to AI
    ├── GitHub/           every GitHub host on one proxy policy
    ├── Infrastructure/   tunnel transport
    ├── Registries/       official registries, distro archives, toolchains
    ├── Tailscale/        tailnet space, coordination, and the direct domains
    └── Library/          first-party classification
```

`config/` is keyed by client, so a second client gets a sibling directory rather than a reshuffle. `catalog/` belongs to no client. Their rule sets, the library index and the catalog are generated: change [`source/`](source/README.md), run `node scripts/build.mjs`, and commit the source with its output.

Start with [`config/Surge/README.md`](config/Surge/README.md) for the order the files must be referenced in and the policy each kind of file expects.

## Consumer

A profile references these files by URL, in the documented order, and binds each one to a policy of its own. A change inside a file reaches every device on the next profile refresh without touching the profile; a new, moved or removed file, or a change to the policy a file expects, needs every profile that references it updated.
