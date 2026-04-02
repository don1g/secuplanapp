import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, CalendarDays, Users, Mail, Plus, MapPin, 
  CheckCircle2, FileText, Settings, Upload, Loader2, X, 
  Trash2, LayoutGrid, Search, Filter, ArrowLeft, Phone, Globe, Ban 
} from 'lucide-react';
import { 
  collection, doc, addDoc, updateDoc, query, onSnapshot, 
  deleteField, where, setDoc, getDocs, increment 
} from 'firebase/firestore';
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
  const [isEditing, setIsEditing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [imageUpload, setImageUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [internalProfileId, setInternalProfileId] = useState(null);

  // Marktplatz States (Wichtig für die Funktion aus GitHub)
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [firmPosts, setFirmPosts] = useState([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!user?.uid) return;

    // 1. Echtzeit-Daten der EIGENEN Firma [aus GitHub Logik]
    const unsubComp = onSnapshot(doc(db, "companies", user.uid), (docSnap) => { 
        if (docSnap.exists()) {
            setData({ 
                address: "", phone: "", publicEmail: "", isVisible: false, showPrice: true,
                ...docSnap.data() 
            }); 
        }
    });

    // 2. Mitarbeiter Liste
    const unsubEmp = onSnapshot(collection(db, "companies", user.uid, "employees"), (snap) => {
        setEmployees(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });

    // 3. Eigene Posts laden
    const unsubPosts = onSnapshot(query(collection(db, "companies", user.uid, "posts")), (snap) => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt - a.createdAt));
    });

    // 4. Anträge (Requests) laden
    const unsubReq = onSnapshot(collection(db, "companies", user.uid, "requests"), (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 5. Marktplatz Firmen laden [Funktion aus GitHub]
    const loadMarketplace = async () => {
        setMarketLoading(true);
        const q = query(collection(db, "companies"), where("isVisible", "==", true));
        const snap = await getDocs(q);
        setFirms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setMarketLoading(false);
    };
    loadMarketplace();

    return () => { unsubComp(); unsubEmp(); unsubPosts(); unsubReq(); };
  }, [user.uid]);

  // Effekt für Marktplatz-Details
  useEffect(() => {
    if (selectedFirm) {
        const loadFirmContent = async () => {
            const q = query(collection(db, "companies", selectedFirm.id, "posts"));
            const snap = await getDocs(q);
            setFirmPosts(snap.docs.map(d => ({id: d.id, ...d.data()})));
        };
        loadFirmContent();
    }
  }, [selectedFirm]);

  useEffect(() => { setTab(initialTab); }, [initialTab]);

  // Handlers
  const handleViewProfile = (id) => {
      if (onViewProfile) onViewProfile(id);
      else setInternalProfileId(id);
  };

  const handleCreatePost = async (e) => { 
      e.preventDefault(); if(!newPostContent.trim()) return; 
      await addDoc(collection(db, "companies", user.uid, "posts"), { 
          content: newPostContent, createdAt: new Date().toISOString(), likes: [], authorInitial: data.name.charAt(0) 
      }); 
      setNewPostContent(''); 
  };

  const handleSaveProfile = async () => { 
      setUploading(true); 
      let url = data.imageUrl; 
      if (imageUpload) { 
          const imageRef = ref(storage, `logos/${user.uid}`); 
          await uploadBytes(imageRef, imageUpload); 
          url = await getDownloadURL(imageRef); 
      } 
      await setDoc(doc(db, "companies", user.uid), { ...data, imageUrl: url }, { merge: true }); 
      setImageUpload(null); setIsEditing(false); setUploading(false);
  };

  const handleDeleteImage = async (e) => {
    e.stopPropagation();
    if (!confirm("Firmenlogo wirklich löschen?")) return;
    setUploading(true);
    try {
        await updateDoc(doc(db, "companies", user.uid), { imageUrl: deleteField() });
        setData(prev => ({ ...prev, imageUrl: null }));
    } catch(err) { console.error(err); }
    setUploading(false);
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
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20}/> },
    { id: 'marketplace', name: 'Marktplatz', icon: <Globe size={20}/> },
    { id: 'schedule', name: 'Dienstplan', icon: <CalendarDays size={20}/> },
    { id: 'staff', name: 'Personal', icon: <Users size={20}/> },
    { id: 'req_manage', name: 'Anträge', icon: <CheckCircle2 size={20}/> },
    { id: 'messages', name: 'Nachrichten', icon: <Mail size={20}/> }
  ];

  if (!data) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-12 h-12"/></div>;

  if (internalProfileId) {
      return (
          <DashboardLayout title="Profil" user={{...user, ...data}} sidebarItems={menu} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
              <UserProfileView targetUserId={internalProfileId} onBack={() => setInternalProfileId(null)} />
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout title="Verwaltung" user={{...user, ...data}} sidebarItems={menu} activeTab={tab} onTabChange={(t) => {setTab(t); setSelectedFirm(null);}} onLogout={onLogout}>
      
      {/* TAB: DASHBOARD (Design nach Screenshot 203605.png) */}
      {tab === 'dashboard' && (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
                <div className="h-56 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-500 relative">
                    <div className="absolute top-8 right-10 z-10 flex gap-4">
                        {isEditing ? (
                            <>
                                <button className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-2.5 rounded-2xl font-bold hover:bg-white/20 transition-all uppercase text-[10px] tracking-widest" onClick={() => setIsEditing(false)}>Abbrechen</button>
                                <Button variant="success" className="shadow-2xl shadow-green-200" onClick={handleSaveProfile}>{uploading ? 'Lädt...' : 'Profil speichern'}</Button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditing(true)} className="bg-white/20 backdrop-blur-xl text-white border border-white/30 hover:bg-white hover:text-blue-600 font-black px-8 py-4 rounded-[1.5rem] text-xs transition-all flex items-center gap-3 uppercase tracking-[0.15em] shadow-2xl">
                                <Settings size={18}/> Profil bearbeiten
                            </button>
                        )}
                    </div>
                </div>
                <div className="px-12 pb-12">
                    <div className="relative flex flex-col md:flex-row items-end gap-10 -mt-24">
                        <div className="relative group">
                            <div onClick={() => !isEditing && setShowImageModal(true)} className={`h-48 w-48 rounded-[3rem] overflow-hidden bg-white p-2 shadow-2xl border border-slate-50 transition-all duration-500 ${!isEditing ? 'cursor-zoom-in hover:scale-105' : ''}`}>
                                <Avatar src={data.imageUrl} alt={data.name} size="full" className="rounded-[2.6rem]" />
                            </div>
                            {isEditing && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-[3rem] gap-6 text-white animate-in fade-in">
                                    <label className="cursor-pointer hover:text-blue-300 transition-transform hover:scale-125"><Upload size={32}/><input type="file" className="hidden" onChange={(e) => setImageUpload(e.target.files[0])} /></label>
                                    {data.imageUrl && <button onClick={handleDeleteImage} className="hover:text-red-400 transition-transform hover:scale-125"><Trash2 size={32}/></button>}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 pb-4">
                            {isEditing ? (
                                <input type="text" value={data.name} onChange={(e) => setData({...data, name: e.target.value})} className="text-5xl font-black text-slate-900 mb-4 w-full bg-slate-50 rounded-2xl px-6 py-3 border-none focus:ring-4 focus:ring-blue-100 outline-none transition-all" />
                            ) : (
                                <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-4">{data.name}</h1>
                            )}
                            <div className="flex flex-wrap gap-4">
                                <div className="flex items-center gap-2 bg-slate-50 text-slate-500 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest border border-slate-100"><MapPin size={16} className="text-blue-500"/> {data.address || "Standort fehlt"}</div>
                                <div className="flex items-center gap-2 bg-slate-50 text-slate-500 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest border border-slate-100"><Users size={16} className="text-blue-500"/> {employees.length} Teammitglieder</div>
                                <div className="flex items-center gap-2 bg-slate-50 text-slate-500 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest border border-slate-100"><Badge color={data.isVisible ? 'green' : 'red'} className="rounded-xl px-4">{data.isVisible ? 'Aktiv' : 'Inaktiv'}</Badge></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-10">
                    <Card className="p-10 rounded-[2.5rem] border-slate-100 shadow-2xl">
                        <h3 className="font-black text-2xl text-slate-900 uppercase tracking-tight mb-8">Unternehmensprofil</h3>
                        {isEditing ? (
                            <textarea value={data.description} onChange={(e) => setData({...data, description: e.target.value})} className="w-full h-64 p-8 bg-slate-50 rounded-[2rem] border-none focus:ring-4 focus:ring-blue-50 outline-none text-slate-700 leading-relaxed font-medium transition-all" />
                        ) : (
                            <p className="text-slate-600 leading-loose font-medium text-lg whitespace-pre-wrap">{data.description || "Beschreiben Sie Ihr Unternehmen..."}</p>
                        )}
                    </Card>
                    <Card className="p-10 rounded-[2.5rem] border-slate-100 shadow-2xl">
                        <h3 className="font-black text-2xl text-slate-900 uppercase tracking-tight mb-10 flex items-center gap-4">Newsfeed</h3>
                        {!isEditing && (
                            <div className="mb-10 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner">
                                <textarea className="w-full bg-white rounded-3xl p-6 text-base font-medium border-none shadow-sm outline-none focus:ring-4 focus:ring-blue-100 transition-all resize-none" rows="3" placeholder="Was gibt es Neues?" value={newPostContent} onChange={e => setNewPostContent(e.target.value)} />
                                <div className="flex justify-end mt-6"><Button className="rounded-2xl px-12 py-4 shadow-2xl shadow-blue-100 font-black uppercase tracking-widest text-xs" onClick={handleCreatePost}>Veröffentlichen</Button></div>
                            </div>
                        )}
                        <div className="space-y-8">{posts.map(post => <PostItem key={post.id} post={post} companyId={user.uid} currentUserId={user.uid} />)}</div>
                    </Card>
                </div>
                <div className="space-y-10">
                    <Card className="p-10 rounded-[2.5rem] border-slate-100 shadow-2xl bg-slate-900 text-white">
                        <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-8">Konditionen</h3>
                        <div className="space-y-6">
                            <div className="bg-white/5 p-6 rounded-[1.5rem] border border-white/10">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Stundensatz</div>
                                <div className="text-4xl font-black text-blue-400">{data.price}€</div>
                            </div>
                            {isEditing && (
                                <div className="pt-6 border-t border-white/10">
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">Sichtbarkeit</span>
                                        <div className={`w-14 h-7 rounded-full transition-all relative p-1 ${data.isVisible ? 'bg-green-500' : 'bg-slate-700'}`}>
                                            <div className={`w-5 h-5 bg-white rounded-full transition-all duration-300 transform ${data.isVisible ? 'translate-x-7' : 'translate-x-0'}`}></div>
                                        </div>
                                        <input type="checkbox" className="hidden" checked={data.isVisible} onChange={e => setData({...data, isVisible: e.target.checked})}/>
                                    </label>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
      )}

      {/* TAB: PERSONAL (Logik aus GitHub + Screenshot Design) */}
      {tab === 'staff' && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
                  <div>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight">Personalstamm</h3>
                      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Verwalten Sie Ihr Team und Rollen.</p>
                  </div>
                  <Button className="rounded-2xl px-10 py-5 shadow-2xl shadow-blue-100 bg-blue-600 hover:bg-blue-700 transition-all font-black uppercase tracking-widest text-[10px]" onClick={handleInvite} icon={Plus}>Personal einladen</Button>
              </div>
              <Card className="rounded-[2.5rem] overflow-hidden border-slate-100 shadow-2xl bg-white">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50/50 text-slate-400 font-black uppercase tracking-[0.25em] text-[10px] border-b border-slate-100">
                          <tr><th className="px-10 py-8">Mitarbeiter</th><th className="px-10 py-8">Position</th><th className="px-10 py-8">Status</th><th className="px-10 py-8 text-right"></th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {employees.map(e => (
                              <tr key={e.id} className="group hover:bg-slate-50/30 transition-all">
                                  <td className="px-10 py-8">
                                      <div className="flex items-center gap-5">
                                          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center font-black text-blue-600 shadow-sm transition-all group-hover:scale-110">
                                              {e.name.charAt(0)}
                                          </div>
                                          <div>
                                              <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors text-base">{e.name}</div>
                                              <div className="text-[11px] font-bold text-slate-400 lowercase tracking-tighter">{e.email}</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-10 py-8"><Badge color="blue" className="px-5 py-1.5 uppercase text-[9px] font-black rounded-xl">{EMP_ROLES[e.role]?.label || e.role}</Badge></td>
                                  <td className="px-10 py-8"><div className="flex items-center gap-3 text-green-500 font-black text-[10px] uppercase tracking-widest"><div className="h-2.5 w-2.5 bg-green-500 rounded-full shadow-[0_0_12px_rgba(34,197,94,0.6)]"></div> Aktiv</div></td>
                                  <td className="px-10 py-8 text-right"><button onClick={() => handleViewProfile(e.id)} className="bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-sm">Profil öffnen</button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </Card>
          </div>
      )}

      {/* TAB: DIENSTPLAN [Einbindung mit onViewProfile Fix] */}
      {tab === 'schedule' && (
          <div className="h-[calc(100vh-140px)] animate-in fade-in">
              <SchedulePlanner 
                employees={employees} 
                companyId={user.uid} 
                currentUser={user} 
                onViewProfile={handleViewProfile} 
              />
          </div>
      )}

      {/* TAB: ANTRÄGE (Logik nach GitHub) */}
      {tab === 'req_manage' && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-8">Personal Anträge</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {requests.filter(r => r.status === 'Offen').map(req => (
                      <div key={req.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col justify-between">
                          <div className="mb-6">
                              <div className="flex justify-between items-start mb-4"><span className="font-black text-slate-900 text-lg leading-tight">{req.employeeName}</span><span className="text-[10px] font-black text-slate-400 uppercase">{new Date(req.date).toLocaleDateString()}</span></div>
                              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><div className="text-[10px] font-black text-slate-400 uppercase mb-1">Anliegen</div><div className="font-bold text-slate-800">{req.type}</div></div>
                          </div>
                          <div className="flex gap-3">
                              <button onClick={() => handleRequestAction(req.id, 'Genehmigt')} className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-green-100 hover:bg-green-700 transition-all">Annehmen</button>
                              <button onClick={() => handleRequestAction(req.id, 'Abgelehnt')} className="flex-1 bg-red-50 text-red-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all">Ablehnen</button>
                          </div>
                      </div>
                  ))}
                  {requests.filter(r => r.status === 'Offen').length === 0 && <div className="col-span-full p-20 text-center text-slate-400 font-bold italic bg-white rounded-[2.5rem] border border-slate-100 shadow-xl">Keine offenen Anträge vorhanden.</div>}
              </div>
          </div>
      )}

      {/* TAB: NACHRICHTEN [Einbindung nach Screenshot Design] */}
      {tab === 'messages' && (
          <div className="h-[calc(100vh-140px)] animate-in fade-in">
              <ChatSystem user={user} userRole="provider" isEmbedded={true} />
          </div>
      )}

      {/* LIGHTBOX (Vollbild-Logo) */}
      {showImageModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-10 animate-in fade-in" onClick={() => setShowImageModal(false)}>
            <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
                <button className="absolute -top-16 right-0 text-white/40 hover:text-white transition-all" onClick={() => setShowImageModal(false)}><X size={48} /></button>
                <img src={data.imageUrl} className="max-w-full max-h-full object-contain rounded-[3rem] shadow-2xl animate-in zoom-in-95" alt="Logo" />
            </div>
        </div>
      )}
    </DashboardLayout>
  );
};