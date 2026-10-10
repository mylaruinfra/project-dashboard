import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";

export default function NoAccessPage() {
  return <EmptyState title="You do not have access to this" body="Your role or project assignment does not include this page. Ask an admin if you need it." action={<LinkButton href="/dashboard" variant="secondary">Go to dashboard</LinkButton>} />;
}
