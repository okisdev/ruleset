# mihomo rule providers

mihomo and OpenClash use the same lists and the same profile order as Surge. Read `manifest.json` at the published base URL, then declare one provider per entry and reference the entries in array order. [Published rulesets](../README.md#published-rulesets) · [Order of the profile](surge.md#order-of-the-profile)

## Providers

Each provider is a classical YAML file. Name it after the entry's source path so a rule names the list it uses.

```yaml
rule-providers:
  Library/Reject/Telemetry.list:
    type: http
    behavior: classical
    format: yaml
    url: https://ruleset.harisfox.com/latest/mihomo/Library/Reject/Telemetry.yaml
    path: ./rule_provider/ruleset/Library/Reject/Telemetry.yaml
    interval: 86400

rules:
  - RULE-SET,Library/Reject/Telemetry.list,AdBlock
```

Later starts read the cached file under `path` until `interval` expires.

## Translating the Surge profile

Bind each list to a group of the kind its header expects, as in the [policy definitions](surge.md#policies). The profile's inline rules translate as follows.

| Surge | mihomo |
| --- | --- |
| `RULE-SET,<url>,Group,extended-matching` | `RULE-SET,<provider>,Group`, with the sniffer enabled and `override-destination` on so a connection that arrives as an address matches by its SNI |
| `AND,((PROTOCOL,UDP),(DEST-PORT,123)),DIRECT` | `AND,((NETWORK,UDP),(DST-PORT,123)),DIRECT` |
| `AND,((PROTOCOL,UDP),(DEST-PORT,443),(RULE-SET,<url>)),REJECT-NO-DROP` | `AND,((NETWORK,UDP),(DST-PORT,443),(RULE-SET,<provider>)),REJECT` |
| `RULE-SET,SYSTEM,DIRECT` | Omit; mihomo has no built-in system set |
| `RULE-SET,LAN,DIRECT` | Omit; `Library/Geo/LAN.list` already carries the private ranges |
| `FINAL,Others,dns-failed` | `MATCH,Others` |

A gateway takes the macOS branch of a `#!MACOS-ONLY` and `#!IOS-ONLY` pair, because it routes for the whole network rather than for one device.

## What differs from Surge

mihomo rejects a configuration whose rule names a group that does not exist, so every group the profile binds must be present before the rules are applied. Map a missing group to an existing group of the same policy kind instead of dropping the rule; a dropped rule moves its hosts to a later list or to `MATCH`.
