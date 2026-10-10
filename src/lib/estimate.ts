/** Pure cost maths shared by the wizard (client) and services (server). */
import type { CentiSft } from "./area";
import type { Paise } from "./money";

export function totalSlabArea(slabAreas: readonly CentiSft[]): CentiSft {
  return slabAreas.reduce((a, b) => a + b, 0);
}

/** total area (centi-SFT) × cost per SFT (paise) → paise, rounded half up. */
export function estimatedCost(totalAreaCenti: CentiSft, costPerSftPaise: Paise): Paise {
  const product = BigInt(totalAreaCenti) * BigInt(costPerSftPaise);
  return Number((product + 50n) / 100n);
}

export interface CostInputs {
  estimatedCost: Paise;
  contractValue: Paise | null;
  /** MATERIAL, MACHINERY, LOGISTICS, SITE_EXPENSE, OTHER transactions (active) */
  expenseCost: Paise;
  /** LABOR attendance cost (active) */
  laborCost: Paise;
  clientReceived: Paise;
  /** Unpaid vendor / labor-party costs minus payments made to them */
  pendingPayments: Paise;
}

export interface ProjectKpis {
  estimatedCost: Paise;
  actualCost: Paise;
  remaining: Paise;
  clientReceived: Paise;
  clientBalance: Paise;
  contractValue: Paise;
  pendingPayments: Paise;
}

/**
 * Actual cost = everything incurred (expenses + labor attendance + machinery), paid or not.
 * Client balance = contract value (falls back to estimated cost) − client received.
 */
export function projectKpis(i: CostInputs): ProjectKpis {
  const actualCost = i.expenseCost + i.laborCost;
  const contractValue = i.contractValue ?? i.estimatedCost;
  return {
    estimatedCost: i.estimatedCost,
    actualCost,
    remaining: i.estimatedCost - actualCost,
    clientReceived: i.clientReceived,
    clientBalance: contractValue - i.clientReceived,
    contractValue,
    pendingPayments: i.pendingPayments,
  };
}

/** Cost per SFT for comparisons: paise per SFT, null when there is no area. */
export function costPerSft(costPaise: Paise, areaCenti: CentiSft): Paise | null {
  if (areaCenti <= 0) return null;
  return Math.round((costPaise * 100) / areaCenti);
}
