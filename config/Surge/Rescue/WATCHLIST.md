# Watchlist

Hosts matched by the imported reject layer whose classification looks defensible but whose collateral effects need confirmation. Entries here do not add rules. Promote an entry into a `.list` file only after a symptom is reproduced, and record the symptom in the file header.

| Host | Matched as | Potential failure |
| --- | --- | --- |
| `tnc0-*.zijieapi.com` | ByteDance network configuration | Douyin and other ByteDance apps may fall back to built-in endpoints |
| `api.segment.io` | Analytics | Apps that block on their analytics client can hang at launch |
| `plausible.io` | Analytics | Visits to sites using Plausible go uncounted |
| `logcollection.ronghub.com` | RongCloud log collection | The messaging channel itself is on other hosts |
| `amdc.m.taobao.com`, `amdc.alipay.com` | Alibaba endpoint dispatch | Taobao and Alipay fall back to ordinary DNS and to addresses dialed without a name, among them anycast blocks `GEOIP,CN` misses; `Library/Geo/AlibabaCIDR.list` keeps those domestic, so the block remains under the policy in `Library/Reject/HttpDNS.list` despite a slower first request |
| `fourier.taobao.com`, `fourier.alibaba.com`, `sjarvis.taobao.com` | Alibaba client reporting, function unconfirmed | These hosts may be requested during Taobao startup beside the security hosts that `Alibaba.list` repairs; promote if Taobao still restricts the app with that repair active |
| `wxa.wxs.qq.com`, `sq.bls.mdt.qq.com` | WeChat mini program statistics | The messenger channel itself is on other hosts |
| `metrics.icloud.com`, `metrics-config.icloud.com` | iCloud device diagnostics | Apple lists them as diagnostics only |
| `mqtt.zhihu.com` | Push and telemetry channel | Zhihu notifications may stop arriving |
| `appsec-mobile.meituan.com` | Security SDK endpoint | Meituan risk control can fail closed and block checkout |
| `edith-seb.xiaohongshu.com` | Risk control endpoint | Xiaohongshu may refuse to load feeds or post |
| `switch.cup.com.cn` | UnionPay client switch, function unconfirmed | A missing switch response may disable a UnionPay feature or force payment fallback |

## How to triage a suspected false positive

1. Switch the policy the reject layer is hung on to DIRECT. If the symptom clears within a second, the reject layer is responsible. If it does not, check the request log for `reject-drop.conf` or `reject-no-drop.conf`: those two imported sets do not follow the group and reject regardless, and a match there needs the entry removed upstream or the profile line changed, because a Rescue file cannot outrank a pre-matching rule. Otherwise stop looking here.
2. Find which rule matched, by domain, in the request log. The record names the rule, so there is no guessing.
3. Confirm the failure shape before writing a patch. A local reject is a zero byte connection that closes immediately after the TCP connect. An origin reset includes the network round trip. A foreign origin refusing a foreign exit can complete a handshake without delivering data, which is a routing problem and belongs in a different file.
4. Add the narrowest rule that covers the symptom, and put the symptom in the header. A patch without a recorded symptom cannot be retired later.

## Two failure modes that look alike

Both surface as "this app or site does not load", and they need opposite fixes:

**Blocked by a reject set.** Zero bytes, closes immediately, and the request log names the reject rule. Fix by adding a pass rule ahead of the reject layer, which is what the files in this directory do.

**Sent abroad by the catch all.** A domestic service that no domestic list carries and that `GEOIP,CN` misses reaches `FINAL` and gets proxied into an origin that refuses foreign exits. The connection completes its handshake, carries a few kilobytes, and then closes. Fix by widening the domestic classification rather than by patching the single host, so the next service in the same position is caught too. To find them, count request log entries whose rule starts with `FINAL`; a domestic domain appearing there repeatedly is this failure mode.

## A third shape: arrives without a name

Traffic that reaches a gateway as a bare address never matches a name rule: names in the profile's `always-real-ip`, and HTTP/3 whose SNI the gateway cannot read. It falls to `FINAL` and, on a proxy policy, `block-quic` rejects QUIC. The request log shows an address without a host and, for QUIC, the policy `QUIC-BLOCK`. Fix with an address rule when the destination owns a published range (Apple), or an inline protocol and port rule in the profile when it does not (NTP, IKE, Syncthing, STUN).
