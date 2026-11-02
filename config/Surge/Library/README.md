# Surge library

First-party classification for this network. The overlay in the sibling directories sits above it.

Each file names the kind of policy it expects, never a policy group; [`../README.md`](../README.md) defines the kinds. Every file is listed in [INDEX.md](INDEX.md), which is generated from the file headers.

## How to use it

1. Keep the overlay block first. Rescue, Tailscale, the Apple pins, the owned AI sets, and the GitHub set all have to win.
2. Reference the files from [INDEX.md](INDEX.md) in the documented order and bind each to a policy of the kind its header expects. Hang ads and HTTP DNS on a reject policy that can be switched off, not a hard REJECT, and keep the imported reject layer between Rescue and the service lists.
3. Apple is `Platforms/Apple.list` on DIRECT behind its four exceptions. Microsoft is `Platforms/MicrosoftCDN.list` DIRECT, `Gaming/Xbox.list`, then `Platforms/Microsoft.list` on DIRECT or a proxy policy. Official package registries are `Registries/Registries.list` in the overlay and precede `Developer/Npm.list`.
4. Mainland companies have their own files; mainland addresses that no file names are handled by the `.cn` rule and `GEOIP,CN`. Everything else falls through to `FINAL` on a proxy policy.

## What earns a file

A mainland service earns a file when it is in daily use here, so its policy is a decision rather than a GEOIP lookup. A foreign service earns a file only when its policy or matching differs from `FINAL`: a policy of its own kind (streaming, gaming, AI, either path for Microsoft), a direct path (downloads, registries), a region pin, or `extended-matching` for clients that arrive with a bare address and an SNI. A foreign service that would simply be proxied stays out; `FINAL` already does that.

Banks are named whichever way they go. A bank ties a session to the address it sees, and GEOIP splits a bank's estate between the direct path and the proxy, so `Bank/Direct.list` and `Bank/Proxy.list` give every bank one path by name.

## Layout

| Directory | What it holds |
| --- | --- |
| `Reject/` | Ads and HTTP DNS |
| `Direct/` | Private names, mainland CDN, downloads, certificate validation, NTP, carrier, Syncthing, Private Relay |
| `Proxy/` | Speedtest and public DoH resolvers |
| `Media/` | Streaming, split by service, plus Apple TV and News |
| `Social/` | Messengers and social networks |
| `Developer/` | Forges, clouds, design tools |
| `Gaming/` | Stores, publishers and consoles |
| `Finance/` | Payments and exchanges |
| `Bank/` | Banks, one path each: mainland banks and BOCHK direct, Hong Kong and foreign banks proxied |
| `Platforms/` | Company-wide sets. Place after the more specific files |
| `Geo/` | LAN, Telegram DC prefixes and Alibaba's anycast space |
| `Process/` | Download clients and proxy cores |

AI is not in this directory. That category is owned by `AI/AI.list` and `AI/AIChina.list` in the overlay.
