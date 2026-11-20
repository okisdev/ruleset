# Source

Every `.list` under `config/Surge/`, `config/Surge/Library/INDEX.md` and `catalog/services.json` are generated from this directory by `node scripts/build.mjs`; the other markdown files there are written by hand. Edit the source, run the build, and commit the source and its output together; `node scripts/build.mjs --check` fails when the two disagree.

## Lists

`lists.json` defines every rule set: its path under `config/Surge/`, its title, its header paragraphs, and its kind. The first header paragraph opens with the policy the list expects (`Expects DIRECT.`, `Expects a proxy policy, …`), and `Library/INDEX.md` reads the expected policy from it.

- A `policy` list is a set chosen by what the rules do rather than whose they are: reject sets, rescue patches, private names, certificate validation, NTP, carrier services, proxy utilities, banks, geographic ranges, process names. It owns all of its rules, in `blocks`.
- A `service` list takes its rules from the services that point at it. It may still own `blocks` of names whose operator is unknown; the build lists those names so they can be claimed.

A block is `{ "note"?, "rules" }`. The note is written as a comment above the rules and carries the reason a rule looks the way it does.

## Services

A service is one product: Douyin, WeChat, iCloud. It has an `id`, an English `name`, an optional `zh` display name, a `category`, its rules under `lists` keyed by list path, and optional `names` that identify it without routing it.

- A company with two or more services has a file named after its owner id, with an `owner` block and its services. A service whose `id` equals its owner's `id` holds the company's shared names.
- Every other service lives in the file of its category.
- `category` is one of `ai`, `cloud`, `developer`, `finance`, `gaming`, `lifestyle`, `music`, `news`, `platform`, `productivity`, `shopping`, `social`, `storage`, `video`.
- A list entry is an array of rules, or an array of blocks when a note is needed.
- In a list that several services feed, the build heads each service's rules with its name, so a note never repeats it.

## Identity

`catalog/services.json` gives each service the `DOMAIN` and `DOMAIN-SUFFIX` values of its rules plus its `names`. A domain belongs to one service only, and the build fails on a second claim. Consumers match a host against the longest domain that equals it or ends in `.` plus it.

- A name is claimed only when its operator is known. A CDN that serves many customers is claimed by the CDN, never by a guess at the customer.
- Address ranges, keywords and wildcards route but do not identify; cloud address space carries other companies' traffic.
- Put a product's own zone in the source whenever it has one. A consumer that keeps only registrable domains sees `163.com`, not `music.163.com`.
