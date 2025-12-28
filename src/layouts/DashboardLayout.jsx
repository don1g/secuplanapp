import React, { useState, useEffect } from 'react';
import { Menu, LogOut, X, Bell, Trash2 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore'; 
import { db } from '../firebase';

export const DashboardLayout = ({ title, children, user, sidebarItems, activeTab, onTabChange, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Notification States
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!user) return;
    const q = query(
        collection(db, "companies", user.uid, "notifications"), 
        orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
        setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
        // Ignorieren falls User kein Provider ist
    });
    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notif) => {
      if(notif.read) return;
      try { await updateDoc(doc(db, "companies", user.uid, "notifications", notif.id), { read: true }); } catch(e) {}
  };

  const deleteNotification = async (e, id) => {
      e.stopPropagation();
      try { await deleteDoc(doc(db, "companies", user.uid, "notifications", id)); } catch(e) {}
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent">SecuPlan</h1>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X size={24} /></button>
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
             {sidebarItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => { onTabChange(item.id); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                        activeTab === item.id 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <div className={`${activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                        {item.icon}
                    </div>
                    <span className="font-medium">{item.name}</span>
                </button>
             ))}
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-3 px-3 py-3 mb-2">
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shadow-md border border-blue-400">
                    {/* HIER GEÄNDERT: Nimmt den ersten Buchstaben vom Firmennamen oder Usernamen */}
                    {(user?.name || user?.displayName || user?.email || "U").charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                    {/* HIER GEÄNDERT: Priorisiert user.name (Firmenname) */}
                    <div className="text-sm font-medium truncate text-white">{user?.name || user?.displayName || "Benutzer"}</div>
                    <div className="text-xs text-slate-400 truncate">{user?.email}</div>
                </div>
            </div>
            <button onClick={onLogout} className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors">
              <LogOut size={18} /> Abmelden
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shadow-sm z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600">
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          </div>

          <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className={`p-2 rounded-full relative transition-colors ${showNotifications ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                  <Bell size={24}/>
                  {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white animate-pulse">
                          {unreadCount}
                      </span>
                  )}
              </button>

              {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h4 className="font-bold text-sm text-slate-700">Benachrichtigungen</h4>
                            {notifications.length > 0 && (
                                <button onClick={() => setNotifications([])} className="text-xs text-blue-600 hover:underline">Alle löschen</button>
                            )}
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">Keine neuen Nachrichten.</div>
                            ) : (
                                notifications.map(notif => (
                                    <div 
                                        key={notif.id} 
                                        onClick={() => markAsRead(notif)}
                                        className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex gap-3 relative group transition-colors ${!notif.read ? 'bg-blue-50/60' : ''}`}
                                    >
                                        <div className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${!notif.read ? 'bg-blue-600' : 'bg-transparent'}`}></div>
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-800 leading-snug">
                                                <span className="font-bold text-slate-900">{notif.fromName}</span> {notif.text}
                                            </p>
                                            <div className="text-xs text-slate-400 mt-1">{new Date(notif.createdAt).toLocaleDateString()}</div>
                                        </div>
                                        <button onClick={(e) => deleteNotification(e, notif.id)} className="absolute right-2 top-2 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all">
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                  </>
              )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50 relative">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};