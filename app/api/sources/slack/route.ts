import { NextResponse } from "next/server";
import { sourceErrorResponse, missingEnvResponse } from "@/lib/sources/helpers";

// Extract channel ID and message timestamp from a Slack permalink
// https://{workspace}.slack.com/archives/{channelId}/p{timestamp}
const SLACK_URL_RE =
  /slack\.com\/archives\/([A-Z0-9]+)\/p(\d+)/;

function parseSlackTs(rawTs: string): string {
  // p1773861817841769 → 1773861817.841769
  return rawTs.slice(0, -6) + "." + rawTs.slice(-6);
}

function formatTs(ts: string): string {
  const date = new Date(parseFloat(ts) * 1000);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function slackApi(
  method: string,
  token: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  return res.json();
}

export async function POST(request: Request) {
  const { url } = await request.json();

  const match = url.match(SLACK_URL_RE);
  if (!match) {
    return sourceErrorResponse(url, "slack", "**Could not parse Slack URL.** Expected a message permalink.");
  }

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return missingEnvResponse(url, "slack", "SLACK_BOT_TOKEN", "Create a Slack app at https://api.slack.com/apps with scopes: `channels:history`, `channels:read`, `groups:history`, `groups:read`, `users:read`.");
  }

  const channelId = match[1];
  const messageTs = parseSlackTs(match[2]);

  // Check for thread_ts in the URL query params
  let threadTs: string | null = null;
  try {
    const parsed = new URL(url);
    threadTs = parsed.searchParams.get("thread_ts");
  } catch {
    // ignore
  }

  try {
    // Fetch messages — try thread first, fall back to single message
    type SlackMessage = {
      user?: string;
      ts: string;
      text: string;
      bot_id?: string;
      username?: string;
    };
    let messages: SlackMessage[] = [];

    if (threadTs) {
      // URL explicitly references a thread
      const resp = await slackApi("conversations.replies", token, {
        channel: channelId,
        ts: threadTs,
      });
      if (resp.ok) {
        messages = resp.messages as SlackMessage[];
      }
    }

    if (messages.length === 0) {
      // Try fetching as thread parent
      const resp = await slackApi("conversations.replies", token, {
        channel: channelId,
        ts: messageTs,
      });
      if (resp.ok && (resp.messages as SlackMessage[]).length > 0) {
        messages = resp.messages as SlackMessage[];
      }
    }

    if (messages.length === 0) {
      // Single message fallback
      const resp = await slackApi("conversations.history", token, {
        channel: channelId,
        oldest: messageTs,
        latest: messageTs,
        inclusive: "true",
        limit: "1",
      });
      if (resp.ok) {
        messages = resp.messages as SlackMessage[];
      }
    }

    if (messages.length === 0) {
      return sourceErrorResponse(url, "slack", "**Could not fetch Slack message.** Check that the bot has access to this channel.");
    }

    // Fetch channel name
    const channelResp = await slackApi("conversations.info", token, {
      channel: channelId,
    });
    const channelName =
      channelResp.ok && (channelResp.channel as { name?: string })?.name
        ? `#${(channelResp.channel as { name: string }).name}`
        : channelId;

    // Resolve user names
    const userIds = [
      ...new Set(messages.map((m) => m.user).filter(Boolean) as string[]),
    ];
    const userNames: Record<string, string> = {};
    await Promise.all(
      userIds.map(async (uid) => {
        const resp = await slackApi("users.info", token, { user: uid });
        if (resp.ok) {
          const user = resp.user as {
            real_name?: string;
            profile?: { display_name?: string };
            name?: string;
          };
          userNames[uid] =
            user.profile?.display_name || user.real_name || user.name || uid;
        } else {
          userNames[uid] = uid;
        }
      }),
    );

    // Format as markdown
    const lines: string[] = [];
    for (const msg of messages) {
      const name =
        msg.user && userNames[msg.user]
          ? userNames[msg.user]
          : msg.username || "bot";
      lines.push(`**@${name}** (${formatTs(msg.ts)}):`);
      lines.push(msg.text);
      lines.push("");
    }

    const title =
      messages.length > 1
        ? `${channelName} — thread (${messages.length} messages)`
        : `${channelName} — message`;

    return NextResponse.json({
      title,
      content: lines.join("\n"),
      sourceType: "slack",
      sourceUrl: url,
    });
  } catch {
    return sourceErrorResponse(url, "slack", "**Failed to fetch Slack content.** Check that the URL is correct and your `SLACK_BOT_TOKEN` has access to this channel.");
  }
}
