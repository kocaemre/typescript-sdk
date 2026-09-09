/**
 * Regression coverage for factories that accidentally reuse the same Server
 * instance across modern HTTP requests: the handler must not wrap `onclose`
 * once per request, or shutdown grows a recursive close chain.
 */
import { CLIENT_CAPABILITIES_META_KEY, CLIENT_INFO_META_KEY, PROTOCOL_VERSION_META_KEY } from '@modelcontextprotocol/core-internal';
import { describe, expect, it } from 'vitest';
import * as z from 'zod/v4';

import { createMcpHandler } from '../../src/server/createMcpHandler';
import { McpServer } from '../../src/server/mcp';

const MODERN_REVISION = '2026-07-28';

function listToolsRequest(id: number): Request {
    return new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'MCP-Protocol-Version': MODERN_REVISION,
            'Mcp-Method': 'tools/list'
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id,
            method: 'tools/list',
            params: {
                _meta: {
                    [PROTOCOL_VERSION_META_KEY]: MODERN_REVISION,
                    [CLIENT_INFO_META_KEY]: { name: 'shared-server-test-client', version: '1.0.0' },
                    [CLIENT_CAPABILITIES_META_KEY]: {}
                }
            }
        })
    });
}

describe('createMcpHandler with a reused server instance', () => {
    it('does not stack a new onclose wrapper for every request', async () => {
        const sharedServer = new McpServer({ name: 'shared-server-test', version: '1.0.0' });
        sharedServer.registerTool('echo', { inputSchema: z.object({ text: z.string() }) }, async ({ text }) => ({
            content: [{ type: 'text', text }]
        }));
        const handler = createMcpHandler(() => sharedServer);

        const first = await handler.fetch(listToolsRequest(1));
        expect(first.status).toBe(200);
        await first.text();

        const oncloseAfterFirstRequest = sharedServer.server.onclose;
        expect(oncloseAfterFirstRequest).toBeTypeOf('function');

        const second = await handler.fetch(listToolsRequest(2));
        expect(second.status).toBe(200);
        await second.text();

        expect(sharedServer.server.onclose).toBe(oncloseAfterFirstRequest);

        await handler.close();
    });
});
