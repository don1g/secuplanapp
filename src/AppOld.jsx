import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// --- ICONS (Lucide) ---
import { 
  Shield, LayoutDashboard, CalendarDays, Users, FileText, Settings, 
  Bell, Search, Menu, X, CheckCircle2, AlertTriangle, Clock, MapPin, 
  LogOut, Save, Loader2, CheckCircle, Upload, Globe, Mail, ArrowLeft, 
  Phone, Filter, Briefcase, User, Plus, Ban, Trash2, ChevronDown, Send, 
  Heart, MessageCircle, MessageSquare, Pencil, Download,
  // NEU FÜR DEN KALENDER:
  ChevronLeft, ChevronRight 
} from 'lucide-react';

// --- DATE HELPER (NEU FÜR DEN KALENDER) ---
// Wichtig: 'npm install date-fns' muss ausgeführt sein!
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, subDays
} from 'date-fns';
import { de } from 'date-fns/locale';

// --- FIREBASE IMPORTS ---
import { auth, db, storage } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, addDoc, deleteDoc, onSnapshot, orderBy, arrayUnion, arrayRemove, increment, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- PDF IMPORTS ---
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

// --- KONFIGURATION ---
const PLANS = {
  basic: { name: "Starter", price: 0, maxEmployees: 1, publicVisible: false, label: "Kostenlos" },
  pro: { name: "Professional", price: 49, maxEmployees: 10, publicVisible: true, label: "49€ / Monat" },
  enterprise: { name: "Enterprise", price: 149, maxEmployees: 50, publicVisible: true, label: "149€ / Monat" }
};

const EMP_ROLES = {
  worker: { label: "Sicherheitsmitarbeiter", canEditSchedule: false },
  team_lead: { label: "Einsatzleiter", canEditSchedule: true },
  obj_lead: { label: "Objektleiter", canEditSchedule: true }
};

// --- HELPER COMPONENTS ---
function NavItem({ icon, label, isActive, isSidebarOpen, onClick, isAction = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center px-3 py-3 rounded-lg transition-all duration-200 group mb-1
        ${isActive 
          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
          : isAction ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 mt-6 border border-indigo-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }
      `}
    >
      <div className={`${isActive ? 'text-white' : isAction ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-900'}`}>
        {icon}
      </div>
      <span className={`ml-3 text-sm font-medium whitespace-nowrap transition-all duration-300 ${!isSidebarOpen ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : ''}`}>
        {label}
      </span>
    </button>
  );
}

function StatCard({ title, value, trend, icon, bg }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl bg-slate-50 text-slate-600`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
        <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mr-2 border border-emerald-200">{trend}</span>
        <span>Aktualisiert</span>
      </div>
    </div>
  );
}

const StarRating = ({ rating }) => (
  <div className="flex text-yellow-400">
    {[...Array(5)].map((_, i) => (
      <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={i < rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="w-3 h-3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.545.044.757.74.34 1.107l-4.193 3.823a.563.563 0 00-.175.53l1.243 5.309c.148.54-.447.962-.916.69l-4.66-2.613a.562.562 0 00-.547 0l-4.66 2.613c-.47.272-1.064-.15-.916-.69l1.243-5.31a.563.563 0 00-.175-.529l-4.193-3.824c-.417-.367-.205-1.063.34-1.107l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ))}
  </div>
);

const TabButton = ({ id, label, active, set, icon, isBoss }) => (
    <button 
        onClick={() => set(id)} 
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all border 
        ${active === id 
            ? isBoss ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-blue-600 text-white border-blue-600 shadow-md' 
            : 'bg-white border-transparent text-slate-500 hover:bg-slate-50'
        }`}
    >
        {icon} {label}
    </button>
);

const StatusBadge = ({ status }) => {
    if(status === 'Genehmigt') return <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold flex items-center w-fit gap-1"><CheckCircle size={12}/> Genehmigt</span>
    if(status === 'Abgelehnt') return <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-bold flex items-center w-fit gap-1"><Ban size={12}/> Abgelehnt</span>
    return <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded font-bold flex items-center w-fit gap-1"><Clock size={12}/> Offen</span>
};

