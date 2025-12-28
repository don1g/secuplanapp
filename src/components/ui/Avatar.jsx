import React from 'react';

export const Avatar = ({ src, alt, size = "md", className = "" }) => {
  const sizes = { 
    sm: "h-8 w-8 text-xs", 
    md: "h-10 w-10 text-sm", 
    lg: "h-24 w-24 text-3xl", 
    xl: "h-32 w-32 text-4xl",
    full: "h-full w-full"
  };

  // HIER GEÄNDERT: rounded-xl statt rounded-full
  return (
    <div className={`${sizes[size]} rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden font-bold text-slate-400 flex-shrink-0 ${className}`}>
      {src ? (
        <img src={src} className="w-full h-full object-cover" alt={alt || "Avatar"} />
      ) : (
        (alt ? alt.charAt(0).toUpperCase() : "U")
      )}
    </div>
  );
};