import React, { useState, useEffect } from 'react';
import { Shield, Menu, X, LogOut, Mail } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';

// Diese Komponente ist der "Rahmen" für alle deine Seiten
export const DashboardLayout = ({ 
  user, 
  title, 
  sidebarItems = [], 
  activeTab, 
  onTabChange, 
  onLogout, 
  children, 
  unreadCount = 0 
}) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Sidebar auf Desktop automatisch öffnen
  useEffect(() => { 
    if (window.innerWidth >= 1024) setSidebarOpen(true); 
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden relative">
      
      {/* Mobile Overlay (Dunkler Hintergrund wenn Menü offen) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}
      
      {/* --- SIDEBAR --- */}
      <aside className={`
        fixed top-0 left-0 h-full z-50 w-64 bg-white border-r border-slate-200 
        transform transition-transform duration-300 flex flex-col
        ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} 
        lg:static lg:translate-x-0 lg:shadow-none
      `}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <Shield className="text-blue-600 h-8 w-8" />
            <span>Secu<span className="text-blue-600">Plan</span></span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {sidebarItems.map((item, idx) => {
            // Falls es ein Trennstrich ist (optional, falls du divider nutzt)
            if (item.divider) return <div key={idx} className="my-4 border-t border-slate-200" />;
            
            // Falls es eine Überschrift ist
            if (item.label) return <div key={idx} className="px-3 pt-4 pb-2 text-[10px] font-bold text-slate-400 uppercase">{item.label}</div>;

            // Normaler Button
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id} 
                onClick={() => { 
                  onTabChange(item.id); 
                  if (window.innerWidth < 1024) setSidebarOpen(false); 
                }} 
                className={`
                  w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all mb-1
                  ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}
                `}
              >
                <div className="flex items-center gap-3">
                  {item.icon} 
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                {/* Badge für ungelesene Nachrichten beim "messages" Tab */}
                {item.id === 'messages' && unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout Bereich unten */}
        <div className="p-4 border-t border-slate-200">
          <Button 
            variant="ghost" 
            onClick={onLogout} 
            icon={LogOut} 
            className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            Abmelden
          </Button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-screen bg-white">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-700">
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-bold text-slate-900 truncate">{title}</h2>
          </div>
          
          {/* User Info rechts oben */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold">{user?.name}</div>
              <div className="text-xs text-slate-500">{user?.email}</div>
            </div>
            <Avatar src={user?.imageUrl} alt={user?.name} />
          </div>
        </header>

        {/* Der eigentliche Inhalt der Seite */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 bg-slate-50 w-full relative">
          <div className="max-w-6xl mx-auto space-y-6 pb-20">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};