// --- USER PROFILE VIEW (Mit integriertem Kalender) ---
const UserProfileView = ({ targetUserId, onBack, onViewCompany }) => {
    const [userData, setUserData] = useState(null);
    const [companyInfo, setCompanyInfo] = useState(null);
    const [employeeData, setEmployeeData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                let docSnap = await getDoc(doc(db, "users", targetUserId));
                let isCompany = false;
                
                if (!docSnap.exists()) {
                    docSnap = await getDoc(doc(db, "companies", targetUserId));
                    isCompany = true;
                }

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData({ ...data, isCompany });

                    if (data.companyId) {
                        const compSnap = await getDoc(doc(db, "companies", data.companyId));
                        if (compSnap.exists()) {
                            setCompanyInfo({ id: compSnap.id, ...compSnap.data() });
                            
                            // Lade Mitarbeiterdaten aus employees collection
                            try {
                                const empSnap = await getDoc(doc(db, "companies", data.companyId, "employees", targetUserId));
                                if (empSnap.exists()) {
                                    setEmployeeData({ id: empSnap.id, ...empSnap.data() });
                                }
                            } catch (err) {
                                console.error("Fehler beim Laden der Mitarbeiterdaten:", err);
                            }
                        }
                    }
                }
            } catch (err) { console.error(err); }
            setLoading(false);
        };
        fetchUser();
    }, [targetUserId]);

    const getRoleLabel = (role) => {
        if (role === 'team_lead') return 'Einsatzleiter';
        if (role === 'obj_lead') return 'Objektleiter';
        return 'Sicherheitsmitarbeiter';
    };

    if (loading) return <div className="flex h-full items-center justify-center p-10"><Loader2 className="animate-spin text-blue-600"/></div>;
    if (!userData) return <div className="p-10 text-center">Nutzer nicht gefunden. <button onClick={onBack} className="text-blue-600 underline">Zurück</button></div>;

    return (
        <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 pb-10">
            <button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-600 font-bold text-sm bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors">
                <ArrowLeft size={18}/> Zurück
            </button>
            
            {/* WENN MITARBEITER: ZEIGE DEN NEUEN ROSTER SCHEDULER (enthält Profilkarte links) */}
            {!userData.isCompany && companyInfo ? (
                <RosterScheduler 
                    user={{ uid: "viewer" }} // Dummy ID für Viewer
                    targetUserId={targetUserId} // Wir schauen uns DIESEN User an
                    companyId={companyInfo.id}
                    employees={employeeData ? [{ id: targetUserId, ...userData, ...employeeData }] : [{ id: targetUserId, ...userData }]} // Mitarbeiterdaten mit Rolle
                />
            ) : (
                // WENN FIRMA ODER KEINE INFO: ZEIGE EINFACHES PROFIL
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden text-center pb-8 max-w-3xl mx-auto">
                    <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-400 relative"></div>
                    <div className="relative -mt-16 mb-3 flex justify-center">
                        <div className="h-32 w-32 rounded-full border-4 border-white bg-white shadow-md overflow-hidden relative">
                            {userData.imageUrl ? <img src={userData.imageUrl} className="h-full w-full object-cover"/> : <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-300 font-bold text-4xl">{userData.name ? userData.name.charAt(0) : "U"}</div>}
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-1">{userData.name}</h2>
                    <div className="flex justify-center mb-6">
                        {userData.isCompany ? (
                            <span className="text-slate-500 font-medium">Offizielles Firmenprofil</span>
                        ) : (
                            <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                                <span>{getRoleLabel(userData.role)} bei</span>
                                {companyInfo ? (
                                    <button onClick={() => onViewCompany && onViewCompany(companyInfo.id)} className="flex items-center gap-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 pl-1 pr-2 py-0.5 rounded-full transition-all group">
                                        <div className="h-5 w-5 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center">{companyInfo.imageUrl ? <img src={companyInfo.imageUrl} className="h-full w-full object-cover"/> : <Shield size={10} className="text-slate-400"/>}</div>
                                        <span className="font-bold text-slate-800 group-hover:text-blue-700">{companyInfo.name}</span>
                                    </button>
                                ) : (<span className="italic text-slate-400">einer Sicherheitsfirma</span>)}
                            </div>
                        )}
                    </div>
                    {/* Kontaktdaten etc. */}
                    <div className="border-t border-slate-100 pt-6 px-8 text-left max-w-lg mx-auto">
                        <div className="space-y-3">
                            <div className="flex items-center gap-4 text-slate-700 p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="bg-white p-2 rounded-full text-blue-600 shadow-sm"><Mail size={18}/></div><div><div className="text-xs text-slate-400 font-bold uppercase">E-Mail</div><div>{userData.email}</div></div></div>
                            {userData.phone && <div className="flex items-center gap-4 text-slate-700 p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="bg-white p-2 rounded-full text-blue-600 shadow-sm"><Phone size={18}/></div><div><div className="text-xs text-slate-400 font-bold uppercase">Telefon</div><div>{userData.phone}</div></div></div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- POST ITEM (Mit klickbaren Profilen) ---
const PostItem = ({ post, companyId, currentUserId, currentUserName, onViewProfile }) => {
    // ... (States wie likes, comments bleiben gleich) ...
    const [likes, setLikes] = useState(post.likes || []);
    const [comments, setComments] = useState([]);
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditingPost, setIsEditingPost] = useState(false);
    const [editedContent, setEditedContent] = useState(post.content);
    const hasLiked = likes.includes(currentUserId);
    const isOwner = companyId === currentUserId;

    // Synchronisiere editedContent wenn post.content sich ändert
    useEffect(() => {
        if (!isEditingPost) {
            setEditedContent(post.content);
        }
    }, [post.content, isEditingPost]);

    // Echtzeit-Listener für Kommentare und User-Daten dazu
    useEffect(() => {
        const q = query(collection(db, "companies", companyId, "posts", post.id, "comments"), orderBy("createdAt", "asc"));
        const unsub = onSnapshot(q, async (snap) => {
            const loadedComments = await Promise.all(snap.docs.map(async (d) => {
                const cData = d.data();
                // Versuche Bild des Autors zu laden, falls nicht im Kommentar gespeichert
                let authorImg = null;
                try {
                    const uDoc = await getDoc(doc(db, "users", cData.authorId));
                    if (uDoc.exists()) authorImg = uDoc.data().imageUrl;
                    else {
                        const cDoc = await getDoc(doc(db, "companies", cData.authorId));
                        if (cDoc.exists()) authorImg = cDoc.data().imageUrl;
                    }
                } catch(e){}
                return { id: d.id, ...cData, authorImg };
            }));
            setComments(loadedComments);
        });
        return () => unsub();
    }, [companyId, post.id]);

    const handleToggleLike = async () => { /* ... (Code bleibt gleich) ... */ 
        if (!currentUserId) return;
        const postRef = doc(db, "companies", companyId, "posts", post.id);
        if (hasLiked) { setLikes(prev => prev.filter(id => id !== currentUserId)); await updateDoc(postRef, { likes: arrayRemove(currentUserId) }); } 
        else { setLikes(prev => [...prev, currentUserId]); await updateDoc(postRef, { likes: arrayUnion(currentUserId) }); }
    };

    const handleAddComment = async (e) => { /* ... (Code bleibt gleich) ... */ 
        e.preventDefault(); if(!newComment.trim() || !currentUserId) return; setIsSubmitting(true);
        await addDoc(collection(db, "companies", companyId, "posts", post.id, "comments"), {
            text: newComment, authorId: currentUserId, authorName: currentUserName || "User", createdAt: new Date().toISOString()
        });
        setNewComment(""); setIsSubmitting(false); setShowComments(true);
    };

    const handleEditPost = () => {
        setIsEditingPost(true);
        setEditedContent(post.content);
    };

    const handleSaveEdit = async () => {
        if (!editedContent.trim()) return;
        const postRef = doc(db, "companies", companyId, "posts", post.id);
        await updateDoc(postRef, { content: editedContent });
        setIsEditingPost(false);
    };

    const handleCancelEdit = () => {
        setIsEditingPost(false);
        setEditedContent(post.content);
    };

    const handleDeletePost = async () => {
        if (window.confirm("Möchten Sie diesen Post wirklich löschen?")) {
            await deleteDoc(doc(db, "companies", companyId, "posts", post.id));
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
            {/* Header des Posts */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Firmenprofil öffnen bei Klick auf Post-Autor (Firma) */}
                    <div onClick={() => onViewProfile && onViewProfile(companyId)} className="cursor-pointer h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200 overflow-hidden">
                        {/* (Hier könnte man noch das Firmenbild laden, vereinfacht AuthorInitial) */}
                        {post.authorInitial || "F"}
                    </div>
                    <div>
                        <div onClick={() => onViewProfile && onViewProfile(companyId)} className="text-sm font-bold text-slate-900 cursor-pointer hover:underline">Neuigkeit</div>
                        <div className="text-xs text-slate-500">{new Date(post.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>
                {/* Edit/Delete Buttons - nur für Post-Besitzer */}
                {isOwner && !isEditingPost && (
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleEditPost}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Bearbeiten"
                        >
                            <Pencil size={16} />
                        </button>
                        <button 
                            onClick={handleDeletePost}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Löschen"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Post Content - Edit Mode oder View Mode */}
            <div className="px-4 pb-2">
                {isEditingPost ? (
                    <div className="space-y-2">
                        <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="w-full bg-slate-50 border border-blue-300 rounded-lg p-3 text-sm text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                            rows="4"
                            placeholder="Post-Inhalt bearbeiten..."
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={handleCancelEdit}
                                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={!editedContent.trim()}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Speichern
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                )}
            </div>

            <div className="px-4 py-2 flex justify-between items-center text-xs text-slate-500 border-b border-slate-100">
                <div className="flex items-center gap-1">{likes.length > 0 && (<><div className="bg-blue-500 text-white rounded-full p-1"><Heart size={10} fill="white"/></div><span>{likes.length}</span></>)}</div>
                <button onClick={() => setShowComments(!showComments)} className="hover:underline">{comments.length === 0 ? "Keine Kommentare" : `${comments.length} Kommentar${comments.length !== 1 ? 'e' : ''}`}</button>
            </div>

            <div className="flex items-center px-2 py-1">
                <button onClick={handleToggleLike} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors text-sm font-medium ${hasLiked ? 'text-red-500' : 'text-slate-500 hover:bg-slate-50'}`}><Heart size={18} fill={hasLiked ? "currentColor" : "none"} /><span>Gefällt mir</span></button>
                <button onClick={() => setShowComments(!showComments)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors text-sm font-medium text-slate-500 hover:bg-slate-50"><MessageCircle size={18} /><span>Kommentieren</span></button>
            </div>

            {showComments && (
                <div className="bg-slate-50 p-4 border-t border-slate-100">
                    <div className="space-y-3 mb-4">
                        {comments.map(c => (
                            <div key={c.id} className="flex gap-2 items-start animate-in fade-in slide-in-from-top-1">
                                {/* HIER: Klick auf Avatar öffnet Profil */}
                                <div 
                                    onClick={() => onViewProfile && onViewProfile(c.authorId)}
                                    className="h-8 w-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 cursor-pointer overflow-hidden border border-slate-200 hover:opacity-80"
                                >
                                    {c.authorImg ? <img src={c.authorImg} className="w-full h-full object-cover"/> : c.authorName.charAt(0)}
                                </div>
                                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm max-w-[85%]">
                                    {/* HIER: Klick auf Namen öffnet Profil */}
                                    <div 
                                        onClick={() => onViewProfile && onViewProfile(c.authorId)}
                                        className="text-xs font-bold text-slate-900 mb-0.5 cursor-pointer hover:underline hover:text-blue-600"
                                    >
                                        {c.authorName}
                                    </div>
                                    <div className="text-sm text-slate-700">{c.text}</div>
                                    <div className="text-[10px] text-slate-400 mt-1">{new Date(c.createdAt).toLocaleDateString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {currentUserId && (
                        <form onSubmit={handleAddComment} className="flex gap-2 items-center">
                            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{currentUserName ? currentUserName.charAt(0) : "I"}</div>
                            <div className="flex-1 relative">
                                <input className="w-full bg-white border border-slate-300 rounded-full px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="Schreibe einen Kommentar..." value={newComment} onChange={e => setNewComment(e.target.value)} disabled={isSubmitting}/>
                                <button type="submit" disabled={!newComment.trim() || isSubmitting} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"><Send size={16}/></button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
};


// --- MESSAGE LIST COMPONENT (Isoliert, um Re-Renders zu vermeiden) ---
const MessageList = React.memo(({ groupedMessages, user, userRole, activeChat, onDeleteMessage, onAcceptRequest }) => {
    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50">
            {groupedMessages.map((item) => {
                if (item.type === 'date') {
                    return (
                        <div key={`date-${item.date}`} className="flex items-center justify-center my-4">
                            <div className="bg-white border border-slate-200 px-3 py-1 rounded-full text-xs font-bold text-slate-600">
                                {item.label}
                            </div>
                        </div>
                    );
                }
                
                const msg = item;
                const isMe = msg.senderId === user.uid;
                return (
                    <div key={msg.id || `msg-${msg.createdAt}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative`}>
                        <div className={`max-w-[75%] p-3 rounded-xl text-sm shadow-sm relative ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-200'}`}>
                            {msg.text}
                            <div className={`text-[10px] mt-1 flex items-center gap-2 ${isMe ? 'text-blue-100 justify-end' : 'text-slate-400 justify-start'}`}>
                                <span>{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                {isMe && msg.id && (
                                    <button
                                        onClick={() => onDeleteMessage(msg.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-200 hover:text-white"
                                        title="Nachricht löschen"
                                    >
                                        <Trash2 size={12}/>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
            {!activeChat.isNewDraft && activeChat.status === 'pending' && userRole === 'provider' && (
                <div className="bg-white border border-slate-200 p-6 rounded-xl text-center my-6 shadow-md">
                    <p className="text-slate-900 font-bold mb-2">Neue Kontaktanfrage</p>
                    <button onClick={onAcceptRequest} className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-lg font-bold text-sm transition-colors shadow-lg">Anfrage akzeptieren</button>
                </div>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison: Nur neu rendern wenn sich groupedMessages wirklich geändert hat
    return (
        prevProps.groupedMessages.length === nextProps.groupedMessages.length &&
        prevProps.groupedMessages.every((msg, idx) => 
            msg.id === nextProps.groupedMessages[idx]?.id &&
            msg.type === nextProps.groupedMessages[idx]?.type
        ) &&
        prevProps.activeChat?.id === nextProps.activeChat?.id &&
        prevProps.activeChat?.status === nextProps.activeChat?.status
    );
});

// --- CHAT SYSTEM (Angepasst für Embedded Mode & Overlay) ---
const ChatSystem = ({ user, userRole, targetId = null, targetName = "Unbekannt", targetImage = null, onClose, isEmbedded = false }) => {
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const messageInputRef = useRef(null);
    const [chatFilter, setChatFilter] = useState('active'); // 'active', 'deleted', 'blocked'

    useEffect(() => {
        const qField = userRole === 'client' ? 'clientId' : 'companyId';
        const q = query(collection(db, "chats"), where(qField, "==", user.uid));
        
        const unsub = onSnapshot(q, (snap) => {
            // Lade ALLE Chats (ohne Filter) für die Synchronisation
            const allChats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Gefilterte Liste für die Anzeige
            const chatList = allChats
                .filter(chat => {
                    // Filter basierend auf gelöscht/blockiert Status
                    const deletedBy = userRole === 'client' ? chat.deletedByClient : chat.deletedByProvider;
                    const blockedBy = userRole === 'client' ? chat.blockedByClient : chat.blockedByProvider;
                    
                    if (chatFilter === 'deleted') {
                        return deletedBy === true;
                    } else if (chatFilter === 'blocked') {
                        return blockedBy === true;
                    } else {
                        return !deletedBy && !blockedBy; // Nur aktive Chats
                    }
                })
                .sort((a, b) => {
                    // Fixierte Chats zuerst
                    const pinnedA = userRole === 'client' ? a.pinnedByClient : a.pinnedByProvider;
                    const pinnedB = userRole === 'client' ? b.pinnedByClient : b.pinnedByProvider;
                    if (pinnedA && !pinnedB) return -1;
                    if (!pinnedA && pinnedB) return 1;
                    // Dann nach lastUpdate
                    return (b.lastUpdate || '') > (a.lastUpdate || '') ? 1 : -1;
                });
            
            // Prüfe ob sich die Chat-Liste geändert hat, bevor wir updaten
            setChats(prevChats => {
                if (prevChats.length === chatList.length && 
                    prevChats.every((c, idx) => c.id === chatList[idx]?.id)) {
                    return prevChats; // Keine Änderung, kein Re-Render
                }
                return chatList;
            });
            
            // Aktualisiere activeChat aus ALLEN Chats (nicht nur gefilterten)
            // WICHTIG: Verwende setActiveChat mit Funktion, um Re-Renders zu vermeiden
            setActiveChat(prevActiveChat => {
                if (!prevActiveChat || !prevActiveChat.id || prevActiveChat.id === 'NEW') {
                    // Wenn kein activeChat oder NEW, prüfe targetId
                    if (targetId) {
                        const existing = chatList.find(c => c.companyId === targetId);
                        if (existing) {
                            return existing;
                        } else if (!prevActiveChat) {
                            return {
                                id: 'NEW', 
                                companyId: targetId,
                                clientName: user.name || "Kunde",
                                companyName: targetName,
                                companyImage: targetImage,
                                status: 'pending',
                                isNewDraft: true 
                            };
                        }
                    }
                    return prevActiveChat;
                }
                
                // Aktualisiere activeChat nur wenn sich wichtige Felder geändert haben
                const updatedChat = allChats.find(c => c.id === prevActiveChat.id);
                if (updatedChat) {
                    const needsUpdate = 
                        updatedChat.status !== prevActiveChat.status ||
                        updatedChat.lastMessage !== prevActiveChat.lastMessage ||
                        updatedChat.unreadClient !== prevActiveChat.unreadClient ||
                        updatedChat.unreadProvider !== prevActiveChat.unreadProvider ||
                        updatedChat.pinnedByClient !== prevActiveChat.pinnedByClient ||
                        updatedChat.pinnedByProvider !== prevActiveChat.pinnedByProvider ||
                        updatedChat.blockedByClient !== prevActiveChat.blockedByClient ||
                        updatedChat.blockedByProvider !== prevActiveChat.blockedByProvider ||
                        updatedChat.deletedByClient !== prevActiveChat.deletedByClient ||
                        updatedChat.deletedByProvider !== prevActiveChat.deletedByProvider;
                    
                    if (needsUpdate) {
                        return updatedChat;
                    }
                }
                
                return prevActiveChat; // Keine Änderung, kein Re-Render
            });
            setLoading(false);
        });
        return () => unsub();
    }, [user.uid, userRole, targetId, targetName, targetImage, chatFilter]);

    useEffect(() => {
        if (!activeChat || activeChat.isNewDraft) {
            setMessages([]); 
            return;
        }
        
        // Mark as read when opening
        if ((userRole === 'client' && activeChat.unreadClient) || (userRole === 'provider' && activeChat.unreadProvider)) {
             updateDoc(doc(db, "chats", activeChat.id), {
                 [userRole === 'client' ? 'unreadClient' : 'unreadProvider']: false
             });
        }

        const q = query(collection(db, "chats", activeChat.id, "messages"), orderBy("createdAt", "asc"));
        const unsub = onSnapshot(q, (snap) => {
            const newMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Nur updaten wenn sich wirklich etwas geändert hat (vergleiche IDs)
            setMessages(prev => {
                // Prüfe ob sich wirklich etwas geändert hat
                if (prev.length === newMessages.length && 
                    prev.every((msg, idx) => msg.id === newMessages[idx]?.id)) {
                    return prev; // Keine Änderung, kein Re-Render
                }
                return newMessages;
            });
        });
        return () => unsub();
    }, [activeChat?.id, userRole]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        
        // Prüfe ob Chat blockiert ist
        const blocked = userRole === 'client' ? activeChat.blockedByClient : activeChat.blockedByProvider;
        if (blocked) {
            alert("Dieser Chat ist blockiert. Sie können keine Nachrichten senden.");
            return;
        }

        let chatId = activeChat?.id;
        const deletedBy = userRole === 'client' ? 'deletedByClient' : 'deletedByProvider';
        const isDeleted = activeChat[deletedBy];

        // Wenn Chat gelöscht ist, stelle ihn wieder her
        if (isDeleted && chatId) {
            await updateDoc(doc(db, "chats", chatId), {
                [deletedBy]: false,
                deletedAt: null
            });
        }

        if (activeChat.isNewDraft) {
            const docRef = await addDoc(collection(db, "chats"), {
                clientId: user.uid,
                clientName: user.name || "Kunde",
                companyId: targetId,
                companyName: targetName,
                companyImage: targetImage || null,
                lastMessage: newMessage,
                lastUpdate: new Date().toISOString(),
                status: 'pending', 
                unreadProvider: true,
                unreadClient: false
            });
            chatId = docRef.id;
            setActiveChat(prev => ({ ...prev, id: chatId, isNewDraft: false }));
        }

        if (chatId) {
            await addDoc(collection(db, "chats", chatId, "messages"), {
                text: newMessage,
                senderId: user.uid,
                createdAt: new Date().toISOString()
            });
            await updateDoc(doc(db, "chats", chatId), {
                lastMessage: newMessage,
                lastUpdate: new Date().toISOString(),
                [userRole === 'client' ? 'unreadProvider' : 'unreadClient']: true
            });
            setNewMessage("");
            // Stelle Fokus wieder her nach dem Senden
            setTimeout(() => {
                if (messageInputRef.current) {
                    messageInputRef.current.focus();
                }
            }, 100);
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!window.confirm("Nachricht wirklich löschen?")) return;
        try {
            await deleteDoc(doc(db, "chats", activeChat.id, "messages", messageId));
        } catch (error) {
            console.error("Fehler beim Löschen der Nachricht:", error);
            alert("Fehler beim Löschen der Nachricht");
        }
    };

    const handleAcceptRequest = async () => {
        await updateDoc(doc(db, "chats", activeChat.id), { status: 'active' });
        setActiveChat(prev => ({...prev, status: 'active'}));
    };

    const handleDeleteChat = async (chatId) => {
        if (!window.confirm("Chat wirklich löschen? Sie können ihn später wiederherstellen.")) return;
        try {
            const deletedBy = userRole === 'client' ? 'deletedByClient' : 'deletedByProvider';
            const chatRef = doc(db, "chats", chatId);
            await updateDoc(chatRef, {
                [deletedBy]: true,
                deletedAt: new Date().toISOString()
            });
            if (activeChat?.id === chatId) {
                setActiveChat(null);
                setChatFilter('active'); // Wechsle zurück zu aktiven Chats
            }
        } catch (error) {
            console.error("Fehler beim Löschen:", error);
            alert("Fehler beim Löschen des Chats");
        }
    };

    const handleRestoreChat = async (chatId) => {
        try {
            const deletedBy = userRole === 'client' ? 'deletedByClient' : 'deletedByProvider';
            await updateDoc(doc(db, "chats", chatId), {
                [deletedBy]: false,
                deletedAt: null
            });
        } catch (error) {
            console.error("Fehler beim Wiederherstellen:", error);
            alert("Fehler beim Wiederherstellen des Chats");
        }
    };

    const handleBlockUser = async (chatId) => {
        if (!window.confirm("Nutzer wirklich blockieren? Sie können ihn später wieder entsperren.")) return;
        try {
            const blockedBy = userRole === 'client' ? 'blockedByClient' : 'blockedByProvider';
            const chatRef = doc(db, "chats", chatId);
            await updateDoc(chatRef, {
                [blockedBy]: true,
                blockedAt: new Date().toISOString()
            });
            if (activeChat?.id === chatId) {
                setActiveChat(prev => ({...prev, [blockedBy]: true}));
                setChatFilter('active'); // Wechsle zurück zu aktiven Chats
            }
        } catch (error) {
            console.error("Fehler beim Blockieren:", error);
            alert("Fehler beim Blockieren des Nutzers");
        }
    };

    const handleUnblockUser = async (chatId) => {
        try {
            const blockedBy = userRole === 'client' ? 'blockedByClient' : 'blockedByProvider';
            await updateDoc(doc(db, "chats", chatId), {
                [blockedBy]: false,
                blockedAt: null
            });
            if (activeChat?.id === chatId) {
                setActiveChat(prev => ({...prev, [blockedBy]: false}));
            }
        } catch (error) {
            console.error("Fehler beim Entsperren:", error);
            alert("Fehler beim Entsperren des Nutzers");
        }
    };

    const handlePinChat = async (chatId, isPinned) => {
        try {
            const pinnedBy = userRole === 'client' ? 'pinnedByClient' : 'pinnedByProvider';
            const chatRef = doc(db, "chats", chatId);
            const newPinnedValue = !isPinned;
            await updateDoc(chatRef, {
                [pinnedBy]: newPinnedValue
            });
            // Update local state
            if (activeChat?.id === chatId) {
                setActiveChat(prev => ({...prev, [pinnedBy]: newPinnedValue}));
            }
        } catch (error) {
            console.error("Fehler beim Fixieren:", error);
            alert("Fehler beim Fixieren des Chats");
        }
    };

    const getPartnerInfo = useCallback((chat) => {
        if (!chat) return { name: "Wähle einen Chat", image: null };
        if (chat.isNewDraft) return { name: targetName, image: targetImage };
        if (userRole === 'client') {
            return { name: chat.companyName, image: chat.companyImage };
        } else {
            return { name: chat.clientName, image: null };
        }
    }, [targetName, targetImage, userRole]);

    const partner = useMemo(() => getPartnerInfo(activeChat), [activeChat, getPartnerInfo]);

    // Berechne Chat-Status - einfach wie bei Posts
    const isBlocked = useMemo(() => 
        activeChat ? (userRole === 'client' ? activeChat.blockedByClient : activeChat.blockedByProvider) : false,
        [activeChat, userRole]
    );
    const canSend = useMemo(() => 
        activeChat ? ((activeChat.status === 'active' || userRole === 'client' || activeChat.isNewDraft) && !isBlocked) : false,
        [activeChat, userRole, isBlocked]
    );

    // Gruppiere Nachrichten nach Tagen - berechne today/yesterday nur einmal pro Tag
    const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
    const yesterdayStr = useMemo(() => format(subDays(new Date(), 1), 'yyyy-MM-dd'), []);
    
    const groupedMessages = useMemo(() => {
        try {
            if (!Array.isArray(messages) || messages.length === 0) return [];
            
            const grouped = [];
            let currentDate = null;
            
            messages.forEach((msg, idx) => {
                if (!msg || !msg.createdAt) return;
                
                try {
                    const msgDate = new Date(msg.createdAt);
                    if (isNaN(msgDate.getTime())) return;
                    
                    const dateStr = format(msgDate, 'yyyy-MM-dd');
                    const dateLabel = format(msgDate, 'EEEE, d. MMMM yyyy', { locale: de });
                    
                    // Füge Datums-Trenner hinzu wenn sich das Datum ändert
                    if (dateStr !== currentDate) {
                        currentDate = dateStr;
                        
                        let dateDisplay = dateLabel;
                        if (dateStr === todayStr) dateDisplay = 'Heute';
                        else if (dateStr === yesterdayStr) dateDisplay = 'Gestern';
                        
                        grouped.push({
                            type: 'date',
                            date: dateStr,
                            label: dateDisplay
                        });
                    }
                    
                    grouped.push({
                        type: 'message',
                        id: msg.id || `msg-${idx}`,
                        ...msg
                    });
                } catch (err) {
                    console.error("Fehler beim Verarbeiten einer Nachricht:", err);
                }
            });
            
            return grouped;
        } catch (error) {
            console.error("Fehler in groupedMessages useMemo:", error);
            return [];
        }
    }, [messages, todayStr, yesterdayStr]);

    // --- RENDER LOGIC: Embedded vs Overlay ---
    const containerClasses = isEmbedded 
        ? "flex h-full w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" // Embedded Style
        : "bg-white w-full max-w-5xl h-[100dvh] md:h-[80vh] md:rounded-xl border border-slate-200 shadow-2xl flex overflow-hidden relative"; // Overlay Style

    const Wrapper = ({ children }) => isEmbedded ? children : (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
            {children}
        </div>
    );

    return (
        <Wrapper>
            <div className={containerClasses}>
                
                {!isEmbedded && (
                    <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200 border border-slate-200 transition-all shadow-sm">
                        <X size={20}/>
                    </button>
                )}

                <div className={`w-full md:w-80 border-r border-slate-200 flex flex-col bg-slate-50 ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-200 bg-white">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-slate-900">Nachrichten</h3>
                        </div>
                        <div className="flex gap-1">
                            <button 
                                onClick={() => setChatFilter('active')}
                                className={`flex-1 px-2 py-1.5 text-xs font-bold rounded-lg transition-colors ${chatFilter === 'active' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                Aktiv
                            </button>
                            <button 
                                onClick={() => setChatFilter('deleted')}
                                className={`flex-1 px-2 py-1.5 text-xs font-bold rounded-lg transition-colors ${chatFilter === 'deleted' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                Gelöscht
                            </button>
                            <button 
                                onClick={() => setChatFilter('blocked')}
                                className={`flex-1 px-2 py-1.5 text-xs font-bold rounded-lg transition-colors ${chatFilter === 'blocked' ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                Blockiert
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {loading && <div className="p-4 text-slate-500 text-sm">Laden...</div>}
                        {chats.length === 0 && !loading && !activeChat?.isNewDraft && (
                            <div className="p-4 text-slate-500 text-sm text-center">
                                {chatFilter === 'deleted' ? 'Keine gelöschten Chats.' : 
                                 chatFilter === 'blocked' ? 'Keine blockierten Chats.' : 
                                 'Keine Nachrichten.'}
                            </div>
                        )}
                        
                        {activeChat?.isNewDraft && chatFilter === 'active' && (
                             <div className="p-4 border-b border-slate-200 bg-blue-50 border-l-4 border-l-blue-500">
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold text-slate-900 text-sm">{targetName}</span>
                                    <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase font-bold">Neu</span>
                                </div>
                                <div className="text-xs text-blue-600">Neue Anfrage...</div>
                            </div>
                        )}

                        {chats.map(chat => {
                            const p = userRole === 'client' ? { name: chat.companyName, image: chat.companyImage } : { name: chat.clientName, image: null };
                            const isUnread = userRole === 'client' ? chat.unreadClient : chat.unreadProvider;
                            const isPinned = userRole === 'client' ? chat.pinnedByClient : chat.pinnedByProvider;
                            return (
                                <div 
                                    key={chat.id} 
                                    onClick={(e) => {
                                        if (e.target.closest('button')) return;
                                        setActiveChat(chat);
                                    }} 
                                    className={`p-4 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors ${activeChat?.id === chat.id ? 'bg-white shadow-sm' : ''} ${isUnread ? 'bg-blue-50/50' : ''} ${isPinned ? 'border-l-4 border-l-yellow-400' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold flex-shrink-0 border border-slate-300 overflow-hidden relative">
                                            {p.image ? <img src={p.image} className="w-full h-full object-cover"/> : p.name.charAt(0)}
                                            {isUnread && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                                    {isPinned && <span className="text-yellow-500 flex-shrink-0"><ChevronDown size={12} className="rotate-180"/></span>}
                                                    <span className={`text-sm truncate ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{p.name}</span>
                                                </div>
                                                {chat.status === 'pending' && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded uppercase font-bold ml-1">Anfrage</span>}
                                            </div>
                                            <div className={`text-xs truncate ${isUnread ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>{chat.lastMessage}</div>
                                        </div>
                                        {chatFilter === 'deleted' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRestoreChat(chat.id);
                                                }}
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                title="Wiederherstellen"
                                            >
                                                <CheckCircle2 size={16}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={`flex-1 flex flex-col bg-white ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
                    {activeChat ? (
                        <>
                            <div className="h-16 md:h-16 border-b border-slate-200 flex items-center px-4 md:px-6 justify-between bg-white shadow-sm z-10">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <button onClick={() => setActiveChat(null)} className="md:hidden text-slate-500 mr-2"><ArrowLeft size={20}/></button>
                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold shadow-sm border-2 border-slate-200 overflow-hidden flex-shrink-0">
                                        {partner.image ? <img src={partner.image} className="w-full h-full object-cover"/> : partner.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 truncate">{partner.name}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                            {activeChat.isNewDraft ? <span className="text-blue-600">Neue Nachricht...</span> : (activeChat.status === 'pending' ? <span className="text-orange-500 flex items-center gap-1"><Clock size={10}/> Wartet auf Bestätigung</span> : <span className="text-green-600 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Aktiv</span>)}
                                        </div>
                                    </div>
                                </div>
                                {!activeChat.isNewDraft && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const isPinned = userRole === 'client' ? activeChat.pinnedByClient : activeChat.pinnedByProvider;
                                                handlePinChat(activeChat.id, isPinned);
                                            }}
                                            className="p-2 text-slate-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                                            title={userRole === 'client' ? (activeChat.pinnedByClient ? 'Fixierung aufheben' : 'Chat fixieren') : (activeChat.pinnedByProvider ? 'Fixierung aufheben' : 'Chat fixieren')}
                                        >
                                            <ChevronDown size={18} className={userRole === 'client' ? (activeChat.pinnedByClient ? 'rotate-180 text-yellow-600' : 'rotate-180') : (activeChat.pinnedByProvider ? 'rotate-180 text-yellow-600' : 'rotate-180')}/>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const isBlocked = userRole === 'client' ? activeChat.blockedByClient : activeChat.blockedByProvider;
                                                if (isBlocked) {
                                                    handleUnblockUser(activeChat.id);
                                                } else {
                                                    handleBlockUser(activeChat.id);
                                                }
                                            }}
                                            className="p-2 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                            title={userRole === 'client' ? (activeChat.blockedByClient ? 'Entsperren' : 'Blockieren') : (activeChat.blockedByProvider ? 'Entsperren' : 'Blockieren')}
                                        >
                                            <Ban size={18} className={userRole === 'client' ? (activeChat.blockedByClient ? 'text-orange-600' : '') : (activeChat.blockedByProvider ? 'text-orange-600' : '')}/>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteChat(activeChat.id);
                                            }}
                                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Chat löschen"
                                        >
                                            <Trash2 size={18}/>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <MessageList 
                                groupedMessages={groupedMessages}
                                user={user}
                                userRole={userRole}
                                activeChat={activeChat}
                                onDeleteMessage={handleDeleteMessage}
                                onAcceptRequest={handleAcceptRequest}
                            />

                            {isBlocked ? (
                                <div className="p-4 bg-white border-t border-slate-200 text-center">
                                    <div className="text-slate-500 text-sm mb-2">Dieser Chat ist blockiert.</div>
                                    <button
                                        onClick={() => {
                                            handleUnblockUser(activeChat.id);
                                        }}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                                    >
                                        Entsperren
                                    </button>
                                </div>
                            ) : canSend ? (
                                <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-200 flex gap-4">
                                    <input 
                                        id="chat-message-input"
                                        name="chat-message-input"
                                        ref={messageInputRef}
                                        type="text"
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-blue-500 outline-none text-sm placeholder-slate-400" 
                                        placeholder="Nachricht schreiben..." 
                                        value={newMessage} 
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        autoComplete="off"
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!newMessage.trim()} 
                                        className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send size={20} />
                                    </button>
                                </form>
                            ) : (
                                <div className="p-4 bg-white border-t border-slate-200 text-center text-slate-500 text-sm">Chat ist noch nicht aktiv.</div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400"><Mail size={64} className="mb-4 opacity-20"/><p className="font-medium">Wählen Sie eine Konversation</p></div>
                    )}
                </div>
            </div>
        </Wrapper>
    );
};

// --- AUTH SCREEN (Mit Auto-Counter Update) ---
const AuthScreen = ({ onLogin }) => {
  const [mode, setMode] = useState('landing'); 
  const [role, setRole] = useState('client'); 
  const [selectedPlan, setSelectedPlan] = useState('basic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
        
        if (userDoc.exists()) {
           const data = userDoc.data();
           
           // EINLADUNGS CHECK (LOGIN)
           const inviteQ = query(collection(db, "global_invites"), where("email", "==", userCredential.user.email));
           const inviteSnap = await getDocs(inviteQ);
           if (!inviteSnap.empty) {
               const inviteData = inviteSnap.docs[0].data();
               const confirmJoin = window.confirm(`Du wurdest von "${inviteData.companyName}" eingeladen. Möchtest du beitreten?`);
               if (confirmJoin) {
                   const batch = writeBatch(db);
                   
                   // 1. User Update
                   batch.update(doc(db, "users", userCredential.user.uid), { type: 'employee', companyId: inviteData.companyId, role: inviteData.role });
                   
                   // 2. Mitarbeiter Eintrag erstellen
                   const empRef = doc(db, "companies", inviteData.companyId, "employees", userCredential.user.uid);
                   batch.set(empRef, {
                       name: data.name || "Mitarbeiter",
                       email: userCredential.user.email,
                       role: inviteData.role,
                       status: 'Aktiv',
                       joinedAt: new Date().toISOString()
                   });

                   // 3. Zähler der Firma erhöhen (+1)
                   const compRef = doc(db, "companies", inviteData.companyId);
                   batch.update(compRef, { employees: increment(1) });

                   // 4. Invite löschen
                   batch.delete(inviteSnap.docs[0].ref);

                   await batch.commit();

                   onLogin({ uid: userCredential.user.uid, email: userCredential.user.email, ...data, type: 'employee', companyId: inviteData.companyId, role: inviteData.role });
                   return;
               }
           }

           if (data.type === 'employee' && data.companyId) {
               const empDoc = await getDoc(doc(db, "companies", data.companyId, "employees", userCredential.user.uid));
               if (empDoc.exists()) {
                   onLogin({ uid: userCredential.user.uid, email: userCredential.user.email, ...data, ...empDoc.data() });
                   return;
               }
           }
           onLogin({ uid: userCredential.user.uid, email: userCredential.user.email, ...data });
        } else {
           onLogin({ uid: userCredential.user.uid, email: userCredential.user.email, type: 'client', name: "User" });
        }
      } else {
        // REGISTRIERUNG
        let assignedCompanyId = null;
        let assignedRole = 'worker';
        let inviteRef = null;

        if (role === 'employee') {
            const q = query(collection(db, "global_invites"), where("email", "==", email));
            const inviteSnap = await getDocs(q);
            if (!inviteSnap.empty) {
                const inviteData = inviteSnap.docs[0].data();
                assignedCompanyId = inviteData.companyId;
                assignedRole = inviteData.role;
                inviteRef = inviteSnap.docs[0].ref;
            }
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const userData = { name, type: role, plan: role === 'provider' ? selectedPlan : null, companyId: assignedCompanyId, createdAt: new Date().toISOString() };
        
        const batch = writeBatch(db);
        batch.set(doc(db, "users", userCredential.user.uid), userData);
        
        if (role === 'provider') {
             batch.set(doc(db, "companies", userCredential.user.uid), {
                 name: name, description: "Neu bei SecuPlan.", price: "49", employees: 0, verified: false, isVisible: false, showPrice: true, plan: selectedPlan, imageUrl: null
             });
        }
        if (role === 'employee' && assignedCompanyId) {
            // Mitarbeiter anlegen
            batch.set(doc(db, "companies", assignedCompanyId, "employees", userCredential.user.uid), {
                name: name, email: email, role: assignedRole, status: 'Aktiv', joinedAt: new Date().toISOString()
            });
            // Zähler erhöhen (+1)
            batch.update(doc(db, "companies", assignedCompanyId), { employees: increment(1) });
            // Invite löschen
            if(inviteRef) batch.delete(inviteRef);
        }

        await batch.commit();

        if (role === 'employee' && assignedCompanyId) {
            onLogin({ uid: userCredential.user.uid, email: userCredential.user.email, ...userData, role: assignedRole });
        } else {
            onLogin({ uid: userCredential.user.uid, email: userCredential.user.email, ...userData });
        }
      }
    } catch (err) { setError("Fehler: " + err.message); }
    setLoading(false);
  };

  if (mode === 'landing') return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-4xl w-full flex flex-col md:flex-row border border-slate-200 overflow-hidden">
          <div className="md:w-1/2 p-4 space-y-6 flex flex-col justify-center">
            <div><h1 className="text-4xl font-bold text-slate-900 mb-2">Secu<span className="text-blue-600">Plan</span></h1><p className="text-slate-500 text-lg">Die moderne Plattform für Sicherheitsdienste.</p></div>
            <div className="space-y-3 pt-4"><button onClick={() => setMode('login')} className="w-full bg-slate-100 text-slate-700 font-bold py-4 rounded-xl hover:bg-slate-200 transition-colors border border-slate-200">Ich habe bereits ein Konto</button><button onClick={() => setMode('role_selection')} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">Neu hier? Jetzt starten</button></div>
          </div>
          <div className="md:w-1/2 bg-slate-50 p-8 flex justify-center items-center border-l border-slate-100"><Shield className="h-40 w-40 text-blue-200" /></div>
        </div>
      </div>
  );
  if (mode === 'role_selection') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl shadow-xl p-8 max-w-4xl w-full border border-slate-200">
        <button onClick={() => setMode('landing')} className="mb-6 text-slate-400 hover:text-slate-600 flex items-center gap-2">← Zurück</button>
        <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Wie möchten Sie SecuPlan nutzen?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div onClick={() => { setRole('client'); setMode('register'); }} className="border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 rounded-2xl p-6 cursor-pointer transition-all group text-center"><User className="h-12 w-12 mx-auto text-slate-400 group-hover:text-blue-500 mb-4"/><h3 className="font-bold text-lg text-slate-800">Privat / Auftraggeber</h3><p className="text-sm text-slate-500 mt-2">Ich suche Sicherheitsdienste.</p></div>
            <div onClick={() => { setRole('provider'); setMode('plan_selection'); }} className="border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 rounded-2xl p-6 cursor-pointer transition-all group text-center relative overflow-hidden"><div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] px-2 py-1 rounded-bl-lg font-bold">BUSINESS</div><Briefcase className="h-12 w-12 mx-auto text-slate-400 group-hover:text-blue-500 mb-4"/><h3 className="font-bold text-lg text-slate-800">Sicherheitsfirma</h3><p className="text-sm text-slate-500 mt-2">Ich leite eine Firma.</p></div>
            <div onClick={() => { setRole('employee'); setMode('register'); }} className="border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 rounded-2xl p-6 cursor-pointer transition-all group text-center"><Users className="h-12 w-12 mx-auto text-slate-400 group-hover:text-emerald-500 mb-4"/><h3 className="font-bold text-lg text-slate-800">Mitarbeiter</h3><p className="text-sm text-slate-500 mt-2">Ich habe eine Einladung.</p></div>
        </div>
    </div>
    </div>
  );
  if (mode === 'plan_selection') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-4xl w-full text-center shadow-xl border border-slate-200">
            <h2 className="text-2xl font-bold mb-2 text-slate-800">Wählen Sie Ihren Plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {Object.entries(PLANS).map(([key, plan]) => (
                    <div key={key} onClick={() => setSelectedPlan(key)} className={`border-2 p-6 rounded-xl cursor-pointer transition-all ${selectedPlan === key ? 'border-blue-500 bg-blue-50 shadow-lg scale-105' : 'border-slate-100 hover:border-slate-300'}`}>
                        <h3 className="font-bold text-lg text-slate-800">{plan.name}</h3><p className="text-xl font-bold text-blue-600 my-2">{plan.label}</p>
                        <ul className="text-sm text-slate-500 space-y-2 mb-4"><li>Bis zu <b>{plan.maxEmployees}</b> Mitarbeiter</li><li>{plan.publicVisible ? "✅ Im Marktplatz" : "❌ Nicht öffentlich"}</li></ul>
                    </div>
                ))}
            </div>
            <div className="flex justify-center gap-4"><button onClick={() => setMode('role_selection')} className="text-slate-500 font-bold px-6 py-3">Zurück</button><button onClick={() => setMode('register')} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800">Weiter</button></div>
        </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-slate-200">
        <button onClick={() => setMode(mode === 'login' ? 'landing' : role === 'provider' ? 'plan_selection' : 'role_selection')} className="text-sm text-slate-400 mb-6 hover:text-slate-600">← Zurück</button>
        <h2 className="text-2xl font-bold mb-1 text-slate-900">{mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}</h2>
        <p className="text-sm text-slate-500 mb-6">{mode === 'login' ? 'Bitte loggen Sie sich ein.' : role === 'employee' ? 'Registrieren Sie sich mit Ihrer E-Mail.' : 'Erstellen Sie Ihr Konto.'}</p>
        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'register' && (<input type="text" placeholder={role === 'provider' ? "Firmenname" : "Vollständiger Name"} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-slate-900" required value={name} onChange={e => setName(e.target.value)} />)}
          <input type="email" placeholder="E-Mail Adresse" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-slate-900" required value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Passwort" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-slate-900" required value={password} onChange={e => setPassword(e.target.value)} />
          {error && <p className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-md">{loading ? <Loader2 className="animate-spin mx-auto" /> : (mode === 'login' ? 'Einloggen' : 'Registrieren')}</button>
        </form>
      </div>
    </div>
  );
};

// --- ROSTER SCHEDULER (Neues Kalender-Design) ---
const RosterScheduler = ({ user, employees = [], companyId, targetUserId = null }) => {
    if (!companyId) {
        return (
            <div className="p-8 text-center text-slate-500">
                <p>Keine Firma zugeordnet. Bitte kontaktieren Sie Ihren Arbeitgeber.</p>
            </div>
        );
    }
    
    const activeUserId = targetUserId || user.uid;
    
    const [activeUser, setActiveUser] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [totalHours, setTotalHours] = useState(0);
    const [objects, setObjects] = useState([]);
    const [viewingObjectDetails, setViewingObjectDetails] = useState(null);

    // Lade aktiven User (aus employees oder users collection)
    useEffect(() => {
        const loadActiveUser = async () => {
            if (targetUserId) {
                // Versuche zuerst in employees zu finden
                const foundEmployee = employees.find(e => e.id === targetUserId);
                if (foundEmployee) {
                    setActiveUser(foundEmployee);
                } else {
                    // Falls nicht gefunden, lade direkt aus users collection
                    try {
                        const userDoc = await getDoc(doc(db, "users", targetUserId));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            // Versuche auch employee data zu laden
                            if (userData.companyId && companyId) {
                                try {
                                    const empDoc = await getDoc(doc(db, "companies", companyId, "employees", targetUserId));
                                    if (empDoc.exists()) {
                                        setActiveUser({ id: targetUserId, ...userData, ...empDoc.data() });
                                    } else {
                                        setActiveUser({ id: targetUserId, ...userData });
                                    }
                                } catch (e) {
                                    setActiveUser({ id: targetUserId, ...userData });
                                }
                            } else {
                                setActiveUser({ id: targetUserId, ...userData });
                            }
                        } else {
                            setActiveUser({ name: "Mitarbeiter", email: "", role: "worker" });
                        }
                    } catch (error) {
                        console.error("Fehler beim Laden des Users:", error);
                        setActiveUser({ name: "Mitarbeiter", email: "", role: "worker" });
                    }
                }
            } else {
                setActiveUser(user);
            }
        };
        loadActiveUser();
    }, [targetUserId, employees, user, companyId]);

    // Lade Objekte
    useEffect(() => {
        const loadObjects = async () => {
            if (!companyId) return;
            try {
                const objectsRef = collection(db, "companies", companyId, "objects");
                const snap = await getDocs(objectsRef);
                setObjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Fehler beim Laden der Objekte:", error);
            }
        };
        loadObjects();
    }, [companyId]);

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    useEffect(() => {
        const fetchShifts = async () => {
            if (!companyId || !activeUserId) return;
            setLoading(true);
            try {
                const startStr = startDate.toISOString().split('T')[0];
                const endStr = endDate.toISOString().split('T')[0];

                // Stelle sicher, dass 'db' hier verfügbar ist (aus dem Scope der Datei)
                const q = query(
                    collection(db, "companies", companyId, "shifts"),
                    where("employeeId", "==", activeUserId),
                    where("date", ">=", startStr),
                    where("date", "<=", endStr)
                );

                const querySnapshot = await getDocs(q);
                const loadedShifts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setShifts(loadedShifts);
                
                // Falls keine Shifts gefunden, versuche auch ohne Datumsfilter
                if (loadedShifts.length === 0) {
                    const allShiftsQ = query(
                        collection(db, "companies", companyId, "shifts"),
                        where("employeeId", "==", activeUserId)
                    );
                    const allShiftsSnapshot = await getDocs(allShiftsQ);
                    const allShifts = allShiftsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    // Filtere manuell nach dem aktuellen Monat
                    const currentMonthStr = format(currentDate, 'yyyy-MM');
                    const monthShifts = allShifts.filter(s => s.date && s.date.startsWith(currentMonthStr));
                    if (monthShifts.length > 0) {
                        setShifts(monthShifts);
                    }
                }

                // Berechne Stunden für alle Shifts im aktuellen Monat
                let hours = 0;
                const currentMonthStr = format(currentDate, 'yyyy-MM');
                loadedShifts.forEach(s => {
                    // Nur Shifts im aktuellen Monat zählen
                    if (s.date && s.date.startsWith(currentMonthStr) && s.startTime && s.endTime) {
                        const startParts = s.startTime.split(':');
                        const endParts = s.endTime.split(':');
                        const startHour = parseInt(startParts[0]) + (parseInt(startParts[1]) || 0) / 60;
                        const endHour = parseInt(endParts[0]) + (parseInt(endParts[1]) || 0) / 60;
                        let diff = endHour - startHour;
                        if (diff < 0) diff += 24; // Über Mitternacht
                        hours += diff;
                    }
                });
                setTotalHours(Math.round(hours * 10) / 10); // Auf 1 Dezimalstelle runden
            } catch (error) { 
                console.error("Fehler Dienstplan:", error);
                // Versuche alternative Abfrage ohne Datumsfilter
                try {
                    const altQ = query(
                        collection(db, "companies", companyId, "shifts"),
                        where("employeeId", "==", activeUserId)
                    );
                    const altSnapshot = await getDocs(altQ);
                    const altShifts = altSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    // Filtere manuell nach Datum
                    const startStr = startDate.toISOString().split('T')[0];
                    const endStr = endDate.toISOString().split('T')[0];
                    const filteredShifts = altShifts.filter(s => s.date >= startStr && s.date <= endStr);
                    setShifts(filteredShifts);
                    
                    // Berechne Stunden
                    let hours = 0;
                    const currentMonthStr = format(currentDate, 'yyyy-MM');
                    filteredShifts.forEach(s => {
                        if (s.date && s.date.startsWith(currentMonthStr) && s.startTime && s.endTime) {
                            const startParts = s.startTime.split(':');
                            const endParts = s.endTime.split(':');
                            const startHour = parseInt(startParts[0]) + (parseInt(startParts[1]) || 0) / 60;
                            const endHour = parseInt(endParts[0]) + (parseInt(endParts[1]) || 0) / 60;
                            let diff = endHour - startHour;
                            if (diff < 0) diff += 24;
                            hours += diff;
                        }
                    });
                    setTotalHours(Math.round(hours * 10) / 10);
                } catch (altError) {
                    console.error("Auch alternative Abfrage fehlgeschlagen:", altError);
                }
            }
            setLoading(false);
        };
        fetchShifts();
    }, [currentDate, companyId, activeUserId, startDate, endDate]); // Abhängigkeiten für useEffect

    if (!activeUser) {
        return <div className="flex items-center justify-center p-10"><Loader2 className="animate-spin text-blue-600"/></div>;
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full animate-in fade-in w-full">
            {/* Profil Karte - Links */}
            <div className="w-full lg:w-80 flex-shrink-0">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">
                    <div className="h-24 bg-gradient-to-r from-blue-600 to-blue-500"></div>
                    <div className="px-6 pb-6 relative">
                        <div className="relative -mt-12 mb-4 flex justify-center">
                            <div className="h-24 w-24 rounded-full border-4 border-white bg-slate-100 shadow-lg flex items-center justify-center overflow-hidden">
                                {activeUser.imageUrl ? <img src={activeUser.imageUrl} className="h-full w-full object-cover"/> : <span className="text-3xl font-bold text-slate-400">{activeUser.name ? activeUser.name.charAt(0) : "U"}</span>}
                            </div>
                        </div>
                        <div className="text-center mb-4">
                            <h2 className="text-xl font-bold text-slate-900 mb-1">{activeUser.name || "Mitarbeiter"}</h2>
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase border border-blue-200">
                                {activeUser.role === 'team_lead' ? 'Einsatzleiter' : activeUser.role === 'obj_lead' ? 'Objektleiter' : 'Sicherheitsmitarbeiter'}
                            </span>
                        </div>
                        <div className="space-y-3 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-3 text-sm text-slate-700">
                                <div className="bg-blue-50 p-2 rounded-lg"><Mail size={16} className="text-blue-600"/></div>
                                <span className="truncate">{activeUser.email || "Keine E-Mail"}</span>
                            </div>
                            {activeUser.phone && (
                                <div className="flex items-center gap-3 text-sm text-slate-700">
                                    <div className="bg-blue-50 p-2 rounded-lg"><Phone size={16} className="text-blue-600"/></div>
                                    <span>{activeUser.phone}</span>
                                </div>
                            )}
                            {activeUser.address && (
                                <div className="flex items-center gap-3 text-sm text-slate-700">
                                    <div className="bg-blue-50 p-2 rounded-lg"><MapPin size={16} className="text-blue-600"/></div>
                                    <span className="truncate">{activeUser.address}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Kalender - Rechts */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-w-0">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
                    <div><h2 className="text-lg font-bold text-slate-900">Dienstplan</h2><p className="text-xs text-slate-500">Stunden: <span className="font-bold text-slate-900">{totalHours}h</span></p></div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={async () => {
                                try {
                                    const pdf = new jsPDF('landscape', 'mm', 'a4');
                                    const monthYear = format(currentDate, 'MMMM yyyy', { locale: de });
                                    const empName = activeUser?.name || user.name || 'Mitarbeiter';
                                    pdf.setFontSize(16);
                                    pdf.text(`Dienstplan - ${empName} - ${monthYear}`, 14, 15);

                                    const tableData = [['Datum', 'Tag', 'Von', 'Bis', 'Objekt']];
                                    const monthStart = startOfMonth(currentDate);
                                    const calendarDays = eachDayOfInterval({ 
                                        start: startOfWeek(monthStart, { weekStartsOn: 1 }), 
                                        end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 })
                                    });
                                    
                                    calendarDays.forEach(day => {
                                        if (isSameMonth(day, monthStart)) {
                                            const dayStr = format(day, 'yyyy-MM-dd');
                                            const shift = shifts.find(s => s.date === dayStr);
                                            if (shift) {
                                                tableData.push([
                                                    format(day, 'dd.MM.yyyy'),
                                                    format(day, 'EEEE', { locale: de }),
                                                    shift.startTime || '-',
                                                    shift.endTime || '-',
                                                    (shift.location || shift.objectName || '-')
                                                ]);
                                            }
                                        }
                                    });

                                    autoTable(pdf, {
                                        head: [tableData[0]],
                                        body: tableData.slice(1),
                                        startY: 25,
                                        styles: { fontSize: 8 },
                                        headStyles: { fillColor: [59, 130, 246] }
                                    });

                                    pdf.save(`Dienstplan_${empName}_${format(currentDate, 'yyyy-MM')}.pdf`);
                                } catch (error) {
                                    console.error("Fehler beim Erstellen des PDFs:", error);
                                    alert("Fehler beim Erstellen des PDFs");
                                }
                            }}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 flex items-center gap-1"
                        >
                            <Download size={14} />
                            PDF
                        </button>
                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                            <button onClick={prevMonth} className="p-1 hover:bg-slate-50 rounded"><ChevronLeft size={18}/></button>
                            <span className="text-sm font-bold w-28 text-center capitalize">{format(currentDate, 'MMMM yyyy', { locale: de })}</span>
                            <button onClick={nextMonth} className="p-1 hover:bg-slate-50 rounded"><ChevronRight size={18}/></button>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{['Mo','Di','Mi','Do','Fr','Sa','So'].map(d=><div key={d} className="py-2 text-center text-[10px] font-bold text-slate-500 uppercase">{d}</div>)}</div>
                <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-px border-b border-slate-200 min-h-[400px]">
                    {calendarDays.map((day) => {
                        const dayStr = format(day, 'yyyy-MM-dd');
                        const dayShifts = shifts.filter(s => s.date === dayStr);
                        const isCurrent = isSameMonth(day, monthStart);
                        const isToday = isSameDay(day, new Date());
                        return (
                            <div key={dayStr} className={`bg-white p-1 min-h-[80px] flex flex-col ${!isCurrent ? 'text-slate-300 bg-slate-50' : ''} ${isToday ? 'bg-blue-50/50' : ''}`}>
                                <span className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : ''}`}>{format(day, 'd')}</span>
                                <div className="flex-1 flex flex-col justify-end gap-1 mt-1">
                                    {dayShifts.map((s,i) => {
                                        const obj = objects.find(o => o.id === s.objectId);
                                        const objName = obj?.name || s.location || s.objectName || '';
                                        return (
                                            <div 
                                                key={i} 
                                                className="bg-blue-600 text-white text-[9px] rounded px-1 py-0.5 font-medium truncate cursor-pointer hover:bg-blue-700" 
                                                title={`${s.startTime}-${s.endTime} ${objName}`}
                                                onClick={(e) => {
                                                    if (s.objectId || s.location || s.objectName) {
                                                        e.stopPropagation();
                                                        const objData = obj || { 
                                                            name: s.location || s.objectName || '',
                                                            address: s.objectAddress || '',
                                                            client: s.objectClient || '',
                                                            uniform: s.objectUniform || '',
                                                            notes: s.objectNotes || ''
                                                        };
                                                        setViewingObjectDetails(objData);
                                                    }
                                                }}
                                            >
                                                {s.startTime}-{s.endTime}
                                                {objName && <div className="text-[7px] opacity-90">{objName}</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {loading && <div className="p-4 text-center text-xs text-blue-600 font-bold animate-pulse">Lade Daten...</div>}
            </div>

            {/* Objekt-Details Modal */}
            {viewingObjectDetails && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-900">{viewingObjectDetails.name}</h3>
                            <button onClick={() => setViewingObjectDetails(null)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {viewingObjectDetails.address && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Adresse</label>
                                    <p className="text-sm text-slate-700 flex items-center gap-2">
                                        <MapPin size={14} className="text-blue-600" />
                                        {viewingObjectDetails.address}
                                    </p>
                                </div>
                            )}
                            {viewingObjectDetails.client && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Auftraggeber</label>
                                    <p className="text-sm text-slate-700">{viewingObjectDetails.client}</p>
                                </div>
                            )}
                            {viewingObjectDetails.uniform && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Dienstkleidung</label>
                                    <p className="text-sm text-slate-700">{viewingObjectDetails.uniform}</p>
                                </div>
                            )}
                            {viewingObjectDetails.notes && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Weitere Informationen</label>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewingObjectDetails.notes}</p>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setViewingObjectDetails(null)}
                            className="w-full mt-4 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700"
                        >
                            Schließen
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SCHEDULE PLANNER (Vollständige Planungsansicht) ---
const SchedulePlanner = ({ user, employees = [], companyId, isEmployee = false, employeeId = null }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState([]);
    const [shiftTemplates, setShiftTemplates] = useState([]);
    const [objects, setObjects] = useState([]);
    const [selectedObject, setSelectedObject] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [showObjects, setShowObjects] = useState(false);
    const [newTemplate, setNewTemplate] = useState({ name: '', startTime: '06:00', endTime: '14:00' });
    const [editingShift, setEditingShift] = useState(null);
    const [editingObject, setEditingObject] = useState(null);
    const [newObject, setNewObject] = useState({ name: '', address: '', client: '', uniform: '', notes: '' });
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfExportType, setPdfExportType] = useState('employee'); // 'employee' or 'object'
    const [selectedPdfEmployee, setSelectedPdfEmployee] = useState(null);
    const [selectedPdfObject, setSelectedPdfObject] = useState('');
    const [viewingObjectDetails, setViewingObjectDetails] = useState(null);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    // Lade Schicht-Vorlagen
    useEffect(() => {
        const loadTemplates = async () => {
            if (!companyId) return;
            try {
                const templatesRef = collection(db, "companies", companyId, "shiftTemplates");
                const snap = await getDocs(templatesRef);
                setShiftTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Fehler beim Laden der Vorlagen:", error);
            }
        };
        loadTemplates();
    }, [companyId]);

    // Lade Objekte
    useEffect(() => {
        const loadObjects = async () => {
            if (!companyId || isEmployee) return;
            try {
                const objectsRef = collection(db, "companies", companyId, "objects");
                const snap = await getDocs(objectsRef);
                setObjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Fehler beim Laden der Objekte:", error);
            }
        };
        loadObjects();
    }, [companyId, isEmployee]);

    // Lade Shifts
    useEffect(() => {
        const loadShifts = async () => {
            if (!companyId) return;
            setLoading(true);
            try {
                const startStr = startDate.toISOString().split('T')[0];
                const endStr = endDate.toISOString().split('T')[0];
                const q = query(
                    collection(db, "companies", companyId, "shifts"),
                    where("date", ">=", startStr),
                    where("date", "<=", endStr)
                );
                const snap = await getDocs(q);
                setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Fehler beim Laden der Shifts:", error);
            }
            setLoading(false);
        };
        loadShifts();
    }, [companyId, currentDate, startDate, endDate]);

    const handleSaveTemplate = async () => {
        if (!newTemplate.name.trim()) return;
        try {
            await addDoc(collection(db, "companies", companyId, "shiftTemplates"), {
                name: newTemplate.name,
                startTime: newTemplate.startTime,
                endTime: newTemplate.endTime,
                createdAt: new Date().toISOString()
            });
            setNewTemplate({ name: '', startTime: '06:00', endTime: '14:00' });
            // Reload templates
            const templatesRef = collection(db, "companies", companyId, "shiftTemplates");
            const snap = await getDocs(templatesRef);
            setShiftTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Fehler beim Speichern der Vorlage:", error);
            alert("Fehler beim Speichern der Vorlage");
        }
    };

    const handleDeleteTemplate = async (templateId) => {
        if (!window.confirm("Vorlage wirklich löschen?")) return;
        try {
            await deleteDoc(doc(db, "companies", companyId, "shiftTemplates", templateId));
            setShiftTemplates(prev => prev.filter(t => t.id !== templateId));
        } catch (error) {
            console.error("Fehler beim Löschen:", error);
        }
    };

    const handleCellClick = (employeeId, dateStr) => {
        const existingShift = shifts.find(s => s.employeeId === employeeId && s.date === dateStr);
        if (existingShift) {
            const obj = objects.find(o => o.id === existingShift.objectId);
            setEditingShift({ ...existingShift, employeeId, date: dateStr, objectId: existingShift.objectId || null, objectName: obj?.name || existingShift.location || '' });
        } else {
            setEditingShift({ employeeId, date: dateStr, startTime: '06:00', endTime: '14:00', objectId: selectedObject || null, objectName: objects.find(o => o.id === selectedObject)?.name || '' });
        }
    };

    const handleSaveShift = async () => {
        if (!editingShift) return;
        try {
            const selectedObj = objects.find(o => o.id === editingShift.objectId);
            const shiftData = {
                startTime: editingShift.startTime,
                endTime: editingShift.endTime,
                objectId: editingShift.objectId || null,
                location: selectedObj?.name || editingShift.objectName || '',
                objectAddress: selectedObj?.address || '',
                objectClient: selectedObj?.client || '',
                objectUniform: selectedObj?.uniform || '',
                objectNotes: selectedObj?.notes || ''
            };

            if (editingShift.id) {
                // Update existing shift
                await updateDoc(doc(db, "companies", companyId, "shifts", editingShift.id), shiftData);
            } else {
                // Create new shift
                await addDoc(collection(db, "companies", companyId, "shifts"), {
                    employeeId: editingShift.employeeId,
                    date: editingShift.date,
                    ...shiftData,
                    createdAt: new Date().toISOString()
                });
            }
            setEditingShift(null);
            // Reload shifts
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];
            const q = query(
                collection(db, "companies", companyId, "shifts"),
                where("date", ">=", startStr),
                where("date", "<=", endStr)
            );
            const snap = await getDocs(q);
            setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Fehler beim Speichern:", error);
            alert("Fehler beim Speichern");
        }
    };

    const handleDeleteShift = async (shiftId) => {
        if (!window.confirm("Schicht wirklich löschen?")) return;
        try {
            await deleteDoc(doc(db, "companies", companyId, "shifts", shiftId));
            setShifts(prev => prev.filter(s => s.id !== shiftId));
        } catch (error) {
            console.error("Fehler beim Löschen:", error);
        }
    };

    const applyTemplate = (template, employeeId, dateStr) => {
        setEditingShift({
            employeeId,
            date: dateStr,
            startTime: template.startTime,
            endTime: template.endTime,
            location: selectedObject || ''
        });
    };

    const getShiftForCell = (employeeId, dateStr) => {
        const shift = shifts.find(s => s.employeeId === employeeId && s.date === dateStr);
        if (shift && shift.objectId) {
            const obj = objects.find(o => o.id === shift.objectId);
            return { ...shift, objectName: obj?.name || shift.location || '' };
        }
        return shift;
    };

    // Objekt-Management Funktionen
    const handleSaveObject = async () => {
        if (!newObject.name.trim()) {
            alert("Bitte geben Sie einen Objektnamen ein");
            return;
        }
        try {
            if (editingObject) {
                await updateDoc(doc(db, "companies", companyId, "objects", editingObject.id), {
                    ...newObject,
                    updatedAt: new Date().toISOString()
                });
            } else {
                await addDoc(collection(db, "companies", companyId, "objects"), {
                    ...newObject,
                    createdAt: new Date().toISOString()
                });
            }
            setNewObject({ name: '', address: '', client: '', uniform: '', notes: '' });
            setEditingObject(null);
            // Reload objects
            const objectsRef = collection(db, "companies", companyId, "objects");
            const snap = await getDocs(objectsRef);
            setObjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Fehler beim Speichern des Objekts:", error);
            alert("Fehler beim Speichern des Objekts");
        }
    };

    const handleDeleteObject = async (objectId) => {
        if (!window.confirm("Objekt wirklich löschen? Alle zugehörigen Shifts behalten das Objekt als Text.")) return;
        try {
            await deleteDoc(doc(db, "companies", companyId, "objects", objectId));
            setObjects(prev => prev.filter(o => o.id !== objectId));
        } catch (error) {
            console.error("Fehler beim Löschen:", error);
        }
    };

    const handleEditObject = (obj) => {
        setEditingObject(obj);
        setNewObject({ name: obj.name || '', address: obj.address || '', client: obj.client || '', uniform: obj.uniform || '', notes: obj.notes || '' });
        setShowObjects(true);
    };

    const isWeekend = (day) => {
        const dayOfWeek = day.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6;
    };

    // PDF Export Funktionen
    const generatePDF = async (targetEmployeeId = null, targetObject = null) => {
        try {
            const pdf = new jsPDF('landscape', 'mm', 'a4');
            
            // Lade alle Shifts für den Monat
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];
            let shiftsToExport = [];
            
            if (targetEmployeeId) {
                // Für spezifischen Mitarbeiter
                const q = query(
                    collection(db, "companies", companyId, "shifts"),
                    where("employeeId", "==", targetEmployeeId),
                    where("date", ">=", startStr),
                    where("date", "<=", endStr)
                );
                const snap = await getDocs(q);
                shiftsToExport = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } else if (targetObject) {
                // Für spezifisches Objekt - suche nach objectId oder location
                const obj = objects.find(o => o.name === targetObject || o.id === targetObject);
                const q = obj ? query(
                    collection(db, "companies", companyId, "shifts"),
                    where("objectId", "==", obj.id),
                    where("date", ">=", startStr),
                    where("date", "<=", endStr)
                ) : query(
                    collection(db, "companies", companyId, "shifts"),
                    where("location", "==", targetObject),
                    where("date", ">=", startStr),
                    where("date", "<=", endStr)
                );
                const snap = await getDocs(q);
                shiftsToExport = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } else if (isEmployee && employeeId) {
                // Für Mitarbeiter (eigener Dienstplan)
                const q = query(
                    collection(db, "companies", companyId, "shifts"),
                    where("employeeId", "==", employeeId),
                    where("date", ">=", startStr),
                    where("date", "<=", endStr)
                );
                const snap = await getDocs(q);
                shiftsToExport = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }

            // Titel
            const monthYear = format(currentDate, 'MMMM yyyy', { locale: de });
            let title = `Dienstplan ${monthYear}`;
            if (targetEmployeeId) {
                const emp = employees.find(e => e.id === targetEmployeeId);
                title = `Dienstplan - ${emp?.name || 'Mitarbeiter'} - ${monthYear}`;
            } else if (targetObject) {
                title = `Dienstplan - ${targetObject} - ${monthYear}`;
            }
            
            pdf.setFontSize(16);
            pdf.text(title, 14, 15);

            // Erstelle Tabelle
            const tableData = [];
            const daysInMonth = calendarDays.filter(day => isSameMonth(day, monthStart));
            
            if (targetEmployeeId || (isEmployee && employeeId)) {
                // Einzelner Mitarbeiter
                const empId = targetEmployeeId || employeeId;
                const emp = employees.find(e => e.id === empId);
                const headerRow = ['Datum', 'Tag', 'Von', 'Bis', 'Objekt'];
                tableData.push(headerRow);
                
                daysInMonth.forEach(day => {
                    const dayStr = format(day, 'yyyy-MM-dd');
                    const shift = shiftsToExport.find(s => s.date === dayStr);
                    if (shift) {
                        tableData.push([
                            format(day, 'dd.MM.yyyy'),
                            format(day, 'EEEE', { locale: de }),
                            shift.startTime || '-',
                            shift.endTime || '-',
                            shift.location || '-'
                        ]);
                    }
                });
            } else if (targetObject) {
                // Alle Mitarbeiter für ein Objekt
                const headerRow = ['Mitarbeiter', 'Datum', 'Tag', 'Von', 'Bis', 'Objekt'];
                tableData.push(headerRow);
                
                shiftsToExport.forEach(shift => {
                    const emp = employees.find(e => e.id === shift.employeeId);
                    const shiftDate = new Date(shift.date);
                    if (isSameMonth(shiftDate, monthStart)) {
                        tableData.push([
                            emp?.name || 'Unbekannt',
                            format(shiftDate, 'dd.MM.yyyy'),
                            format(shiftDate, 'EEEE', { locale: de }),
                            shift.startTime || '-',
                            shift.endTime || '-',
                            (shift.location || shift.objectName || '-')
                        ]);
                    }
                });
            }

            // Erstelle Tabelle mit autoTable
            autoTable(pdf, {
                head: [tableData[0]],
                body: tableData.slice(1),
                startY: 25,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [59, 130, 246] },
                margin: { top: 25 }
            });

            // Dateiname
            let filename = `Dienstplan_${format(currentDate, 'yyyy-MM')}`;
            if (targetEmployeeId) {
                const emp = employees.find(e => e.id === targetEmployeeId);
                filename = `Dienstplan_${emp?.name || 'Mitarbeiter'}_${format(currentDate, 'yyyy-MM')}`;
            } else if (targetObject) {
                filename = `Dienstplan_${targetObject}_${format(currentDate, 'yyyy-MM')}`;
            }

            pdf.save(`${filename}.pdf`);
            setShowPdfModal(false);
        } catch (error) {
            console.error("Fehler beim Erstellen des PDFs:", error);
            alert("Fehler beim Erstellen des PDFs");
        }
    };

    const handlePdfExport = () => {
        if (isEmployee && employeeId) {
            // Mitarbeiter: direkt eigenen Dienstplan exportieren
            generatePDF(null, null);
        } else {
            // Chef: Modal öffnen
            setShowPdfModal(true);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header mit Navigation */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-lg">
                            <ChevronLeft size={20} />
                        </button>
                        <h2 className="text-lg font-bold text-slate-900 min-w-[150px] text-center">
                            {format(currentDate, 'MMMM yyyy', { locale: de })}
                        </h2>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-lg">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isEmployee && (
                            <select 
                                value={selectedObject || ''} 
                                onChange={(e) => setSelectedObject(e.target.value)}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                            >
                                <option value="">Alle Objekte</option>
                                {objects.map(obj => (
                                    <option key={obj.id} value={obj.id}>{obj.name}</option>
                                ))}
                            </select>
                        )}
                        <div className="relative">
                            <button 
                                onClick={handlePdfExport}
                                className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
                            >
                                <Download size={16} />
                                PDF Export
                            </button>
                        </div>
                        {!isEmployee && (
                            <>
                                <button 
                                    onClick={() => { setShowObjects(!showObjects); setEditingObject(null); setNewObject({ name: '', address: '', client: '', uniform: '', notes: '' }); }}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${showObjects ? 'bg-green-600 text-white' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                                >
                                    <Briefcase size={16} />
                                    Objekte
                                </button>
                                <button 
                                    onClick={() => setShowTemplates(!showTemplates)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${showTemplates ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-600 hover:bg-orange-200'}`}
                                >
                                    <Settings size={16} />
                                    Schicht-Typen
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Objekt-Management */}
            {showObjects && !isEmployee && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-lg text-slate-900 mb-4">Objekte verwalten</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        {objects.map(obj => (
                            <div key={obj.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-slate-900">{obj.name}</h4>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEditObject(obj)} className="text-blue-600 hover:text-blue-800">
                                            <Pencil size={14} />
                                        </button>
                                        <button onClick={() => handleDeleteObject(obj.id)} className="text-red-600 hover:text-red-800">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                {obj.address && <p className="text-xs text-slate-600 mb-1"><MapPin size={12} className="inline"/> {obj.address}</p>}
                                {obj.client && <p className="text-xs text-slate-600">Auftraggeber: {obj.client}</p>}
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-slate-200 pt-4">
                        <h4 className="font-bold text-sm text-slate-700 mb-3">{editingObject ? 'Objekt bearbeiten' : 'Neues Objekt anlegen'}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Objektname *</label>
                                <input
                                    type="text"
                                    value={newObject.name}
                                    onChange={(e) => setNewObject({...newObject, name: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                                    placeholder="z.B. Hauptobjekt"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Adresse</label>
                                <input
                                    type="text"
                                    value={newObject.address}
                                    onChange={(e) => setNewObject({...newObject, address: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                                    placeholder="Musterstraße 1, 12345 Stadt"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Auftraggeber</label>
                                <input
                                    type="text"
                                    value={newObject.client}
                                    onChange={(e) => setNewObject({...newObject, client: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                                    placeholder="Firmenname"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Dienstkleidung</label>
                                <input
                                    type="text"
                                    value={newObject.uniform}
                                    onChange={(e) => setNewObject({...newObject, uniform: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                                    placeholder="z.B. Schwarze Hose, weißes Hemd"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Weitere Informationen</label>
                                <textarea
                                    value={newObject.notes}
                                    onChange={(e) => setNewObject({...newObject, notes: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none resize-none"
                                    rows="3"
                                    placeholder="Zusätzliche Hinweise, Ansprechpartner, etc."
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={handleSaveObject}
                                className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                            >
                                <Save size={16} />
                                {editingObject ? 'Aktualisieren' : 'Speichern'}
                            </button>
                            {editingObject && (
                                <button
                                    onClick={() => { setEditingObject(null); setNewObject({ name: '', address: '', client: '', uniform: '', notes: '' }); }}
                                    className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300"
                                >
                                    Abbrechen
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Schicht-Vorlagen */}
            {showTemplates && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-lg text-slate-900 mb-4">Schicht-Vorlagen definieren</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {shiftTemplates.map(template => (
                            <div key={template.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                <span className="text-sm font-medium text-slate-900">
                                    {template.name} | {template.startTime}-{template.endTime}
                                </span>
                                <button 
                                    onClick={() => handleDeleteTemplate(template.id)}
                                    className="text-red-600 hover:text-red-800"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input
                            type="text"
                            placeholder="z.B. Früh"
                            value={newTemplate.name}
                            onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                        />
                        <div className="flex items-center gap-2">
                            <Clock size={16} className="text-slate-400" />
                            <input
                                type="time"
                                value={newTemplate.startTime}
                                onChange={(e) => setNewTemplate({...newTemplate, startTime: e.target.value})}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock size={16} className="text-slate-400" />
                            <input
                                type="time"
                                value={newTemplate.endTime}
                                onChange={(e) => setNewTemplate({...newTemplate, endTime: e.target.value})}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-blue-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={handleSaveTemplate}
                            className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                        >
                            <Plus size={16} />
                            Speichern
                        </button>
                    </div>
                </div>
            )}

            {/* Planungstabelle */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                                    MITARBEITER
                                </th>
                                {calendarDays.map(day => {
                                    const dayStr = format(day, 'yyyy-MM-dd');
                                    const isCurrent = isSameMonth(day, monthStart);
                                    const isWeekendDay = isWeekend(day);
                                    return (
                                        <th 
                                            key={dayStr}
                                            className={`px-1 py-1.5 text-center text-[9px] font-bold min-w-[45px] max-w-[45px] ${!isCurrent ? 'text-slate-300' : isWeekendDay ? 'text-red-600 bg-red-50' : 'text-slate-700'}`}
                                        >
                                            <div className="leading-tight">
                                                <div>{format(day, 'd')}</div>
                                                <div className="text-[8px]">{format(day, 'EEE', { locale: de }).toUpperCase().slice(0, 2)}</div>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(emp => (
                                <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="px-3 py-2 font-bold text-xs text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                                        {emp.name}
                                    </td>
                                    {calendarDays.map(day => {
                                        const dayStr = format(day, 'yyyy-MM-dd');
                                        const isCurrent = isSameMonth(day, monthStart);
                                        const shift = getShiftForCell(emp.id, dayStr);
                                        const isWeekendDay = isWeekend(day);
                                        return (
                                            <td
                                                key={dayStr}
                                                onClick={() => isCurrent && handleCellClick(emp.id, dayStr)}
                                                className={`px-0.5 py-1 text-center text-[8px] min-h-[50px] max-w-[45px] cursor-pointer border-r border-slate-100 ${!isCurrent ? 'bg-slate-50' : isWeekendDay ? 'bg-red-50/30' : 'hover:bg-blue-50'}`}
                                            >
                                                {shift && (
                                                    <div 
                                                        className="bg-blue-600 text-white rounded px-0.5 py-0.5 font-medium leading-tight cursor-pointer hover:bg-blue-700 transition-colors"
                                                        onClick={(e) => {
                                                            if (shift.objectId || shift.location || shift.objectName) {
                                                                e.stopPropagation();
                                                                const obj = objects.find(o => o.id === shift.objectId) || { 
                                                                    name: shift.location || shift.objectName || '',
                                                                    address: shift.objectAddress || '',
                                                                    client: shift.objectClient || '',
                                                                    uniform: shift.objectUniform || '',
                                                                    notes: shift.objectNotes || ''
                                                                };
                                                                setViewingObjectDetails(obj);
                                                            }
                                                        }}
                                                    >
                                                        <div>{shift.startTime}</div>
                                                        <div>{shift.endTime}</div>
                                                        {(shift.objectName || shift.location) && (
                                                            <div className="text-[7px] mt-0.5 opacity-90 truncate" title={shift.objectName || shift.location}>
                                                                {shift.objectName || shift.location}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PDF Export Modal (nur für Chef) */}
            {showPdfModal && !isEmployee && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-900">PDF Export</h3>
                            <button onClick={() => setShowPdfModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">Export-Typ wählen</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPdfExportType('employee')}
                                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold ${pdfExportType === 'employee' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                                    >
                                        Mitarbeiter
                                    </button>
                                    <button
                                        onClick={() => setPdfExportType('object')}
                                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold ${pdfExportType === 'object' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                                    >
                                        Objekt
                                    </button>
                                </div>
                            </div>
                            {pdfExportType === 'employee' ? (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2">Mitarbeiter auswählen</label>
                                    <select
                                        value={selectedPdfEmployee || ''}
                                        onChange={(e) => setSelectedPdfEmployee(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 outline-none"
                                    >
                                        <option value="">-- Bitte wählen --</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2">Objekt auswählen</label>
                                    <select
                                        value={selectedPdfObject}
                                        onChange={(e) => setSelectedPdfObject(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 outline-none"
                                    >
                                        <option value="">-- Bitte wählen --</option>
                                        {objects.map(obj => (
                                            <option key={obj.id} value={obj.name}>{obj.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => {
                                        if (pdfExportType === 'employee' && selectedPdfEmployee) {
                                            generatePDF(selectedPdfEmployee, null);
                                        } else if (pdfExportType === 'object' && selectedPdfObject) {
                                            generatePDF(null, selectedPdfObject);
                                        } else {
                                            alert("Bitte wählen Sie einen Mitarbeiter oder ein Objekt aus");
                                        }
                                    }}
                                    className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700"
                                >
                                    PDF erstellen
                                </button>
                                <button
                                    onClick={() => setShowPdfModal(false)}
                                    className="px-4 bg-slate-200 text-slate-700 font-bold py-2 rounded-lg hover:bg-slate-300"
                                >
                                    Abbrechen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Objekt-Details Modal */}
            {viewingObjectDetails && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-900">{viewingObjectDetails.name}</h3>
                            <button onClick={() => setViewingObjectDetails(null)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {viewingObjectDetails.address && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Adresse</label>
                                    <p className="text-sm text-slate-700 flex items-center gap-2">
                                        <MapPin size={14} className="text-blue-600" />
                                        {viewingObjectDetails.address}
                                    </p>
                                </div>
                            )}
                            {viewingObjectDetails.client && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Auftraggeber</label>
                                    <p className="text-sm text-slate-700">{viewingObjectDetails.client}</p>
                                </div>
                            )}
                            {viewingObjectDetails.uniform && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Dienstkleidung</label>
                                    <p className="text-sm text-slate-700">{viewingObjectDetails.uniform}</p>
                                </div>
                            )}
                            {viewingObjectDetails.notes && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Weitere Informationen</label>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{viewingObjectDetails.notes}</p>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setViewingObjectDetails(null)}
                            className="w-full mt-4 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700"
                        >
                            Schließen
                        </button>
                    </div>
                </div>
            )}

            {/* Shift Bearbeitungs-Modal */}
            {editingShift && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-900">Schicht bearbeiten</h3>
                            <button onClick={() => setEditingShift(null)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Von</label>
                                <input
                                    type="time"
                                    value={editingShift.startTime}
                                    onChange={(e) => setEditingShift({...editingShift, startTime: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Bis</label>
                                <input
                                    type="time"
                                    value={editingShift.endTime}
                                    onChange={(e) => setEditingShift({...editingShift, endTime: e.target.value})}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 outline-none"
                                />
                            </div>
                            {!isEmployee && objects.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Objekt</label>
                                    <select
                                        value={editingShift.objectId || ''}
                                        onChange={(e) => {
                                            const obj = objects.find(o => o.id === e.target.value);
                                            setEditingShift({...editingShift, objectId: e.target.value || null, objectName: obj?.name || ''});
                                        }}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:border-blue-500 outline-none"
                                    >
                                        <option value="">-- Kein Objekt --</option>
                                        {objects.map(obj => (
                                            <option key={obj.id} value={obj.id}>{obj.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {shiftTemplates.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2">Vorlage anwenden</label>
                                    <div className="flex flex-wrap gap-2">
                                        {shiftTemplates.map(template => (
                                            <button
                                                key={template.id}
                                                onClick={() => applyTemplate(template, editingShift.employeeId, editingShift.date)}
                                                className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100"
                                            >
                                                {template.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={handleSaveShift}
                                    className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700"
                                >
                                    Speichern
                                </button>
                                {editingShift.id && (
                                    <button
                                        onClick={() => {
                                            handleDeleteShift(editingShift.id);
                                            setEditingShift(null);
                                        }}
                                        className="px-4 bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-700"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={() => setEditingShift(null)}
                                    className="px-4 bg-slate-200 text-slate-700 font-bold py-2 rounded-lg hover:bg-slate-300"
                                >
                                    Abbrechen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- PROVIDER DASHBOARD (Fixed & Clean) ---
const ProviderDashboard = ({ user, onLogout, onSwitchToMarket, initialTab = 'dashboard' }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // --- TABS & PERSISTENZ ---
  const [activeTab, setActiveTab] = useState(() => {
      if (initialTab && initialTab !== 'dashboard') return initialTab;
      return localStorage.getItem('secu_prov_tab') || 'dashboard';
  });
  
  // Profil-ID State (für interne Navigation)
  const [viewingProfileId, setViewingProfileId] = useState(() => localStorage.getItem('secu_prov_profile_id') || null);

  useEffect(() => { if (initialTab && initialTab !== 'dashboard') setActiveTab(initialTab); }, [initialTab]);
  useEffect(() => { localStorage.setItem('secu_prov_tab', activeTab); }, [activeTab]);
  
  useEffect(() => {
      if (viewingProfileId) localStorage.setItem('secu_prov_profile_id', viewingProfileId);
      else localStorage.removeItem('secu_prov_profile_id');
  }, [viewingProfileId]);

  const handleLogout = () => {
      localStorage.removeItem('secu_prov_tab');
      localStorage.removeItem('secu_prov_profile_id');
      onLogout();
  };

  // Helper für Profil-Anzeige
  const handleViewProfile = (userId) => { setViewingProfileId(userId); };
  const handleCloseProfile = () => { setViewingProfileId(null); };

  // --- DATEN STATES ---
  const [companyData, setCompanyData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [requests, setRequests] = useState([]);
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('worker');
  const [loading, setLoading] = useState(false);
  const [imageUpload, setImageUpload] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Auto-Open Sidebar Desktop
  useEffect(() => { if (window.innerWidth >= 1024) setSidebarOpen(true); }, []);

  // Nachrichten Listener
  useEffect(() => {
      const q = query(collection(db, "chats"), where("companyId", "==", user.uid));
      const unsub = onSnapshot(q, (snap) => {
          let count = 0;
          snap.docs.forEach(d => { if (d.data().unreadProvider) count++; });
          setUnreadCount(count);
      });
      return () => unsub();
  }, [user.uid]);

  const userPlan = companyData?.plan ? PLANS[companyData.plan] : PLANS.basic;

  // Daten laden
  useEffect(() => {
    const loadData = async () => {
      const docSnap = await getDoc(doc(db, "companies", user.uid));
      if (docSnap.exists()) { 
          const data = docSnap.data();
          // Sicherstellen, dass alle Felder existieren
          setCompanyData({ 
              address: "", 
              phone: "", 
              publicEmail: "", 
              plan: "basic", 
              isVisible: false, 
              showPrice: true, 
              ...data 
          }); 
          
          const empSnapshot = await getDocs(collection(db, "companies", user.uid, "employees"));
          setEmployees(empSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          
          const reqSnapshot = await getDocs(collection(db, "companies", user.uid, "requests"));
          setRequests(reqSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          
          // Mitarbeiterzahl synchronisieren
          if (data.employees !== empSnapshot.size) { 
              await updateDoc(doc(db, "companies", user.uid), { employees: empSnapshot.size }); 
              setCompanyData(prev => ({...prev, employees: empSnapshot.size})); 
          }
      }
      
      const qPosts = query(collection(db, "companies", user.uid, "posts"));
      const unsubscribePosts = onSnapshot(qPosts, (snap) => { 
          setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt - a.createdAt)); 
      });
      return () => unsubscribePosts();
    };
    loadData();
  }, [user.uid]);

  // --- ACTIONS ---
  const handleCreatePost = async (e) => { 
      e.preventDefault(); 
      if(!newPostContent.trim()) return; 
      await addDoc(collection(db, "companies", user.uid, "posts"), { 
          content: newPostContent, 
          createdAt: new Date().toISOString(), 
          likes: [], 
          authorInitial: companyData.name.charAt(0) 
      }); 
      setNewPostContent(''); 
  };

  const handleDeletePost = async (postId) => { 
      if(window.confirm("Löschen?")) await deleteDoc(doc(db, "companies", user.uid, "posts", postId)); 
  };

  const toggleVisibility = async () => { 
      if (!userPlan.publicVisible) { alert("Upgrade erforderlich!"); return; } 
      const newStatus = !companyData.isVisible; 
      await updateDoc(doc(db, "companies", user.uid), { isVisible: newStatus }); 
      setCompanyData(prev => ({ ...prev, isVisible: newStatus })); 
  };

  const handleSaveProfile = async () => { 
      setLoading(true); 
      let url = companyData.imageUrl; 
      if (imageUpload) { 
          const imageRef = ref(storage, `logos/${user.uid}`); 
          await uploadBytes(imageRef, imageUpload); 
          url = await getDownloadURL(imageRef); 
      } 
      await setDoc(doc(db, "companies", user.uid), { ...companyData, imageUrl: url }, { merge: true }); 
      setCompanyData({ ...companyData, imageUrl: url }); 
      setImageUpload(null); 
      setLoading(false); 
      setIsEditing(false); 
      alert("Profil aktualisiert!"); 
  };

  const handleCancelEdit = () => { setIsEditing(false); setImageUpload(null); };

  const handleInviteEmployee = async (e) => { 
      e.preventDefault(); 
      if (employees.length >= userPlan.maxEmployees) { alert("Plan Limit erreicht!"); return; } 
      await addDoc(collection(db, "global_invites"), { 
          email: inviteEmail, 
          companyId: user.uid, 
          companyName: companyData.name, 
          role: inviteRole, 
          invitedAt: new Date().toISOString() 
      }); 
      window.location.href = `mailto:${inviteEmail}?subject=Einladung&body=Registriere dich bei SecuPlan!`; 
      alert(`Einladung vorbereitet!`); 
      setInviteEmail(''); 
  };

  const handleDeleteEmployee = async (id) => { 
      if(window.confirm("Löschen?")) { 
          await deleteDoc(doc(db, "companies", user.uid, "employees", id)); 
          await updateDoc(doc(db, "companies", user.uid), { employees: increment(-1) }); 
          setEmployees(employees.filter(e => e.id !== id)); 
      } 
  };

  const handleRequestAction = async (reqId, newStatus) => { 
      if (!confirm(`Antrag wirklich ${newStatus}?`)) return; 
      await updateDoc(doc(db, "companies", user.uid, "requests", reqId), { status: newStatus }); 
      setRequests(requests.map(r => r.id === reqId ? {...r, status: newStatus} : r)); 
  };

  if (!companyData) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden relative">
      
      {/* Mobile Overlay */}
      {isSidebarOpen && (<div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}/>)}

      {/* --- SIDEBAR --- */}
      <aside className={`fixed top-0 left-0 h-full z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} lg:static lg:translate-x-0 lg:shadow-none`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 bg-white shrink-0">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={onSwitchToMarket}>
                <Shield className="text-blue-600 h-8 w-8" /><span className="font-bold text-xl tracking-tight">Secu<span className="text-blue-600">Manager</span></span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-full"><X size={24} /></button>
        </div>

        <nav className="flex-1 py-6 px-3 overflow-y-auto space-y-1">
          <button onClick={() => { setActiveTab('dashboard'); handleCloseProfile(); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-3 rounded-lg transition-all mb-1 ${activeTab === 'dashboard' && !viewingProfileId ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><User size={20} /><span className="ml-3 text-sm font-medium">Mein Profil</span></button>
          <button onClick={() => { setActiveTab('schedule'); handleCloseProfile(); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-3 rounded-lg transition-all mb-1 ${activeTab === 'schedule' && !viewingProfileId ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><CalendarDays size={20} /><span className="ml-3 text-sm font-medium">Dienstplan</span></button>
          <button onClick={() => { setActiveTab('messages'); handleCloseProfile(); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all mb-1 ${activeTab === 'messages' && !viewingProfileId ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
             <div className="flex items-center gap-3"><Mail size={20} /> <span className="text-sm font-medium">Nachrichten</span></div>
             {unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>}
          </button>

          <div className="my-2 px-3 pt-4 pb-2"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Verwaltung</span></div>

          <button onClick={() => { setActiveTab('staff'); handleCloseProfile(); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-3 rounded-lg transition-all mb-1 ${activeTab === 'staff' && !viewingProfileId ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-purple-50 hover:text-purple-600'}`}><Users size={20} /><span className="ml-3 text-sm font-medium">Personal</span></button>
          <button onClick={() => { setActiveTab('req_manage'); handleCloseProfile(); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-3 rounded-lg transition-all mb-1 ${activeTab === 'req_manage' && !viewingProfileId ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-purple-50 hover:text-purple-600'}`}>
              <CheckCircle2 size={20} /><span className="ml-3 text-sm font-medium">Anträge prüfen</span>
              {requests.filter(r => r.status === 'Offen').length > 0 && <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{requests.filter(r => r.status === 'Offen').length}</span>}
          </button>

          <div className="my-4 border-t border-slate-200"></div>
          <NavItem isAction={true} icon={<Globe size={20} />} label="Marktplatz" isActive={false} isSidebarOpen={true} onClick={onSwitchToMarket}/>
        </nav>
        <div className="p-4 border-t border-slate-200 bg-white shrink-0"><button onClick={handleLogout} className="w-full flex items-center px-3 py-3 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"><LogOut size={20} /><span className="ml-3 text-sm font-medium">Abmelden</span></button></div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative h-screen bg-white">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-700"><Menu size={24} /></button>
              <h2 className="text-lg font-bold text-slate-900 truncate">
                  {viewingProfileId ? 'Profilansicht' : 
                   activeTab === 'dashboard' ? (isEditing ? 'Profil bearbeiten' : 'Mein Firmenprofil') : 
                   activeTab === 'staff' ? 'Personalverwaltung' : 
                   activeTab === 'req_manage' ? 'Offene Anträge' : 
                   activeTab === 'messages' ? 'Nachrichten' : 'Dienstplan'}
              </h2>
          </div>
          <div className="flex items-center gap-3">
              <button onClick={() => { setActiveTab('messages'); handleCloseProfile(); }} className={`relative p-2 transition-colors ${activeTab === 'messages' && !viewingProfileId ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}>
                  <Mail size={22}/>
                  {unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center shadow-sm border border-white">{unreadCount}</span>}
              </button>
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${companyData.isVisible ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}><div className={`w-2 h-2 rounded-full ${companyData.isVisible ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>{companyData.isVisible ? 'ONLINE' : 'OFFLINE'}</div>
              <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">{companyData.imageUrl ? <img src={companyData.imageUrl} className="h-full w-full object-cover"/> : <span className="flex h-full items-center justify-center font-bold text-slate-500">{companyData.name.charAt(0)}</span>}</div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 bg-slate-50 w-full relative">
            <div className={`max-w-6xl mx-auto ${activeTab === 'messages' && !viewingProfileId ? 'h-full pb-0' : 'space-y-6 pb-20'}`}>
                
                {viewingProfileId ? (
                    <UserProfileView targetUserId={viewingProfileId} onBack={handleCloseProfile} />
                ) : (
                    <>
                        {/* --- TAB: DASHBOARD / PROFIL --- */}
                        {activeTab === 'dashboard' && (
                            <div className="max-w-5xl mx-auto space-y-6">
                                <div className={`bg-white rounded-2xl shadow-xl border overflow-hidden transition-colors ${isEditing ? 'border-blue-300 ring-2 ring-blue-50' : 'border-slate-200'}`}>
                                    <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-400 relative group">
                                        <div className="absolute top-4 right-4 z-10 flex gap-2">
                                            {isEditing ? (<><button onClick={handleCancelEdit} className="bg-white text-slate-700 font-bold px-4 py-2 rounded-lg text-sm shadow-sm hover:bg-slate-50">Abbrechen</button><button onClick={handleSaveProfile} disabled={loading} className="bg-green-600 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm hover:bg-green-700 flex items-center gap-2">{loading ? <Loader2 className="animate-spin h-4 w-4"/> : <><CheckCircle2 size={16}/> Speichern</>}</button></>) : (<button onClick={() => setIsEditing(true)} className="bg-white/20 backdrop-blur text-white border border-white/40 hover:bg-white hover:text-blue-600 font-bold px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 shadow-sm"><Settings size={16}/> Bearbeiten</button>)}
                                        </div>
                                        <div className="absolute -bottom-12 left-8 p-1 bg-white rounded-2xl shadow-md border border-slate-200 relative group/logo">
                                             <div className="h-24 w-24 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center relative">
                                                {imageUpload ? <img src={URL.createObjectURL(imageUpload)} className="h-full w-full object-cover opacity-50"/> : companyData.imageUrl ? <img src={companyData.imageUrl} className="h-full w-full object-cover"/> : <div className="text-slate-400 font-bold text-2xl">{companyData.name.charAt(0)}</div>}
                                                {isEditing && <label className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer text-white opacity-0 group-hover/logo:opacity-100 transition-opacity"><Upload size={24}/><input type="file" className="hidden" onChange={(e) => setImageUpload(e.target.files[0])} /></label>}
                                             </div>
                                        </div>
                                    </div>
                                    <div className="pt-16 pb-8 px-8 flex flex-col md:flex-row justify-between items-start gap-4">
                                        <div className="flex-1 w-full">
                                            {isEditing ? <input type="text" value={companyData.name} onChange={(e) => setCompanyData({...companyData, name: e.target.value})} className="text-3xl font-bold text-slate-900 mb-1 w-full bg-slate-50 border-b-2 border-blue-500 outline-none px-1 rounded-t" placeholder="Firmenname" /> : <h1 className="text-3xl font-bold text-slate-900 mb-1">{companyData.name}</h1>}
                                            <div className="flex flex-wrap gap-4 text-sm text-slate-500 mt-2 items-center">
                                                <div className="flex items-center gap-1"><MapPin size={16}/> {isEditing ? <input value={companyData.address} onChange={(e) => setCompanyData({...companyData, address: e.target.value})} className="bg-slate-50 border-b border-blue-400 outline-none px-1 text-slate-700 w-48" placeholder="Adresse" /> : <span>{companyData.address || "Keine Adresse"}</span>}</div>
                                                <div className="flex items-center gap-1"><Phone size={16}/> {isEditing ? <input value={companyData.phone || ""} onChange={(e) => setCompanyData({...companyData, phone: e.target.value})} className="bg-slate-50 border-b border-blue-400 outline-none px-1 text-slate-700 w-32" placeholder="Telefon" /> : <span>{companyData.phone || "Kein Tel."}</span>}</div>
                                                <div className="flex items-center gap-1"><Users size={16}/> {employees.length} Mitarbeiter</div>
                                                <div className="flex items-center gap-1"><Mail size={16}/> {isEditing ? <input value={companyData.publicEmail} onChange={(e) => setCompanyData({...companyData, publicEmail: e.target.value})} className="bg-slate-50 border-b border-blue-400 outline-none px-1 text-slate-700 w-48" placeholder="E-Mail" /> : <span>{companyData.publicEmail || user.email}</span>}</div>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                             <div className="flex items-center gap-2 mb-1 justify-end">{isEditing ? <div className="flex items-center gap-2 bg-slate-50 p-1 rounded border border-blue-200"><span className="text-sm font-bold text-blue-600">ab</span><input type="number" value={companyData.price} onChange={(e) => setCompanyData({...companyData, price: e.target.value})} className="w-16 font-bold text-slate-900 bg-white border border-slate-300 rounded px-1 text-right"/><span className="text-sm font-bold text-blue-600">€</span></div> : (companyData.showPrice !== false ? <div className="text-2xl font-bold text-blue-600">ab {companyData.price}€ <span className="text-sm text-slate-500 font-normal">/ Std.</span></div> : <div className="text-xl font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded inline-block">Preis auf Anfrage</div>)}</div>
                                             {isEditing && <label className="flex items-center gap-1 text-xs text-slate-500 mb-2 cursor-pointer"><input type="checkbox" checked={companyData.showPrice !== false} onChange={e => setCompanyData({...companyData, showPrice: e.target.checked})}/> Preis anzeigen</label>}
                                             <div className={`inline-block ${companyData.isVisible ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'} border text-xs font-bold px-3 py-1 rounded-full`}>{companyData.isVisible ? 'Öffentlich sichtbar' : 'Versteckt'}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-2 space-y-6">
                                        <div className={`bg-white p-6 rounded-2xl border shadow-sm ${isEditing ? 'border-blue-300' : 'border-slate-200'}`}><h3 className="font-bold text-lg text-slate-900 mb-4 border-b border-slate-200 pb-2">Über uns</h3>{isEditing ? <textarea value={companyData.description} onChange={(e) => setCompanyData({...companyData, description: e.target.value})} className="w-full h-40 p-3 bg-slate-50 border border-blue-300 rounded-xl text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none resize-none" placeholder="Beschreibung"/> : <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{companyData.description || "Noch keine Beschreibung hinterlegt."}</p>}</div>
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                            <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2"><FileText size={20} className="text-blue-600"/> Neuigkeiten & Updates</h3>
                                            {!isEditing && <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200"><form onSubmit={handleCreatePost}><textarea className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500 outline-none resize-none" rows="2" placeholder="Was gibt es Neues?" value={newPostContent} onChange={e => setNewPostContent(e.target.value)} /><div className="flex justify-between items-center mt-2"><span className="text-xs text-slate-400">Wird veröffentlicht.</span><button type="submit" className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">Posten</button></div></form></div>}
                                            {posts.length === 0 ? <div className="text-slate-500 text-sm italic py-2 text-center">Noch keine Beiträge.</div> : <div className="space-y-4">{posts.map((post, index) => <PostItem key={post.id} post={post} companyId={user.uid} currentUserId={user.uid} currentUserName={companyData.name} onViewProfile={handleViewProfile} />)}</div>}
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><h3 className="font-bold text-sm text-slate-500 uppercase mb-4">Statistik & Status</h3><div className="space-y-4"><div className="flex items-center justify-between"><span className="text-slate-700 flex items-center gap-2"><Users size={16}/> Mitarbeiter</span> <span className="font-bold text-slate-900">{employees.length}</span></div><div className="flex items-center justify-between"><span className="text-slate-700 flex items-center gap-2"><FileText size={16}/> Beiträge</span> <span className="font-bold text-slate-900">{posts.length}</span></div><div className="pt-4 border-t border-slate-100"><div className="flex items-center justify-between mb-2"><span className="text-slate-700 font-bold text-sm">Status</span> <span className={`text-xs font-bold px-2 py-0.5 rounded ${companyData.isVisible ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{companyData.isVisible ? 'Online' : 'Offline'}</span></div><button onClick={toggleVisibility} disabled={!userPlan.publicVisible} className="w-full text-xs text-blue-600 hover:underline text-left">Sichtbarkeit umschalten</button></div></div></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- TAB: ANTRÄGE VERWALTEN --- */}
                        {activeTab === 'req_manage' && (
                            <div className="space-y-4 max-w-6xl mx-auto">
                                <h3 className="font-bold text-lg text-slate-800">Offene Anträge prüfen</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {requests.filter(r => r.status === 'Offen').length === 0 ? (
                                        <div className="col-span-full p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">Keine offenen Anträge.</div>
                                    ) : (
                                        requests.filter(r => r.status === 'Offen').map(req => (
                                            <div key={req.id} className="bg-white p-5 rounded-xl border border-l-4 border-l-orange-400 border-slate-200 shadow-sm">
                                                <div className="flex justify-between items-start mb-2"><span className="font-bold text-slate-800">{req.employeeName}</span><span className="text-xs text-slate-400">{new Date(req.date).toLocaleDateString()}</span></div>
                                                <div className="text-sm font-medium text-slate-600 mb-4">möchte <span className="text-slate-900 font-bold">{req.type}</span>{req.reason && <p className="mt-1 text-slate-500 italic">"{req.reason}"</p>}</div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleRequestAction(req.id, 'Genehmigt')} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><CheckCircle2 size={16}/> Ja</button>
                                                    <button onClick={() => handleRequestAction(req.id, 'Abgelehnt')} className="flex-1 bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-600 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><Ban size={16}/> Nein</button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="pt-8">
                                    <h4 className="font-bold text-slate-600 text-sm uppercase mb-3">Entscheidungs-Historie</h4>
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto shadow-sm">
                                        <table className="w-full text-left text-sm min-w-[500px]">
                                            <thead className="bg-slate-50 text-slate-400"><tr><th className="p-3">Mitarbeiter</th><th className="p-3">Typ</th><th className="p-3">Datum</th><th className="p-3">Status</th></tr></thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {requests.filter(r => r.status !== 'Offen').map(req => (
                                                    <tr key={req.id}><td className="p-3 font-medium text-slate-700">{req.employeeName}</td><td className="p-3">{req.type}</td><td className="p-3 text-slate-500">{new Date(req.date).toLocaleDateString()}</td><td className="p-3"><StatusBadge status={req.status}/></td></tr>
                                                ))}
                                                {requests.filter(r => r.status !== 'Offen').length === 0 && <tr><td colSpan="4" className="p-4 text-center text-slate-400">Noch keine Historie.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- TAB: PERSONAL --- */}
                        {activeTab === 'staff' && (
                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-900 mb-4">Einladung senden</h3><div className="flex flex-col gap-4"><input type="email" placeholder="E-Mail Adresse" className="w-full p-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl outline-none focus:border-blue-500 text-sm" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}/><div className="flex gap-2"><select className="flex-1 p-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl outline-none focus:border-blue-500 text-sm" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>{Object.entries(EMP_ROLES).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}</select><button onClick={handleInviteEmployee} className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 shadow-md text-sm">Senden</button></div></div></div>
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-slate-700 min-w-[600px]">
                                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200"><tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Rolle</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right"></th></tr></thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {employees.map(emp => (
                                                    <tr key={emp.id} className="hover:bg-slate-50">
                                                        <td onClick={() => handleViewProfile(emp.id)} className="px-6 py-4 font-bold text-slate-900 text-sm cursor-pointer hover:text-blue-600 hover:underline">
                                                            {emp.name}
                                                            <div className="text-xs font-normal text-slate-500 no-underline">{emp.email}</div>
                                                        </td>
                                                        <td className="px-6 py-4"><span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1 rounded border border-blue-200 whitespace-nowrap">{EMP_ROLES[emp.role]?.label || emp.role}</span></td>
                                                        <td className="px-6 py-4"><span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-1 rounded-full border border-green-200">{emp.status || 'Aktiv'}</span></td>
                                                        <td className="px-6 py-4 text-right"><button onClick={() => handleDeleteEmployee(emp.id)} className="text-slate-400 hover:text-red-600"><X size={18}/></button></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'schedule' && (
                            <SchedulePlanner 
                                user={user}
                                employees={employees}
                                companyId={user.uid}
                            />
                        )}
                        {activeTab === 'messages' && (<div className="h-[calc(100vh-140px)]"><ChatSystem user={user} userRole="provider" isEmbedded={true} /></div>)}
                    </>
                )}
            </div>
        </div>
      </main>
    </div>
  );
};

// --- CLIENT DASHBOARD (Final Complete) ---
const ClientDashboard = ({ onLogout, isProviderView, onBackToDashboard, fixedFirmId }) => {
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFirm, setSelectedFirm] = useState(null); 
  const [firmPosts, setFirmPosts] = useState([]); 
  
  // --- VIEW STATE & PERSISTENCE ---
  const [currentView, setCurrentView] = useState(() => {
      if (fixedFirmId) return 'details';
      const saved = localStorage.getItem('secu_client_view');
      // Fix: Verhindere leere Seite nach Reload
      if (saved === 'details' && !localStorage.getItem('secu_client_firm_id')) return 'search';
      return saved || 'search';
  });

  const [viewingProfileId, setViewingProfileId] = useState(() => localStorage.getItem('secu_client_profile_id') || null);

  useEffect(() => { 
      if (!fixedFirmId) localStorage.setItem('secu_client_view', currentView); 
  }, [currentView, fixedFirmId]);

  useEffect(() => {
      if (viewingProfileId) localStorage.setItem('secu_client_profile_id', viewingProfileId);
      else localStorage.removeItem('secu_client_profile_id');
  }, [viewingProfileId]);

  // Speichere die ausgewählte Firma
  useEffect(() => {
      if (selectedFirm) localStorage.setItem('secu_client_firm_id', selectedFirm.id);
  }, [selectedFirm]);

  // RESTORE SESSION (Nach Reload Firmendaten wiederholen)
  useEffect(() => {
      const restoreSession = async () => {
          if (currentView === 'details' && !selectedFirm && !fixedFirmId) {
              const savedFirmId = localStorage.getItem('secu_client_firm_id');
              if (savedFirmId) {
                  setLoading(true);
                  try {
                      const docRef = doc(db, "companies", savedFirmId);
                      const snap = await getDoc(docRef);
                      if (snap.exists()) {
                          setSelectedFirm({ id: snap.id, ...snap.data(), rating: snap.data().rating || 5, reviews: snap.data().reviews || 12 });
                      } else { setCurrentView('search'); }
                  } catch (e) { setCurrentView('search'); }
                  setLoading(false);
              } else { setCurrentView('search'); }
          }
      };
      restoreSession();
  }, []); // Nur einmal beim Start

  const handleLogout = () => {
      localStorage.removeItem('secu_client_view');
      localStorage.removeItem('secu_client_profile_id');
      localStorage.removeItem('secu_client_firm_id');
      onLogout();
  };

  // --- HELPERS ---
  const handleViewProfile = (userId) => { setViewingProfileId(userId); };
  const handleCloseProfile = () => { setViewingProfileId(null); };

  const handleViewCompanyFromProfile = async (companyId) => {
      setLoading(true);
      try {
          setViewingProfileId(null);
          const docRef = doc(db, "companies", companyId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
              const firmData = { id: snap.id, ...snap.data(), rating: snap.data().rating || 5, reviews: snap.data().reviews || 12 };
              setSelectedFirm(firmData);
              setCurrentView('details');
          } else { alert("Firma nicht gefunden."); }
      } catch (e) { console.error(e); }
      setLoading(false);
  };

  const [chatTarget, setChatTarget] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [realName, setRealName] = useState("");
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({ name: "", phone: "", address: "" });
  const [profileImageUpload, setProfileImageUpload] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const [citySuggestions, setCitySuggestions] = useState([]); 
  const [minEmployees, setMinEmployees] = useState(null);
  const [maxPrice, setMaxPrice] = useState(null);
  const [sortBy, setSortBy] = useState("recommended");

  const filterRef = useRef(null); 
  const cityInputRef = useRef(null); 
  const currentUser = auth.currentUser; 

  // --- PROFILE EDIT ---
  useEffect(() => {
      const fetchUserData = async () => {
          if (!currentUser) return;
          try {
              const userDoc = await getDoc(doc(db, "users", currentUser.uid));
              if (userDoc.exists()) { 
                  const data = userDoc.data();
                  setRealName(data.name);
                  setProfileData({ name: data.name || "", phone: data.phone || "", address: data.address || "" });
              } else {
                  setRealName(currentUser.displayName || "User");
                  setProfileData({ name: currentUser.displayName || "", phone: "", address: "" });
              }
          } catch (e) { setRealName("User"); }
      };
      fetchUserData();
  }, [currentUser]);

  const handleSaveProfile = async () => {
      if (!currentUser) return;
      try {
          await updateDoc(doc(db, "users", currentUser.uid), { name: profileData.name, phone: profileData.phone, address: profileData.address });
          setRealName(profileData.name); setIsEditingProfile(false); alert("Profil gespeichert!");
      } catch (e) { console.error(e); alert("Fehler."); }
  };

  const handleProfileImageUpload = async (e) => {
      const file = e.target.files[0]; if (!file || !currentUser) return; setUploading(true);
      try { const storageRef = ref(storage, `avatars/${currentUser.uid}`); await uploadBytes(storageRef, file); const url = await getDownloadURL(storageRef); await updateDoc(doc(db, "users", currentUser.uid), { imageUrl: url }); const img = document.getElementById('header-avatar'); if(img) img.src = url; alert("Bild aktualisiert!"); setProfileImageUpload(null); } catch (err) { console.error(err); } setUploading(false);
  };

  // --- STANDARD LOGIC (Search etc.) ---
  const handleCityInput = async (val) => { setCityFilter(val); if (cityInputRef.current) clearTimeout(cityInputRef.current); if (val.length < 3) { setCitySuggestions([]); return; } cityInputRef.current = setTimeout(async () => { try { const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${val}&countrycodes=de&limit=5`); const data = await response.json(); setCitySuggestions(data); } catch (err) { console.error(err); } }, 300); };
  const selectCity = (cityData) => { setCityFilter(cityData.display_name.split(',')[0]); setCitySuggestions([]); };
  useEffect(() => { if(!currentUser) return; const q = query(collection(db, "chats"), where(isProviderView ? 'companyId' : 'clientId', "==", currentUser.uid)); const unsub = onSnapshot(q, (snap) => { let count = 0; snap.docs.forEach(d => { if (isProviderView) { if (d.data().unreadProvider) count++; } else { if (d.data().unreadClient) count++; } }); setUnreadCount(count); }); return () => unsub(); }, [currentUser, isProviderView]);
  useEffect(() => { const loadData = async () => { setLoading(true); try { if (fixedFirmId) { const docRef = doc(db, "companies", fixedFirmId); const snap = await getDoc(docRef); if (snap.exists()) { const firmData = { id: snap.id, ...snap.data(), rating: 5, reviews: 12 }; setFirms([firmData]); setSelectedFirm(firmData); setCurrentView('details'); } } else { const q = query(collection(db, "companies"), where("isVisible", "==", true)); const snap = await getDocs(q); setFirms(snap.docs.map(d => ({ id: d.id, ...d.data(), rating: d.data().rating || Math.floor(Math.random() * 2) + 3.5, reviews: d.data().reviews || Math.floor(Math.random() * 50) + 5, joinedAt: d.data().joinedAt || new Date().toISOString() }))); } } catch (err) { console.error(err); } setLoading(false); }; loadData(); }, [fixedFirmId]);
  useEffect(() => { if (selectedFirm) { const loadPosts = async () => { const q = query(collection(db, "companies", selectedFirm.id, "posts")); const snap = await getDocs(q); setFirmPosts(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))); }; loadPosts(); } else { setFirmPosts([]); } }, [selectedFirm]);
  
  const getFilteredFirms = () => { let result = firms.filter(firm => { const term = searchTerm.toLowerCase(); const matchesSearch = !term || firm.name.toLowerCase().includes(term) || (firm.description && firm.description.toLowerCase().includes(term)); const matchesCity = !cityFilter || (firm.address && firm.address.toLowerCase().includes(cityFilter.toLowerCase())); const empCount = firm.employees || 0; const matchesEmp = !minEmployees || empCount >= minEmployees; const price = parseFloat(firm.price) || 0; const matchesPrice = !maxPrice || price <= maxPrice; return matchesSearch && matchesCity && matchesEmp && matchesPrice; }); result.sort((a, b) => { switch (sortBy) { case 'new': return new Date(b.joinedAt || 0) - new Date(a.joinedAt || 0); case 'old': return new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0); case 'price_asc': return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0); case 'price_desc': return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0); case 'recommended': default: return (b.rating * b.reviews) - (a.rating * a.reviews); } }); return result; };
  const filteredFirms = getFilteredFirms();
  const hasActiveFilters = cityFilter || minEmployees || maxPrice || sortBy !== 'recommended';
  const handleResetFilter = () => { setCityFilter(""); setMinEmployees(null); setMaxPrice(null); setSortBy("recommended"); };
  const handleStartChat = (firmId) => { if(!currentUser) { alert("Bitte erst einloggen."); return; } setChatTarget(firmId); setCurrentView('chat'); };
  
  const goBack = () => { 
      if (viewingProfileId) { setViewingProfileId(null); return; }
      if (currentView === 'chat' && selectedFirm) { setCurrentView('details'); } 
      else if (currentView === 'my_profile') { setCurrentView('search'); }
      else { setCurrentView('search'); setSelectedFirm(null); } 
  };

  const FilterButton = ({ label, active, onClick }) => ( <button onClick={onClick} className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex-1 whitespace-nowrap ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>{label}</button> );
  const ActiveFilterChip = ({ label, onRemove }) => ( <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100 animate-in fade-in zoom-in">{label}<button onClick={onRemove} className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"><X size={10}/></button></div> );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 sticky top-0 z-40 shadow-sm h-16 flex items-center gap-3">
            <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => { setCurrentView('search'); setSelectedFirm(null); handleCloseProfile(); }}>
                <Shield className="text-blue-600 h-8 w-8" /><h1 className="hidden md:block text-xl font-bold tracking-tight">Secu<span className="text-blue-600">Now</span></h1>
            </div>
            
            {currentView === 'search' && !viewingProfileId ? (
                <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div className="flex-1 bg-slate-100 rounded-lg flex items-center px-3 h-10 border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-all min-w-0">
                        <Search className="text-slate-400 h-4 w-4 shrink-0 mr-2"/>
                        <input type="text" placeholder="Suchen..." className="bg-transparent border-none outline-none text-slate-900 text-sm w-full placeholder-slate-400 h-full min-w-0" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                        {searchTerm && <button onClick={() => setSearchTerm("")} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>}
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)} className={`h-10 px-3 md:px-4 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors border shrink-0 ${showFilters || hasActiveFilters ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Filter size={16}/> <span className="hidden md:inline">Filter</span></button>
                </div>
            ) : (
                <div className="flex-1 text-center font-bold text-slate-600 uppercase tracking-wider text-xs md:text-sm truncate mx-2">
                    {viewingProfileId ? 'Profilansicht' : currentView === 'chat' ? 'Nachrichten' : currentView === 'my_profile' ? 'Mein Profil' : selectedFirm?.name || 'Profil'}
                </div>
            )}

            <div className="flex items-center gap-2 shrink-0">
               {currentUser && (
                   <button onClick={() => { isProviderView ? onBackToDashboard('messages') : setCurrentView('chat'); handleCloseProfile(); }} className={`relative p-2 rounded-lg transition-colors ${currentView === 'chat' && !viewingProfileId ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}>
                       <Mail size={22}/>
                       {unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold h-3 w-3 rounded-full flex items-center justify-center border border-white translate-x-1 -translate-y-1">{unreadCount}</span>}
                   </button>
               )}
               {isProviderView ? ( 
                   <button onClick={() => onBackToDashboard('dashboard')} className="text-slate-500 p-2 rounded-lg hover:bg-slate-100"><User size={22}/></button> 
               ) : ( 
                   <button onClick={() => { setCurrentView('my_profile'); handleCloseProfile(); }} className={`p-2 rounded-lg transition-colors ${currentView === 'my_profile' && !viewingProfileId ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-100'}`}><User size={22}/></button> 
               )}
               <button onClick={handleLogout} className="text-slate-500 p-2 rounded-lg hover:bg-red-50 hover:text-red-600"><LogOut size={22}/></button>
            </div>
      </header>

      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 flex-1 relative">
        {viewingProfileId ? (
            <UserProfileView targetUserId={viewingProfileId} onBack={handleCloseProfile} onViewCompany={handleViewCompanyFromProfile} />
        ) : (
            <>
                {currentView === 'search' && showFilters && (
                    <div className="mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xl animate-in fade-in slide-in-from-top-2 z-30 absolute left-4 right-4 md:static">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="relative"><label className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Stadt</label><div className="relative"><MapPin size={14} className="absolute left-3 top-3 text-slate-400"/><input type="text" placeholder="Stadt eingeben..." className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:border-blue-500 focus:bg-white outline-none transition-all" value={cityFilter} onChange={(e) => handleCityInput(e.target.value)}/></div>{citySuggestions.length > 0 && (<div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-2 z-50 overflow-hidden">{citySuggestions.map((city, idx) => (<div key={idx} onClick={() => selectCity(city)} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0"><div className="bg-slate-100 p-2 rounded-full text-slate-500"><MapPin size={14}/></div><span className="text-sm font-medium text-slate-700 truncate">{city.display_name}</span></div>))}</div>)}</div>
                            <div><label className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Mindestanzahl Mitarbeiter</label><div className="flex gap-1">{[1, 5, 10, 20, 50].map(num => (<FilterButton key={num} label={`${num}+`} active={minEmployees === num} onClick={() => setMinEmployees(minEmployees === num ? null : num)} />))}</div></div>
                            <div><label className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Maximaler Stundensatz</label><div className="flex gap-1">{[30, 50, 75, 100, 150].map(price => (<FilterButton key={price} label={`${price}€`} active={maxPrice === price} onClick={() => setMaxPrice(maxPrice === price ? null : price)} />))}</div></div>
                            <div><label className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block">Sortierung</label><div className="grid grid-cols-2 gap-1"><button onClick={() => setSortBy('recommended')} className={`col-span-2 py-2 rounded-lg text-xs font-bold border transition-all ${sortBy === 'recommended' ? 'bg-blue-500 border-blue-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>★ Empfohlen</button><button onClick={() => setSortBy('new')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${sortBy === 'new' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>Neu</button><button onClick={() => setSortBy('price_asc')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${sortBy === 'price_asc' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>Preis ↑</button></div></div>
                        </div>
                        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3"><button onClick={handleResetFilter} className="text-xs font-bold text-slate-500 hover:text-red-600 flex items-center gap-1"><Trash2 size={12}/> Filter zurücksetzen</button></div>
                    </div>
                )}
                {currentView === 'search' && !showFilters && hasActiveFilters && (<div className="mb-6 flex flex-wrap gap-2">{cityFilter && <ActiveFilterChip label={`Stadt: ${cityFilter}`} onRemove={() => setCityFilter("")} />}{minEmployees && <ActiveFilterChip label={`MA: ${minEmployees}+`} onRemove={() => setMinEmployees(null)} />}{maxPrice && <ActiveFilterChip label={`Max: ${maxPrice}€`} onRemove={() => setMaxPrice(null)} />}{sortBy !== 'recommended' && <ActiveFilterChip label="Sortiert" onRemove={() => setSortBy("recommended")} />}</div>)}

                {currentView === 'my_profile' && currentUser && (
                    <div className="animate-in fade-in max-w-2xl mx-auto">
                        <button onClick={goBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm mb-6"><ArrowLeft size={18}/> Zurück zur Suche</button>
                        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                            <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-400"></div>
                            <div className="relative -mt-16 mb-4 flex flex-col items-center">
                                <div className="h-32 w-32 rounded-full border-4 border-white bg-white shadow-md overflow-hidden relative group">
                                    {currentUser.photoURL ? <img id="header-avatar" src={currentUser.photoURL} className="h-full w-full object-cover"/> : <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-300 font-bold text-4xl">{realName ? realName.charAt(0) : "U"}</div>}
                                    <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"><Upload size={24}/><input type="file" className="hidden" accept="image/*" onChange={handleProfileImageUpload}/></label>
                                </div>
                                {uploading && <span className="text-xs font-bold text-blue-600 animate-pulse mt-2">Bild wird hochgeladen...</span>}
                            </div>
                            <div className="px-8 pb-8 text-center">
                                {isEditingProfile ? (
                                    <div className="space-y-4 max-w-sm mx-auto">
                                        <input className="w-full p-2 border rounded-lg text-center font-bold text-lg" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} placeholder="Ihr Name" />
                                        <div className="flex items-center gap-2 border rounded-lg p-2 bg-slate-50"><Phone size={16} className="text-slate-400"/><input className="flex-1 bg-transparent outline-none text-sm" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} placeholder="Telefonnummer" /></div>
                                        <div className="flex items-center gap-2 border rounded-lg p-2 bg-slate-50"><MapPin size={16} className="text-slate-400"/><input className="flex-1 bg-transparent outline-none text-sm" value={profileData.address} onChange={e => setProfileData({...profileData, address: e.target.value})} placeholder="Adresse" /></div>
                                        <div className="flex gap-2 justify-center mt-4"><button onClick={() => setIsEditingProfile(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Abbrechen</button><button onClick={handleSaveProfile} className="px-6 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg">Speichern</button></div>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-3xl font-bold text-slate-900 mb-1">{realName}</h2>
                                        <div className="text-slate-500 text-sm mb-4">{currentUser.email}</div>
                                        <button onClick={() => setIsEditingProfile(true)} className="text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-100 mb-6">Profil bearbeiten</button>
                                        <div className="border-t border-slate-100 pt-6 text-left space-y-4 max-w-sm mx-auto"><div className="flex items-center gap-3 text-slate-700"><Phone size={18} className="text-blue-500"/> <span>{profileData.phone || "Keine Telefonnummer"}</span></div><div className="flex items-center gap-3 text-slate-700"><MapPin size={18} className="text-blue-500"/> <span>{profileData.address || "Keine Adresse"}</span></div></div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {currentView === 'chat' && currentUser && (<div className="h-[calc(100vh-140px)] flex flex-col"><button onClick={goBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm mb-4"><ArrowLeft size={18}/> Zurück</button><div className="flex-1 overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white"><ChatSystem user={{ uid: currentUser.uid, name: realName || currentUser.displayName || "User" }} userRole="client" targetId={chatTarget} targetName={selectedFirm?.name || "Firma"} targetImage={selectedFirm?.imageUrl} isEmbedded={true} /></div></div>)}
                
                {currentView === 'details' && selectedFirm && (
                    <div className="animate-in fade-in">
                        <button onClick={goBack} className="mb-4 flex items-center gap-2 text-slate-600 font-bold text-sm bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm"><ArrowLeft size={18}/> Zurück</button>
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6"><div className="h-24 bg-gradient-to-r from-blue-600 to-blue-400 relative"><div className="absolute -bottom-10 left-4 md:left-8 p-1 bg-white rounded-xl shadow-md border border-slate-200">{selectedFirm.imageUrl ? <img src={selectedFirm.imageUrl} className="h-20 w-20 md:h-24 md:w-24 object-cover rounded-lg"/> : <div className="h-20 w-20 md:h-24 md:w-24 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-bold text-xl">{selectedFirm.name.charAt(0)}</div>}</div></div><div className="pt-12 pb-6 px-4 md:px-8 mt-2"><div className="flex flex-col md:flex-row justify-between items-start gap-4"><div><h1 className="text-2xl font-bold text-slate-900">{selectedFirm.name}</h1><div className="flex items-center gap-2 text-sm text-slate-500 mt-1"><StarRating rating={Math.round(selectedFirm.rating)} /><span className="font-bold">{selectedFirm.rating}</span> ({selectedFirm.reviews})</div><div className="mt-3 space-y-1 text-sm text-slate-600"><div className="flex items-center gap-2"><MapPin size={14} className="text-blue-500"/> {selectedFirm.address || "Keine Adresse"}</div><div className="flex items-center gap-2"><Users size={14} className="text-blue-500"/> {selectedFirm.employees || 0} Mitarbeiter</div></div></div><div className="text-left md:text-right mt-2 md:mt-0 w-full md:w-auto bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-lg"><div className="text-xs text-slate-500 uppercase font-bold">Stundensatz</div><div className="text-xl font-bold text-blue-600">{selectedFirm.showPrice !== false ? `ab ${selectedFirm.price}€` : 'Auf Anfrage'}</div></div></div></div></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-6">
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-900 mb-3 border-b pb-2">Über uns</h3><p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedFirm.description || "Keine Beschreibung."}</p></div>
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-900 mb-3">Neuigkeiten</h3>{firmPosts.length === 0 ? <div className="text-slate-400 text-sm italic">Keine Beiträge.</div> : <div className="space-y-4">{firmPosts.map((post, index) => <PostItem key={index} post={post} companyId={selectedFirm.id} currentUserId={currentUser?.uid} currentUserName={realName || "Gast"} onViewProfile={handleViewProfile} />)}</div>}</div>
                            </div>
                            <div>{currentUser?.uid === selectedFirm.id && isProviderView ? (<button onClick={() => onBackToDashboard('dashboard')} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md">Zum Dashboard</button>) : (<div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm sticky top-20"><button onClick={() => handleStartChat(selectedFirm.id)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md mb-3 flex items-center justify-center gap-2"><Mail size={18}/> Nachricht senden</button><a href={`tel:${selectedFirm.phone}`} className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl shadow-sm flex items-center justify-center gap-2"><Phone size={18}/> Anrufen</a></div>)}</div>
                        </div>
                    </div>
                )}

                {currentView === 'search' && (
                    <>
                        <div className="mb-4 flex justify-between items-end"><h2 className="text-lg font-bold text-slate-900">Ergebnisse ({filteredFirms.length})</h2></div>
                        {loading ? <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-blue-600 h-8 w-8"/></div> : filteredFirms.length === 0 ? (<div className="text-center p-10 bg-white rounded-xl border border-slate-200"><Search className="h-8 w-8 text-slate-300 mx-auto mb-2"/><p className="text-slate-500 text-sm">Keine Treffer.</p><button onClick={handleResetFilter} className="text-blue-600 text-sm font-bold mt-2">Filter löschen</button></div>) : (<div className="space-y-3">{filteredFirms.map(firm => (<div key={firm.id} onClick={() => { if (currentUser && currentUser.uid === firm.id && isProviderView) { onBackToDashboard('dashboard'); } else { setSelectedFirm(firm); setCurrentView('details'); } }} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:border-blue-400 transition-all cursor-pointer flex gap-4 overflow-hidden"><div className="h-24 w-24 shrink-0 bg-slate-100 rounded-lg overflow-hidden border border-slate-100 relative">{firm.imageUrl ? <img src={firm.imageUrl} className="h-full w-full object-cover"/> : <div className="h-full w-full flex items-center justify-center text-slate-300"><Shield size={24}/></div>}</div><div className="flex-1 min-w-0 flex flex-col justify-between py-0.5"><div><h3 className="font-bold text-slate-900 text-base leading-tight truncate mb-1">{firm.name}</h3><div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mb-2"><div className="flex items-center gap-1"><MapPin size={12} className="text-slate-400"/> {firm.address || "n.a."}</div><div className="flex items-center gap-1"><Phone size={12} className="text-slate-400"/> {firm.phone || "n.a."}</div><div className="flex items-center gap-1"><Mail size={12} className="text-slate-400"/> {firm.publicEmail || "n.a."}</div></div><p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">"{firm.description || "Professionelle Sicherheitslösungen."}"</p></div><div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100"><div className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><Users size={14} className="text-blue-500"/> {firm.employees || 1} Mitarbeiter verfügbar</div><div className="text-sm font-bold text-blue-600">{firm.showPrice !== false ? `ab ${firm.price} €/Std` : 'n.a.'}</div></div></div></div>))}</div>)}
                    </>
                )}
            </>
        )}
      </div>
    </div>
  );
};

// --- EMPLOYEE DASHBOARD (Final Complete) ---
const EmployeeDashboard = ({ user, onLogout }) => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    useEffect(() => { if (window.innerWidth >= 1024) setSidebarOpen(true); }, []);

    // Tabs & Persistence
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('secu_emp_tab') || 'schedule');
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('secu_emp_view') || 'dashboard');
    const [viewingProfileId, setViewingProfileId] = useState(() => localStorage.getItem('secu_emp_profile_id') || null);

    useEffect(() => { localStorage.setItem('secu_emp_tab', activeTab); }, [activeTab]);
    useEffect(() => { localStorage.setItem('secu_emp_view', viewMode); }, [viewMode]);
    useEffect(() => {
        if (viewingProfileId) localStorage.setItem('secu_emp_profile_id', viewingProfileId);
        else localStorage.removeItem('secu_emp_profile_id');
    }, [viewingProfileId]);

    const handleLogout = () => {
        localStorage.removeItem('secu_emp_tab');
        localStorage.removeItem('secu_emp_view');
        localStorage.removeItem('secu_emp_profile_id');
        onLogout();
    };

    const handleViewProfile = (id) => setViewingProfileId(id);
    const handleCloseProfile = () => setViewingProfileId(null);

    const [loading, setLoading] = useState(false);
    const [myRequests, setMyRequests] = useState([]);
    const [teamRequests, setTeamRequests] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);
    const [docUpload, setDocUpload] = useState(null);
    const [docType, setDocType] = useState('Sachkunde 34a');
    
    // Edit State
    const [editData, setEditData] = useState({ name: user.name || "", phone: user.phone || "", address: user.address || "" });

    const isBoss = user.role === 'team_lead' || user.role === 'obj_lead';
    const canViewMarket = user.role === 'team_lead';

    const handleLogoClick = () => { if (canViewMarket) { setViewMode('market'); } };

    useEffect(() => {
        if (!user.companyId) return;
        const qMy = query(collection(db, "companies", user.companyId, "requests"), where("employeeId", "==", user.uid));
        getDocs(qMy).then(snap => setMyRequests(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        getDocs(collection(db, "companies", user.companyId, "employees")).then(snap => { 
            const members = snap.docs.map(d => ({id: d.id, ...d.data()}));
            // Stelle sicher, dass der aktuelle User auch enthalten ist (falls nicht in employees)
            const userInMembers = members.find(m => m.id === user.uid);
            if (!userInMembers && user.uid) {
                members.push({ id: user.uid, ...user, role: user.role || 'worker' });
            }
            setTeamMembers(members);
        });
        if (isBoss) { getDocs(collection(db, "companies", user.companyId, "requests")).then(snap => { setTeamRequests(snap.docs.map(d => ({id: d.id, ...d.data()}))); }); }
    }, [user, isBoss, activeTab]);

    const handleRequest = async (type) => { const reason = prompt(`Grund für ${type} (optional):`); if (reason === null) return; const newReq = { employeeId: user.uid, employeeName: user.name, type: type, reason: reason, status: 'Offen', date: new Date().toISOString() }; const docRef = await addDoc(collection(db, "companies", user.companyId, "requests"), newReq); setMyRequests(prev => [...prev, {id: docRef.id, ...newReq}]); alert("Antrag gesendet!"); };
    const handleRequestAction = async (reqId, newStatus) => { if (!confirm(`Antrag wirklich ${newStatus}?`)) return; await updateDoc(doc(db, "companies", user.companyId, "requests", reqId), { status: newStatus }); setTeamRequests(prev => prev.map(r => r.id === reqId ? {...r, status: newStatus} : r)); };
    const handleUpload = async (e) => { e.preventDefault(); if(!docUpload || !user.companyId) return; setLoading(true); try { const storageRef = ref(storage, `docs/${user.companyId}/${user.uid}/${docUpload.name}`); await uploadBytes(storageRef, docUpload); const url = await getDownloadURL(storageRef); await addDoc(collection(db, "companies", user.companyId, "employees", user.uid, "documents"), { name: docType, url: url, uploadedAt: new Date().toISOString() }); alert("Gespeichert!"); setDocUpload(null); } catch (err) { console.error(err); } setLoading(false); };
    const handleProfileImageUpload = async (e) => { const file = e.target.files[0]; if (!file) return; setLoading(true); try { const storageRef = ref(storage, `avatars/${user.uid}`); await uploadBytes(storageRef, file); const url = await getDownloadURL(storageRef); await updateDoc(doc(db, "users", user.uid), { imageUrl: url }); if(user.companyId) await updateDoc(doc(db, "companies", user.companyId, "employees", user.uid), { imageUrl: url }); alert("Profilbild aktualisiert!"); } catch (err) { console.error(err); } setLoading(false); };
    const handleSaveContact = async () => { setLoading(true); try { await updateDoc(doc(db, "users", user.uid), { phone: editData.phone, address: editData.address }); if (user.companyId) { await updateDoc(doc(db, "companies", user.companyId, "employees", user.uid), { phone: editData.phone, address: editData.address }); } alert("Gespeichert!"); } catch (err) { console.error(err); } setLoading(false); };

    if (!user.companyId) return (<div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md"><AlertTriangle className="h-16 w-16 text-orange-500 mx-auto mb-4"/><h2 className="text-xl font-bold text-slate-800">Noch keiner Firma zugeordnet</h2><p className="text-slate-500 mt-2">Bitte bitten Sie Ihren Arbeitgeber um eine Einladung.</p><button onClick={handleLogout} className="mt-6 text-blue-600 font-bold hover:underline">Abmelden</button></div></div>);

    if (viewMode === 'market' && canViewMarket) return <ClientDashboard onLogout={handleLogout} onBackToDashboard={() => setViewMode('dashboard')} isProviderView={true} />;
    if (viewMode === 'company_profile') return <ClientDashboard onLogout={handleLogout} onBackToDashboard={() => setViewMode('dashboard')} fixedFirmId={user.companyId} />;

    return (
      <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden relative">
        {isSidebarOpen && (<div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}/>)}

        <aside className={`fixed top-0 left-0 h-full z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} lg:static lg:translate-x-0 lg:shadow-none`}>
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 bg-white shrink-0">
                <div className={`flex items-center gap-2 ${canViewMarket ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`} onClick={handleLogoClick}><Shield className="text-blue-600 h-8 w-8" /><div><h1 className="font-bold text-sm text-slate-800 leading-tight">Mitarbeiter</h1><span className="text-[10px] uppercase text-slate-500 font-bold">{isBoss ? 'Führungskraft' : 'Sicherheitskraft'}</span></div></div>
                <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-full"><X size={24} /></button>
            </div>
            <nav className="flex-1 py-6 px-3 overflow-y-auto space-y-1">
                <button onClick={() => { setActiveTab('schedule'); handleCloseProfile(); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-3 rounded-lg transition-all mb-1 ${activeTab === 'schedule' && !viewingProfileId ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><CalendarDays size={20} /><span className="ml-3 text-sm font-medium">Dienstplan</span></button>
                <button onClick={() => { setActiveTab('requests'); handleCloseProfile(); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-3 rounded-lg transition-all mb-1 ${activeTab === 'requests' && !viewingProfileId ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><FileText size={20} /><span className="ml-3 text-sm font-medium">Meine Anträge</span></button>
                <button onClick={() => { setActiveTab('files'); handleCloseProfile(); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-3 rounded-lg transition-all mb-1 ${activeTab === 'files' && !viewingProfileId ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Briefcase size={20} /><span className="ml-3 text-sm font-medium">Meine Akte</span></button>
                {isBoss && (<><div className="my-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-6">Verwaltung</div><button onClick={() => { setActiveTab('team_manage'); handleCloseProfile(); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-3 rounded-lg transition-all mb-1 ${activeTab === 'team_manage' && !viewingProfileId ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-purple-50 hover:text-purple-600'}`}><Users size={20} /><span className="ml-3 text-sm font-medium">Team Liste</span></button><button onClick={() => { setActiveTab('req_manage'); handleCloseProfile(); if(window.innerWidth < 1024) setSidebarOpen(false); }} className={`w-full flex items-center px-3 py-3 rounded-lg transition-all mb-1 ${activeTab === 'req_manage' && !viewingProfileId ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-purple-50 hover:text-purple-600'}`}><CheckCircle2 size={20} /><span className="ml-3 text-sm font-medium">Anträge prüfen</span></button></>)}
                <div className="my-4 border-t border-slate-200"></div>
                {canViewMarket ? ( <button onClick={() => setViewMode('market')} className="w-full flex items-center px-3 py-3 rounded-lg text-slate-500 hover:bg-slate-100 transition-all"><Globe size={20}/><span className="ml-3 text-sm font-medium">Zum Marktplatz</span></button> ) : ( <button onClick={() => setViewMode('company_profile')} className="w-full flex items-center px-3 py-3 rounded-lg text-slate-500 hover:bg-slate-100 transition-all"><Briefcase size={20}/><span className="ml-3 text-sm font-medium">Firmenprofil</span></button> )}
            </nav>
            <div className="p-4 border-t border-slate-200 bg-white shrink-0"><button onClick={handleLogout} className="w-full flex items-center px-3 py-3 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"><LogOut size={20} /><span className="ml-3 text-sm font-medium">Abmelden</span></button></div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative h-screen bg-white">
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-700"><Menu size={24} /></button>
                    <h2 className="text-lg font-bold text-slate-900 truncate">{viewingProfileId ? 'Profilansicht' : activeTab === 'schedule' ? 'Dienstplan' : activeTab === 'requests' ? 'Meine Anträge' : activeTab === 'files' ? 'Personalakte' : 'Verwaltung'}</h2>
                </div>
                <div className="flex items-center gap-3"><div className="text-right hidden sm:block"><div className="text-sm font-bold text-slate-900">{user.name}</div><div className="text-xs text-slate-500">{user.email}</div></div><div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200 overflow-hidden">{user.imageUrl ? <img src={user.imageUrl} className="h-full w-full object-cover"/> : user.name.charAt(0)}</div></div>
            </header>

            <div className="flex-1 overflow-auto p-4 lg:p-8 bg-slate-50 w-full relative">
                <div className="max-w-6xl mx-auto space-y-6 pb-20">
                    {viewingProfileId ? (
                        <UserProfileView targetUserId={viewingProfileId} onBack={handleCloseProfile} />
                    ) : (
                        <>
                            {activeTab === 'schedule' && (<div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-hidden"><div className="w-full overflow-x-auto"><RosterScheduler user={user} employees={teamMembers} companyId={user.companyId} /></div></div>)}
                            {activeTab === 'requests' && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="lg:col-span-1 space-y-4"><h3 className="font-bold text-slate-700">Neuen Antrag stellen</h3><div onClick={() => handleRequest('Urlaub')} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group flex items-center gap-4"><div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors"><Globe/></div><div><div className="font-bold text-slate-800">Urlaub</div><div className="text-xs text-slate-500">Freizeit beantragen</div></div></div><div onClick={() => handleRequest('Krankmeldung')} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-red-500 hover:shadow-md transition-all group flex items-center gap-4"><div className="h-10 w-10 bg-red-50 rounded-full flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors"><Plus className="rotate-45"/></div><div><div className="font-bold text-slate-800">Krankheit</div><div className="text-xs text-slate-500">Meldung einreichen</div></div></div></div><div className="lg:col-span-2"><h3 className="font-bold text-slate-700 mb-4">Meine Historie</h3><div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">{myRequests.length === 0 ? <div className="p-8 text-center text-slate-400 text-sm">Keine Einträge vorhanden.</div> : (<table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100"><tr><th className="p-4">Typ</th><th className="p-4">Datum</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{myRequests.map(req => (<tr key={req.id}><td className="p-4 font-medium text-slate-800">{req.type} <span className="text-slate-400 font-normal ml-1">- {req.reason}</span></td><td className="p-4 text-slate-500">{new Date(req.date).toLocaleDateString()}</td><td className="p-4"><StatusBadge status={req.status}/></td></tr>))}</tbody></table>)}</div></div></div>)}
                            {activeTab === 'files' && (<div className="space-y-6"><div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto flex flex-col md:flex-row gap-6"><div className="flex flex-col items-center gap-2"><div className="h-24 w-24 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden border-2 border-slate-200 relative group">{user.imageUrl ? <img src={user.imageUrl} className="h-full w-full object-cover"/> : <div className="h-full w-full flex items-center justify-center text-slate-400 font-bold text-xl">{user.name.charAt(0)}</div>}<label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"><Upload size={20}/><input type="file" className="hidden" accept="image/*" onChange={handleProfileImageUpload}/></label></div>{loading && <span className="text-xs text-blue-600 animate-pulse">Laden...</span>}</div><div className="flex-1 w-full space-y-3"><h3 className="font-bold text-slate-900 border-b pb-2 mb-2">Meine Daten</h3><div><label className="text-xs font-bold uppercase text-slate-500">Name (Read-Only)</label><input className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-500" value={editData.name} disabled /></div><div><label className="text-xs font-bold uppercase text-slate-500">Telefonnummer</label><input className="w-full p-2 bg-white border border-slate-300 rounded focus:border-blue-500 outline-none" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} placeholder="0176..." /></div><div><label className="text-xs font-bold uppercase text-slate-500">Adresse</label><input className="w-full p-2 bg-white border border-slate-300 rounded focus:border-blue-500 outline-none" value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} placeholder="Musterstraße 1..." /></div><button onClick={handleSaveContact} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg text-sm hover:bg-blue-700 w-full md:w-auto">Daten speichern</button></div></div><div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto"><h3 className="font-bold text-lg mb-4 text-slate-800">Dokumente hochladen</h3><form onSubmit={handleUpload} className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Typ</label><select value={docType} onChange={e => setDocType(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 outline-none focus:border-blue-500"><option>Sachkunde 34a</option><option>Erste Hilfe Nachweis</option><option>Führungszeugnis</option><option>Sonstiges</option></select></div><div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Datei</label><input type="file" onChange={e => setDocUpload(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/></div></div><button type="submit" disabled={!docUpload || loading} className="bg-slate-900 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-slate-800 w-full md:w-auto flex items-center justify-center gap-2">{loading && <Loader2 className="animate-spin h-4 w-4"/>} Hochladen & Speichern</button></form></div></div>)}
                            {activeTab === 'team_manage' && isBoss && (<div className="space-y-4 max-w-6xl mx-auto"><div className="flex justify-between items-center"><h3 className="font-bold text-lg text-slate-800">Team Übersicht</h3></div><div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto"><table className="w-full text-left text-sm min-w-[500px]"><thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100"><tr><th className="p-4">Name</th><th className="p-4">Rolle</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{teamMembers.map(m => (<tr key={m.id}><td className="p-4 font-bold text-slate-700 cursor-pointer hover:text-blue-600" onClick={() => handleViewProfile(m.id)}>{m.name}</td><td className="p-4">{m.role === 'worker' ? 'Mitarbeiter' : 'Leitung'}</td><td className="p-4"><span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs font-bold">Aktiv</span></td></tr>))}</tbody></table></div></div>)}
                            {activeTab === 'req_manage' && isBoss && (<div className="space-y-4 max-w-6xl mx-auto"><h3 className="font-bold text-lg text-slate-800">Offene Anträge prüfen</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{teamRequests.filter(r => r.status === 'Offen').map(req => (<div key={req.id} className="bg-white p-5 rounded-xl border border-l-4 border-l-orange-400 border-slate-200 shadow-sm"><div className="flex justify-between items-start mb-2"><span className="font-bold text-slate-800">{req.employeeName}</span><span className="text-xs text-slate-400">{new Date(req.date).toLocaleDateString()}</span></div><div className="text-sm font-medium text-slate-600 mb-4">möchte <span className="text-slate-900 font-bold">{req.type}</span>{req.reason && <p className="mt-1 text-slate-500 italic">"{req.reason}"</p>}</div><div className="flex gap-2"><button onClick={() => handleRequestAction(req.id, 'Genehmigt')} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><CheckCircle2 size={16}/> Ja</button><button onClick={() => handleRequestAction(req.id, 'Abgelehnt')} className="flex-1 bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-600 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><Ban size={16}/> Nein</button></div></div>))}</div><h4 className="font-bold text-slate-600 mt-8 text-sm uppercase">Entscheidungs-Historie</h4><div className="bg-white rounded-xl border border-slate-200 overflow-hidden opacity-75 overflow-x-auto"><table className="w-full text-left text-sm min-w-[500px]"><thead className="bg-slate-50 text-slate-400"><tr><th className="p-3">Mitarbeiter</th><th className="p-3">Typ</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{teamRequests.filter(r => r.status !== 'Offen').map(req => (<tr key={req.id}><td className="p-3 font-medium">{req.employeeName}</td><td className="p-3">{req.type}</td><td className="p-3"><StatusBadge status={req.status}/></td></tr>))}</tbody></table></div></div>)}
                        </>
                    )}
                </div>
            </div>
        </main>
      </div>
    );
};

// --- APP ROOT (Updated for Profile Views) ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('secuPlanViewMode') || 'dashboard');
  
  // States für Navigation
  const [initialDashboardTab, setInitialDashboardTab] = useState('dashboard');
  const [profileTargetId, setProfileTargetId] = useState(null); // NEU: Wen schauen wir an?

  const handleSetViewMode = (mode) => {
      setViewMode(mode);
      localStorage.setItem('secuPlanViewMode', mode);
  };

  const goBackToDashboard = (targetTab = 'dashboard') => {
      setInitialDashboardTab(targetTab);
      handleSetViewMode('dashboard');
  };

  // NEU: Funktion um ein Profil zu öffnen (wird an alle Dashboards weitergegeben)
  const handleViewProfile = (userId) => {
      setProfileTargetId(userId);
      handleSetViewMode('user_profile');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
             const data = userDoc.data();
             // (Einladungs-Logik hier gekürzt, bleibt gleich wie vorher...)
             if (data.type === 'employee' && data.companyId) {
                 const empDoc = await getDoc(doc(db, "companies", data.companyId, "employees", currentUser.uid));
                 if (empDoc.exists()) { setUser({ uid: currentUser.uid, email: currentUser.email, ...data, ...empDoc.data() }); } 
                 else { setUser({ uid: currentUser.uid, email: currentUser.email, ...data }); }
             } else {
                 setUser({ uid: currentUser.uid, email: currentUser.email, ...data });
             }
        } else {
            // Check if Provider (Company)
            const compDoc = await getDoc(doc(db, "companies", currentUser.uid));
            if (compDoc.exists()) { setUser({ uid: currentUser.uid, email: currentUser.email, type: 'provider', ...compDoc.data() }); }
        }
      } else { setUser(null); handleSetViewMode('dashboard'); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600 h-12 w-12"/></div>;
  
  // NEU: Globaler View für Profile
  if (viewMode === 'user_profile' && profileTargetId) {
      return <UserProfileView targetUserId={profileTargetId} onBack={() => handleSetViewMode('dashboard')} />;
  }

  if (!user) return <AuthScreen onLogin={setUser} />;
  
  // WICHTIG: onViewProfile prop wird an alle Dashboards übergeben!
  if (user.type === 'employee') {
      if (viewMode === 'market') return <ClientDashboard onLogout={() => signOut(auth)} onBackToDashboard={goBackToDashboard} isProviderView={true} onViewProfile={handleViewProfile} />;
      if (viewMode === 'company_profile') return <ClientDashboard onLogout={() => signOut(auth)} onBackToDashboard={goBackToDashboard} fixedFirmId={user.companyId} onViewProfile={handleViewProfile} />;
      return <EmployeeDashboard user={user} onLogout={() => signOut(auth)} onViewProfile={handleViewProfile} />;
  }

  if (user.type === 'provider') {
      if (viewMode === 'market') return <ClientDashboard onLogout={() => signOut(auth)} onBackToDashboard={goBackToDashboard} isProviderView={true} onViewProfile={handleViewProfile} />;
      return <ProviderDashboard user={user} onLogout={() => signOut(auth)} onSwitchToMarket={() => handleSetViewMode('market')} initialTab={initialDashboardTab} onViewProfile={handleViewProfile} />;
  }
  
  // Kunde
  return <ClientDashboard onLogout={() => signOut(auth)} isProviderView={false} onViewProfile={handleViewProfile} />;
}