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
