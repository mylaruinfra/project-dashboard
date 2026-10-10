import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";

export default function NotFound() {
  return <EmptyState title="Not found" body="This record does not exist or was removed." action={<LinkButton href="/dashboard" variant="secondary">Go to dashboard</LinkButton>} />;
}
