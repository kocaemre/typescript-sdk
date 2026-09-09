---
'@modelcontextprotocol/server': patch
---

Avoid stacking `createMcpHandler` close callbacks when a factory accidentally reuses the same server instance across modern requests. The handler now installs at most one in-flight close wrapper per server, preventing an unbounded `onclose` chain while preserving the original close callback.
