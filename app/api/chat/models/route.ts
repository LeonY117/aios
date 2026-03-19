import { getAvailableModels } from "@/lib/ai/models";

export async function GET() {
  const models = getAvailableModels();
  return Response.json(models);
}
