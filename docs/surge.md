# Surge rule sets

Read `manifest.json` at the published base URL for the lists in profile order. Append each entry’s `surge` path to the base URL and set `extended-matching` on references marked `sni`. [Published rulesets](../README.md#published-rulesets)

## Policies

Each header opens with the kind of policy it expects. The profile binds that policy to one of its own groups.

- **DIRECT**, Surge's built-in direct path.
- **DIRECT or a proxy policy** allows either path.
- **A proxy policy**, any proxy or group that leaves the country.
- **A mainland policy**, the path for mainland services: DIRECT unless the profile routes mainland traffic elsewhere.
- **A reject policy**, REJECT or a group that can be switched off, so a false positive can be tested without editing the profile.
- **An AI policy**, a proxy whose exit region the AI providers serve.
- **A streaming policy** and **a gaming policy**, a proxy chosen for that service.

Files that expect DIRECT expect it literally: a bank or a pin on DIRECT must not move when the profile reroutes mainland traffic.

## Order of the profile

1. **Overlay.** Surge's built-in `SYSTEM` set, infrastructure, Tailscale, the transport guards, the iCloud content QUIC guard, the Apple pins, Apple Intelligence, the AI sets, the GitHub set, and the registries. It sits first so these rules win.
2. **Local.** Proxy cores and download clients by process name, private names, LAN.
3. **Reject.** The unresolvable names on REJECT, then the HTTP DNS, ads and telemetry sets on a reject policy that can be switched off, each with `extended-matching`. Every service list must follow this block.
4. **Direct services.** Certificate validation, NTP, carrier, Syncthing, downloads, the mainland CDN, then the four proxy-side utility sets (speedtest, public DoH, Safe Browsing, app backends).
5. **Apple.** Apple China, Apple TV and News, Private Relay, then the company floor `Platforms/Apple.list` on DIRECT.
6. **Microsoft.** The CDN, Xbox, then the company set, which works on DIRECT or a proxy policy.
7. **Social, media, gaming, developer, finance.** One file per service.
8. **Banks.** The proxied set, then the direct set; every bank takes one path by name.
9. **Company-wide sets** after the more specific files, `Platforms/China.list` last among them, then `DOMAIN-SUFFIX,cn`.
10. **Addresses.** The HTTP DNS service addresses on the reject policy, the Telegram prefixes, Alibaba's anycast space, `LAN`, `GEOIP,CN`, then `FINAL`.

## Apple

Apple is direct by default. `Platforms/Apple.list` carries every Apple name and Apple's own address space (17.0.0.0/8 and the three IPv6 blocks) and expects DIRECT. Four sets precede it because their policy differs: `Apple/AppleIntelligence.list` on an AI policy, `Media/AppleMedia.list` (TV and News) on a proxy policy, `Platforms/AppleChina.list` on a mainland policy, and `Direct/PrivateRelay.list`, which is DIRECT but exists on its own so the relay can be switched off by pointing it at `REJECT`. `Apple/ApplePush.list` and `Apple/iCloudContent.list` sit in the overlay as pins: they are DIRECT too, and they stay DIRECT whatever policy the profile gives the company floor. The address rules for Apple's space live in the floor and nowhere earlier, because an address rule matches a request that arrived as an address even when it carries an SNI, and 17.248.152.0/24 and 17.248.163.0/24 are shared by the content edges, the Private Relay ingress and the Intelligence relay.

iCloud content is held to TCP because direct QUIC can transfer slowly while its successful handshake prevents a fallback. A guard ahead of the pin answers UDP 443 to the content names with `REJECT-NO-DROP`, an immediate ICMP refusal that Surge never escalates to a silent drop, so the client retries over TCP and lands on the DIRECT pin. The guard matches names only, never the shared edge addresses: Apple's frontends can hand an established HTTP/3 connection a preferred address in those ranges, and refusing the migrated path kills the connection instead of triggering a TCP fallback.

## Banks

A bank ties a session to the address it sees, so each bank takes one path for its whole estate, decided by name. `Library/Bank/Direct.list` carries the mainland banks, UnionPay, ICBC Asia (which runs on its parent's mainland infrastructure) and Bank of China (Hong Kong) on DIRECT; `Library/Bank/Proxy.list` carries the Hong Kong and foreign banks, and AlipayHK, on a proxy policy. BOCHK is direct because a proxy provider can refuse `bochk.com` by name even when the bank accepts the exit and the direct path answers. The proxied set exists although `FINAL` is a proxy: mainland resolvers can hand Hong Kong bank edges mainland or Alibaba anycast addresses, which `GEOIP,CN` and `Geo/AlibabaCIDR.list` would send direct. A bank's second zones (a card or wealth app domain, a `.citic` host) are named as well, because a name the files miss reaches its path only through `DOMAIN-SUFFIX,cn` or `GEOIP,CN`.

## What cannot live in a rule set

**Logical rules.** Surge does not accept `AND`, `OR`, or `NOT` inside an external rule set. The transport guards stay inline in the profile:

```
AND,((PROTOCOL,UDP),(DEST-PORT,3478)),DIRECT     STUN, including Tailscale DERP
AND,((PROTOCOL,UDP),(DEST-PORT,19302)),DIRECT    Google STUN
AND,((PROTOCOL,UDP),(DEST-PORT,123)),DIRECT      NTP
AND,((PROTOCOL,UDP),(DEST-PORT,500)),DIRECT      IKE, Wi-Fi Calling
AND,((PROTOCOL,UDP),(DEST-PORT,4500)),DIRECT     IPsec NAT-T, Wi-Fi Calling
AND,((PROTOCOL,TCP),(DEST-PORT,22000)),DIRECT    Syncthing sync
AND,((PROTOCOL,TCP),(DEST-PORT,22067)),DIRECT    Syncthing relay
```

The iCloud content guard uses a rule set inside a logical rule so that the content names remain in one list. Replace `<list-url>` with the published base URL followed by `surge/Apple/iCloudContent.list`.

```
AND,((PROTOCOL,UDP),(DEST-PORT,443),(RULE-SET,<list-url>)),REJECT-NO-DROP
```

The port guards cover traffic that reaches a gateway without a name. Names in a profile's `always-real-ip` (NTP servers, carrier ePDG endpoints, STUN, console NAT probes) resolve on the device, so packets arrive as bare addresses and never match a name rule. HTTP/3 whose SNI the gateway cannot read arrives the same way. Where the destination owns a published range, an address rule in a list does the job (Apple and Alibaba's anycast space in `Library/Geo/AlibabaCIDR.list`); where it does not, only a port rule can.

**Platform directives.** `#!MACOS-ONLY` and `#!IOS-ONLY` are resolved by the profile generator before delivery. A rule set file has no way to express a platform split, which is why `Tailscale/Tailnet.list` is referenced twice with different policies.

**Device rules.** A console whose NAT traversal and unnamed downloads must stay direct needs a device rule in the profile; no list can name it. A gateway profile matches it by `DEVICE-NAME`, the name set in the gateway's device list, because DHCP hands the same address to other devices over time.

## Rule types that do work in a rule set

`DOMAIN`, `DOMAIN-SUFFIX`, `DOMAIN-KEYWORD`, `DOMAIN-WILDCARD`, `IP-CIDR`, `IP-CIDR6`, and `PROCESS-NAME`. IP rules carry `no-resolve` so a domain never gets resolved just to be matched by address. That keeps them away from requests that arrived as a name; a request that arrived as an address with an SNI is still matched by address, so an address rule must follow every named exception that could own that address.

`DOMAIN-SUFFIX` matches on label boundaries. A host that carries its region inside a label (`gspe19-cn-ssl.ls.apple.com`) needs `DOMAIN-WILDCARD`.

## Ordering rules that are easy to get wrong

- Overlay precedes library. A repair rule placed behind the classification it is repairing does nothing.
- Reject precedes every service list. A service list placed before the reject layer shields that company's telemetry hosts from it.
- The HTTP DNS, ads and telemetry references carry `extended-matching`. A client that dials an address and names the host only in its SNI otherwise passes the block unmatched and leaves through the address rules.
- `Reject/HttpDNSCIDR.list` follows every name rule, so a named request that lands on one of its addresses is classified by its name.
- The iCloud content QUIC guard precedes `Apple/iCloudContent.list`. Behind the pin it never sees a packet.
- `AI/AI.list` precedes `Platforms/Google.list`, so the `.google` AI products keep the AI exit; `Platforms/GoogleChina.list` precedes it too.
- The four Apple exceptions and `Proxy/SafeBrowsing.list` precede `Platforms/Apple.list`; the Microsoft CDN and Xbox precede `Platforms/Microsoft.list`; `Direct/Download.list` and `Direct/CDNChina.list` precede the company sets whose suffixes cover their hosts.
- `Library/Bank/Proxy.list` precedes `Library/Bank/Direct.list`, so `www.asia.ccb.com` and `hk.bankcomm.com` keep the proxy instead of matching their mainland parents' suffixes.
- `Library/Geo/LAN.list` does not carry `100.64.0.0/10`. That range belongs to `Tailscale/Tailnet.list`.

## Checking a change

`node scripts/build.mjs --check` verifies that every generated file matches the source, that no domain is claimed twice, and that no reject set matches a host in `source/protected.json`. It does not judge routing, so also check a change by replaying request log hosts through the old and new rule order. Compare which hosts change policy, what still lands on `FINAL`, and whether functional hosts meet the reject layer. Traffic arriving as a bare address appears without a host and, for QUIC on a proxy policy, can show `QUIC-BLOCK`.

## Triaging a page or app that does not load

Three failure shapes look alike and need different fixes. The request log names the rule that matched each connection, so start there.

**Blocked by a reject set.** A zero byte connection that closes immediately after the TCP connect, with a reject rule named in the log. Switch the reject policy to DIRECT; if the symptom clears within a second, narrow or remove the rule and add the host to `source/protected.json` with the symptom as its reason.

**Sent abroad by the catch all.** A domestic service that no domestic list carries and that `GEOIP,CN` misses reaches `FINAL` and is proxied into an origin that refuses foreign exits. The handshake completes, a few kilobytes pass, then the connection closes. Widen the domestic classification instead of patching the single host, so the next service in the same position is caught too.

**Arrives without a name.** Names in the profile's `always-real-ip`, and HTTP/3 whose SNI the gateway cannot read, reach the gateway as a bare address and fall to `FINAL`, where `block-quic` rejects QUIC on a proxy policy. The log shows an address without a host and, for QUIC, the policy `QUIC-BLOCK`. Fix with an address rule when the destination owns a published range, or an inline protocol and port rule in the profile when it does not.
