
import React, { useRef, useEffect, useState } from 'react';

interface ColorWheelProps {
  color: string;
  onChange: (color: string) => void;
  size?: number;
}

// Helper to parse color string to HSL using Canvas API (no DOM append needed)
const parseColorToHSL = (color: string): { h: number; s: number; l: number } => {
  // Basic fallback
  if (!color) return { h: 0, s: 0, l: 100 };

  // Try basic regex for HSL
  const hslMatch = color.match(/hsl\(\s*(\d+(\.\d+)?)\s*,\s*(\d+(\.\d+)?)%\s*,\s*(\d+(\.\d+)?)%\s*\)/);
  if (hslMatch) {
    return { h: parseFloat(hslMatch[1]), s: parseFloat(hslMatch[3]), l: parseFloat(hslMatch[5]) };
  }

  // Use Offscreen Canvas for robust parsing
  // This avoids document.body.appendChild which caused issues
  try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { h: 0, s: 0, l: 100 };
      
      ctx.fillStyle = color;
      ctx.fillRect(0,0,1,1);
      const [r, g, b] = ctx.getImageData(0,0,1,1).data;
      
      // RGB to HSL
      const rN = r / 255;
      const gN = g / 255;
      const bN = b / 255;

      const max = Math.max(rN, gN, bN);
      const min = Math.min(rN, gN, bN);
      let h = 0, s = 0, l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case rN: h = (gN - bN) / d + (gN < bN ? 6 : 0); break;
          case gN: h = (bN - rN) / d + 2; break;
          case bN: h = (rN - gN) / d + 4; break;
        }
        h /= 6;
      }
      return { h: h * 360, s: s * 100, l: l * 100 };
  } catch (e) {
      return { h: 0, s: 0, l: 100 };
  }
};

export const ColorWheel: React.FC<ColorWheelProps> = ({ color, onChange, size = 200 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Derived position state
  const [pos, setPos] = useState({ x: size / 2, y: size / 2 });

  const radius = size / 2;
  const centerX = size / 2;
  const centerY = size / 2;

  // Update position when color prop changes
  useEffect(() => {
    const { h, s } = parseColorToHSL(color);
    // Map HSL to Polar
    // h = degrees (0-360)
    // s = distance % (0-100)
    const angleRad = (h * Math.PI) / 180;
    const dist = (s / 100) * radius;

    const x = centerX + dist * Math.cos(angleRad);
    const y = centerY + dist * Math.sin(angleRad);
    setPos({ x, y });
  }, [color, size, radius, centerX, centerY]);

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);

    // 1. Conic Gradient (Hue)
    // Note: standard canvas hue usually starts red at 0 (3 o'clock) if drawing normally, 
    // but conic gradients start at 12 o'clock (top) by default usually, or right depending on browser.
    // Let's assume standard 0 is right (3 o'clock) for math, so we might need offset.
    // Actually CSS conic-gradient starts at top. Canvas createConicGradient starts at 0 angle (3 o'clock in canvas arc context).
    
    try {
      const conic = ctx.createConicGradient(0, centerX, centerY);
      conic.addColorStop(0, 'red');
      conic.addColorStop(1/6, 'magenta');
      conic.addColorStop(2/6, 'blue');
      conic.addColorStop(3/6, 'cyan');
      conic.addColorStop(4/6, 'lime'); // "green" in standard wheel is often lime
      conic.addColorStop(5/6, 'yellow');
      conic.addColorStop(1, 'red');
      
      ctx.fillStyle = conic;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fill();
    } catch (e) {
       // Fallback for environments without createConicGradient (rare now, but safe)
       for (let i = 0; i < 360; i+=1) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, (i * Math.PI)/180, ((i+1.5) * Math.PI)/180);
        ctx.fillStyle = `hsl(${360 - i}, 100%, 50%)`; // Reverse to match standard direction if needed
        ctx.fill();
       }
    }

    // 2. Radial Gradient (White Center for Tint/Saturation)
    const radial = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    radial.addColorStop(0, 'white');
    radial.addColorStop(1, 'transparent');
    
    ctx.fillStyle = radial;
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();

    // 3. Border to make it neat
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 0.5, 0, 2 * Math.PI);
    ctx.stroke();
  };

  useEffect(() => {
    drawWheel();
  }, [size]);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left - centerX;
    const y = clientY - rect.top - centerY;
    
    // Calculate Angle (Hue)
    let angle = Math.atan2(y, x) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    
    // Calculate Distance (Saturation)
    const dist = Math.sqrt(x * x + y * y);
    // Clamp distance to radius for interaction, but color calc uses clamped
    const saturatedDist = Math.min(dist, radius);
    
    const hue = angle;
    const saturation = (saturatedDist / radius) * 100;
    // Lightness logic: Center(white) -> Edge(vibrant)
    // At center (sat 0), Lightness should be 100
    // At edge (sat 100), Lightness should be 50
    const lightness = 100 - (saturation / 2);

    onChange(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  };

  return (
    <div className="relative touch-none select-none" style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-full cursor-crosshair shadow-sm"
        onMouseDown={(e) => { setIsDragging(true); handleInteraction(e); }}
        onMouseMove={(e) => { if(isDragging) handleInteraction(e); }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={(e) => { setIsDragging(true); handleInteraction(e); }}
        onTouchMove={(e) => { if(isDragging) handleInteraction(e); }}
        onTouchEnd={() => setIsDragging(false)}
      />
      {/* Indicator */}
      <div 
        className="absolute w-6 h-6 rounded-full border-2 border-white shadow-md pointer-events-none"
        style={{
           left: pos.x,
           top: pos.y,
           transform: 'translate(-50%, -50%)',
           backgroundColor: color
        }}
      />
    </div>
  );
};
