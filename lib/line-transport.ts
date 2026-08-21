const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_TIMEOUT_MS = 8_000;

export type LineDeliveryJob = {
  reportId: string;
  shopId: string;
  retryKey: string;
  firstAttemptAt: string;
  recipientLineUserId: string | null;
  petName: string;
  ownerName: string;
  foodStatus: string;
  excretionStatus: string;
  moodStatus: string;
  photoUrls: string[];
  staffNotes: string | null;
};

export type LinePushResult =
  | { accepted: true; status: 200 | 409 }
  | { accepted: false; status?: number; retryable: boolean; error: string };

const LABELS: Record<string, string> = {
  finished: "กินหมด", half: "กินครึ่งหนึ่ง", little: "กินน้อย", refused: "ไม่กิน",
  normal: "ปกติ", diarrhea: "ท้องเสีย", none: "ยังไม่ขับถ่าย",
  happy: "อารมณ์ดี", calm: "สงบ", stressed: "เครียด",
};
function textLine(label: string, value: string) {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: "#666666", flex: 3 },
      { type: "text", text: LABELS[value] ?? value, size: "sm", wrap: true, flex: 5 },
    ],
    margin: "md",
  };
}

export function buildDailyReportFlexMessage(job: LineDeliveryJob) {
  const extraImages = job.photoUrls.slice(1).map((url) => ({
    type: "image",
    url,
    size: "full",
    aspectMode: "cover",
    aspectRatio: "1:1",
    flex: 1,
  }));

  const bodyContents: Record<string, unknown>[] = [
    { type: "text", text: `อัปเดตจาก PawSpace · ${job.petName}`, weight: "bold", size: "xl", wrap: true },
    { type: "text", text: `ถึง ${job.ownerName || "เจ้าของน้อง"}`, size: "sm", color: "#777777", margin: "sm" },
    textLine("อาหาร", job.foodStatus),
    textLine("ขับถ่าย", job.excretionStatus),
    textLine("อารมณ์", job.moodStatus),
  ];
  if (job.staffNotes?.trim()) {
    bodyContents.push({
      type: "text",
      text: job.staffNotes.trim(),
      wrap: true,
      size: "sm",
      margin: "lg",
    });
  }

  if (extraImages.length > 0) {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      margin: "lg",
      contents: extraImages,
    });
  }

  return {
    type: "flex",
    altText: `อัปเดตจาก PawSpace · ${job.petName}`,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: job.photoUrls[0],
        size: "full",
        aspectMode: "cover",
        aspectRatio: "1:1",
      },
      body: { type: "box", layout: "vertical", contents: bodyContents },
    },
  };
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    const message = typeof body.message === "string" ? body.message : "LINE API request failed.";
    return message.slice(0, 300);
  } catch {
    return `LINE API request failed with HTTP ${response.status}.`;
  }
}

export async function sendLineDailyReport(
  job: LineDeliveryJob,
  channelAccessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LinePushResult> {
  if (!job.recipientLineUserId || !job.retryKey || job.photoUrls.length < 1) {
    return { accepted: false, retryable: false, error: "LINE delivery job is incomplete." };
  }

  const firstAttemptMs = Date.parse(job.firstAttemptAt);
  if (!Number.isFinite(firstAttemptMs) || Date.now() - firstAttemptMs >= 24 * 60 * 60 * 1000) {
    return {
      accepted: false,
      retryable: false,
      error: "LINE retry safety window expired; operator review required.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(LINE_PUSH_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${channelAccessToken}`,
        "content-type": "application/json",
        "x-line-retry-key": job.retryKey,
      },
      body: JSON.stringify({
        to: job.recipientLineUserId,
        messages: [buildDailyReportFlexMessage(job)],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 200 || response.status === 409) {
      return { accepted: true, status: response.status as 200 | 409 };
    }

    return {
      accepted: false,
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
      error: await safeErrorMessage(response),
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      accepted: false,
      retryable: true,
      error: timedOut ? "LINE API request timed out." : "LINE API network request failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}
