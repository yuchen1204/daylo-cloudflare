import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Note } from '../types';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface KnowledgeGraphProps {
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
  onNavigateToNote: (noteId: string) => void;
}

interface GraphNode {
  id: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number;
  notebookId: string;
}

interface GraphEdge {
  source: string;
  target: string;
}

const NOTEBOOK_COLORS: Record<string, string> = {};

const getColorForNotebook = (notebookId: string): string => {
  if (!NOTEBOOK_COLORS[notebookId]) {
    const hue = Object.keys(NOTEBOOK_COLORS).length * 60;
    NOTEBOOK_COLORS[notebookId] = `hsl(${hue % 360}, 70%, 50%)`;
  }
  return NOTEBOOK_COLORS[notebookId];
};

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  notes,
  isOpen,
  onClose,
  onNavigateToNote,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState<GraphNode | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) return;

    const newNodes: GraphNode[] = notes
      .filter(n => n.format === 'markdown' || !n.format)
      .map(note => {
        const links = (note.content.match(/\[\[([^\]]+)\]\]/g) || []).length;
        return {
          id: note.id,
          title: note.title || 'Untitled',
          x: Math.random() * 800 + 100,
          y: Math.random() * 600 + 100,
          vx: 0,
          vy: 0,
          connections: links,
          notebookId: note.notebookId,
        };
      });

    const titleToId = new Map(notes.map(n => [n.title?.toLowerCase(), n.id]));
    const newEdges: GraphEdge[] = [];
    
    notes.forEach(note => {
      const linkMatches = note.content.match(/\[\[([^\]]+)\]\]/g) || [];
      linkMatches.forEach((match: string) => {
        const title = match.slice(2, -2).toLowerCase();
        const targetId = titleToId.get(title);
        if (targetId && targetId !== note.id) {
          newEdges.push({ source: note.id, target: targetId });
        }
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [notes, isOpen]);

  useEffect(() => {
    if (!isOpen || nodes.length === 0) return;

    const simulate = () => {
      setNodes(prevNodes => {
        const newNodes = prevNodes.map(node => ({ ...node }));
        
        for (let i = 0; i < newNodes.length; i++) {
          for (let j = i + 1; j < newNodes.length; j++) {
            const dx = newNodes[j].x - newNodes[i].x;
            const dy = newNodes[j].y - newNodes[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            const repulsion = 1000 / (dist * dist);
            newNodes[i].vx -= (dx / dist) * repulsion;
            newNodes[i].vy -= (dy / dist) * repulsion;
            newNodes[j].vx += (dx / dist) * repulsion;
            newNodes[j].vy += (dy / dist) * repulsion;
          }
        }

        edges.forEach(edge => {
          const source = newNodes.find(n => n.id === edge.source);
          const target = newNodes.find(n => n.id === edge.target);
          if (source && target) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            const attraction = (dist - 100) * 0.01;
            source.vx += (dx / dist) * attraction;
            source.vy += (dy / dist) * attraction;
            target.vx -= (dx / dist) * attraction;
            target.vy -= (dy / dist) * attraction;
          }
        });

        newNodes.forEach(node => {
          node.vx += (400 - node.x) * 0.001;
          node.vy += (300 - node.y) * 0.001;
          
          node.x += node.vx * 0.1;
          node.y += node.vy * 0.1;
          node.vx *= 0.9;
          node.vy *= 0.9;
        });

        return newNodes;
      });

      animationRef.current = requestAnimationFrame(simulate);
    };

    animationRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isOpen, nodes.length, edges]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);

      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      nodes.forEach(node => {
        const radius = Math.max(8, Math.min(20, node.connections * 3 + 8));
        const color = getColorForNotebook(node.notebookId);
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        if (hoveredNode?.id === node.id || selectedNode?.id === node.id) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.fillStyle = '#333';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.title, node.x, node.y + radius + 16);
      });

      ctx.restore();
    };

    render();
  }, [nodes, edges, zoom, offset, hoveredNode, selectedNode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;

    const clickedNode = nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });

    if (clickedNode) {
      setDragNode(clickedNode);
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;

    if (isDragging && dragNode) {
      setNodes(prev => prev.map(node => 
        node.id === dragNode.id ? { ...node, x, y } : node
      ));
    } else {
      const hovered = nodes.find(node => {
        const dx = node.x - x;
        const dy = node.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 20;
      });
      setHoveredNode(hovered || null);
    }
  };

  const handleMouseUp = () => {
    if (dragNode) {
      setSelectedNode(dragNode);
    }
    setIsDragging(false);
    setDragNode(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (dragNode) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;

    const clickedNode = nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });

    if (clickedNode) {
      onNavigateToNote(clickedNode.id);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(3, prev * delta)));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <div className="h-14 border-b flex items-center justify-between px-4 shrink-0" style={{ borderColor: 'var(--border-primary)' }}>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Knowledge Graph</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(prev => Math.min(3, prev * 1.2))}
            className="p-2 rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}
            className="p-2 rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="p-2 rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-[var(--interactive-hover)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1200}
          height={800}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
          style={{ background: 'var(--bg-secondary)' }}
        />
        
        <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
          {nodes.length} notes • {edges.length} connections
        </div>
      </div>
    </div>
  );
};
