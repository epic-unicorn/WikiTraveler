import type { Tier } from "@wikitraveler/core";
import { prisma } from "@/lib/prisma";
import type { SignalStatus, SignalType } from "@prisma/client";

const TIER_WEIGHT: Record<string, number> = {
  OFFICIAL: 0,
  AI_GUESS: 5,
  VERIFIED: 20,
  CONFIRMED: 25,
};

const TYPE_WEIGHT: Record<SignalType, number> = {
  INCORRECT: 30,
  OUTDATED: 25,
  LOCATION: 20,
  MISSING: 15,
  DEMAND: 10,
};

export type SignalInput = {
  type: SignalType;
  fieldName?: string | null;
  scopeKey?: string | null;
  currentValue?: string | null;
  currentTier?: Tier | string | null;
  suggestedValue?: string | null;
  note?: string | null;
  visitDate?: string | null;
  photos?: string[];
};

export function reporterId(username: string, homeNodeUrl: string): string {
  return `${username}@${homeNodeUrl}`;
}

export function computePriorityScore(
  type: SignalType,
  currentTier: string | null | undefined,
  duplicateCount: number
): number {
  let score = TYPE_WEIGHT[type] ?? 10;
  if (currentTier && (TIER_WEIGHT[currentTier] ?? 0) >= 20) {
    score += 15;
  }
  score += Math.min(duplicateCount, 5) * 5;
  return score;
}

export async function countDuplicateOpenSignals(
  propertyId: string,
  fieldName: string | null | undefined,
  type: SignalType
): Promise<number> {
  if (!fieldName) {
    return prisma.communitySignal.count({
      where: { propertyId, type, status: "OPEN" },
    });
  }
  return prisma.communitySignal.count({
    where: { propertyId, fieldName, type, status: "OPEN" },
  });
}

export async function upsertCommunitySignal(opts: {
  propertyId: string;
  reporterId: string;
  input: SignalInput;
}) {
  const { propertyId, reporterId: reporter, input } = opts;
  const fieldName = input.fieldName?.trim() || null;
  const scopeKey = input.scopeKey?.trim() || "property";
  const note = input.note?.trim() || null;

  if (!note && input.type !== "DEMAND" && input.type !== "MISSING") {
    throw new Error("note is required for this report type");
  }

  const dupCount = await countDuplicateOpenSignals(propertyId, fieldName, input.type);
  const priorityScore = computePriorityScore(input.type, input.currentTier, dupCount);

  const existing = await prisma.communitySignal.findFirst({
    where: {
      propertyId,
      reporterId: reporter,
      fieldName,
      type: input.type,
      status: "OPEN",
    },
  });

  const photos = Array.isArray(input.photos)
    ? input.photos.filter((p) => typeof p === "string").slice(0, 2)
    : [];

  const visitDate = input.visitDate ? new Date(input.visitDate) : null;
  const data = {
    type: input.type,
    scopeKey,
    currentValue: input.currentValue ?? null,
    currentTier: (input.currentTier as Tier | undefined) ?? null,
    suggestedValue: input.suggestedValue?.trim() || null,
    note,
    visitDate: visitDate && !Number.isNaN(visitDate.getTime()) ? visitDate : null,
    photos,
    priorityScore,
  };

  if (existing) {
    return prisma.communitySignal.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.communitySignal.create({
    data: {
      propertyId,
      reporterId: reporter,
      ...data,
    },
  });
}

export async function listSignalsForAdmin(status?: SignalStatus) {
  const signals = await prisma.communitySignal.findMany({
    where: status ? { status } : undefined,
    include: {
      property: { select: { id: true, name: true, location: true } },
    },
    orderBy: [{ priorityScore: "desc" }, { createdAt: "asc" }],
    take: 200,
  });
  return signals;
}

export async function listSignalsForProperty(propertyId: string, reporterIdFilter?: string) {
  const signals = await prisma.communitySignal.findMany({
    where: {
      propertyId,
      ...(reporterIdFilter ? { reporterId: reporterIdFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const openCount = await prisma.communitySignal.count({
    where: { propertyId, status: "OPEN" },
  });

  return { signals, openCount };
}

export async function getContributorStats(reporterId: string) {
  const [submitted, resolved, open] = await Promise.all([
    prisma.communitySignal.count({ where: { reporterId } }),
    prisma.communitySignal.count({ where: { reporterId, status: "RESOLVED" } }),
    prisma.communitySignal.count({ where: { reporterId, status: "OPEN" } }),
  ]);
  return { submitted, resolved, open };
}
