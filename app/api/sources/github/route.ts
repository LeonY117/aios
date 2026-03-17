import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

// groups: [1]=owner, [2]=repo, [3]=pull|issues, [4]=number
const PR_OR_ISSUE_RE =
  /github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/;

export async function POST(request: Request) {
  const { url } = await request.json();

  const match = url.match(PR_OR_ISSUE_RE);
  if (!match) {
    return NextResponse.json({
      title: url,
      content: "**Could not parse GitHub URL.** Expected a PR or issue link.",
      sourceType: "github",
      sourceUrl: url,
    });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({
      title: url,
      content:
        "**Set `GITHUB_TOKEN` in `.env.local`** to fetch GitHub content.\n\nCreate a personal access token at https://github.com/settings/tokens with `repo` scope.",
      sourceType: "github",
      sourceUrl: url,
    });
  }

  const [, owner, repo, , number] = match;
  const num = parseInt(number, 10);
  const isPR = url.includes("/pull/");
  const octokit = new Octokit({ auth: token });

  try {
    if (isPR) {
      const [pr, diff, comments] = await Promise.all([
        octokit.pulls.get({ owner, repo, pull_number: num }),
        octokit.pulls.get({
          owner,
          repo,
          pull_number: num,
          mediaType: { format: "diff" },
        }),
        octokit.pulls.listReviewComments({ owner, repo, pull_number: num }),
      ]);

      const title = `PR #${num}: ${pr.data.title}`;
      const lines: string[] = [
        `# ${title}`,
        "",
        `**State:** ${pr.data.state} | **Author:** ${pr.data.user?.login} | **Branch:** \`${pr.data.head.ref}\` → \`${pr.data.base.ref}\``,
        "",
      ];

      if (pr.data.body) {
        lines.push("## Description", "", pr.data.body, "");
      }

      lines.push("## Diff", "", "```diff", diff.data as unknown as string, "```", "");

      if (comments.data.length > 0) {
        lines.push("## Review Comments", "");
        for (const c of comments.data) {
          lines.push(
            `**${c.user?.login}** on \`${c.path}\`:`,
            "",
            c.body,
            "",
            "---",
            "",
          );
        }
      }

      return NextResponse.json({
        title,
        content: lines.join("\n"),
        sourceType: "github",
        sourceUrl: url,
      });
    } else {
      // Issue
      const [issue, comments] = await Promise.all([
        octokit.issues.get({ owner, repo, issue_number: num }),
        octokit.issues.listComments({ owner, repo, issue_number: num }),
      ]);

      const title = `Issue #${num}: ${issue.data.title}`;
      const labels = issue.data.labels
        .map((l) => (typeof l === "string" ? l : l.name))
        .filter(Boolean)
        .join(", ");
      const lines: string[] = [
        `# ${title}`,
        "",
        `**State:** ${issue.data.state} | **Author:** ${issue.data.user?.login}`,
      ];

      if (labels) {
        lines.push(`**Labels:** ${labels}`);
      }
      lines.push("");

      if (issue.data.body) {
        lines.push("## Description", "", issue.data.body, "");
      }

      if (comments.data.length > 0) {
        lines.push("## Comments", "");
        for (const c of comments.data) {
          lines.push(`**${c.user?.login}:**`, "", c.body ?? "", "", "---", "");
        }
      }

      return NextResponse.json({
        title,
        content: lines.join("\n"),
        sourceType: "github",
        sourceUrl: url,
      });
    }
  } catch {
    return NextResponse.json({
      title: url,
      content:
        "**Failed to fetch GitHub content.** Check that the URL is correct and your `GITHUB_TOKEN` has access to this repository.",
      sourceType: "github",
      sourceUrl: url,
    });
  }
}
