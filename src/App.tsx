import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { simulate, type FlowSpec, type InfluenceSpec, type SimulationPoint, type StockSpec } from "./model";

interface CanvasData extends Record<string, unknown> {
  kind: "stock" | "source" | "sink" | "flow";
  label: string;
  initial?: number;
  rate?: number;
  unit?: string;
  polarity?: 1 | -1;
}

type CanvasNode = Node<CanvasData>;
type CanvasEdgeData = Record<string, unknown> & { kind: "pipe" | "influence"; polarity?: 1 | -1 };
type CanvasEdge = Edge<CanvasEdgeData>;
type ConnectMode = "select" | "pipe" | "influence";
type Graph = { nodes: CanvasNode[]; edges: CanvasEdge[] };

const STORAGE_KEY = "systems-playground:graph:v1";
const HORIZON = 40;
const STEP = 0.25;
const STOCK_COLORS = ["#39745d", "#527e91", "#ad7044", "#766596", "#8b7862"];

const starterGraph: Graph = {
  nodes: [
    { id: "rain", type: "cloud", position: { x: 50, y: 205 }, data: { kind: "source", label: "Outside world" } },
    { id: "inflow", type: "flow", position: { x: 270, y: 205 }, data: { kind: "flow", label: "Inflow", rate: 8, unit: "units / year" } },
    { id: "water", type: "stock", position: { x: 500, y: 190 }, data: { kind: "stock", label: "Water in tub", initial: 60, unit: "units" } },
    { id: "drain", type: "flow", position: { x: 770, y: 205 }, data: { kind: "flow", label: "Outflow", rate: 6, unit: "units / year" } },
    { id: "sink", type: "cloud", position: { x: 1010, y: 205 }, data: { kind: "sink", label: "Beyond the boundary" } },
  ],
  edges: [
    { id: "rain-inflow", source: "rain", sourceHandle: "pipe-out", target: "inflow", targetHandle: "pipe-in", type: "smoothstep", data: { kind: "pipe" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#42433e" }, style: { stroke: "#42433e", strokeWidth: 1.5 } },
    { id: "inflow-water", source: "inflow", sourceHandle: "pipe-out", target: "water", targetHandle: "pipe-in", type: "smoothstep", data: { kind: "pipe" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#42433e" }, style: { stroke: "#42433e", strokeWidth: 1.5 } },
    { id: "water-drain", source: "water", sourceHandle: "pipe-out", target: "drain", targetHandle: "pipe-in", type: "smoothstep", data: { kind: "pipe" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#42433e" }, style: { stroke: "#42433e", strokeWidth: 1.5 } },
    { id: "drain-sink", source: "drain", sourceHandle: "pipe-out", target: "sink", targetHandle: "pipe-in", type: "smoothstep", data: { kind: "pipe" }, markerEnd: { type: MarkerType.ArrowClosed, color: "#42433e" }, style: { stroke: "#42433e", strokeWidth: 1.5 } },
    { id: "water-regulates-outflow", source: "water", sourceHandle: "info-out", target: "drain", targetHandle: "info-in", type: "default", data: { kind: "influence", polarity: 1 }, label: "+", markerEnd: { type: MarkerType.ArrowClosed, color: "#718da0" }, style: { stroke: "#718da0", strokeWidth: 1.2, strokeDasharray: "4 4" }, labelStyle: { fill: "#617d90", fontWeight: 600, fontSize: 11 }, labelBgStyle: { fill: "#fff", fillOpacity: 0.95 } },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCanvasNode(value: unknown): value is CanvasNode {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.type !== "string" || !isRecord(value.position) || !isRecord(value.data)) return false;
  const data = value.data;
  return ["stock", "source", "sink", "flow"].includes(String(data.kind))
    && typeof data.label === "string"
    && typeof value.position.x === "number"
    && typeof value.position.y === "number";
}

function isCanvasEdge(value: unknown): value is CanvasEdge {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.source === "string"
    && typeof value.target === "string"
    && isRecord(value.data)
    && (value.data.kind === "pipe" || value.data.kind === "influence");
}

function isGraph(value: unknown): value is Graph {
  return isRecord(value)
    && Array.isArray(value.nodes)
    && value.nodes.every(isCanvasNode)
    && Array.isArray(value.edges)
    && value.edges.every(isCanvasEdge);
}

function loadGraph(): Graph {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (isGraph(parsed)) return parsed;
    }
  } catch {
    // A blocked or malformed local save should not prevent opening the playground.
  }
  return starterGraph;
}

function makeNode(type: "stock" | "flow" | "source" | "sink", index: number): CanvasNode {
  const id = crypto.randomUUID();
  const offset = (index % 7) * 35;
  if (type === "stock") {
    return { id, type, position: { x: 390 + offset, y: 145 + offset }, data: { kind: "stock", label: "New stock", initial: 100, unit: "units" } };
  }
  if (type === "flow") {
    return { id, type, position: { x: 250 + offset, y: 145 + offset }, data: { kind: "flow", label: "New flow", rate: 10, unit: "units / year" } };
  }
  const isSource = type === "source";
  return {
    id,
    type: "cloud",
    position: { x: isSource ? 80 + offset : 900 + offset, y: 145 + offset },
    data: { kind: type, label: isSource ? "New source" : "New sink" },
  };
}

function StockNode({ data, selected }: NodeProps<CanvasNode>) {
  return (
    <div className={`diagram-node stock-node${selected ? " selected" : ""}`}>
      <Handle id="pipe-in" type="target" position={Position.Left} />
      <Handle id="info-in" type="target" position={Position.Top} />
      <div className="node-eyebrow">Stock · accumulation</div>
      <div className="node-title">{data.label}</div>
      <div className="stock-level">{Number(data.current ?? data.initial ?? 0).toLocaleString("en-US")} <span>{data.unit || "units"}</span></div>
      <Handle id="pipe-out" type="source" position={Position.Right} />
      <Handle id="info-out" type="source" position={Position.Bottom} />
    </div>
  );
}

function CloudNode({ data, selected }: NodeProps<CanvasNode>) {
  const isSource = data.kind === "source";
  return (
    <div className={`diagram-node cloud-node ${isSource ? "source-node" : "sink-node"}${selected ? " selected" : ""}`}>
      {isSource
        ? <Handle id="pipe-out" type="source" position={Position.Right} />
        : <Handle id="pipe-in" type="target" position={Position.Left} />}
      <svg className="cloud-outline" viewBox="0 0 148 72" aria-hidden="true"><path d="M26 54C12 54 8 45 11 37c2-7 9-10 16-9 1-13 12-19 22-16 8-10 25-9 30 2 12-5 25 1 26 12 12-1 20 7 19 16-1 8-8 12-18 12H26Z"/></svg>
      <span className="cloud-content"><span className="cloud-label">{data.label}</span><span className="cloud-caption">{isSource ? "source" : "sink"}</span></span>
    </div>
  );
}

function FlowNode({ data, selected }: NodeProps<CanvasNode>) {
  return (
    <div className={`diagram-node flow-node${selected ? " selected" : ""}`}>
      <Handle id="pipe-in" type="target" position={Position.Left} />
      <Handle id="info-in" type="target" position={Position.Top} />
      <span className="valve" aria-hidden="true"><span /></span>
      <span className="flow-title">{data.label}</span>
      <span className="flow-rate">{Number(data.rate ?? 0).toLocaleString("en-US")} / year</span>
      <Handle id="pipe-out" type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes: NodeTypes = { stock: StockNode, cloud: CloudNode, flow: FlowNode };

function currentModel(nodes: CanvasNode[], edges: CanvasEdge[]) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const stocks: StockSpec[] = nodes
    .filter((node) => node.type === "stock")
    .map((node) => ({ id: node.id, initial: Math.max(0, Number(node.data.initial ?? 0)) }));
  const flows: FlowSpec[] = nodes
    .filter((node) => node.type === "flow")
    .map((node) => {
      const input = edges.find((edge) => edge.data?.kind === "pipe" && edge.target === node.id);
      const output = edges.find((edge) => edge.data?.kind === "pipe" && edge.source === node.id);
      const source = input ? nodesById.get(input.source) : undefined;
      const target = output ? nodesById.get(output.target) : undefined;
      return {
        id: node.id,
        rate: Math.max(0, Number(node.data.rate ?? 0)),
        sourceStockId: source?.type === "stock" ? source.id : undefined,
        targetStockId: target?.type === "stock" ? target.id : undefined,
      };
    });
  const influences: InfluenceSpec[] = edges
    .filter((edge) => edge.data?.kind === "influence")
    .flatMap((edge) => {
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);
      if (source?.type !== "stock" || target?.type !== "flow") return [];
      return [{ sourceStockId: source.id, targetFlowId: target.id, polarity: edge.data?.polarity === -1 ? -1 as const : 1 as const }];
    });
  return { stocks, flows, influences };
}

function nodeTypeLabel(node: CanvasNode): string {
  if (node.type === "stock") return "Stock";
  if (node.type === "flow") return "Flow";
  return node.data.kind === "source" ? "Source cloud" : "Sink cloud";
}

function CanvasToolbar({ mode, setMode, addNode }: {
  mode: ConnectMode;
  setMode: (mode: ConnectMode) => void;
  addNode: (type: "stock" | "flow" | "source" | "sink") => void;
}) {
  return (
    <aside className="tool-rail">
      <div className="tool-group">
        <button className={`tool-button${mode === "select" ? " active" : ""}`} onClick={() => setMode("select")} title="Select and move elements"><span className="tool-icon">↖</span><span>Select</span><span className="tool-hint">V</span></button>
      </div>
      <div className="tool-group">
        <button className="tool-button" onClick={() => addNode("stock")} title="Add stock"><span className="tool-icon stock-icon">□</span><span>Stock</span><span className="tool-hint">S</span></button>
        <button className="tool-button" onClick={() => addNode("source")} title="Add source cloud"><span className="tool-icon cloud-icon">☁</span><span>Source cloud</span></button>
        <button className="tool-button" onClick={() => addNode("sink")} title="Add sink cloud"><span className="tool-icon cloud-icon">☁</span><span>Sink cloud</span></button>
        <button className="tool-button" onClick={() => addNode("flow")} title="Add flow valve"><span className="tool-icon flow-icon">◈</span><span>Flow / valve</span><span className="tool-hint">F</span></button>
      </div>
      <div className="tool-group">
        <button className={`tool-button${mode === "pipe" ? " active" : ""}`} onClick={() => setMode(mode === "pipe" ? "select" : "pipe")} title="Draw material flow"><span className="tool-icon pipe-icon">⟶</span><span>Material flow</span></button>
        <button className={`tool-button${mode === "influence" ? " active" : ""}`} onClick={() => setMode(mode === "influence" ? "select" : "influence")} title="Draw information link"><span className="tool-icon info-icon">⇢</span><span>Influence arrow</span></button>
      </div>
      <div className="tool-help">{mode === "pipe" ? "Connect through a valve" : mode === "influence" ? "Stock → flow rate" : "Drag to arrange"}</div>
    </aside>
  );
}

function Inspector({ node, edge, updateNode, updateEdge, deleteSelection }: {
  node?: CanvasNode;
  edge?: CanvasEdge;
  updateNode: (id: string, data: Partial<CanvasData>) => void;
  updateEdge: (id: string, data: Partial<CanvasEdgeData>) => void;
  deleteSelection: () => void;
}) {
  if (node) {
    return (
      <div className="inspector-content">
        <div className="inspector-eyebrow">{nodeTypeLabel(node)}</div>
        <label className="field-label" htmlFor="element-name">Name</label>
        <input id="element-name" className="text-field" value={node.data.label} onChange={(event) => updateNode(node.id, { label: event.target.value })} />
        {node.type === "stock" && <>
          <label className="field-label" htmlFor="stock-level-input">Initial quantity</label>
          <div className="input-with-unit"><input id="stock-level-input" className="text-field" type="number" min="0" step="1" value={Number(node.data.initial ?? 0)} onChange={(event) => updateNode(node.id, { initial: Math.max(0, Number(event.target.value)) })} /><span>{node.data.unit || "units"}</span></div>
          <p className="field-note">A stock is an accumulation. Inflows add to it; outflows drain it.</p>
        </>}
        {node.type === "flow" && <>
          <label className="field-label" htmlFor="flow-rate-input">Flow rate</label>
          <div className="input-with-unit"><input id="flow-rate-input" className="text-field" type="number" min="0" step="0.5" value={Number(node.data.rate ?? 0)} onChange={(event) => updateNode(node.id, { rate: Math.max(0, Number(event.target.value)) })} /><span>units / year</span></div>
          <p className="field-note">The valve controls the rate. A stock cannot drain below zero.</p>
        </>}
        {(node.data.kind === "source" || node.data.kind === "sink") && <p className="field-note">Clouds mark sources or sinks outside the boundary of the model.</p>}
        <button className="delete-button" onClick={deleteSelection}>Delete element</button>
      </div>
    );
  }

  if (edge) {
    const isInfluence = edge.data?.kind === "influence";
    return (
      <div className="inspector-content">
        <div className="inspector-eyebrow">{isInfluence ? "Information link" : "Material flow"}</div>
        {isInfluence
          ? <>
            <div className="field-label">Polarity</div>
            <div className="segmented-control">
              <button className={edge.data?.polarity !== -1 ? "chosen" : ""} onClick={() => updateEdge(edge.id, { polarity: 1 })}>+ &nbsp; Same direction</button>
              <button className={edge.data?.polarity === -1 ? "chosen" : ""} onClick={() => updateEdge(edge.id, { polarity: -1 })}>− &nbsp; Opposite</button>
            </div>
            <p className="field-note">A signed arrow from a stock to a flow adjusts the flow rate as the stock changes.</p>
          </>
          : <p className="field-note">Material moves in the direction of the arrow. The connected flow valve sets its rate.</p>}
        <button className="delete-button" onClick={deleteSelection}>Delete connection</button>
      </div>
    );
  }

  return (
    <div className="inspector-content inspector-empty">
      <div className="empty-orbit">◎</div>
      <strong>Make a system</strong>
      <span>Select a stock, cloud, valve, or arrow to edit its properties.</span>
      <div className="definition"><b>Stock</b><span>A quantity that accumulates or drains.</span></div>
      <div className="definition"><b>Flow</b><span>A rate of change, set by its valve.</span></div>
      <div className="definition"><b>Cloud</b><span>A source or sink beyond this model.</span></div>
      <div className="definition"><b>Arrow</b><span>Information about what influences a flow.</span></div>
    </div>
  );
}

function SimulationChart({ points, stocks }: { points: SimulationPoint[]; stocks: CanvasNode[] }) {
  if (stocks.length === 0 || points.length === 0) return <div className="chart-empty">Add a stock to see how its level changes over time.</div>;
  const width = 560;
  const height = 100;
  const left = 8;
  const right = width - 8;
  const top = 8;
  const bottom = height - 8;
  const paths = stocks.map((stock, index) => {
    const values = points.map((point) => point.stocks[stock.id] ?? 0);
    const maximum = Math.max(...values, 1);
    const path = values.map((value, pointIndex) => {
      const x = left + (pointIndex / Math.max(1, values.length - 1)) * (right - left);
      const y = bottom - (value / maximum) * (bottom - top);
      return `${pointIndex === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return { stock, path, color: STOCK_COLORS[index % STOCK_COLORS.length] };
  });

  return (
    <div className="chart-content">
      <svg className="simulation-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Normalized stock levels over the simulation">
        {[0, 0.5, 1].map((ratio) => <line key={ratio} x1={left} x2={right} y1={top + ratio * (bottom - top)} y2={top + ratio * (bottom - top)} className="chart-grid" />)}
        {paths.map(({ stock, path, color }) => <path key={stock.id} d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
      </svg>
      <div className="chart-legend">{paths.map(({ stock, color }) => <span key={stock.id}><i style={{ background: color }} />{stock.data.label}</span>)}</div>
    </div>
  );
}

export function App() {
  const [savedGraph] = useState(loadGraph);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(savedGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>(savedGraph.edges);
  const [mode, setMode] = useState<ConnectMode>("select");
  const [selection, setSelection] = useState<{ nodeId?: string; edgeId?: string }>({});
  const [year, setYear] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stocks = useMemo(() => nodes.filter((node) => node.type === "stock"), [nodes]);
  const model = useMemo(() => currentModel(nodes, edges), [nodes, edges]);
  const points = useMemo(() => simulate(model.stocks, model.flows, model.influences, HORIZON, STEP), [model]);
  const point = points.reduce((closest, candidate) => Math.abs(candidate.year - year) < Math.abs(closest.year - year) ? candidate : closest, points[0]);
  const displayNodes = useMemo(() => nodes.map((node) => node.type === "stock"
    ? { ...node, data: { ...node.data, current: point.stocks[node.id] ?? node.data.initial } }
    : node), [nodes, point]);
  const selectedNode = nodes.find((node) => node.id === selection.nodeId);
  const selectedEdge = edges.find((edge) => edge.id === selection.edgeId);
  const handleSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => {
    const nodeId = selectedNodes[0]?.id;
    const edgeId = selectedEdges[0]?.id;
    setSelection((current) => current.nodeId === nodeId && current.edgeId === edgeId ? current : { nodeId, edgeId });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
    } catch {
      // The current canvas remains usable when browser storage is unavailable.
    }
  }, [nodes, edges]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setYear((current) => {
        if (current >= HORIZON) {
          setPlaying(false);
          return HORIZON;
        }
        return current + 1;
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [playing]);

  function addNode(type: "stock" | "flow" | "source" | "sink"): void {
    const node = makeNode(type, nodes.length);
    setNodes((current) => [...current, node]);
    setSelection({ nodeId: node.id });
    setMode("select");
  }

  function updateNode(id: string, data: Partial<CanvasData>): void {
    setNodes((current) => current.map((node) => node.id === id ? { ...node, data: { ...node.data, ...data } } : node));
  }

  function updateEdge(id: string, data: Partial<CanvasEdgeData>): void {
    setEdges((current) => current.map((edge) => {
      if (edge.id !== id) return edge;
      const nextData: CanvasEdgeData = { kind: edge.data?.kind ?? "pipe", ...edge.data, ...data };
      return { ...edge, data: nextData, label: nextData.kind === "influence" ? (nextData.polarity === -1 ? "−" : "+") : edge.label };
    }));
  }

  function deleteSelection(): void {
    if (selection.nodeId) {
      const id = selection.nodeId;
      setNodes((current) => current.filter((node) => node.id !== id));
      setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    } else if (selection.edgeId) {
      const id = selection.edgeId;
      setEdges((current) => current.filter((edge) => edge.id !== id));
    }
    setSelection({});
  }

  function connect(connection: Connection): void {
    if (!connection.source || !connection.target) return;
    if (mode === "pipe" && (connection.sourceHandle !== "pipe-out" || connection.targetHandle !== "pipe-in")) return;
    if (mode === "influence" && (connection.sourceHandle !== "info-out" || connection.targetHandle !== "info-in")) return;
    const source = nodes.find((node) => node.id === connection.source);
    const target = nodes.find((node) => node.id === connection.target);
    if (!source || !target || source.id === target.id) return;

    let edge: CanvasEdge | undefined;
    if (mode === "pipe") {
      const validPair = (source.type === "stock" || (source.type === "cloud" && source.data.kind === "source")) && target.type === "flow"
        || source.type === "flow" && (target.type === "stock" || (target.type === "cloud" && target.data.kind === "sink"));
      if (!validPair) return;
      const duplicatesFlowPort = source.type === "flow" && edges.some((existing) => existing.data?.kind === "pipe" && existing.source === source.id)
        || target.type === "flow" && edges.some((existing) => existing.data?.kind === "pipe" && existing.target === target.id);
      if (duplicatesFlowPort) return;
      edge = {
        id: crypto.randomUUID(),
        source: connection.source,
        sourceHandle: connection.sourceHandle,
        target: connection.target,
        targetHandle: connection.targetHandle,
        type: "smoothstep",
        data: { kind: "pipe" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#42433e" },
        style: { stroke: "#42433e", strokeWidth: 1.5 },
      };
    } else if (mode === "influence" && source.type === "stock" && (target.type === "flow" || target.type === "stock")) {
      edge = {
        id: crypto.randomUUID(),
        source: connection.source,
        sourceHandle: connection.sourceHandle,
        target: connection.target,
        targetHandle: connection.targetHandle,
        type: "default",
        data: { kind: "influence", polarity: 1 },
        label: "+",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#718da0" },
        style: { stroke: "#718da0", strokeWidth: 1.2, strokeDasharray: "4 4" },
        labelStyle: { fill: "#617d90", fontWeight: 600, fontSize: 11 },
        labelBgStyle: { fill: "#fff", fillOpacity: 0.95 },
      };
    }
    if (edge) {
      setEdges((current) => addEdge(edge!, current));
      setSelection({ edgeId: edge.id });
      setMode("select");
    }
  }

  function loadStarter(): void {
    setNodes(starterGraph.nodes);
    setEdges(starterGraph.edges);
    setSelection({});
    setMode("select");
    setYear(0);
  }

  function clearCanvas(): void {
    setNodes([]);
    setEdges([]);
    setSelection({});
    setMode("select");
    setYear(0);
  }

  const onNodesChangeTyped = (changes: NodeChange<CanvasNode>[]) => onNodesChange(changes);
  const onEdgesChangeTyped = (changes: EdgeChange<CanvasEdge>[]) => onEdgesChange(changes);
  const flowToolActive = mode !== "select";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">↗</span><span>Systems Playground</span><span className="brand-divider"/><span className="brand-context">Stock &amp; flow</span></div>
        <div className="top-actions"><span className="save-status"><i/>Saved on this device</span><button className="quiet-button" onClick={clearCanvas}>New canvas</button><button className="starter-button" onClick={loadStarter}>Load bathtub example</button></div>
      </header>
      <main className="playground">
        <CanvasToolbar mode={mode} setMode={setMode} addNode={addNode} />
        <section className="center-stage">
          <div className="canvas-heading"><div><div className="canvas-title">Untitled system</div><div className="canvas-subtitle">Stocks accumulate · flows change them · arrows carry information</div></div><span className={`mode-badge${flowToolActive ? " mode-active" : ""}`}>{mode === "select" ? "SELECT & MOVE" : mode === "pipe" ? "DRAW MATERIAL FLOW" : "DRAW INFLUENCE LINK"}</span></div>
          <div className={`canvas-frame${flowToolActive ? " connecting" : ""}`}>
            <ReactFlow<CanvasNode, CanvasEdge>
              nodes={displayNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChangeTyped}
              onEdgesChange={onEdgesChangeTyped}
              onConnect={connect}
              onSelectionChange={handleSelectionChange}
              nodesConnectable={flowToolActive}
              nodesDraggable
              elementsSelectable
              fitView
              fitViewOptions={{ padding: 0.18, minZoom: 0.45, maxZoom: 1.1 }}
              minZoom={0.25}
              maxZoom={1.4}
              deleteKeyCode={["Backspace", "Delete"]}
              defaultEdgeOptions={{ type: "smoothstep" }}
              connectionLineStyle={{ stroke: mode === "influence" ? "#718da0" : "#42433e", strokeWidth: 1.5, strokeDasharray: mode === "influence" ? "4 4" : undefined }}
              proOptions={{ hideAttribution: false }}
            >
              <Background variant={BackgroundVariant.Dots} color="#d7dbd1" gap={20} size={1} />
              <Controls position="bottom-right" showInteractive={false} />
            </ReactFlow>
            {nodes.length === 0 && <div className="canvas-empty"><span>Start with an accumulation</span><button onClick={() => addNode("stock")}>＋ Add a stock</button><small>Then connect a flow valve and mark what lies beyond the boundary.</small></div>}
          </div>
          <section className="simulation-panel">
            <div className="simulation-controls">
              <div className="sim-title"><span className="sim-icon">⌁</span><div><strong>Behavior over time</strong><small>Each line is normalized to its own range</small></div></div>
              <button className="play-button" onClick={() => { if (year >= HORIZON) setYear(0); setPlaying((current) => !current); }}>{playing ? "Ⅱ  Pause" : "▶  Play"}</button>
              <div className="time-control"><span>NOW</span><input type="range" min="0" max={HORIZON} step="1" value={year} onChange={(event) => { setPlaying(false); setYear(Number(event.target.value)); }} aria-label="Simulation year"/><span>{HORIZON} yr</span></div>
              <div className="year-readout">Year <b>{year}</b></div>
            </div>
            <SimulationChart points={points} stocks={stocks} />
          </section>
          <footer className="canvas-footer">Inspired by Donella Meadows’ <em>Thinking in Systems</em> · Model boundaries are choices, not facts.</footer>
        </section>
        {(selectedNode || selectedEdge) && <aside className="inspector">
          <div className="inspector-header"><div><div className="rail-label">MODEL ELEMENT</div><h2>{selectedNode?.data.label ?? (selectedEdge?.data?.kind === "influence" ? "Influence arrow" : "Material pipe")}</h2></div><button className="inspector-close" onClick={() => setSelection({})} aria-label="Close inspector">×</button></div>
          <Inspector node={selectedNode} edge={selectedEdge} updateNode={updateNode} updateEdge={updateEdge} deleteSelection={deleteSelection} />
          {selectedNode?.type === "stock" && <div className="current-levels"><div className="rail-label">AT YEAR {year}</div><div className="level-row"><span><i style={{ background: STOCK_COLORS[0] }}/>{selectedNode.data.label}</span><b>{Math.round(point.stocks[selectedNode.id] ?? 0).toLocaleString("en-US")}</b></div></div>}
        </aside>}
      </main>
    </div>
  );
}
