import React, { useState, useEffect, useRef } from 'react';

interface FaderProps {
  label: string;
  value: number; // 0-100
  onChange: (val: number) => void;
  color?: string;
}

const Fader: React.FC<FaderProps> = ({ label, value, onChange, color = 'bg-zinc-200' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    e.preventDefault();
    setIsDragging(true);
    updateValue(e.clientY);
  };

  const updateValue = (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const height = rect.height;
      const y = Math.max(0, Math.min(height, clientY - rect.top));
      // Inverted Y (bottom is 0)
      const percent = 1 - (y / height);
      onChange(Math.round(percent * 100));
  };
  
  const handleDoubleClick = () => {
      setIsEditing(true);
      setInputValue(Math.round(value).toString());
  };

  const commitInput = () => {
      let val = parseFloat(inputValue);
      if (!isNaN(val)) {
          val = Math.max(0, Math.min(100, val));
          onChange(val);
      }
      setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') commitInput();
      if (e.key === 'Escape') setIsEditing(false);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      updateValue(e.clientY);
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
  }, [isDragging]);

  return (
    <div className="flex flex-col items-center gap-2 w-10 md:w-12 group">
       {/* Track */}
       <div 
          ref={trackRef}
          className="h-32 md:h-40 w-2 md:w-3 bg-zinc-950 rounded-full relative cursor-pointer shadow-[inset_0_0_4px_rgba(0,0,0,0.8)] border border-zinc-800"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
       >
          {/* Tick Marks */}
          <div className="absolute -right-3 top-2 bottom-2 flex flex-col justify-between opacity-20">
             {[...Array(5)].map((_, i) => <div key={i} className="h-px w-1.5 bg-white"></div>)}
          </div>

          {/* Thumb */}
          <div 
             className="absolute left-1/2 -translate-x-1/2 w-6 md:w-8 h-4 rounded shadow-lg border border-zinc-600 flex items-center justify-center z-10"
             style={{ 
                 bottom: `${value}%`, 
                 marginBottom: '-8px', 
                 background: 'linear-gradient(180deg, #3f3f46 0%, #18181b 100%)',
                 boxShadow: '0 4px 6px rgba(0,0,0,0.5)'
             }}
          >
              <div className={`w-3/4 h-[2px] ${color} shadow-[0_0_4px_currentColor]`}></div>
          </div>
       </div>

       <div className="flex flex-col items-center" onDoubleClick={handleDoubleClick}>
           <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter group-hover:text-zinc-300 transition-colors">{label}</span>
           {isEditing ? (
                <input 
                    ref={inputRef}
                    type="number"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={commitInput}
                    onKeyDown={handleKeyDown}
                    className="w-10 bg-zinc-800 text-white text-[9px] font-mono text-center border border-zinc-600 rounded outline-none p-0"
                />
           ) : (
                <span className="text-[9px] font-mono text-zinc-600 group-hover:text-zinc-400 cursor-text">{Math.round(value)}</span>
           )}
       </div>
    </div>
  );
};

export default Fader;