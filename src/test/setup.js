import "@testing-library/jest-dom";
import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.confirm - the component uses await, so it needs to return a Promise
// But window.confirm is normally synchronous, so we'll make it async-compatible
Object.defineProperty(window, "confirm", {
  writable: true,
  value: vi.fn(() => true),
});

// Mock alert
global.alert = vi.fn();

// Keep console methods but allow them to be spied on in tests
// Don't completely mock them as it can hide important errors






















































