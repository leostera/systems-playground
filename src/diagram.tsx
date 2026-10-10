import { useEffect } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface StockData extends Record<string, unknown> {
  title: string;
  kind: string;
  value: string;
  tone: "resource" | "people";
}

type StockNodeModel = Node<StockData, "stock">;

const initialNodes: StockNodeModel[] = [
  {
    id: "resource",
    type: "stock",
    position: { x: 32, y: 72 },
    data: { kind: "Stock · renewable", title: "Shared resource", value: "9,000", tone: "resource" },
  },
  {
    id: "people",
    type: "stock",
    position: { x: 435, y: 72 },
    data: { kind: "Stock · dependent", title: "People", value: "1,000", tone: "people" },
  },
];

const edges: Edge[] = [
  {
    id: "resource-supports-people",
    source: "resource",
    target: "people",
    label: "supports  +",
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#87958b" },
    style: { stroke: "#87958b", strokeWidth: 1.5 },
    labelStyle: { fill: "#707a73", fontSize: 10 },
    labelBgStyle: { fill: "#f9faf5", fillOpacity: 0.95 },
  },
  {
    id: "people-harvests-resource",
    source: "people",
    target: "resource",
    label: "harvests  −",
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#87958b" },
    style: { stroke: "#87958b", strokeWidth: 1.5 },
    labelStyle: { fill: "#707a73", fontSize: 10 },
    labelBgStyle: { fill: "#f9faf5", fillOpacity: 0.95 },
  },
];

function StockNode({ data }: NodeProps<StockNodeModel>) {
  return (
    <div className={`stock-node ${data.tone}`}>
      <Handle type="target" position={Position.Left} />
      <div className="stock-type">{data.kind}</div>
      <div className="stock-name">{data.title}</div>
      <div className="stock-value">{data.value}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { stock: StockNode };

interface SystemDiagramProps {
  population: number;
  resource: number;
}

export function SystemDiagram({ population, resource }: SystemDiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<StockNodeModel>(initialNodes);

  useEffect(() => {
    setNodes((current) => current.map((node) => ({
      ...node,
      data: {
        ...node.data,
        value: node.id === "people" ? population.toLocaleString("en-US") : resource.toLocaleString("en-US"),
      },
    })));
  }, [population, resource, setNodes]);

  return (
    <ReactFlow<StockNodeModel>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.17 }}
      minZoom={0.45}
      maxZoom={1.5}
      zoomOnScroll={false}
      panOnScroll
      aria-label="Causal loop diagram: resource availability supports population, and population harvests the resource"
    >
      <Background variant={BackgroundVariant.Dots} color="#daddd1" gap={18} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
