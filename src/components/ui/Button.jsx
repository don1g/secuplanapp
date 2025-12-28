import React from 'react';

export const Button = ({ children, onClick, variant = 'primary', size = 'md', icon: Icon, disabled, className = "", ...props }) => {
  // Design-Varianten
  const baseStyle = "font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-md",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    success: "bg-green-600 text-white hover:bg-green-700 shadow-md",
    ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
    outline: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
  };

  const sizes = { 
    sm: "px-2 py-1 text-xs", 
    md: "px-4 py-2 text-sm", 
    lg: "px-6 py-3 text-base" 
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} 
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 18} />} 
      {children}
    </button>
  );
};