import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
  textSizeClass?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Pilih --',
  className = '',
  id,
  required,
  textSizeClass = 'text-[10px] sm:text-xs'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full text-left ${className}`} id={id}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-zinc-200/80 ${textSizeClass} font-bold text-zinc-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition shadow-sm outline-none cursor-pointer min-h-[42px]`}
      >
        <span className={selectedOption ? 'text-zinc-950 font-black truncate pr-2' : 'text-zinc-400 font-medium truncate pr-2'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto rounded-xl bg-white border border-zinc-200 shadow-xl pointer-events-auto"
          >
            <div className="p-1">
              {placeholder && (
                <button
                  type="button"
                  onClick={() => handleSelect('')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 ${textSizeClass} font-bold rounded-lg transition-colors text-left ${
                    !value ? 'bg-red-50 text-red-900 font-extrabold' : 'text-zinc-400 hover:bg-zinc-50'
                  }`}
                >
                  <span>{placeholder}</span>
                  {!value && <Check className="h-3.5 w-3.5 text-red-600 shrink-0" />}
                </button>
              )}
              
              {options.map(opt => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 ${textSizeClass} font-bold rounded-lg transition-colors text-left ${
                      isSelected ? 'bg-red-50 text-red-950 font-black' : 'text-zinc-700 hover:bg-zinc-50 font-bold'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="h-4 w-4 text-red-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
