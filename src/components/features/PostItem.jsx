import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Trash2, Edit2, Send, X, Save } from 'lucide-react';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
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

  // Prüfen ob der aktuelle User der Besitzer des Posts ist (für Edit/Delete)
  useEffect(() => {
    setIsOwner(currentUserId === companyId);
  }, [currentUserId, companyId]);

  // Kommentare laden (nur wenn ausgeklappt)
  useEffect(() => {
    if (!showComments) return;
    
    // Subcollection "comments" im Post-Dokument abrufen
    const q = query(
        collection(db, "companies", companyId, "posts", post.id, "comments"), 
        orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [showComments, companyId, post.id]);

  // LIKE FUNKTION
  const toggleLike = async () => {
    if (!currentUserId) return;
    const ref = doc(db, "companies", companyId, "posts", post.id);
    const newLikes = hasLiked ? likes.filter(id => id !== currentUserId) : [...likes, currentUserId];
    setLikes(newLikes);
    await updateDoc(ref, { likes: hasLiked ? arrayRemove(currentUserId) : arrayUnion(currentUserId) });
  };

  // DELETE FUNKTION
  const handleDelete = async () => {
      if (!confirm("Diesen Beitrag wirklich löschen?")) return;
      try {
          await deleteDoc(doc(db, "companies", companyId, "posts", post.id));
      } catch (e) {
          console.error("Fehler beim Löschen:", e);
          alert("Fehler beim Löschen.");
      }
  };

  // UPDATE FUNKTION
  const handleUpdate = async () => {
      if (!editContent.trim()) return;
      try {
          await updateDoc(doc(db, "companies", companyId, "posts", post.id), {
              content: editContent
          });
          setIsEditing(false);
      } catch (e) {
          console.error("Fehler beim Speichern:", e);
      }
  };

  // KOMMENTAR SENDEN
  const handleSendComment = async () => {
      if (!newComment.trim() || !currentUserId) return;
      
      const user = auth.currentUser; // Wir holen uns Infos direkt vom Auth User
      
      try {
          await addDoc(collection(db, "companies", companyId, "posts", post.id, "comments"), {
              text: newComment,
              authorId: currentUserId,
              authorName: user?.displayName || "Benutzer",
              authorImage: user?.photoURL || null,
              createdAt: new Date().toISOString()
          });
          setNewComment("");
      } catch (e) {
          console.error(e);
      }
  };

  return (
    <Card className="mb-4 overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      
      {/* HEADER */}
      <div className="p-4 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div 
            onClick={() => onViewProfile && onViewProfile(companyId)} 
            className="cursor-pointer h-10 w-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center text-blue-700 font-bold border border-blue-200 shadow-sm"
          >
            {post.authorInitial || "F"}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Neuigkeit</div>
            <div className="text-xs text-slate-500">{new Date(post.createdAt).toLocaleDateString()} • {new Date(post.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} Uhr</div>
          </div>
        </div>

        {/* Edit/Delete Buttons (Nur für Besitzer) */}
        {isOwner && !isEditing && (
            <div className="flex gap-1">
                <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all" title="Bearbeiten">
                    <Edit2 size={16}/>
                </button>
                <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all" title="Löschen">
                    <Trash2 size={16}/>
                </button>
            </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap">
        {isEditing ? (
            <div className="space-y-2 animate-in fade-in">
                <textarea 
                    value={editContent} 
                    onChange={(e) => setEditContent(e.target.value)} 
                    className="w-full p-3 border rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none min-h-[100px]"
                />
                <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} icon={X}>Abbrechen</Button>
                    <Button size="sm" onClick={handleUpdate} icon={Save}>Speichern</Button>
                </div>
            </div>
        ) : (
            post.content
        )}
      </div>

      {/* ACTION BAR */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-6 bg-slate-50/30">
        <button 
          onClick={toggleLike} 
          className={`flex items-center gap-2 text-sm font-medium transition-all group ${hasLiked ? 'text-red-500' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <div className={`p-2 rounded-full group-hover:bg-red-50 transition-colors ${hasLiked ? 'bg-red-50' : ''}`}>
            <Heart size={18} fill={hasLiked ? "currentColor" : "none"} /> 
          </div>
          {likes.length} <span className="hidden sm:inline">Gefällt mir</span>
        </button>

        <button 
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-2 text-sm font-medium transition-all group ${showComments ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <div className={`p-2 rounded-full group-hover:bg-blue-50 transition-colors ${showComments ? 'bg-blue-50' : ''}`}>
            <MessageCircle size={18} />
          </div>
          {comments.length > 0 ? comments.length : ''} <span className="hidden sm:inline">Kommentare</span>
        </button>
      </div>

      {/* COMMENT SECTION */}
      {showComments && (
          <div className="bg-slate-50 border-t border-slate-100 p-4 animate-in slide-in-from-top-2">
              {/* Liste der Kommentare */}
              <div className="space-y-4 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {comments.length === 0 && <div className="text-center text-slate-400 text-sm py-2">Noch keine Kommentare. Sei der Erste!</div>}
                  {comments.map(comment => (
                      <div key={comment.id} className="flex gap-3 items-start group">
                          <Avatar src={comment.authorImage} alt={comment.authorName} size="sm" className="mt-1"/>
                          <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex-1">
                              <div className="flex justify-between items-baseline mb-1">
                                  <span className="font-bold text-xs text-slate-900">{comment.authorName}</span>
                                  <span className="text-[10px] text-slate-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm text-slate-700">{comment.text}</p>
                          </div>
                          {/* Löschen Button für eigene Kommentare oder Post-Besitzer */}
                          {(currentUserId === comment.authorId || isOwner) && (
                              <button 
                                onClick={async () => {
                                    if(confirm("Kommentar löschen?")) 
                                        await deleteDoc(doc(db, "companies", companyId, "posts", post.id, "comments", comment.id));
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all self-center"
                              >
                                  <Trash2 size={14}/>
                              </button>
                          )}
                      </div>
                  ))}
              </div>

              {/* Input Feld */}
              <div className="flex gap-2 items-end">
                  <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all">
                    <textarea 
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Schreibe einen Kommentar..."
                        className="w-full p-3 text-sm outline-none resize-none max-h-24"
                        rows="1"
                        onKeyDown={(e) => {
                            if(e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendComment();
                            }
                        }}
                    />
                  </div>
                  <Button size="icon" onClick={handleSendComment} disabled={!newComment.trim()} className="rounded-xl h-[46px] w-[46px]">
                      <Send size={18}/>
                  </Button>
              </div>
          </div>
      )}

    </Card>
  );
};