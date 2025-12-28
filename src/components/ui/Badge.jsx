import React from 'react';

export const Badge = ({ children, color = 'slate', className = "" }) => {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200"
  };

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${colors[color] || colors.slate} ${className}`}>
      {children}
    </span>
  );
};