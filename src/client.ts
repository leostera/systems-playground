import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { SystemDiagram } from "./diagram";
import { DEFAULT_PARAMETERS, simulate, type ModelParameters, type ModelPoint } from "./model";

const byId = <T extends Element>(id: string): T => {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) throw new Error(`Missing page element: ${id}`);
  return element;
};

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const controls = {
  regeneration: byId<HTMLInputElement>("regeneration"),
  consumption: byId<HTMLInputElement>("consumption"),
  birthRate: byId<HTMLInputElement>("birth-rate"),
  horizon: byId<HTMLInputElement>("horizon"),
};
const outputs = {
  regeneration: byId<HTMLOutputElement>("regeneration-value"),
  consumption: byId<HTMLOutputElement>("consumption-value"),
  birthRate: byId<HTMLOutputElement>("birth-rate-value"),
  horizon: byId<HTMLOutputElement>("horizon-value"),
};
const scrubber = byId<HTMLInputElement>("scrubber");
const chart = byId<SVGSVGElement>("chart");
const diagram = createRoot(byId<HTMLDivElement>("diagram-root"));
const playButton = byId<HTMLButtonElement>("play");
let parameters: ModelParameters = { ...DEFAULT_PARAMETERS };
let points: ModelPoint[] = [];
let playback: number | undefined;

function readParameters(): ModelParameters {
  return {
    ...DEFAULT_PARAMETERS,
    regenerationRate: Number(controls.regeneration.value) / 100,
    consumptionPerPerson: Number(controls.consumption.value),
    birthRate: Number(controls.birthRate.value) / 100,
    years: Number(controls.horizon.value),
  };
}

function describeControls(): void {
  outputs.regeneration.value = `${controls.regeneration.value}% / year`;
  outputs.consumption.value = `${Number(controls.consumption.value).toFixed(1)} units / person`;
  outputs.birthRate.value = `${Number(controls.birthRate.value).toFixed(1)}% births / year`;
  outputs.horizon.value = `${controls.horizon.value} years`;
}

function chartPath(series: number[], maximum: number, xStart: number, xEnd: number, yTop: number, yBottom: number): string {
  const last = Math.max(1, series.length - 1);
  return series.map((value, index) => {
    const x = xStart + (index / last) * (xEnd - xStart);
    const y = yBottom - (value / Math.max(maximum, 1)) * (yBottom - yTop);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function updateChart(): void {
  const xStart = 42;
  const xEnd = 686;
  const yTop = 12;
  const yBottom = 147;
  const populationPeak = Math.max(...points.map(({ population }) => population));
  const resourcePeak = Math.max(...points.map(({ resource }) => resource));
  const years = points.at(-1)?.year ?? 1;
  const grid = [0, 1, 2, 3].map((line) => {
    const y = yTop + ((yBottom - yTop) * line) / 3;
    return `<line class="gridline" x1="${xStart}" x2="${xEnd}" y1="${y}" y2="${y}"/><text class="axis-label" x="${xStart - 8}" y="${y + 3}" text-anchor="end">${100 - line * 25}%</text>`;
  }).join("");
  const populationPath = chartPath(points.map(({ population }) => population), populationPeak, xStart, xEnd, yTop, yBottom);
  const resourcePath = chartPath(points.map(({ resource }) => resource), resourcePeak, xStart, xEnd, yTop, yBottom);
  chart.innerHTML = `${grid}<path class="resource-path" d="${resourcePath}"/><path class="population-path" d="${populationPath}"/><line id="chart-cursor" class="cursor-line" x1="${xStart}" x2="${xStart}" y1="${yTop}" y2="${yBottom}"/><text class="axis-label" x="${xStart}" y="165">0</text><text class="axis-label" x="${xEnd}" y="165" text-anchor="end">${years} years</text>`;
  scrubber.max = String(years);
  scrubber.value = String(Math.min(Number(scrubber.value), years));
  byId<HTMLElement>("horizon-label").textContent = `${years} YEARS`;
}

function updateReadout(): void {
  const year = Number(scrubber.value);
  const point = points.reduce((closest, candidate) =>
    Math.abs(candidate.year - year) < Math.abs(closest.year - year) ? candidate : closest,
  points[0]);
  const cursorX = 42 + (year / Math.max(parameters.years, 1)) * (686 - 42);
  const cursor = byId<SVGLineElement>("chart-cursor");
  cursor.setAttribute("x1", String(cursorX));
  cursor.setAttribute("x2", String(cursorX));
  byId<HTMLElement>("year-label").textContent = `Year ${fmt.format(point.year)}`;
  byId<HTMLElement>("readout-year").textContent = fmt.format(point.year);
  byId<HTMLElement>("readout-population").textContent = fmt.format(point.population);
  byId<HTMLElement>("readout-resource").textContent = fmt.format(point.resource);
  diagram.render(createElement(SystemDiagram, { population: point.population, resource: point.resource }));
}

function updateInsight(): void {
  const start = points[0];
  const finish = points.at(-1);
  if (!start || !finish) return;
  const resourceRatio = finish.resource / Math.max(start.resource, 1);
  if (resourceRatio < 0.2) {
    byId<HTMLElement>("insight-copy").textContent = "Growth can outrun renewal. The limit only becomes visible after the stock has been drawn down.";
    byId<HTMLElement>("insight-detail").textContent = "Notice how long it takes for the balancing loop to change the trend.";
  } else if (finish.population > start.population * 1.5) {
    byId<HTMLElement>("insight-copy").textContent = "A reinforcing loop is at work: more people means more growth, until resource pressure pushes back.";
    byId<HTMLElement>("insight-detail").textContent = "The system’s structure shapes the behavior you see.";
  } else {
    byId<HTMLElement>("insight-copy").textContent = "A system’s behavior comes from its structure—not from any one person’s intentions.";
    byId<HTMLElement>("insight-detail").textContent = "Small changes can compound over time.";
  }
}

function stopPlayback(): void {
  if (playback !== undefined) window.clearInterval(playback);
  playback = undefined;
  playButton.textContent = "▶   Play";
  playButton.setAttribute("aria-label", "Play simulation");
}

function render(): void {
  stopPlayback();
  parameters = readParameters();
  points = simulate(parameters);
  describeControls();
  updateChart();
  updateReadout();
  updateInsight();
}

for (const control of Object.values(controls)) control.addEventListener("input", render);
scrubber.addEventListener("input", updateReadout);
byId<HTMLButtonElement>("reset").addEventListener("click", () => {
  controls.regeneration.value = "10";
  controls.consumption.value = "1.8";
  controls.birthRate.value = "3.5";
  controls.horizon.value = "80";
  scrubber.value = "0";
  render();
});
playButton.addEventListener("click", () => {
  if (playback !== undefined) {
    stopPlayback();
    return;
  }
  if (Number(scrubber.value) >= parameters.years) scrubber.value = "0";
  playButton.textContent = "Ⅱ   Pause";
  playButton.setAttribute("aria-label", "Pause simulation");
  playback = window.setInterval(() => {
    const next = Number(scrubber.value) + 1;
    scrubber.value = String(next);
    updateReadout();
    if (next >= parameters.years) stopPlayback();
  }, 90);
});

render();
