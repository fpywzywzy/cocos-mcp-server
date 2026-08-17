"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerTools = void 0;
class ServerTools {
    getTools() {
        return [
            // 1. Server Information Management - Basic server info
            {
                name: 'server_information',
                description: 'SERVER INFORMATION: Get Cocos Creator editor server network details and status. USAGE: Essential for network configuration, debugging connection issues, and understanding server setup. Use "get_ip_list" to see available network interfaces, "get_port" for current server port.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['get_ip_list', 'get_sorted_ip_list', 'get_port', 'get_comprehensive_status'],
                            description: 'Information query: "get_ip_list" = all available network IP addresses | "get_sorted_ip_list" = IPs sorted by priority/type | "get_port" = current editor server port number | "get_comprehensive_status" = complete server status with IPs, port, and system info'
                        }
                    },
                    required: ['action']
                }
            },
            // 1.5 Preview control - start a browser/simulator preview
            {
                name: 'preview_start',
                description: 'PREVIEW START: Trigger Cocos Creator preview (build current scene and open it in the preview target). USAGE: Call with optional "platform" to choose target (e.g. "web-desktop", "web-mobile", "android", "ios", "windows"). Omit "platform" to use the editor\'s last selected preview platform. This is a fire-and-forget action; the preview runs in its own process and the tool returns immediately with success/failure of the launch request.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        platform: {
                            type: 'string',
                            enum: ['web-desktop', 'web-mobile', 'android', 'ios', 'windows', 'mac'],
                            description: 'Target platform for the preview. Defaults to "web-desktop" if omitted. Must match one of the platforms available in your project\'s build settings.'
                        }
                    },
                    required: []
                }
            },
            // 2. Server Connectivity Testing - Network and connectivity
            {
                name: 'server_connectivity',
                description: 'SERVER CONNECTIVITY: Test and diagnose network connectivity for the Cocos Creator editor server. USAGE: "test_connectivity" to verify server accessibility with custom timeout, "get_network_interfaces" for detailed network adapter information. Critical for troubleshooting connection problems.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['test_connectivity', 'get_network_interfaces'],
                            description: 'Connectivity operation: "test_connectivity" = verify server connection and response time (optional timeout parameter) | "get_network_interfaces" = detailed network adapter and interface information (no parameters needed)'
                        },
                        timeout: {
                            type: 'number',
                            description: 'Connection timeout duration (test_connectivity action). Milliseconds to wait for server response. Examples: 1000 for quick test, 5000 for standard check, 10000 for slow networks. Default: 5000ms provides good balance between speed and reliability.',
                            default: 5000,
                            minimum: 1000,
                            maximum: 30000
                        }
                    },
                    required: ['action']
                }
            }
        ];
    }
    async execute(toolName, args) {
        switch (toolName) {
            case 'server_information':
                return await this.handleServerInformation(args);
            case 'server_connectivity':
                return await this.handleServerConnectivity(args);
            case 'preview_start':
                return await this.handlePreviewStart(args);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
    async queryServerIPList() {
        try {
            const ipList = await Editor.Message.request('server', 'query-ip-list');
            return {
                success: true,
                data: {
                    ipList: ipList,
                    count: ipList.length,
                    message: 'IP list retrieved successfully'
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async querySortedServerIPList() {
        try {
            const sortedIPList = await Editor.Message.request('server', 'query-sort-ip-list');
            return {
                success: true,
                data: {
                    sortedIPList: sortedIPList,
                    count: sortedIPList.length,
                    message: 'Sorted IP list retrieved successfully'
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async queryServerPort() {
        try {
            const port = await Editor.Message.request('server', 'query-port');
            return {
                success: true,
                data: {
                    port: port,
                    message: `Editor server is running on port ${port}`
                }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async getServerStatus() {
        var _a;
        try {
            const [ipListResult, portResult] = await Promise.allSettled([
                this.queryServerIPList(),
                this.queryServerPort()
            ]);
            const status = {
                timestamp: new Date().toISOString(),
                serverRunning: true
            };
            if (ipListResult.status === 'fulfilled' && ipListResult.value.success) {
                status.availableIPs = ipListResult.value.data.ipList;
                status.ipCount = ipListResult.value.data.count;
            }
            else {
                status.availableIPs = [];
                status.ipCount = 0;
                status.ipError = ipListResult.status === 'rejected' ? ipListResult.reason : ipListResult.value.error;
            }
            if (portResult.status === 'fulfilled' && portResult.value.success) {
                status.port = portResult.value.data.port;
            }
            else {
                status.port = null;
                status.portError = portResult.status === 'rejected' ? portResult.reason : portResult.value.error;
            }
            status.editorVersion = ((_a = Editor.versions) === null || _a === void 0 ? void 0 : _a.cocos) || 'Unknown';
            status.platform = process.platform;
            status.nodeVersion = process.version;
            return {
                success: true,
                data: status
            };
        }
        catch (err) {
            return {
                success: false,
                error: `Failed to get server status: ${err.message}`
            };
        }
    }
    async checkServerConnectivity(timeout = 5000) {
        const startTime = Date.now();
        try {
            const testPromise = Editor.Message.request('server', 'query-port');
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timeout')), timeout);
            });
            await Promise.race([testPromise, timeoutPromise]);
            const responseTime = Date.now() - startTime;
            return {
                success: true,
                data: {
                    connected: true,
                    responseTime: responseTime,
                    timeout: timeout,
                    message: `Server connectivity confirmed in ${responseTime}ms`
                }
            };
        }
        catch (err) {
            const responseTime = Date.now() - startTime;
            return {
                success: false,
                data: {
                    connected: false,
                    responseTime: responseTime,
                    timeout: timeout,
                    error: err.message
                }
            };
        }
    }
    async getNetworkInterfaces() {
        try {
            const os = require('os');
            const interfaces = os.networkInterfaces();
            const networkInfo = Object.entries(interfaces).map(([name, addresses]) => ({
                name: name,
                addresses: addresses.map((addr) => ({
                    address: addr.address,
                    family: addr.family,
                    internal: addr.internal,
                    cidr: addr.cidr
                }))
            }));
            const serverIPResult = await this.queryServerIPList();
            return {
                success: true,
                data: {
                    networkInterfaces: networkInfo,
                    serverAvailableIPs: serverIPResult.success ? serverIPResult.data.ipList : [],
                    message: 'Network interfaces retrieved successfully'
                }
            };
        }
        catch (err) {
            return {
                success: false,
                error: `Failed to get network interfaces: ${err.message}`
            };
        }
    }
    // New handler methods for optimized tools
    async handleServerInformation(args) {
        const { action } = args;
        switch (action) {
            case 'get_ip_list':
                return await this.queryServerIPList();
            case 'get_sorted_ip_list':
                return await this.querySortedServerIPList();
            case 'get_port':
                return await this.queryServerPort();
            case 'get_comprehensive_status':
                return await this.getServerStatus();
            default:
                return { success: false, error: `Unknown server information action: ${action}` };
        }
    }
    async handleServerConnectivity(args) {
        const { action, timeout } = args;
        switch (action) {
            case 'test_connectivity':
                return await this.checkServerConnectivity(timeout);
            case 'get_network_interfaces':
                return await this.getNetworkInterfaces();
            default:
                return { success: false, error: `Unknown server connectivity action: ${action}` };
        }
    }
    async handlePreviewStart(args) {
        const platform = args.platform || 'web-desktop';
        try {
            // preview:start launches the preview in its own process (browser/simulator).
            // Use send (fire-and-forget) so we don't block on the long-running preview process.
            await Editor.Message.send('preview', 'start', { platform });
            return {
                success: true,
                data: {
                    platform: platform,
                    message: `Preview launch requested for platform "${platform}". The preview will open in its target (browser/simulator).`
                }
            };
        }
        catch (err) {
            return {
                success: false,
                error: `Failed to start preview for platform "${platform}": ${err.message}`
            };
        }
    }
}
exports.ServerTools = ServerTools;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL3NlcnZlci10b29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSxNQUFhLFdBQVc7SUFDcEIsUUFBUTtRQUNKLE9BQU87WUFDSCx1REFBdUQ7WUFDdkQ7Z0JBQ0ksSUFBSSxFQUFFLG9CQUFvQjtnQkFDMUIsV0FBVyxFQUFFLHFSQUFxUjtnQkFDbFMsV0FBVyxFQUFFO29CQUNULElBQUksRUFBRSxRQUFRO29CQUNkLFVBQVUsRUFBRTt3QkFDUixNQUFNLEVBQUU7NEJBQ0osSUFBSSxFQUFFLFFBQVE7NEJBQ2QsSUFBSSxFQUFFLENBQUMsYUFBYSxFQUFFLG9CQUFvQixFQUFFLFVBQVUsRUFBRSwwQkFBMEIsQ0FBQzs0QkFDbkYsV0FBVyxFQUFFLG1RQUFtUTt5QkFDblI7cUJBQ0o7b0JBQ0QsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO2lCQUN2QjthQUNKO1lBRUQsMERBQTBEO1lBQzFEO2dCQUNJLElBQUksRUFBRSxlQUFlO2dCQUNyQixXQUFXLEVBQUUsc2JBQXNiO2dCQUNuYyxXQUFXLEVBQUU7b0JBQ1QsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFO3dCQUNSLFFBQVEsRUFBRTs0QkFDTixJQUFJLEVBQUUsUUFBUTs0QkFDZCxJQUFJLEVBQUUsQ0FBQyxhQUFhLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQzs0QkFDdkUsV0FBVyxFQUFFLHFKQUFxSjt5QkFDcks7cUJBQ0o7b0JBQ0QsUUFBUSxFQUFFLEVBQUU7aUJBQ2Y7YUFDSjtZQUVELDREQUE0RDtZQUM1RDtnQkFDSSxJQUFJLEVBQUUscUJBQXFCO2dCQUMzQixXQUFXLEVBQUUsc1NBQXNTO2dCQUNuVCxXQUFXLEVBQUU7b0JBQ1QsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFO3dCQUNSLE1BQU0s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QztJQUNMLENBQUM7Q0FFSjtBQWpTRCxrQ0FpU0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUb29sRGVmaW5pdGlvbiwgVG9vbFJlc3BvbnNlLCBUb29sRXhlY3V0b3IgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG5leHBvcnQgY2xhc3MgU2VydmVyVG9vbHMgaW1wbGVtZW50cyBUb29sRXhlY3V0b3Ige1xyXG4gICAgZ2V0VG9vbHMoKTogVG9vbERlZmluaXRpb25bXSB7XHJcbiAgICAgICAgcmV0dXJuIFtcclxuICAgICAgICAgICAgLy8gMS4gU2VydmVyIEluZm9ybWF0aW9uIE1hbmFnZW1lbnQgLSBCYXNpYyBzZXJ2ZXIgaW5mb1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2VydmVyX2luZm9ybWF0aW9uJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU0VSVkVSIElORk9STUFUSU9OOiBHZXQgQ29jb3MgQ3JlYXRvciBlZGl0b3Igc2VydmVyIG5ldHdvcmsgZGV0YWlscyBhbmQgc3RhdHVzLiBVU0FHRTogRXNzZW50aWFsIGZvciBuZXR3b3JrIGNvbmZpZ3VyYXRpb24sIGRlYnVnZ2luZyBjb25uZWN0aW9uIGlzc3VlcywgYW5kIHVuZGVyc3RhbmRpbmcgc2VydmVyIHNldHVwLiBVc2UgXCJnZXRfaXBfbGlzdFwiIHRvIHNlZSBhdmFpbGFibGUgbmV0d29yayBpbnRlcmZhY2VzLCBcImdldF9wb3J0XCIgZm9yIGN1cnJlbnQgc2VydmVyIHBvcnQuJyxcclxuICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWydnZXRfaXBfbGlzdCcsICdnZXRfc29ydGVkX2lwX2xpc3QnLCAnZ2V0X3BvcnQnLCAnZ2V0X2NvbXByZWhlbnNpdmVfc3RhdHVzJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0luZm9ybWF0aW9uIHF1ZXJ5OiBcImdldF9pcF9saXN0XCIgPSBhbGwgYXZhaWxhYmxlIG5ldHdvcmsgSVAgYWRkcmVzc2VzIHwgXCJnZXRfc29ydGVkX2lwX2xpc3RcIiA9IElQcyBzb3J0ZWQgYnkgcHJpb3JpdHkvdHlwZSB8IFwiZ2V0X3BvcnRcIiA9IGN1cnJlbnQgZWRpdG9yIHNlcnZlciBwb3J0IG51bWJlciB8IFwiZ2V0X2NvbXByZWhlbnNpdmVfc3RhdHVzXCIgPSBjb21wbGV0ZSBzZXJ2ZXIgc3RhdHVzIHdpdGggSVBzLCBwb3J0LCBhbmQgc3lzdGVtIGluZm8nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgICAvLyAxLjUgUHJldmlldyBjb250cm9sIC0gc3RhcnQgYSBicm93c2VyL3NpbXVsYXRvciBwcmV2aWV3XHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdwcmV2aWV3X3N0YXJ0JyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUFJFVklFVyBTVEFSVDogVHJpZ2dlciBDb2NvcyBDcmVhdG9yIHByZXZpZXcgKGJ1aWxkIGN1cnJlbnQgc2NlbmUgYW5kIG9wZW4gaXQgaW4gdGhlIHByZXZpZXcgdGFyZ2V0KS4gVVNBR0U6IENhbGwgd2l0aCBvcHRpb25hbCBcInBsYXRmb3JtXCIgdG8gY2hvb3NlIHRhcmdldCAoZS5nLiBcIndlYi1kZXNrdG9wXCIsIFwid2ViLW1vYmlsZVwiLCBcImFuZHJvaWRcIiwgXCJpb3NcIiwgXCJ3aW5kb3dzXCIpLiBPbWl0IFwicGxhdGZvcm1cIiB0byB1c2UgdGhlIGVkaXRvclxcJ3MgbGFzdCBzZWxlY3RlZCBwcmV2aWV3IHBsYXRmb3JtLiBUaGlzIGlzIGEgZmlyZS1hbmQtZm9yZ2V0IGFjdGlvbjsgdGhlIHByZXZpZXcgcnVucyBpbiBpdHMgb3duIHByb2Nlc3MgYW5kIHRoZSB0b29sIHJldHVybnMgaW1tZWRpYXRlbHkgd2l0aCBzdWNjZXNzL2ZhaWx1cmUgb2YgdGhlIGxhdW5jaCByZXF1ZXN0LicsXHJcbiAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYToge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGxhdGZvcm06IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWyd3ZWItZGVza3RvcCcsICd3ZWItbW9iaWxlJywgJ2FuZHJvaWQnLCAnaW9zJywgJ3dpbmRvd3MnLCAnbWFjJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1RhcmdldCBwbGF0Zm9ybSBmb3IgdGhlIHByZXZpZXcuIERlZmF1bHRzIHRvIFwid2ViLWRlc2t0b3BcIiBpZiBvbWl0dGVkLiBNdXN0IG1hdGNoIG9uZSBvZiB0aGUgcGxhdGZvcm1zIGF2YWlsYWJsZSBpbiB5b3VyIHByb2plY3RcXCdzIGJ1aWxkIHNldHRpbmdzLidcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFtdXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgICAvLyAyLiBTZXJ2ZXIgQ29ubmVjdGl2aXR5IFRlc3RpbmcgLSBOZXR3b3JrIGFuZCBjb25uZWN0aXZpdHlcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ3NlcnZlcl9jb25uZWN0aXZpdHknLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdTRVJWRVIgQ09OTkVDVElWSVRZOiBUZXN0IGFuZCBkaWFnbm9zZSBuZXR3b3JrIGNvbm5lY3Rpdml0eSBmb3IgdGhlIENvY29zIENyZWF0b3IgZWRpdG9yIHNlcnZlci4gVVNBR0U6IFwidGVzdF9jb25uZWN0aXZpdHlcIiB0byB2ZXJpZnkgc2VydmVyIGFjY2Vzc2liaWxpdHkgd2l0aCBjdXN0b20gdGltZW91dCwgXCJnZXRfbmV0d29ya19pbnRlcmZhY2VzXCIgZm9yIGRldGFpbGVkIG5ldHdvcmsgYWRhcHRlciBpbmZvcm1hdGlvbi4gQ3JpdGljYWwgZm9yIHRyb3VibGVzaG9vdGluZyBjb25uZWN0aW9uIHByb2JsZW1zLicsXHJcbiAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYToge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsndGVzdF9jb25uZWN0aXZpdHknLCAnZ2V0X25ldHdvcmtfaW50ZXJmYWNlcyddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdDb25uZWN0aXZpdHkgb3BlcmF0aW9uOiBcInRlc3RfY29ubmVjdGl2aXR5XCIgPSB2ZXJpZnkgc2VydmVyIGNvbm5lY3Rpb24gYW5kIHJlc3BvbnNlIHRpbWUgKG9wdGlvbmFsIHRpbWVvdXQgcGFyYW1ldGVyKSB8IFwiZ2V0X25ldHdvcmtfaW50ZXJmYWNlc1wiID0gZGV0YWlsZWQgbmV0d29yayBhZGFwdGVyIGFuZCBpbnRlcmZhY2UgaW5mb3JtYXRpb24gKG5vIHBhcmFtZXRlcnMgbmVlZGVkKSdcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Nvbm5lY3Rpb24gdGltZW91dCBkdXJhdGlvbiAodGVzdF9jb25uZWN0aXZpdHkgYWN0aW9uKS4gTWlsbGlzZWNvbmRzIHRvIHdhaXQgZm9yIHNlcnZlciByZXNwb25zZS4gRXhhbXBsZXM6IDEwMDAgZm9yIHF1aWNrIHRlc3QsIDUwMDAgZm9yIHN0YW5kYXJkIGNoZWNrLCAxMDAwMCBmb3Igc2xvdyBuZXR3b3Jrcy4gRGVmYXVsdDogNTAwMG1zIHByb3ZpZGVzIGdvb2QgYmFsYW5jZSBiZXR3ZWVuIHNwZWVkIGFuZCByZWxpYWJpbGl0eS4nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogNTAwMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbmltdW06IDEwMDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhpbXVtOiAzMDAwMFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgXTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBleGVjdXRlKHRvb2xOYW1lOiBzdHJpbmcsIGFyZ3M6IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgc3dpdGNoICh0b29sTmFtZSkge1xyXG4gICAgICAgICAgICBjYXNlICdzZXJ2ZXJfaW5mb3JtYXRpb24nOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuaGFuZGxlU2VydmVySW5mb3JtYXRpb24oYXJncyk7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NlcnZlcl9jb25uZWN0aXZpdHknOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuaGFuZGxlU2VydmVyQ29ubmVjdGl2aXR5KGFyZ3MpO1xyXG4gICAgICAgICAgICBjYXNlICdwcmV2aWV3X3N0YXJ0JzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmhhbmRsZVByZXZpZXdTdGFydChhcmdzKTtcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0b29sOiAke3Rvb2xOYW1lfWApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5U2VydmVySVBMaXN0KCk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgaXBMaXN0OiBzdHJpbmdbXSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NlcnZlcicsICdxdWVyeS1pcC1saXN0Jyk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIGlwTGlzdDogaXBMaXN0LFxyXG4gICAgICAgICAgICAgICAgICAgIGNvdW50OiBpcExpc3QubGVuZ3RoLFxyXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdJUCBsaXN0IHJldHJpZXZlZCBzdWNjZXNzZnVsbHknXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5U29ydGVkU2VydmVySVBMaXN0KCk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3Qgc29ydGVkSVBMaXN0OiBzdHJpbmdbXSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NlcnZlcicsICdxdWVyeS1zb3J0LWlwLWxpc3QnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc29ydGVkSVBMaXN0OiBzb3J0ZWRJUExpc3QsXHJcbiAgICAgICAgICAgICAgICAgICAgY291bnQ6IHNvcnRlZElQTGlzdC5sZW5ndGgsXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ1NvcnRlZCBJUCBsaXN0IHJldHJpZXZlZCBzdWNjZXNzZnVsbHknXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5U2VydmVyUG9ydCgpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHBvcnQ6IG51bWJlciA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NlcnZlcicsICdxdWVyeS1wb3J0Jyk7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIHBvcnQ6IHBvcnQsXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYEVkaXRvciBzZXJ2ZXIgaXMgcnVubmluZyBvbiBwb3J0ICR7cG9ydH1gXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldFNlcnZlclN0YXR1cygpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IFtpcExpc3RSZXN1bHQsIHBvcnRSZXN1bHRdID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcclxuICAgICAgICAgICAgICAgIHRoaXMucXVlcnlTZXJ2ZXJJUExpc3QoKSxcclxuICAgICAgICAgICAgICAgIHRoaXMucXVlcnlTZXJ2ZXJQb3J0KClcclxuICAgICAgICAgICAgXSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBzdGF0dXM6IGFueSA9IHtcclxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgICAgICAgICAgc2VydmVyUnVubmluZzogdHJ1ZVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgaWYgKGlwTGlzdFJlc3VsdC5zdGF0dXMgPT09ICdmdWxmaWxsZWQnICYmIGlwTGlzdFJlc3VsdC52YWx1ZS5zdWNjZXNzKSB7XHJcbiAgICAgICAgICAgICAgICBzdGF0dXMuYXZhaWxhYmxlSVBzID0gaXBMaXN0UmVzdWx0LnZhbHVlLmRhdGEuaXBMaXN0O1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLmlwQ291bnQgPSBpcExpc3RSZXN1bHQudmFsdWUuZGF0YS5jb3VudDtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN0YXR1cy5hdmFpbGFibGVJUHMgPSBbXTtcclxuICAgICAgICAgICAgICAgIHN0YXR1cy5pcENvdW50ID0gMDtcclxuICAgICAgICAgICAgICAgIHN0YXR1cy5pcEVycm9yID0gaXBMaXN0UmVzdWx0LnN0YXR1cyA9PT0gJ3JlamVjdGVkJyA/IGlwTGlzdFJlc3VsdC5yZWFzb24gOiBpcExpc3RSZXN1bHQudmFsdWUuZXJyb3I7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChwb3J0UmVzdWx0LnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgJiYgcG9ydFJlc3VsdC52YWx1ZS5zdWNjZXNzKSB7XHJcbiAgICAgICAgICAgICAgICBzdGF0dXMucG9ydCA9IHBvcnRSZXN1bHQudmFsdWUuZGF0YS5wb3J0O1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLnBvcnQgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLnBvcnRFcnJvciA9IHBvcnRSZXN1bHQuc3RhdHVzID09PSAncmVqZWN0ZWQnID8gcG9ydFJlc3VsdC5yZWFzb24gOiBwb3J0UmVzdWx0LnZhbHVlLmVycm9yO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzdGF0dXMuZWRpdG9yVmVyc2lvbiA9IChFZGl0b3IgYXMgYW55KS52ZXJzaW9ucz8uY29jb3MgfHwgJ1Vua25vd24nO1xyXG4gICAgICAgICAgICBzdGF0dXMucGxhdGZvcm0gPSBwcm9jZXNzLnBsYXRmb3JtO1xyXG4gICAgICAgICAgICBzdGF0dXMubm9kZVZlcnNpb24gPSBwcm9jZXNzLnZlcnNpb247XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHN0YXR1c1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGVycm9yOiBgRmFpbGVkIHRvIGdldCBzZXJ2ZXIgc3RhdHVzOiAke2Vyci5tZXNzYWdlfWBcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBjaGVja1NlcnZlckNvbm5lY3Rpdml0eSh0aW1lb3V0OiBudW1iZXIgPSA1MDAwKTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCB0ZXN0UHJvbWlzZSA9IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NlcnZlcicsICdxdWVyeS1wb3J0Jyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHRpbWVvdXRQcm9taXNlID0gbmV3IFByb21pc2UoKF8sIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiByZWplY3QobmV3IEVycm9yKCdDb25uZWN0aW9uIHRpbWVvdXQnKSksIHRpbWVvdXQpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGF3YWl0IFByb21pc2UucmFjZShbdGVzdFByb21pc2UsIHRpbWVvdXRQcm9taXNlXSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZVRpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29ubmVjdGVkOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIHJlc3BvbnNlVGltZTogcmVzcG9uc2VUaW1lLFxyXG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IHRpbWVvdXQsXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFNlcnZlciBjb25uZWN0aXZpdHkgY29uZmlybWVkIGluICR7cmVzcG9uc2VUaW1lfW1zYFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlVGltZSA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29ubmVjdGVkOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICByZXNwb25zZVRpbWU6IHJlc3BvbnNlVGltZSxcclxuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiB0aW1lb3V0LFxyXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBlcnIubWVzc2FnZVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldE5ldHdvcmtJbnRlcmZhY2VzKCk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3Qgb3MgPSByZXF1aXJlKCdvcycpO1xyXG4gICAgICAgICAgICBjb25zdCBpbnRlcmZhY2VzID0gb3MubmV0d29ya0ludGVyZmFjZXMoKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG5ldHdvcmtJbmZvID0gT2JqZWN0LmVudHJpZXMoaW50ZXJmYWNlcykubWFwKChbbmFtZSwgYWRkcmVzc2VzXTogW3N0cmluZywgYW55XSkgPT4gKHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IG5hbWUsXHJcbiAgICAgICAgICAgICAgICBhZGRyZXNzZXM6IGFkZHJlc3Nlcy5tYXAoKGFkZHI6IGFueSkgPT4gKHtcclxuICAgICAgICAgICAgICAgICAgICBhZGRyZXNzOiBhZGRyLmFkZHJlc3MsXHJcbiAgICAgICAgICAgICAgICAgICAgZmFtaWx5OiBhZGRyLmZhbWlseSxcclxuICAgICAgICAgICAgICAgICAgICBpbnRlcm5hbDogYWRkci5pbnRlcm5hbCxcclxuICAgICAgICAgICAgICAgICAgICBjaWRyOiBhZGRyLmNpZHJcclxuICAgICAgICAgICAgICAgIH0pKVxyXG4gICAgICAgICAgICB9KSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBzZXJ2ZXJJUFJlc3VsdCA9IGF3YWl0IHRoaXMucXVlcnlTZXJ2ZXJJUExpc3QoKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIG5ldHdvcmtJbnRlcmZhY2VzOiBuZXR3b3JrSW5mbyxcclxuICAgICAgICAgICAgICAgICAgICBzZXJ2ZXJBdmFpbGFibGVJUHM6IHNlcnZlcklQUmVzdWx0LnN1Y2Nlc3MgPyBzZXJ2ZXJJUFJlc3VsdC5kYXRhLmlwTGlzdCA6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdOZXR3b3JrIGludGVyZmFjZXMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseSdcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogYEZhaWxlZCB0byBnZXQgbmV0d29yayBpbnRlcmZhY2VzOiAke2Vyci5tZXNzYWdlfWBcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gTmV3IGhhbmRsZXIgbWV0aG9kcyBmb3Igb3B0aW1pemVkIHRvb2xzXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVNlcnZlckluZm9ybWF0aW9uKGFyZ3M6IGFueSk6IFByb21pc2U8VG9vbFJlc3BvbnNlPiB7XHJcbiAgICAgICAgY29uc3QgeyBhY3Rpb24gfSA9IGFyZ3M7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICAgICAgY2FzZSAnZ2V0X2lwX2xpc3QnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucXVlcnlTZXJ2ZXJJUExpc3QoKTtcclxuICAgICAgICAgICAgY2FzZSAnZ2V0X3NvcnRlZF9pcF9saXN0JzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnF1ZXJ5U29ydGVkU2VydmVySVBMaXN0KCk7XHJcbiAgICAgICAgICAgIGNhc2UgJ2dldF9wb3J0JzpcclxuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnF1ZXJ5U2VydmVyUG9ydCgpO1xyXG4gICAgICAgICAgICBjYXNlICdnZXRfY29tcHJlaGVuc2l2ZV9zdGF0dXMnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZ2V0U2VydmVyU3RhdHVzKCk7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBVbmtub3duIHNlcnZlciBpbmZvcm1hdGlvbiBhY3Rpb246ICR7YWN0aW9ufWAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVTZXJ2ZXJDb25uZWN0aXZpdHkoYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcclxuICAgICAgICBjb25zdCB7IGFjdGlvbiwgdGltZW91dCB9ID0gYXJncztcclxuICAgICAgICBcclxuICAgICAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgICAgICBjYXNlICd0ZXN0X2Nvbm5lY3Rpdml0eSc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5jaGVja1NlcnZlckNvbm5lY3Rpdml0eSh0aW1lb3V0KTtcclxuICAgICAgICAgICAgY2FzZSAnZ2V0X25ldHdvcmtfaW50ZXJmYWNlcyc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5nZXROZXR3b3JrSW50ZXJmYWNlcygpO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgVW5rbm93biBzZXJ2ZXIgY29ubmVjdGl2aXR5IGFjdGlvbjogJHthY3Rpb259YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVByZXZpZXdTdGFydChhcmdzOiBhbnkpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xyXG4gICAgICAgIGNvbnN0IHBsYXRmb3JtOiBzdHJpbmcgPSBhcmdzLnBsYXRmb3JtIHx8ICd3ZWItZGVza3RvcCc7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8gcHJldmlldzpzdGFydCBsYXVuY2hlcyB0aGUgcHJldmlldyBpbiBpdHMgb3duIHByb2Nlc3MgKGJyb3dzZXIvc2ltdWxhdG9yKS5cclxuICAgICAgICAgICAgLy8gVXNlIHNlbmQgKGZpcmUtYW5kLWZvcmdldCkgc28gd2UgZG9uJ3QgYmxvY2sgb24gdGhlIGxvbmctcnVubmluZyBwcmV2aWV3IHByb2Nlc3MuXHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnNlbmQoJ3ByZXZpZXcnLCAnc3RhcnQnLCB7IHBsYXRmb3JtIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICBwbGF0Zm9ybTogcGxhdGZvcm0sXHJcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFByZXZpZXcgbGF1bmNoIHJlcXVlc3RlZCBmb3IgcGxhdGZvcm0gXCIke3BsYXRmb3JtfVwiLiBUaGUgcHJldmlldyB3aWxsIG9wZW4gaW4gaXRzIHRhcmdldCAoYnJvd3Nlci9zaW11bGF0b3IpLmBcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogYEZhaWxlZCB0byBzdGFydCBwcmV2aWV3IGZvciBwbGF0Zm9ybSBcIiR7cGxhdGZvcm19XCI6ICR7ZXJyLm1lc3NhZ2V9YFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbn0iXX0=