// MSW mocks at the network layer (real `fetch` calls, intercepted before they leave the process) —
// components use the real src/api/client.js exactly as they do against the live backend. Each test
// adds the handlers it needs with server.use(...); nothing here is a default response, so a request
// no test expects fails loudly (onUnhandledRequest: "error" in setup.js) instead of hanging.
import { setupServer } from "msw/node";

export const server = setupServer();
