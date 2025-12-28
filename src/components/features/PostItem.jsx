import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card } from '../ui/Card';

export const PostItem = ({ post, companyId, currentUserId, onViewProfile }) => {
  const [likes, setLikes] = useState(post.likes || []);
  const hasLiked = likes.includes(currentUserId);

  const toggleLike = async () => {
    if (!currentUserId) return;
    const ref = doc(db, "companies", companyId, "posts", post.id);
    const newLikes = hasLiked ? likes.filter(id => id !== currentUserId) : [...likes, currentUserId];
    setLikes(newLikes);
    await updateDoc(ref, { likes: hasLiked ? arrayRemove(currentUserId) : arrayUnion(currentUserId) });
  };

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* HIER GEÄNDERT: rounded-xl statt rounded-full */}
          <div 
            onClick={() => onViewProfile && onViewProfile(companyId)} 
            className="cursor-pointer h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200"
          >
            {post.authorInitial || "F"}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Neuigkeit</div>
            <div className="text-xs text-slate-500">{new Date(post.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-2 text-sm text-slate-800 whitespace-pre-wrap">
        {post.content}
      </div>
      <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4">
        <button 
          onClick={toggleLike} 
          className={`flex items-center gap-1 text-sm font-medium transition-colors ${hasLiked ? 'text-red-500' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Heart size={18} fill={hasLiked ? "currentColor" : "none"} /> 
          {likes.length}
        </button>
      </div>
    </Card>
  );
};