import { AgentEditor } from '@/features/agents';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentEditor id={id} />;
}
