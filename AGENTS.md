<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Supabase MCP (Cursor)

The repo includes `.cursor/mcp.json` wiring the official Supabase MCP server (`@supabase/mcp-server-supabase`, read-only). Set `SUPABASE_ACCESS_TOKEN` to a [Supabase personal access token](https://supabase.com/dashboard/account/tokens) in Cursor’s MCP server environment (or paste into the `env` block locally—do not commit secrets). Restart Cursor and confirm the server is active under Cursor Settings → MCP.
