import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Trash2, Edit2, Send, X, Save, User } from 'lucide-react';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, collection, addDoc, query, orderBy, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

export const PostItem = ({ post, companyId, currentUserId, onViewProfile }) => {
  const [likes, setLikes] = useState(post.likes || []);
  const hasLiked = likes.includes(currentUserId);
  
  // Edit & Delete States
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isOwner, setIsOwner] = useState(false);

  // Comment States
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  // Likers Modal
  const [showLikers, setShowLikers] = useState(false);
  const [likerNames, setLikerNames] = useState([]);

  useEffect(() => {
    setIsOwner(currentUserId === companyId);
  }, [currentUserId, companyId]);

  // Kommentare laden
  useEffect(() => {
    if (!showComments) return;
    const q = query(collection(db, "companies", companyId, "posts", post.id, "comments"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [showComments, companyId, post.id]);

  // Funktion: Benachrichtigung senden
  const sendNotification = async (type, text) => {
      if(isOwner) return; // Keine Benachrichtigung an sich selbst
      try {
        const user = auth.currentUser;
        await addDoc(collection(db, "companies", companyId, "notifications"), {
            type: type, // 'like' oder 'comment'
            fromName: user?.displayName || "Jemand",
            fromId: user?.uid,
            text: text,
            postId: post.id,
            read: false,
            createdAt: new Date().toISOString()
        });
      } catch(e) { console.error("Notification Error:", e); }
  };

  // LIKE FUNKTION
  const toggleLike = async () => {
    if (!currentUserId) return;
    const ref = doc(db, "companies", companyId, "posts", post.id);
    
    if (hasLiked) {
        // Unlike
        setLikes(likes.filter(id => id !== currentUserId));
        await updateDoc(ref, { likes: arrayRemove(currentUserId) });
    } else {
        // Like
        setLikes([...likes, currentUserId]);
        await updateDoc(ref, { likes: arrayUnion(currentUserId) });
        // Benachrichtigung senden
        sendNotification('like', 'gefällt dein Beitrag');
    }
  };

  // Liste der Liker laden (Namen holen)
  const fetchLikers = async () => {
      if(likes.length === 0) return;
      setShowLikers(true);
      const names = [];
      // Achtung: Das ist eine einfache Methode. Bei tausenden Likes müsste man das anders lösen.
      for(const uid of likes) {
          // Versuchen User zu finden
          let userSnap = await getDoc(doc(db, "users", uid));
          if(userSnap.exists()) {
              names.push(userSnap.data().name || "Unbekannt");
          } else {
              // Falls es eine Firma war
              let compSnap = await getDoc(doc(db, "companies", uid));
              if(compSnap.exists()) names.push(compSnap.data().name);
          }
      }
      setLikerNames(names);
  };

  // KOMMENTAR SENDEN
  const handleSendComment = async () => {
      if (!newComment.trim() || !currentUserId) return;
      const user = auth.currentUser;
      try {
          await addDoc(collection(db, "companies", companyId, "posts", post.id, "comments"), {
              text: newComment,
              authorId: currentUserId,
              authorName: user?.displayName || "Benutzer",
              authorImage: user?.photoURL || null,
              createdAt: new Date().toISOString()
          });
          sendNotification('comment', `hat kommentiert: "${newComment.substring(0, 20)}..."`);
          setNewComment("");
      } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
      if (!confirm("Diesen Beitrag wirklich löschen?")) return;
      try { await deleteDoc(doc(db, "companies", companyId, "posts", post.id)); } catch (e) { console.error(e); }
  };

  const handleUpdate = async () => {
      if (!editContent.trim()) return;
      try {
          await updateDoc(doc(db, "companies", companyId, "posts", post.id), { content: editContent });
          setIsEditing(false);
      } catch (e) { console.error(e); }
  };

  return (
    <Card className="mb-4 overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative">
      
      {/* HEADER */}
      <div className="p-4 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div onClick={() => onViewProfile && onViewProfile(companyId)} className="cursor-pointer h-10 w-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center text-blue-700 font-bold border border-blue-200 shadow-sm">
            {post.authorInitial || "F"}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Neuigkeit</div>
            <div className="text-xs text-slate-500">{new Date(post.createdAt).toLocaleDateString()} • {new Date(post.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} Uhr</div>
          </div>
        </div>
        {isOwner && !isEditing && (
            <div className="flex gap-1">
                <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-blue-600 rounded-full"><Edit2 size={16}/></button>
                <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-600 rounded-full"><Trash2 size={16}/></button>
            </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap">
        {isEditing ? (
            <div className="space-y-2">
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full p-3 border rounded-xl outline-none min-h-[100px]"/>
                <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} icon={X}>Abbrechen</Button>
                    <Button size="sm" onClick={handleUpdate} icon={Save}>Speichern</Button>
                </div>
            </div>
        ) : post.content}
      </div>

      {/* ACTION BAR */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-6 bg-slate-50/30">
        <button onClick={toggleLike} className={`flex items-center gap-2 text-sm font-medium transition-all group ${hasLiked ? 'text-red-500' : 'text-slate-500 hover:text-slate-900'}`}>
          <Heart size={18} fill={hasLiked ? "currentColor" : "none"} /> 
        </button>
        
        {/* Klickbare Like-Zahl um Namen zu sehen */}
        <button onClick={fetchLikers} className="text-sm text-slate-500 hover:text-blue-600 hover:underline cursor-pointer">
            {likes.length} Gefällt mir
        </button>

        <button onClick={() => setShowComments(!showComments)} className={`flex items-center gap-2 text-sm font-medium transition-all group ${showComments ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}>
          <MessageCircle size={18} /> {comments.length} <span className="hidden sm:inline">Kommentare</span>
        </button>
      </div>

      {/* COMMENT SECTION */}
      {showComments && (
          <div className="bg-slate-50 border-t border-slate-100 p-4">
              <div className="space-y-4 mb-4 max-h-[300px] overflow-y-auto">
                  {comments.map(c => (
                      <div key={c.id} className="flex gap-3 items-start">
                          <Avatar src={c.authorImage} alt={c.authorName} size="sm" className="mt-1"/>
                          <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex-1">
                              <div className="flex justify-between"><span className="font-bold text-xs">{c.authorName}</span><span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span></div>
                              <p className="text-sm">{c.text}</p>
                          </div>
                          {(currentUserId === c.authorId || isOwner) && (
                              <button onClick={() => deleteDoc(doc(db, "companies", companyId, "posts", post.id, "comments", c.id))} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                          )}
                      </div>
                  ))}
              </div>
              <div className="flex gap-2">
                  <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Kommentar..." className="flex-1 p-2 border rounded-lg text-sm" onKeyDown={e => e.key === 'Enter' && handleSendComment()}/>
                  <Button size="icon" onClick={handleSendComment} disabled={!newComment.trim()}><Send size={16}/></Button>
              </div>
          </div>
      )}

      {/* MODAL: WER HAT GELIKET */}
      {showLikers && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur flex flex-col items-center justify-center p-4 animate-in fade-in">
              <div className="w-full max-w-sm bg-white shadow-xl rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-3 border-b flex justify-between items-center bg-slate-50">
                      <h4 className="font-bold text-sm">Gefällt mir Angaben</h4>
                      <button onClick={() => setShowLikers(false)}><X size={16}/></button>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-2">
                      {likerNames.length > 0 ? likerNames.map((name, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg">
                              <div className="bg-blue-100 p-1 rounded-full"><User size={12} className="text-blue-600"/></div>
                              <span className="text-sm font-medium">{name}</span>
                          </div>
                      )) : <div className="p-4 text-center text-xs text-slate-400">Lädt... oder keine Namen gefunden.</div>}
                  </div>
              </div>
          </div>
      )}
    </Card>
  );
};