import React, { useState, useEffect } from 'react';
import { ArrowLeft, Send, Search, Mail } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Avatar } from '../ui/Avatar';

export const ChatSystem = ({ user, userRole, targetId, targetName, isEmbedded = false }) => {
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chats, setChats] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // 1. Alle Chats laden (Echtzeit-Logik aus GitHub)
  useEffect(() => {
    if (!user?.uid || !userRole) return;

    const q = query(
      collection(db, "chats"), 
      where(userRole === 'client' ? 'clientId' : 'companyId', "==", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b) => (b.lastUpdate || '') > (a.lastUpdate || '') ? 1 : -1);
      setChats(list);
      
      // Falls wir von außen (Marktplatz) kommen und einen Chat starten wollen
      if (targetId && !activeChat) {
        const existing = list.find(c => c.companyId === targetId || c.clientId === targetId);
        if (existing) {
          setActiveChat(existing);
        } else {
          setActiveChat({ 
            id: 'NEW', 
            companyId: targetId, 
            companyName: targetName, 
            messages: [] 
          });
        }
      }
    }, (error) => {
      console.error("Fehler beim Laden der Chats:", error);
    });

    return () => unsub();
  }, [user?.uid, targetId, userRole]);

  // 2. Nachrichten des aktiven Chats laden & Gelesen-Status setzen
  useEffect(() => {
    if (!activeChat || activeChat.id === 'NEW' || !userRole) { 
      setMessages([]); 
      return; 
    }
    
    // Gelesen-Status in Firestore aktualisieren
    if ((userRole === 'client' && activeChat.unreadClient) || (userRole === 'provider' && activeChat.unreadProvider)) {
        updateDoc(doc(db, "chats", activeChat.id), { 
          [userRole === 'client' ? 'unreadClient' : 'unreadProvider']: false 
        });
    }

    const q = query(collection(db, "chats", activeChat.id, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [activeChat?.id, userRole]);

  // 3. Nachricht senden
  const sendMessage = async (e) => {
    e.preventDefault(); 
    if (!newMessage.trim() || !user?.uid) return;

    let chatId = activeChat?.id;
    
    // Falls es ein komplett neuer Chat ist (noch kein Dokument in Firebase)
    if (chatId === 'NEW') {
      try {
        const res = await addDoc(collection(db, "chats"), {
          clientId: userRole === 'client' ? user.uid : activeChat.clientId, 
          clientName: userRole === 'client' ? (user.name || "Kunde") : activeChat.clientName,
          companyId: userRole === 'provider' ? user.uid : activeChat.companyId, 
          companyName: userRole === 'provider' ? (user.name || "Firma") : activeChat.companyName,
          lastMessage: newMessage, 
          lastUpdate: new Date().toISOString(), 
          unreadProvider: userRole === 'client', 
          unreadClient: userRole === 'provider'
        });
        chatId = res.id;
        setActiveChat(prev => ({...prev, id: chatId}));
      } catch (err) {
        console.error("Fehler beim Erstellen des Chats:", err);
        return;
      }
    }

    // Nachricht im Unterordner speichern
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), { 
        text: newMessage, 
        senderId: user.uid, 
        createdAt: new Date().toISOString() 
      });
      
      // Haupt-Chat Dokument aktualisieren für die Vorschau in der Liste
      await updateDoc(doc(db, "chats", chatId), { 
        lastMessage: newMessage, 
        lastUpdate: new Date().toISOString(), 
        [userRole === 'client' ? 'unreadProvider' : 'unreadClient']: true 
      });
      setNewMessage("");
    } catch (err) {
      console.error("Fehler beim Senden:", err);
    }
  };

  const filteredChats = chats.filter(c => 
    (userRole === 'client' ? c.companyName : c.clientName)?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Falls User noch nicht geladen ist, zeigen wir einen Loader statt einer weißen Seite
  if (!user?.uid) {
    return (
      <div className="flex h-full items-center justify-center bg-white rounded-2xl border">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`flex h-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm ${!isEmbedded ? 'fixed inset-4 z-50' : ''}`}>
      
      {/* SIDEBAR: Chat-Liste */}
      <div className={`w-full md:w-80 border-r border-slate-200 flex flex-col bg-slate-50 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b bg-white">
            <h3 className="font-bold text-lg mb-3 text-slate-900">Nachrichten</h3>
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                <input 
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm outline-none text-slate-900" 
                  placeholder="Suchen..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map(c => (
            <div 
              key={c.id} 
              onClick={() => setActiveChat(c)} 
              className={`p-4 border-b cursor-pointer transition-colors ${activeChat?.id === c.id ? 'bg-blue-50' : 'hover:bg-white'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-sm text-slate-900">
                  {userRole === 'client' ? c.companyName : c.clientName}
                </span>
                {((userRole === 'client' && c.unreadClient) || (userRole === 'provider' && c.unreadProvider)) && (
                  <div className="h-2.5 w-2.5 bg-blue-600 rounded-full mt-1 animate-pulse"></div>
                )}
              </div>
              <div className="text-xs text-slate-500 truncate">{c.lastMessage}</div>
            </div>
          ))}
          {filteredChats.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm italic">Keine Chats gefunden.</div>
          )}
        </div>
      </div>

      {/* MAIN: Chat-Verlauf */}
      <div className={`flex-1 flex flex-col bg-white ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {activeChat ? (
          <>
            <div className="p-4 border-b flex items-center gap-3 font-bold bg-white shadow-sm">
              <button onClick={() => setActiveChat(null)} className="md:hidden p-1 hover:bg-slate-100 rounded-lg text-slate-600">
                <ArrowLeft size={20}/>
              </button>
              <Avatar size="sm" alt={userRole === 'client' ? activeChat.companyName : activeChat.clientName} />
              <span className="text-slate-900">
                {userRole === 'client' ? activeChat.companyName : activeChat.clientName}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] p-3 rounded-2xl text-sm shadow-sm ${
                    m.senderId === user.uid 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {messages.length === 0 && activeChat.id !== 'NEW' && (
                <div className="text-center text-slate-400 text-xs mt-10">Beginne jetzt eine Unterhaltung...</div>
              )}
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t bg-white flex gap-2">
              <input 
                value={newMessage} 
                onChange={e => setNewMessage(e.target.value)} 
                className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900" 
                placeholder="Nachricht schreiben..." 
              />
              <button 
                type="submit" 
                disabled={!newMessage.trim()} 
                className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-100"
              >
                <Send size={20}/>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="p-6 bg-slate-50 rounded-full">
              <Mail size={48} className="opacity-20"/>
            </div>
            <p className="font-medium">Wähle eine Konversation aus oder starte eine neue.</p>
          </div>
        )}
      </div>
    </div>
  );
};