import { describe, expect, it } from "vitest";
import { contributorRouteRedirect } from "./contributorRoutes";

describe("contributorRouteRedirect", () => {
  it("allows contributors on all routes", () => {
    expect(contributorRouteRedirect("/audit/p1", "AUDITOR")).toBeNull();
    expect(contributorRouteRedirect("/properties/new", "ADMIN")).toBeNull();
  });

  it("redirects USER from audit routes to property detail", () => {
    expect(contributorRouteRedirect("/audit/prop-123", "USER")).toBe("/properties/prop-123");
  });

  it("redirects USER from new-property route to home", () => {
    expect(contributorRouteRedirect("/properties/new", "USER")).toBe("/");
  });

  it("allows USER on browse routes", () => {
    expect(contributorRouteRedirect("/", "USER")).toBeNull();
    expect(contributorRouteRedirect("/properties/p1", "USER")).toBeNull();
  });
});
