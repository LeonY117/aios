import { NextResponse } from "next/server";

export function sourceErrorResponse(
  url: string,
  sourceType: string,
  message: string,
) {
  return NextResponse.json({
    title: url,
    content: message,
    sourceType,
    sourceUrl: url,
  });
}

export function missingEnvResponse(
  url: string,
  sourceType: string,
  envKey: string,
  setupInstructions: string,
) {
  return sourceErrorResponse(
    url,
    sourceType,
    `**Set \`${envKey}\` in \`.env.local\`** to fetch ${sourceType} content.\n\n${setupInstructions}`,
  );
}
