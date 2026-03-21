import Canvas from "@/components/canvas/Canvas";

type Props = {
  params: Promise<{ workspace: string }>;
};

export default async function WorkspacePage({ params }: Props) {
  const { workspace } = await params;
  return <Canvas workspace={decodeURIComponent(workspace)} />;
}
