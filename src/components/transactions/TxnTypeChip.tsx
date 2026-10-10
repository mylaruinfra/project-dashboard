import { Chip, type ChipTone } from "@/components/ui/Chip";
import { TXN_TYPE_LABEL, type TxnType } from "@/lib/domain";

const TONE: Record<TxnType, ChipTone> = {
  LABOR: "hazard",
  MATERIAL: "indigo",
  MACHINERY: "indigo",
  LOGISTICS: "muted",
  SITE_EXPENSE: "muted",
  CLIENT_PAYMENT: "ink",
  CONTRACTOR_PAYMENT: "ink",
  OTHER: "muted",
};

export function TxnTypeChip({ type }: { type: TxnType }) {
  return <Chip tone={TONE[type]}>{TXN_TYPE_LABEL[type]}</Chip>;
}
