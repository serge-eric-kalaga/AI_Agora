import { AgentEditor, AgentProfile } from '@/features/agents';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ id }, { edit }] = await Promise.all([params, searchParams]);
  return edit === '1' ? <AgentEditor id={id} /> : <AgentProfile id={id} />;
}
