import React, { useState } from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { doc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card } from '../ui/Card';

export const PostItem = ({ post, companyId, currentUserId, onViewProfile }) => {
  const [likes, setLikes] = useState(post.likes || []);
  const hasLiked = likes.includes(currentUserId);
  const isOwner = currentUserId === companyId;

  const toggleLike = async () => {
    if (!currentUserId) return;
    const ref = doc(db, "companies", companyId, "posts", post.id);
    const newLikes = hasLiked 
      ? likes.filter(id => id !== currentUserId) 
      : [...likes, currentUserId];
    
    setLikes(newLikes);
    await updateDoc(ref, { 
      likes: hasLiked ? arrayRemove(currentUserId) : arrayUnion(currentUserId) 
    });
  };

  const handleDelete = async () => {
    if (!window.confirm("Beitrag löschen?")) return;
    await deleteDoc(doc(db, "companies", companyId, "posts", post.id));
  };

  return (
    <Card className="mb-4 overflow-hidden border-slate-200">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            onClick={() => onViewProfile && onViewProfile(companyId)} 
            className="cursor-pointer h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200 shadow-sm"
          >
            {post.authorInitial || "F"}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Neuigkeit</div>
            <div className="text-xs text-slate-500">{new Date(post.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
        {isOwner && (
          <button onClick={handleDelete} className="text-slate-400 hover:text-red-500 transition-colors">
            <Trash2 size={18} />
          </button>
        )}
      </div>
      <div className="px-4 pb-4 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
        {post.content}
      </div>
      <div className="px-4 py-2 border-t border-slate-50 bg-slate-50/50 flex items-center gap-4">
        <button 
          onClick={toggleLike} 
          className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${hasLiked ? 'text-red-500' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Heart size={16} fill={hasLiked ? "currentColor" : "none"} /> 
          {likes.length} {likes.length === 1 ? 'Gefällt mir' : 'Gefällt mir'}
        </button>
      </div>
    </Card>
  );
};