import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidBlockProps {
  code: string;
}

mermaid.initialize({
  startOnLoad: false,
  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
  securityLevel: 'loose',
});

export const MermaidBlock: React.FC<MermaidBlockProps> = ({ code }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    if (!code.trim()) return;
    
    const renderChart = async () => {
      try {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, code.trim());
        setSvg(renderedSvg);
        setError(null);
      } catch (e: any) {
        setError(e.message || 'Failed to render diagram');
        setSvg('');
      }
    };

    renderChart();
  }, [code]);

  if (error) {
    return (
      <div className="my-4 p-4 rounded-lg border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
        <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Mermaid Diagram Error</div>
        <pre className="text-xs overflow-x-auto" style={{ color: 'var(--text-muted)' }}>{error}</pre>
        <pre className="text-xs mt-2 overflow-x-auto" style={{ color: 'var(--text-secondary)' }}>{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 p-4 rounded-lg animate-pulse" style={{ background: 'var(--bg-secondary)' }}>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Rendering diagram...</div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="my-4 p-4 rounded-lg flex justify-center overflow-x-auto"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
