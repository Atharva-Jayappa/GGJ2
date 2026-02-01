import React from 'react';

interface GlitchTextProps {
  text: string;
  as?: any;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function GlitchText({ text, as: Component = 'h1', className = '', size = 'xl' }: GlitchTextProps) {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
    xl: 'text-7xl md:text-9xl'
  };

  return (
    <Component className={`relative inline-block font-mono font-bold uppercase ${sizeClasses[size]} ${className} group`}>
      <span className="relative z-10">{text}</span>
      <span className="absolute top-0 left-0 -z-10 w-full h-full text-primary opacity-0 group-hover:opacity-70 group-hover:translate-x-[2px] transition-all duration-75 select-none" aria-hidden="true">{text}</span>
      <span className="absolute top-0 left-0 -z-10 w-full h-full text-red-500 opacity-0 group-hover:opacity-70 group-hover:-translate-x-[2px] transition-all duration-75 select-none" aria-hidden="true">{text}</span>
    </Component>
  );
}
