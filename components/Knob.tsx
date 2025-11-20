
import React, { useState, useRef, useEffect } from 'react';

interface KnobProps {
  label: string;
  value: number; // 0-100
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  size?: number;
  color?: string;
  paramDisplay?: string; // e.g. "Hz", "%"
}

const Knob: React.FC<KnobProps> = ({ 
    label, 
    value, 
    onChange, 
    min = 0, 
    max = 100, 
    size = 60,
    color = "#ef4444", // Tailwind red-500
    paramDisplay
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(0);
  
  // Angles for the knob (approx 270 degrees total rotation)
  const minAngle = -135;
  const maxAngle = 135;
  
  const currentAngle = ((value - min) / (max - min)) * (maxAngle - minAngle) + minAngle;

  useEffect(() => {
      if (isEditing && inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
      }
  }, [isEditing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    e.preventDefault();
    setIsDragging(true);
    setStartY(e.clientY);
    setStartValue(value);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsEditing(true);
      setInputValue(Math.round(value).toString());
  };

  const commitInput = () => {
      let val = parseFloat(inputValue);
      if (!isNaN(val)) {
          val = Math.max(min, Math.min(max, val));
          onChange(val);
      }
      setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') commitInput();
      if (e.key === 'Escape') setIsEditing(false);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = startY - e.clientY;
      const sensitivity = 1; 
      let newValue = startValue + deltaY * sensitivity;
      newValue = Math.max(min, Math.min(max, newValue));
      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startY, startValue, min, max, onChange]);

  // SVG Path Generator for the arc
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  };

  const radius = size / 2 - 4;
  const center = size / 2;
  const trackPath = describeArc(center, center, radius, minAngle, maxAngle);
  const valuePath = describeArc(center, center, radius, minAngle, currentAngle);

  return (
    <div className="flex flex-col items-center justify-center gap-1 select-none group relative">
      <div 
        className="relative cursor-ns-resize"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
         {/* SVG Container */}
         <svg width={size} height={size} className="overflow-visible">
            {/* Filter Drop Shadow */}
            <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <radialGradient id="knobGradient">
                    <stop offset="0%" stopColor="#52525b" />
                    <stop offset="100%" stopColor="#18181b" />
                </radialGradient>
            </defs>

            {/* Background Track */}
            <path d={trackPath} fill="none" stroke="#3f3f46" strokeWidth="5" strokeLinecap="round" />
            
            {/* Active Value Arc */}
            <path d={valuePath} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" opacity="0.8" />

            {/* Knob Cap */}
            {!isEditing && (
                <g transform={`rotate(${currentAngle}, ${center}, ${center})`}>
                    <circle cx={center} cy={center} r={radius * 0.7} fill="#27272a" stroke="#18181b" strokeWidth="2" />
                    {/* Inner Shader */}
                    <circle cx={center} cy={center} r={radius * 0.65} fill="url(#knobGradient)" opacity="0.5" />
                    {/* Indicator Line */}
                    <line x1={center} y1={center - radius * 0.4} x2={center} y2={center - radius * 0.7} stroke="white" strokeWidth="2" strokeLinecap="round" />
                </g>
            )}
         </svg>

         {/* Input Overlay */}
         {isEditing && (
             <div className="absolute inset-0 flex items-center justify-center z-10">
                 <input
                    ref={inputRef}
                    type="number"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={commitInput}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-white text-black text-center font-mono font-bold text-sm border-2 border-zinc-600 rounded outline-none shadow-lg"
                    style={{ maxWidth: size }}
                 />
             </div>
         )}

         {/* Value Tooltip (visible on drag) */}
         {isDragging && !isEditing && (
             <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[11px] font-mono px-2 py-1 rounded border border-zinc-700 z-50 whitespace-nowrap shadow-xl">
                 {Math.round(value)}{paramDisplay}
             </div>
         )}
      </div>
      
      <div className="flex flex-col items-center -mt-1">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter leading-none">{label}</span>
      </div>
    </div>
  );
};

export default Knob;
