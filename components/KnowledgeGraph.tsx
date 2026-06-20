import React, { useEffect, useRef, useState } from 'react';
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
    const palette = ['#FF006E', '#00FFFF', '#FFB000', '#00FF41', '#A855F7', '#FF6B6B'];
    const idx = Object.keys(NOTEBOOK_COLORS).length % palette.length;
    NOTEBOOK_COLORS[notebookId] = palette[idx];
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
  const timeRef = useRef<number>(0);

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

    let frameId: number;

    const render = () => {
      timeRef.current += 0.02;
      const t = timeRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);

      // Draw edges with neon glow
      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (source && target) {
          const pulse = Math.sin(t * 2 + source.x * 0.01) * 0.3 + 0.7;
          
          // Outer glow
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = `rgba(0, 255, 255, ${0.08 * pulse})`;
          ctx.lineWidth = 6;
          ctx.stroke();

          // Inner glow
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = `rgba(0, 255, 255, ${0.25 * pulse})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Core line
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = `rgba(0, 255, 255, ${0.6 * pulse})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Draw nodes with neon halo
      nodes.forEach(node => {
        const radius = Math.max(6, Math.min(18, node.connections * 2 + 6));
        const color = getColorForNotebook(node.notebookId);
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;
        const pulse = Math.sin(t * 3 + node.x * 0.02) * 0.15 + 0.85;
        const haloRadius = radius + (isHovered || isSelected ? 12 : 6);

        // Outer glow halo
        const gradient = ctx.createRadialGradient(
          node.x, node.y, radius,
          node.x, node.y, haloRadius
        );
        gradient.addColorStop(0, color.replace(')', `, ${0.4 * pulse})`).replace('rgb', 'rgba'));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, haloRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Node body
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Node border glow
        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 2, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Label
        ctx.font = '10px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255, 255, 255, ${isHovered || isSelected ? 1 : 0.7})`;
        ctx.fillText(node.title, node.x, node.y + radius + 14);
      });

      ctx.restore();
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameId);
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
    <div className="fixed inset-0 z-[10000] flex flex-col" style={{ background: '#0A0014' }}>
      {/* CRT Scanline Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-[10001]"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.15) 0px, rgba(0, 0, 0, 0.15) 1px, transparent 1px, transparent 2px)',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Header */}
      <div 
        className="h-14 border-b flex items-center justify-between px-6 shrink-0 relative"
        style={{ 
          borderColor: 'rgba(0, 255, 255, 0.15)',
          background: 'linear-gradient(180deg, rgba(10, 0, 20, 0.95) 0%, rgba(10, 0, 20, 0.8) 100%)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <h2 
          className="text-lg font-bold tracking-wider uppercase"
          style={{ 
            fontFamily: '"Orbitron", sans-serif',
            color: '#00FFFF',
            textShadow: '2px 0 #FF006E, -2px 0 #00FFFF, 0 0 20px rgba(0, 255, 255, 0.5)',
          }}
        >
          Knowledge Graph
        </h2>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(prev => Math.min(3, prev * 1.2))}
            className="p-2 transition-all"
            style={{ 
              color: '#00FFFF',
              border: '1px solid rgba(0, 255, 255, 0.2)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0, 255, 255, 0.1)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 255, 255, 0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.1, prev * 0.8))}
            className="p-2 transition-all"
            style={{ 
              color: '#00FFFF',
              border: '1px solid rgba(0, 255, 255, 0.2)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0, 255, 255, 0.1)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 255, 255, 0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="p-2 transition-all"
            style={{ 
              color: '#00FFFF',
              border: '1px solid rgba(0, 255, 255, 0.2)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0, 255, 255, 0.1)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 255, 255, 0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-px h-6 mx-1" style={{ background: 'rgba(0, 255, 255, 0.2)' }} />
          <button
            onClick={onClose}
            className="p-2 transition-all"
            style={{ 
              color: '#FF006E',
              border: '1px solid rgba(255, 0, 110, 0.2)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 0, 110, 0.1)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(255, 0, 110, 0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1200}
          height={800}
          className="w-full h-full"
          style={{ 
            background: 'radial-gradient(ellipse at center, #0D0025 0%, #0A0014 70%)',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
        />
        
        {/* Stats */}
        <div 
          className="absolute bottom-4 left-4 px-4 py-2 text-xs"
          style={{ 
            fontFamily: '"Space Mono", monospace',
            color: '#00FFFF',
            background: 'rgba(10, 0, 20, 0.8)',
            border: '1px solid rgba(0, 255, 255, 0.2)',
            textShadow: '0 0 8px rgba(0, 255, 255, 0.5)',
          }}
        >
          <span style={{ color: '#FF006E' }}>{nodes.length}</span> notes 
          <span className="mx-2" style={{ color: 'rgba(0, 255, 255, 0.3)' }}>|</span>
          <span style={{ color: '#FF006E' }}>{edges.length}</span> connections
        </div>

        {/* Selected node info */}
        {selectedNode && (
          <div 
            className="absolute bottom-4 right-4 px-4 py-3 text-xs"
            style={{ 
              fontFamily: '"Space Mono", monospace',
              color: '#fff',
              background: 'rgba(10, 0, 20, 0.9)',
              border: '1px solid rgba(255, 0, 110, 0.3)',
              boxShadow: '0 0 20px rgba(255, 0, 110, 0.2)',
              maxWidth: '280px',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ 
                  background: getColorForNotebook(selectedNode.notebookId),
                  boxShadow: `0 0 8px ${getColorForNotebook(selectedNode.notebookId)}`,
                }}
              />
              <span style={{ 
                fontFamily: '"Orbitron", sans-serif',
                color: '#FF006E',
                textShadow: '0 0 10px rgba(255, 0, 110, 0.5)',
              }}>
                {selectedNode.title}
              </span>
            </div>
            <div style={{ color: 'rgba(0, 255, 255, 0.6)' }}>
              {selectedNode.connections} connection{selectedNode.connections !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
