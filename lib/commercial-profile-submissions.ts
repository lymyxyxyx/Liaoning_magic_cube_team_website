import { readAppDocument, writeAppDocument } from "@/lib/app-document-store";

export const commercialSubmissionStatuses = ["pending", "approved", "rejected"] as const;

export type CommercialSubmissionStatus = (typeof commercialSubmissionStatuses)[number];

export type CommercialProfileSubmission = {
  id: string;
  status: CommercialSubmissionStatus;
  playerName: string;
  teamName?: string;
  city?: string;
  wcaId?: string;
  mainEvent?: string;
  bio: string;
  submitterRole?: string;
  contact?: string;
  note?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
};

const dataPath = `${process.cwd()}/data/commercial-profile-submissions.json`;
const documentKey = "commercial-profile-submissions";

export async function readCommercialProfileSubmissions() {
  const raw = await readAppDocument<CommercialProfileSubmission>(documentKey, dataPath);
  return normalizeSubmissions(raw || []);
}

export async function writeCommercialProfileSubmissions(submissions: CommercialProfileSubmission[]) {
  const normalized = normalizeSubmissions(submissions);
  await writeAppDocument(documentKey, dataPath, normalized);
  return normalized;
}

export async function addCommercialProfileSubmission(input: {
  playerName: string;
  teamName?: string;
  city?: string;
  wcaId?: string;
  mainEvent?: string;
  bio: string;
  submitterRole?: string;
  contact?: string;
  note?: string;
}) {
  const submissions = await readCommercialProfileSubmissions();
  const nextSubmission: CommercialProfileSubmission = {
    id: `commercial-submission-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    status: "pending",
    playerName: cleanRequiredString(input.playerName),
    teamName: cleanOptionalString(input.teamName),
    city: cleanOptionalString(input.city),
    wcaId: cleanOptionalString(input.wcaId)?.toUpperCase(),
    mainEvent: cleanOptionalString(input.mainEvent),
    bio: cleanRequiredString(input.bio),
    submitterRole: cleanOptionalString(input.submitterRole),
    contact: cleanOptionalString(input.contact),
    note: cleanOptionalString(input.note),
    createdAt: new Date().toISOString()
  };
  const next = [nextSubmission, ...submissions];
  await writeCommercialProfileSubmissions(next);
  return nextSubmission;
}

function normalizeSubmissions(submissions: Partial<CommercialProfileSubmission>[]) {
  if (!Array.isArray(submissions)) return [];
  return submissions
    .map((submission) => {
      const id = cleanRequiredString(submission.id);
      const playerName = cleanRequiredString(submission.playerName);
      const bio = cleanRequiredString(submission.bio);
      if (!id || !playerName || !bio) return null;
      const status = commercialSubmissionStatuses.includes(submission.status as CommercialSubmissionStatus)
        ? (submission.status as CommercialSubmissionStatus)
        : "pending";
      return {
        id,
        status,
        playerName,
        teamName: cleanOptionalString(submission.teamName),
        city: cleanOptionalString(submission.city),
        wcaId: cleanOptionalString(submission.wcaId)?.toUpperCase(),
        mainEvent: cleanOptionalString(submission.mainEvent),
        bio,
        submitterRole: cleanOptionalString(submission.submitterRole),
        contact: cleanOptionalString(submission.contact),
        note: cleanOptionalString(submission.note),
        createdAt: cleanRequiredString(submission.createdAt) || new Date().toISOString(),
        reviewedAt: cleanOptionalString(submission.reviewedAt),
        reviewNote: cleanOptionalString(submission.reviewNote)
      };
    })
    .filter(Boolean) as CommercialProfileSubmission[];
}

function cleanRequiredString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalString(value: unknown) {
  const cleaned = cleanRequiredString(value);
  return cleaned || undefined;
}
