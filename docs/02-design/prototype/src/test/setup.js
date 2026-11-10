import { transferableAbortController } from "node:util";
// Node fetch/MSW needs Node's AbortSignal rather than jsdom's DOM implementation.
globalThis.AbortController = class { constructor() { return transferableAbortController(); } };
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./server";
import { setUnauthenticatedHandler } from "../api/client";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  setUnauthenticatedHandler(null); // tests that install one must not leak it into the next test
  cleanup();
});
afterAll(() => server.close());

// Native modal dialogs are provided by browsers; jsdom needs their open-state methods.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
