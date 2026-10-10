export interface StockSpec {
  id: string;
  initial: number;
}

export interface FlowSpec {
  id: string;
  rate: number;
  sourceStockId?: string;
  targetStockId?: string;
}

export interface InfluenceSpec {
  sourceStockId: string;
  targetFlowId: string;
  polarity: 1 | -1;
}

export interface SimulationPoint {
  year: number;
  stocks: Record<string, number>;
}

function requireNonNegative(value: number, description: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${description} must be a finite non-negative number`);
  }
}

/** Simulate arbitrary stocks, fixed-rate flows, and signed stock-to-flow influences. */
export function simulate(
  stocks: StockSpec[],
  flows: FlowSpec[],
  influences: InfluenceSpec[] = [],
  years = 40,
  step = 0.25,
): SimulationPoint[] {
  requireNonNegative(years, "Simulation horizon");
  if (!Number.isFinite(step) || step <= 0) throw new RangeError("Simulation step must be positive");

  const levels = new Map<string, number>();
  const startingLevels = new Map<string, number>();
  for (const stock of stocks) {
    requireNonNegative(stock.initial, `Initial level for ${stock.id}`);
    if (levels.has(stock.id)) throw new RangeError(`Duplicate stock id: ${stock.id}`);
    levels.set(stock.id, stock.initial);
    startingLevels.set(stock.id, stock.initial);
  }
  for (const flow of flows) requireNonNegative(flow.rate, `Rate for ${flow.id}`);

  const flowInfluences = new Map<string, InfluenceSpec[]>();
  for (const influence of influences) {
    if (!levels.has(influence.sourceStockId)) continue;
    const links = flowInfluences.get(influence.targetFlowId) ?? [];
    links.push(influence);
    flowInfluences.set(influence.targetFlowId, links);
  }

  const points: SimulationPoint[] = [];
  let year = 0;

  while (true) {
    points.push({ year, stocks: Object.fromEntries(levels) });
    if (year >= years) break;

    const elapsed = Math.min(step, years - year);
    const effectiveRates = flows.map((flow) => {
      const influenceFactor = (flowInfluences.get(flow.id) ?? []).reduce((factor, influence) => {
        const current = levels.get(influence.sourceStockId) ?? 0;
        const initial = Math.max(startingLevels.get(influence.sourceStockId) ?? 0, 0.01);
        const relativeLevel = current / initial;
        return factor * (influence.polarity === 1 ? relativeLevel : 1 / Math.max(relativeLevel, 0.1));
      }, 1);
      return { ...flow, effectiveRate: flow.rate * influenceFactor };
    });

    const requestedOutflow = new Map<string, number>();
    for (const flow of effectiveRates) {
      if (flow.sourceStockId && levels.has(flow.sourceStockId)) {
        requestedOutflow.set(flow.sourceStockId, (requestedOutflow.get(flow.sourceStockId) ?? 0) + flow.effectiveRate);
      }
    }

    const scaleByStock = new Map<string, number>();
    for (const [stockId, requestedRate] of requestedOutflow) {
      const available = levels.get(stockId) ?? 0;
      scaleByStock.set(stockId, Math.min(1, available / Math.max(requestedRate * elapsed, 0.01)));
    }

    const changes = new Map<string, number>();
    for (const flow of effectiveRates) {
      const scale = flow.sourceStockId ? scaleByStock.get(flow.sourceStockId) ?? 1 : 1;
      const amount = flow.effectiveRate * scale * elapsed;
      if (flow.sourceStockId && levels.has(flow.sourceStockId)) {
        changes.set(flow.sourceStockId, (changes.get(flow.sourceStockId) ?? 0) - amount);
      }
      if (flow.targetStockId && levels.has(flow.targetStockId)) {
        changes.set(flow.targetStockId, (changes.get(flow.targetStockId) ?? 0) + amount);
      }
    }

    for (const [stockId, change] of changes) {
      levels.set(stockId, Math.max(0, (levels.get(stockId) ?? 0) + change));
    }
    year += elapsed;
  }

  return points;
}
