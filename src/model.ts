export interface ModelParameters {
  population: number;
  resource: number;
  capacity: number;
  regenerationRate: number;
  consumptionPerPerson: number;
  birthRate: number;
  deathRate: number;
  years: number;
}

export interface ModelPoint {
  year: number;
  population: number;
  resource: number;
}

export const DEFAULT_PARAMETERS: ModelParameters = {
  population: 1_000,
  resource: 9_000,
  capacity: 15_000,
  regenerationRate: 0.1,
  consumptionPerPerson: 1.8,
  birthRate: 0.035,
  deathRate: 0.02,
  years: 80,
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

/** Euler integration of a renewable commons and the population that depends on it. */
export function simulate(parameters: ModelParameters, step = 0.25): ModelPoint[] {
  const points: ModelPoint[] = [];
  let population = parameters.population;
  let resource = parameters.resource;
  const count = Math.ceil(parameters.years / step);

  for (let index = 0; index <= count; index += 1) {
    const year = Math.min(index * step, parameters.years);
    points.push({ year, population, resource });

    if (index === count) break;

    const resourcePressure = clamp(resource / (parameters.capacity * 0.4), 0.2, 1);
    const naturalGrowth = parameters.regenerationRate * resource * (1 - resource / parameters.capacity);
    const harvest = population * parameters.consumptionPerPerson;
    const populationChange = population * (parameters.birthRate * resourcePressure - parameters.deathRate);

    resource = clamp(resource + (naturalGrowth - harvest) * step, 0, parameters.capacity);
    population = Math.max(0, population + populationChange * step);
  }

  return points;
}
