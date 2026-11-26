# Source

Edit routing lists, service identities and protected hosts in this directory. Run `node scripts/build.mjs && node --test` from the repository root to validate the source and produce the Surge and mihomo targets under `dist/`. Git ignores the generated files.

## Lists

The array in `lists.json` defines profile order. Each entry has a relative `.list` path, a title, a kind, a policy and an array of header paragraphs. Set `sni` to `true` when the list needs matching on the TLS server name. It defaults to `false` in the manifest.

Choose a policy from `direct`, `direct-or-proxy`, `proxy`, `mainland`, `reject`, `ai`, `streaming` or `gaming`. The build writes the opening “Expects” sentence from this value. An optional `policySuffix` qualifies the policy phrase before its period, including the joining space or comma. An optional `intro` continues the opening paragraph after that sentence. The `header` array holds the subsequent paragraphs.

A list of kind `policy` owns all its rules in `blocks`. This includes reject sets, certificate validation, geographic ranges and process names. A list of kind `service` draws rules from the services that reference its path. It may also own blocks for names whose operator is unknown. The build reports unclaimed names.

A block has a `rules` array and an optional `note` that explains the rules. The build emits service blocks in source file order, followed by the list’s own blocks. When multiple services contribute, their names appear above their blocks.

## Services

A service represents one product. It has an `id`, an English `name`, an optional Chinese display name in `zh`, a `category`, and optional `lists` and `names`. Each key in `lists` names a list path and contains an array of rules or blocks. Use `names` for domains that identify the service independently of routing.

A company with at least two services has a file named after its owner ID. The file contains the `owner` and its `services`. A service whose ID equals the owner ID holds the company’s shared names. Other services live in the file for their category. The categories are `ai`, `cloud`, `developer`, `finance`, `gaming`, `lifestyle`, `music`, `news`, `platform`, `productivity`, `shopping`, `social`, `storage` and `video`.

Each service claims its `DOMAIN` and `DOMAIN-SUFFIX` values plus any explicit `names`. A domain has one owner in the catalog. Consumers use the longest matching domain on a label boundary. Claim a shared CDN under its operator and use a product’s own zone when known. Address ranges, keywords, wildcards and process names affect routing only. [Catalog format](../docs/catalog.md)

## Protected hosts

Each entry in `protected.json` records a `host`, the functional reason to protect it, and optionally a `list` that must match it. Validation fails if any reject list matches the host or if its specified list misses it. Record the symptom as the `reason` when narrowing a rule after a false positive.

## Build outputs

For each source path, the build emits a Surge list under `dist/surge/` and a classical YAML provider under `dist/mihomo/`. Both retain rule order and address options. The build also emits `dist/catalog/services.json` and copies `protected.json` verbatim.

`dist/manifest.json` lists both client paths in profile order. Resolve each path against the published base URL. [Published rulesets](../README.md#published-rulesets)
