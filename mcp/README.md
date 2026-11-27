# FLUX by FlowFi (MCP server)

FLUX is FlowFi's market intelligence, available to any AI agent or MCP client as a remote MCP server.

- **Registry name:** `app.flowfiengine/flux` ([official MCP Registry](https://registry.modelcontextprotocol.io/v0/servers?search=app.flowfiengine/flux))
- **Endpoint:** `https://flowfiengine.app/api/mcp` (streamable HTTP)
- **Setup guide:** https://flowfiengine.app/flux/connect

## Tools

All tools are read-only.

| Tool | What it answers |
| --- | --- |
| `whats_moving` | The projects on FlowFi's LIVE map right now, ranked by capital flow in the last hour, with the Firewall's verdict on each. Free, 15 minutes delayed. |
| `check_project` | FlowFi's three checks on one Solana project by contract address: capital flow, social attention and security check, plus liquidity against market cap. |
| `results` | FlowFi's public track record, as the Results page shows it. |
| `early_radar` | Projects on the Early Radar before they reach the LIVE map, real-time. Paid: a FlowFi API key or $0.01 per call over x402. |

Every answer links to its proof on flowfiengine.app. Information only, not financial advice.

## Connect

Add the server to any MCP client that supports remote servers:

```json
{
  "mcpServers": {
    "flux": {
      "type": "http",
      "url": "https://flowfiengine.app/api/mcp"
    }
  }
}
```

Free: 10 answers a day. For code instead of a chat client, see the JavaScript SDK in [`../sdk/js`](../sdk/js).
