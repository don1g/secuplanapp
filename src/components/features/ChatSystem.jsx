import React, { useState, useEffect } from 'react';
import { ArrowLeft, Send, Search, Mail, Ban, Trash2, MoreVertical, ShieldAlert } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Avatar } from '../ui/Avatar';

export const ChatSystem = ({ user, userRole, targetId, targetName, isEmbedded = false }) => {
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chats, setChats] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [view, setView] = useState('active'); // 'active', 'blocked', 'deleted'

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "chats"), 
      where(userRole === 'client' ? 'clientId' : 'companyId', "==", user.uid)
    );

    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (b.lastUpdate || '') > (a.lastUpdate || '') ? 1 : -1);
      setChats(list);
      
      if (targetId && !activeChat) {
        const existing = list.find(c => c.companyId === targetId || c.clientId === targetId);
        if (existing) setActiveChat(existing);
        else setActiveChat({ id: 'NEW', companyId: targetId, companyName: targetName, messages: [] });
      }
    });
  }, [user?.uid, targetId, userRole]);

  useEffect(() => {
    if (!activeChat || activeChat.id === 'NEW') { setMessages([]); return; }
    
    if ((userRole === 'client' && activeChat.unreadClient) || (userRole === 'provider' && activeChat.unreadProvider)) {
        updateDoc(doc(db, "chats", activeChat.id), { [userRole === 'client' ? 'unreadClient' : 'unreadProvider']: false });
    }

    const q = query(collection(db, "chats", activeChat.id, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [activeChat?.id, userRole]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || activeChat?.isBlocked) return;

    let chatId = activeChat.id;
    if (chatId === 'NEW') {
      const res = await addDoc(collection(db, "chats"), {
        clientId: userRole === 'client' ? user.uid : activeChat.clientId,
        clientName: userRole === 'client' ? user.name : activeChat.clientName,
        companyId: userRole === 'provider' ? user.uid : activeChat.companyId,
        companyName: userRole === 'provider' ? user.name : activeChat.companyName,
        lastMessage: newMessage,
        lastUpdate: new Date().toISOString(),
        unreadProvider: userRole === 'client',
        unreadClient: userRole === 'provider',
        status: 'active'
      });
      chatId = res.id;
      setActiveChat(prev => ({...prev, id: chatId}));
    }

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: newMessage,
      senderId: user.uid,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: newMessage,
      lastUpdate: new Date().toISOString(),
      [userRole === 'client' ? 'unreadProvider' : 'unreadClient']: true
    });
    setNewMessage("");
  };

  const handleUpdateStatus = async (chatId, status) => {
    await updateDoc(doc(db, "chats", chatId), { status });
    if (activeChat?.id === chatId) setActiveChat(null);
  };

  const filteredChats = chats.filter(c => {
    const matchesSearch = (userRole === 'client' ? c.companyName : c.clientName)?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesView = (view === 'active' && !c.status || c.status === 'active') || (c.status === view);
    return matchesSearch && matchesView;
  });

  return (
    <div className={`flex h-full bg-[#f8fafc] rounded-[2rem] border border-slate-200 overflow-hidden shadow-2xl ${!isEmbedded ? 'fixed inset-6 z-50' : ''}`}>
      {/* Sidebar */}
      <div className={`w-full md:w-[350px] border-r border-slate-200 flex flex-col bg-white ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Chats</h3>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setView('active')} className={`p-2 rounded-lg transition-all ${view === 'active' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><Mail size={18}/></button>
              <button onClick={() => setView('blocked')} className={`p-2 rounded-lg transition-all ${view === 'blocked' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}><Ban size={18}/></button>
              <button onClick={() => setView('deleted')} className={`p-2 rounded-lg transition-all ${view === 'deleted' ? 'bg-white shadow-sm text-slate-600' : 'text-slate-400'}`}><Trash2 size={18}/></button>
            </div>
          </div>
          <div className="relative group">
            <Search className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18}/>
            <input className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all" placeholder="Unterhaltung suchen..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-1">
          {filteredChats.map(c => (
            <div key={c.id} onClick={() => setActiveChat(c)} className={`group relative p-4 rounded-[1.25rem] cursor-pointer transition-all ${activeChat?.id === c.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'hover:bg-slate-50'}`}>
              <div className="flex gap-4">
                <Avatar size="md" alt={userRole === 'client' ? c.companyName : c.clientName} className={activeChat?.id === c.id ? 'border-white/20' : ''} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <span className="font-bold truncate pr-2">{userRole === 'client' ? c.companyName : c.clientName}</span>
                    {((userRole === 'client' && c.unreadClient) || (userRole === 'provider' && c.unreadProvider)) && <div className="h-2.5 w-2.5 bg-blue-500 rounded-full mt-1 border-2 border-white animate-pulse"></div>}
                  </div>
                  <div className={`text-xs truncate ${activeChat?.id === c.id ? 'text-blue-100' : 'text-slate-500'}`}>{c.lastMessage}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-white ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {activeChat ? (
          <>
            <div className="p-5 border-b flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChat(null)} className="md:hidden p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"><ArrowLeft size={20}/></button>
                <Avatar size="md" alt={userRole === 'client' ? activeChat.companyName : activeChat.clientName} />
                <div>
                  <div className="font-black text-slate-900 leading-none mb-1">{userRole === 'client' ? activeChat.companyName : activeChat.clientName}</div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-500 uppercase tracking-widest"><div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse"></div> Online</div>
                </div>
              </div>
              <div className="flex gap-2">
                {activeChat.status !== 'blocked' && <button onClick={() => handleUpdateStatus(activeChat.id, 'blocked')} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Blockieren"><Ban size={20}/></button>}
                <button onClick={() => handleUpdateStatus(activeChat.id, 'deleted')} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all" title="Löschen"><Trash2 size={20}/></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fcfdfe]">
              {messages.map((m, i) => {
                const isMe = m.senderId === user.uid;
                return (
                  <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`max-w-[70%] p-4 rounded-[1.5rem] text-sm shadow-sm leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-100' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                      {m.text}
                      <div className={`text-[9px] mt-1.5 font-bold uppercase tracking-tighter opacity-50 ${isMe ? 'text-right' : 'text-left'}`}>
                        {m.createdAt?.toDate ? new Date(m.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={sendMessage} className="p-6 border-t bg-white">
              <div className="flex gap-3 items-center bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                <input value={newMessage} onChange={e => setNewMessage(e.target.value)} disabled={activeChat.status === 'blocked'} className="flex-1 bg-transparent border-none px-4 py-2 text-sm outline-none text-slate-900 disabled:placeholder-red-300" placeholder={activeChat.status === 'blocked' ? "Dieser Chat ist blockiert" : "Schreibe eine Nachricht..."} />
                <button type="submit" disabled={!newMessage.trim() || activeChat.status === 'blocked'} className="bg-blue-600 text-white p-3 rounded-2xl hover:bg-blue-700 disabled:opacity-30 transition-all shadow-lg shadow-blue-100"><Send size={20}/></button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center">
            <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mb-6 text-blue-600 shadow-inner"><Mail size={40}/></div>
            <h4 className="text-xl font-black text-slate-900 mb-2">Deine Zentrale</h4>
            <p className="text-sm max-w-xs leading-relaxed">Wähle links eine Unterhaltung aus, um deine Nachrichten zu verwalten.</p>
          </div>
        )}
      </div>
    </div>
  );
};