import { describe, expect, it } from "vitest";
import { parseTaggedNotes, taggedNoteHeadingKey } from "./taggedNotes";

describe("parseTaggedNotes", () => {
  it("splits Wheelmap category tags into headings and title-case items", () => {
    const sections = parseTaggedNotes(
      "[Bathroom] Emergency cord in bathroom Lower bathroom sink Toilet with grab rails [Communication] None of these info found."
    );
    expect(sections).toEqual([
      {
        heading: "Bathroom",
        items: [
          "Emergency cord in bathroom",
          "Lower bathroom sink",
          "Toilet with grab rails",
        ],
      },
    ]);
  });

  it("keeps a preamble and drops empty categories", () => {
    const sections = parseTaggedNotes(
      "Side entrance is ramped. [Parking] Accessible parking [Communication] None of these info found."
    );
    expect(sections).toEqual([
      { heading: null, items: ["Side entrance is ramped."] },
      { heading: "Parking", items: ["Accessible parking"] },
    ]);
  });

  it("returns null for ordinary auditor notes", () => {
    expect(parseTaggedNotes("Nice ramp at the side door.")).toBeNull();
    expect(parseTaggedNotes("See [the photo] on the listing.")).toBeNull();
  });
});

describe("taggedNoteHeadingKey", () => {
  it("maps Wheelmap English headings onto existing i18n keys", () => {
    expect(taggedNoteHeadingKey("Bathroom")).toBe("ui.propertySectionBathroom");
    expect(taggedNoteHeadingKey("Communication")).toBe("ui.auditStepCommunication");
  });
});
