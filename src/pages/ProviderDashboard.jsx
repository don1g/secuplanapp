import React, { useState, useEffect } from 'react';
import { LayoutDashboard, CalendarDays, Users, Mail, Plus, MapPin, CheckCircle2, FileText, Settings, Upload, Loader2, X } from 'lucide-react'; // X hinzugefügt
import { collection, getDocs, getDoc, setDoc, doc, addDoc, updateDoc, query, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { EMP_ROLES } from '../utils/constants';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { SchedulePlanner } from '../components/features/SchedulePlanner';
import { ChatSystem } from '../components/features/ChatSystem';
import { PostItem } from '../components/features/PostItem';
import { UserProfileView } from '../components/features/UserProfileView';

export const ProviderDashboard = ({ user, onLogout, initialTab = 'dashboard', onViewProfile }) => {
  const [tab, setTab] = useState(initialTab);
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState(null);
  
  // States für Bearbeitung & Bild
  const [isEditing, setIsEditing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false); // NEU
  
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [imageUpload, setImageUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [requests, setRequests] = useState([]);
  
  const [internalProfileId, setInternalProfileId] = useState(null);

  useEffect(() => {
    const unsubComp = onSnapshot(doc(db, "companies", user.uid), (doc) => { setData(doc.data()); });
    const unsubEmp = onSnapshot(collection(db, "companies", user.uid, "employees"), (snap) => {
        setEmployees(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });
    const qPosts = query(collection(db, "companies", user.uid, "posts"));
    const unsubPosts = onSnapshot(qPosts, (snap) => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt - a.createdAt));
    });
    const unsubReq = onSnapshot(collection(db, "companies", user.uid, "requests"), (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubComp(); unsubEmp(); unsubPosts(); unsubReq(); };
  }, [user]);

  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const handleViewProfile = (id) => {
      if (onViewProfile) {
          onViewProfile(id);
      } else {
          setInternalProfileId(id);
      }
  };

  const handleCreatePost = async (e) => { 
      e.preventDefault(); if(!newPostContent.trim()) return; 
      await addDoc(collection(db, "companies", user.uid, "posts"), { 
          content: newPostContent, createdAt: new Date().toISOString(), likes: [], authorInitial: data.name.charAt(0) 
      }); 
      setNewPostContent(''); 
  };

  const handleSaveProfile = async () => { 
      setUploading(true); let url = data.imageUrl; 
      if (imageUpload) { 
          const imageRef = ref(storage, `logos/${user.uid}`); await uploadBytes(imageRef, imageUpload); 
          url = await getDownloadURL(imageRef); 
      } 
      await setDoc(doc(db, "companies", user.uid), { ...data, imageUrl: url }, { merge: true }); 
      setImageUpload(null); setUploading(false); setIsEditing(false); 
  };

  const handleInvite = async () => {
    const email = prompt("E-Mail des neuen Mitarbeiters:"); if(!email) return;
    await addDoc(collection(db, "global_invites"), { 
        email, companyId: user.uid, companyName: data?.name || "Firma", role: 'worker', invitedAt: new Date().toISOString()
    });
    alert(`Einladung an ${email} gesendet!`);
  };

  const handleRequestAction = async (reqId, newStatus) => {
      if (!confirm(`Antrag wirklich ${newStatus}?`)) return;
      await updateDoc(doc(db, "companies", user.uid, "requests", reqId), { status: newStatus });
  };

  const menu = [
    { id: 'dashboard', name: 'Mein Profil', icon: <LayoutDashboard size={20}/> },
    { id: 'schedule', name: 'Dienstplan', icon: <CalendarDays size={20}/> },
    { id: 'staff', name: 'Personal', icon: <Users size={20}/> },
    { id: 'req_manage', name: 'Anträge', icon: <CheckCircle2 size={20}/> },
    { id: 'messages', name: 'Nachrichten', icon: <Mail size={20}/> }
  ];

  if (!data) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  if (internalProfileId) {
      return (
          <DashboardLayout title="Mitarbeiter Profil" user={{...user, ...data}} sidebarItems={menu} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
              <UserProfileView targetUserId={internalProfileId} onBack={() => setInternalProfileId(null)} />
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout title="Firmen Verwaltung" user={{...user, ...data}} sidebarItems={menu} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
      
      {tab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in">
            {/* Banner */}
            <div className={`bg-white rounded-2xl shadow-xl border overflow-hidden relative group ${isEditing ? 'ring-2 ring-blue-500' : 'border-slate-200'}`}>
                <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-400 relative">
                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                        {isEditing ? (
                            <>
                                <Button size="sm" variant="outline" onClick={() => {setIsEditing(false); setImageUpload(null);}}>Abbrechen</Button>
                                <Button size="sm" variant="success" onClick={handleSaveProfile} disabled={uploading}>{uploading ? 'Lädt...' : 'Speichern'}</Button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditing(true)} className="bg-white/20 backdrop-blur text-white border border-white/40 hover:bg-white hover:text-blue-600 font-bold px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 shadow-sm"><Settings size={16}/> Bearbeiten</button>
                        )}
                    </div>
                </div>
                
                {/* Logo Area */}
                <div className="relative px-8 pb-8">
                    <div className="absolute -top-12 left-8 p-1 bg-white rounded-2xl shadow-md border border-slate-200 group/logo">
                        {/* HIER GEÄNDERT: Bild in Container gepackt für Klick-Logik */}
                        <div className="h-24 w-24 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center relative">
                            <div 
                                onClick={() => !isEditing && setShowImageModal(true)} 
                                className={`w-full h-full ${!isEditing ? 'cursor-zoom-in' : ''}`}
                            >
                                {imageUpload ? <img src={URL.createObjectURL(imageUpload)} className="h-full w-full object-cover opacity-50"/> : <Avatar src={data.imageUrl} alt={data.name} size="full" className="w-full h-full rounded-none"/>}
                            </div>
                            
                            {/* Upload Button nur wenn isEditing */}
                            {isEditing && (
                                <label className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer text-white animate-in fade-in">
                                    <Upload size={24}/>
                                    <input type="file" className="hidden" onChange={(e) => setImageUpload(e.target.files[0])} />
                                </label>
                            )}
                        </div>
                    </div>
                    
                    <div className="pt-16 flex flex-col md:flex-row justify-between items-start gap-4">
                        <div className="flex-1 w-full">
                            {isEditing ? <input type="text" value={data.name} onChange={(e) => setData({...data, name: e.target.value})} className="text-3xl font-bold text-slate-900 mb-1 w-full border-b-2 border-blue-500 outline-none" placeholder="Firmenname" /> : <h1 className="text-3xl font-bold text-slate-900 mb-1">{data.name}</h1>}
                            <div className="flex flex-wrap gap-4 text-sm text-slate-500 mt-2 items-center">
                                <div className="flex items-center gap-1"><MapPin size={16}/> {isEditing ? <input value={data.address} onChange={(e) => setData({...data, address: e.target.value})} className="border-b border-blue-300 outline-none" placeholder="Adresse"/> : (data.address || "Keine Adresse")}</div>
                                <div className="flex items-center gap-1"><Users size={16}/> {employees.length} Mitarbeiter</div>
                                <div className="flex items-center gap-1"><Mail size={16}/> {isEditing ? <input value={data.publicEmail} onChange={(e) => setData({...data, publicEmail: e.target.value})} className="border-b border-blue-300 outline-none" placeholder="E-Mail"/> : (data.publicEmail || user.email)}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600">
                                {isEditing ? <input type="number" value={data.price} onChange={(e) => setData({...data, price: e.target.value})} className="w-20 text-right border-b border-blue-300 outline-none"/> : data.price}€ <span className="text-sm text-slate-500 font-normal">/ Std.</span>
                            </div>
                            <div className={`inline-block mt-1 ${data.isVisible ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'} border text-xs font-bold px-3 py-1 rounded-full`}>
                                {data.isVisible ? 'Öffentlich sichtbar' : 'Versteckt'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <Card className="p-6">
                        <h3 className="font-bold text-lg text-slate-900 mb-4 border-b border-slate-200 pb-2">Über uns</h3>
                        {isEditing ? <textarea value={data.description} onChange={(e) => setData({...data, description: e.target.value})} className="w-full h-32 p-3 bg-slate-50 rounded-xl outline-none border focus:border-blue-500" placeholder="Beschreibung"/> : <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{data.description || "Keine Beschreibung hinterlegt."}</p>}
                    </Card>
                    <Card className="p-6">
                        <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2"><FileText size={20} className="text-blue-600"/> Neuigkeiten</h3>
                        {!isEditing && (
                            <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <textarea className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500 outline-none resize-none" rows="2" placeholder="Was gibt es Neues?" value={newPostContent} onChange={e => setNewPostContent(e.target.value)} />
                                <div className="flex justify-end mt-2"><Button size="sm" onClick={handleCreatePost}>Posten</Button></div>
                            </div>
                        )}
                        <div className="space-y-4">{posts.length === 0 ? <div className="text-slate-500 text-sm italic text-center">Keine Beiträge.</div> : posts.map(post => <PostItem key={post.id} post={post} companyId={user.uid} currentUserId={user.uid} />)}</div>
                    </Card>
                </div>
                <div className="space-y-6">
                    <Card className="p-6">
                        <h3 className="font-bold text-sm text-slate-500 uppercase mb-4">Statistik</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between"><span className="flex gap-2 items-center text-slate-700"><Users size={16}/> Mitarbeiter</span> <span className="font-bold">{employees.length}</span></div>
                            <div className="flex justify-between"><span className="flex gap-2 items-center text-slate-700"><FileText size={16}/> Beiträge</span> <span className="font-bold">{posts.length}</span></div>
                            <div className="pt-4 border-t mt-4">
                                {isEditing && <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={data.isVisible} onChange={e => setData({...data, isVisible: e.target.checked})}/> Profil öffentlich sichtbar machen</label>}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
      )}

      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="flex justify-end"><Button onClick={handleInvite} icon={Plus}>Mitarbeiter einladen</Button></div>
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold"><tr><th className="p-4">Name</th><th className="p-4">Rolle</th><th className="p-4">Status</th><th className="p-4 text-right">Aktion</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                        <td className="p-4 font-bold text-slate-700 cursor-pointer hover:text-blue-600" onClick={() => handleViewProfile(e.id)}>{e.name} <div className="text-xs font-normal text-slate-400">{e.email}</div></td>
                        <td className="p-4"><Badge color="blue">{EMP_ROLES[e.role]?.label || e.role}</Badge></td>
                        <td className="p-4"><Badge color="green">Aktiv</Badge></td>
                        <td className="p-4 text-right"><Button variant="ghost" size="sm" onClick={() => handleViewProfile(e.id)}>Profil</Button></td>
                    </tr>
                ))}
              </tbody>
            </table>
            {employees.length === 0 && <div className="p-8 text-center text-slate-400">Noch keine Mitarbeiter.</div>}
          </Card>
        </div>
      )}

      {tab === 'req_manage' && (
          <div className="space-y-4">
              <h3 className="font-bold text-lg text-slate-800">Offene Anträge prüfen</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {requests.filter(r => r.status === 'Offen').length === 0 ? <div className="col-span-full p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-xl">Keine offenen Anträge.</div> : 
                  requests.filter(r => r.status === 'Offen').map(req => (
                      <div key={req.id} className="bg-white p-5 rounded-xl border border-l-4 border-l-orange-400 border-slate-200 shadow-sm">
                          <div className="flex justify-between items-start mb-2"><span className="font-bold text-slate-800">{req.employeeName}</span><span className="text-xs text-slate-400">{new Date(req.date).toLocaleDateString()}</span></div>
                          <div className="text-sm font-medium text-slate-600 mb-4">möchte <span className="text-slate-900 font-bold">{req.type}</span>{req.reason && <p className="mt-1 text-slate-500 italic">"{req.reason}"</p>}</div>
                          <div className="flex gap-2">
                              <button onClick={() => handleRequestAction(req.id, 'Genehmigt')} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><CheckCircle2 size={16}/> Ja</button>
                              <button onClick={() => handleRequestAction(req.id, 'Abgelehnt')} className="flex-1 bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-600 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1">Nein</button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Scheduler */}
      {tab === 'schedule' && (
        <div className="h-[calc(100vh-140px)]">
            <SchedulePlanner 
                employees={employees} 
                companyId={user.uid} 
                currentUser={user} 
                onViewProfile={handleViewProfile} 
            />
        </div>
      )}

      {tab === 'messages' && <div className="h-[calc(100vh-140px)]"><ChatSystem user={user} userRole="provider" isEmbedded={true} /></div>}

      {/* NEU: BILD MODAL (Lightbox) */}
      {showImageModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-in fade-in" onClick={() => setShowImageModal(false)}>
            <div className="relative max-w-4xl w-full h-full flex items-center justify-center">
                <button className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full backdrop-blur-sm" onClick={() => setShowImageModal(false)}>
                    <X size={24} />
                </button>
                <img src={data.imageUrl} alt={data.name} className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
            </div>
        </div>
      )}

    </DashboardLayout>
  );
};