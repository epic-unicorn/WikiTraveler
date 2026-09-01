import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichAuditNotesForDisplay } from "./enrichFactsForDisplay";

vi.mock("@/lib/translation", () => ({
  getOrTranslateCachedText: vi.fn(),
  getOrTranslateFactText: vi.fn(),
}));

import { getOrTranslateCachedText } from "@/lib/translation";

describe("enrichAuditNotesForDisplay", () => {
  beforeEach(() => {
    vi.mocked(getOrTranslateCachedText).mockReset();
  });

  it("translates each audit note for the viewer locale", async () => {
    vi.mocked(getOrTranslateCachedText).mockResolvedValue({
      text: "Hallo",
      machineTranslated: true,
    });

    const result = await enrichAuditNotesForDisplay(
      [
        {
          submissionId: "sub-1",
          createdAt: "2026-01-01T00:00:00.000Z",
          auditorToken: "auditor@node",
          text: "Hello",
          sourceLocale: "en",
        },
      ],
      "nl",
      "en"
    );

    expect(getOrTranslateCachedText).toHaveBeenCalledWith(
      "audit-note:sub-1",
      "Hello",
      "en",
      "nl"
    );
    expect(result[0]).toMatchObject({
      text: "Hello",
      displayText: "Hallo",
      machineTranslated: true,
      sourceLocale: "en",
    });
  });
});
