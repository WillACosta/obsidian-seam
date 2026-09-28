import { SpecialSearchPipeline } from '../types';

/** JSON Canvas 1.0 compatible text nodes and directional edges used by Seam's pipeline renderer. */
export interface PipelineCanvasNode {
    id: string;
    type: 'text';
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
}

export interface PipelineCanvasEdge {
    id: string;
    fromNode: string;
    fromSide: 'right';
    toNode: string;
    toSide: 'left';
    toEnd: 'arrow';
}

export interface PipelineCanvasData {
    nodes: PipelineCanvasNode[];
    edges: PipelineCanvasEdge[];
}

export function buildPipelineCanvas(pipeline: SpecialSearchPipeline, labelForQuery: (queryId: string) => string): PipelineCanvasData {
    const positions = pipeline.nodes?.length
        ? pipeline.nodes
        : pipeline.queryIds.map((queryId, index) => ({ queryId, x: index * 260 + 20, y: 20 }));
    const nodes = positions.map((node): PipelineCanvasNode => ({
        id: node.queryId,
        type: 'text',
        x: node.x,
        y: node.y,
        width: 220,
        height: 88,
        text: labelForQuery(node.queryId),
    }));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = (pipeline.connections ?? [])
        .filter((connection) => nodeIds.has(connection.from) && nodeIds.has(connection.to) && connection.from !== connection.to)
        .map((connection, index): PipelineCanvasEdge => ({
            id: `edge-${index}-${connection.from}-${connection.to}`,
            fromNode: connection.from,
            fromSide: 'right',
            toNode: connection.to,
            toSide: 'left',
            toEnd: 'arrow',
        }));
    return { nodes, edges };
}
