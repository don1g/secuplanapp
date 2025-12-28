import React, { useState, useEffect } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';

export const ChatSystem = ({ user, userRole, targetId, targetName, isEmbedded = false }) => {
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chats, setChats] = useState([]);
  
  // 1. Lade Liste der Chats
  useEffect(() => {
    const q = query(collection(db, "chats"), where(userRole === 'client' ? 'clientId' : 'companyId', "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (b.lastUpdate || '') > (a.lastUpdate || '') ? 1 : -1);
      
      setChats(list);
      
      // Auto-Select Logik für neuen Chat
      if (targetId && !activeChat) {
        const existing = list.find(c => c.companyId === targetId);
        if (existing) setActiveChat(existing);
        else setActiveChat({ id: 'NEW', companyId: targetId, companyName: targetName, messages: [] });
      }
    });
    return () => unsub();
  }, [user.uid, targetId, userRole, targetName, activeChat]);

  // 2. Lade Nachrichten für aktiven Chat
  useEffect(() => {
    if (!activeChat || activeChat.id === 'NEW') { setMessages([]); return; }
    
    // Als gelesen markieren
    if ((userRole === 'client' && activeChat.unreadClient) || (userRole === 'provider' && activeChat.unreadProvider)) {
        updateDoc(doc(db, "chats", activeChat.id), { [userRole === 'client' ? 'unreadClient' : 'unreadProvider']: false });
    }

    const q = query(collection(db, "chats", activeChat.id, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeChat?.id, userRole]);

  const sendMessage = async (e) => {
    e.preventDefault(); if (!newMessage.trim()) return;
    let chatId = activeChat?.id;
    
    // Neuen Chat erstellen falls nötig
    if (chatId === 'NEW') {
      const res = await addDoc(collection(db, "chats"), {
        clientId: user.uid, clientName: user.name, companyId: targetId, companyName: targetName,
        lastMessage: newMessage, lastUpdate: new Date().toISOString(), status: 'active', unreadProvider: true, unreadClient: false
      });
      chatId = res.id; 
      setActiveChat(prev => ({...prev, id: chatId}));
    }

    await addDoc(collection(db, "chats", chatId, "messages"), { text: newMessage, senderId: user.uid, createdAt: new Date().toISOString() });
    
    await updateDoc(doc(db, "chats", chatId), { 
      lastMessage: newMessage, 
      lastUpdate: new Date().toISOString(), 
      [userRole === 'client' ? 'unreadProvider' : 'unreadClient']: true 
    });
    setNewMessage("");
  };

  const containerClasses = isEmbedded 
    ? "flex h-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm" 
    : "fixed inset-4 z-50 md:inset-auto md:w-[800px] md:h-[600px] md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 flex h-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xl";

  return (
    <div className={containerClasses}>
      {/* Linke Spalte: Liste */}
      <div className={`w-80 border-r border-slate-200 flex flex-col bg-slate-50 ${activeChat && 'hidden md:flex'}`}>
        <div className="p-4 font-bold border-b">Nachrichten</div>
        <div className="flex-1 overflow-y-auto">
          {chats.map(c => (
            <div key={c.id} onClick={() => setActiveChat(c)} className={`p-4 border-b cursor-pointer hover:bg-white transition-colors ${activeChat?.id === c.id ? 'bg-white shadow-inner' : ''}`}>
              <div className="font-bold text-sm text-slate-800">{userRole === 'client' ? c.companyName : c.clientName}</div>
              <div className="text-xs text-slate-500 truncate">{c.lastMessage}</div>
            </div>
          ))}
          {chats.length === 0 && <div className="p-4 text-xs text-slate-400">Keine Chats vorhanden.</div>}
        </div>
      </div>

      {/* Rechte Spalte: Chat */}
      <div className={`flex-1 flex flex-col ${!activeChat && 'hidden md:flex'}`}>
        {activeChat ? (
          <>
            <div className="p-4 border-b flex items-center gap-2 font-bold bg-white shadow-sm z-10">
              <button onClick={() => setActiveChat(null)} className="md:hidden p-1 hover:bg-slate-100 rounded"><ArrowLeft size={18}/></button>
              {activeChat.id === 'NEW' ? targetName : (userRole === 'client' ? activeChat.companyName : activeChat.clientName)}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] p-3 rounded-xl text-sm shadow-sm ${m.senderId === user.uid ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none text-slate-800'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="p-3 border-t bg-white flex gap-2">
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)} className="flex-1 border border-slate-300 rounded-full px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Nachricht schreiben..." />
              <button type="submit" disabled={!newMessage.trim()} className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"><Send size={18}/></button>
            </form>
          </>
        ) : <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">Wähle einen Chat aus</div>}
      </div>
    </div>
  );
};