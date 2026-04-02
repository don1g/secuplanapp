import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, CalendarDays, Users, Mail, Plus, MapPin, 
  CheckCircle2, FileText, Settings, Upload, Loader2, X, 
  Trash2, Search, Filter, ArrowLeft, Phone, Globe, Ban,
  IdCard, Baby, Award, Car, Shirt, Clock, Shield, CheckCircle
} from 'lucide-react';
import { 
  collection, doc, addDoc, updateDoc, query, onSnapshot, 
  where, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { SchedulePlanner } from '../components/features/SchedulePlanner';
import { RosterScheduler } from '../components/features/RosterScheduler'; 
import { ChatSystem } from '../components/features/ChatSystem';
import { PostItem } from '../components/features/PostItem';

export const ProviderDashboard = ({ user, onLogout, initialTab = 'dashboard' }) => {
  const [tab, setTab] = useState(initialTab);
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState(null);
  const [internalProfileId, setInternalProfileId] = useState(null);
  const [detailTab, setDetailTab] = useState('profile'); 
  const [isEditing, setIsEditing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [imageUpload, setImageUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [requests, setRequests] = useState([]);
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // --- ECHTZEIT-DATEN LADEN ---
  useEffect(() => {
    if (!user?.uid) return;

    // Firmen-Stammdaten
    const unsubComp = onSnapshot(doc(db, "companies", user.uid), (docSnap) => { 
        if (docSnap.exists()) setData({ name: "Firma", isVisible: false, price: "45", ...docSnap.data() }); 
    });

    // Alle Mitarbeiter dieser Firma
    const unsubEmp = onSnapshot(collection(db, "companies", user.uid, "employees"), (snap) => {
        setEmployees(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });

    // Newsfeed
    const unsubPosts = onSnapshot(query(collection(db, "companies", user.uid, "posts")), (snap) => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt - a.createdAt));
    });

    // Urlaubsanträge
    const unsubReq = onSnapshot(collection(db, "companies", user.uid, "requests"), (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Marktplatz (Andere Firmen)
    const unsubMarket = onSnapshot(query(collection(db, "companies"), where("isVisible", "==", true)), (snap) => {
        setFirms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubComp(); unsubEmp(); unsubPosts(); unsubReq(); unsubMarket(); };
  }, [user.uid]);

  const handleTabChange = (newTab) => {
      setTab(newTab);
      setInternalProfileId(null);
      setSelectedFirm(null);
  };

  const handleSaveProfile = async () => { 
      setUploading(true); 
      try {
          let url = data?.imageUrl || null; 
          if (imageUpload) { 
              const imageRef = ref(storage, `logos/${user.uid}`); 
              await uploadBytes(imageRef, imageUpload); 
              url = await getDownloadURL(imageRef); 
          } 
          const batch = writeBatch(db);
          batch.set(doc(db, "companies", user.uid), { ...data, imageUrl: url }, { merge: true });
          batch.update(doc(db, "users", user.uid), { name: data?.name, imageUrl: url });
          await batch.commit();
          setIsEditing(false);
          setImageUpload(null);
      } catch (e) { console.error(e); }
      setUploading(false);
  };

  const handleCreatePost = async () => { 
      if(!newPostContent.trim()) return; 
      await addDoc(collection(db, "companies", user.uid, "posts"), { 
          content: newPostContent, createdAt: new Date().toISOString(), likes: [], authorInitial: data?.name?.charAt(0) || "F" 
      }); 
      setNewPostContent(''); 
  };

  // Ladebildschirm während die Daten kommen
  if (!data) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600 w-10 h-10"/></div>;

  // Der aktuell zur Ansicht ausgewählte Mitarbeiter
  const activeEmployee = employees.find(e => e.id === internalProfileId);

  const menu = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20}/> },
    { id: 'marketplace', name: 'Marktplatz', icon: <Globe size={20}/> },
    { id: 'schedule', name: 'Dienstplan', icon: <CalendarDays size={20}/> },
    { id: 'staff', name: 'Personal', icon: <Users size={20}/> },
    { id: 'req_manage', name: 'Anträge', icon: <CheckCircle2 size={20}/> },
    { id: 'messages', name: 'Nachrichten', icon: <Mail size={20}/> }
  ];

  return (
    <DashboardLayout title="Verwaltung" user={{...user, ...data}} sidebarItems={menu} activeTab={tab} onTabChange={handleTabChange} onLogout={onLogout}>
      
      {/* --- FALL: MITARBEITER-AKTE GEÖFFNET --- */}
      {internalProfileId ? (
          <div className="max-w-5xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500 text-slate-900">
              {/* BACK-BUTTON */}
              <button 
                onClick={() => setInternalProfileId(null)} 
                className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors font-black uppercase text-[10px] tracking-[0.2em] mb-4 bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100"
              >
                <ArrowLeft size={14}/> Zurück zur Liste
              </button>

              {activeEmployee ? (
                <>
                  {/* PROFIL HEADER (ZENTRIERT) */}
                  <Card className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10 flex flex-col items-center text-center">
                      <div className="h-32 w-32 rounded-[2.5rem] overflow-hidden bg-slate-50 border-4 border-white shadow-2xl mb-6">
                          <Avatar src={activeEmployee?.imageUrl} alt={activeEmployee?.name} size="full" />
                      </div>
                      <div className="space-y-4 w-full max-w-md">
                          <h2 className="text-3xl font-black tracking-tight uppercase leading-none">{activeEmployee?.name}</h2>
                          <div className="flex flex-col items-center gap-3">
                              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-8 py-3 rounded-2xl border border-blue-100 shadow-sm">
                                  <IdCard size={18} className="text-blue-600"/>
                                  <span className="text-xs font-black uppercase tracking-[0.1em]">Bewacher ID: {activeEmployee?.bewacherId || 'FEHLT'}</span>
                              </div>
                              <Badge color="slate" className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest bg-slate-100 border-none">
                                  {activeEmployee?.role === 'team_lead' ? 'Einsatzleiter' : 'Mitarbeiter'}
                              </Badge>
                          </div>
                      </div>
                  </Card>

                  {/* TAB SWITCHER */}
                  <div className="flex bg-slate-200/50 p-1 rounded-2xl w-fit mx-auto shadow-inner border border-slate-100">
                      <button onClick={() => setDetailTab('profile')} className={`flex items-center gap-2 px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${detailTab === 'profile' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>
                        <User size={14}/> Stammdaten
                      </button>
                      <button onClick={() => setDetailTab('roster')} className={`flex items-center gap-2 px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${detailTab === 'roster' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>
                        <CalendarDays size={14}/> Dienstplan
                      </button>
                  </div>

                  {/* INHALT: STAMMDATEN ODER DIENSTPLAN */}
                  {detailTab === 'profile' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                        <Card className="p-8 rounded-[2.5rem] shadow-lg bg-white border-slate-50 space-y-6">
                            <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-blue-600 flex items-center gap-2 mb-2"><User size={16}/> Persönlich</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                                    <div className="p-3 bg-white rounded-xl shadow-sm text-blue-600"><Baby size={18}/></div>
                                    <div><div className="text-[9px] font-black text-slate-400 uppercase">Geburtsdatum</div><div className="text-sm font-bold text-slate-900">{activeEmployee?.birthDate || '---'}</div></div>
                                </div>
                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                                    <div className="p-3 bg-white rounded-xl shadow-sm text-blue-600"><Car size={18}/></div>
                                    <div><div className="text-[9px] font-black text-slate-400 uppercase">Führerschein</div><div className="text-sm font-bold text-slate-900">{activeEmployee?.hasLicense || 'Nein'}</div></div>
                                </div>
                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                                    <div className="p-3 bg-white rounded-xl shadow-sm text-blue-600"><Phone size={18}/></div>
                                    <div><div className="text-[9px] font-black text-slate-400 uppercase">Kontakt</div><div className="text-sm font-bold text-slate-900">{activeEmployee?.phone || '---'}</div></div>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-8 rounded-[2.5rem] shadow-lg bg-white border-slate-50 space-y-6">
                            <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-blue-600 flex items-center gap-2 mb-2"><Award size={16}/> Fachlich</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                                    <div className="p-3 bg-white rounded-xl shadow-sm text-blue-600"><Shield size={18}/></div>
                                    <div><div className="text-[9px] font-black text-slate-400 uppercase">Qualifikation</div><div className="text-sm font-bold text-slate-900">{activeEmployee?.qualification || 'Sachkunde'}</div></div>
                                </div>
                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                                    <div className="p-3 bg-white rounded-xl shadow-sm text-blue-600"><Shirt size={18}/></div>
                                    <div><div className="text-[9px] font-black text-slate-400 uppercase">Größe</div><div className="text-sm font-bold text-slate-900">{activeEmployee?.shirtSize || 'L'}</div></div>
                                </div>
                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                                    <div className="p-3 bg-white rounded-xl shadow-sm text-blue-600"><MapPin size={18}/></div>
                                    <div><div className="text-[9px] font-black text-slate-400 uppercase">Anschrift</div><div className="text-sm font-bold text-slate-900 truncate">{activeEmployee?.address || '---'}</div></div>
                                </div>
                            </div>
                        </Card>
                    </div>
                  ) : (
                    <div className="animate-in zoom-in-95 duration-300 pb-20">
                        {/* WICHTIG: UID Mapping um White-Screen zu verhindern */}
                        <RosterScheduler user={{...activeEmployee, uid: activeEmployee.id}} companyId={user.uid} />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="animate-spin mb-4" />
                    <p className="font-bold uppercase text-xs tracking-widest">Daten werden geladen...</p>
                </div>
              )}
          </div>
      ) : (
          /* --- FALL: HAUPT DASHBOARD ANSICHT --- */
          <div className="max-w-6xl mx-auto space-y-6 pb-12 text-slate-900">
            
            {/* TAB: DASHBOARD (UNTERNEHMENSPROFIL) */}
            {tab === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in">
                    <Card className="bg-white rounded-[1.5rem] shadow-xl border border-slate-100 overflow-hidden">
                        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
                            {!isEditing && (
                                <button onClick={() => setIsEditing(true)} className="absolute top-4 right-6 bg-white/20 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/30 hover:bg-white hover:text-blue-600 transition-all font-bold text-xs shadow-xl tracking-widest uppercase">Bearbeiten</button>
                            )}
                        </div>
                        <div className="px-6 pb-6 -mt-10 flex flex-col md:flex-row items-end gap-6 text-slate-900">
                            <div className="relative group">
                                <div onClick={() => !isEditing && setShowImageModal(true)} className="h-28 w-28 rounded-[1.5rem] overflow-hidden bg-white p-1 shadow-xl border border-slate-100 cursor-zoom-in">
                                    <Avatar src={imageUpload ? URL.createObjectURL(imageUpload) : data?.imageUrl} alt={data?.name} size="full" className="rounded-[1.3rem]" />
                                </div>
                                {isEditing && (
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[1.5rem] cursor-pointer text-white animate-in fade-in">
                                        <Upload size={24}/>
                                        <input type="file" className="hidden" onChange={(e) => setImageUpload(e.target.files[0])} />
                                    </label>
                                )}
                            </div>
                            <div className="flex-1 pb-1">
                                {isEditing ? (
                                    <input value={data?.name} onChange={e => setData({...data, name: e.target.value})} className="text-2xl font-black bg-slate-50 rounded-xl px-3 py-1 w-full outline-none focus:ring-2 focus:ring-blue-500" />
                                ) : (
                                    <h1 className="text-2xl font-black tracking-tight uppercase">{data?.name}</h1>
                                )}
                                <div className="flex gap-4 mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                    <span className="flex items-center gap-1"><MapPin size={12} className="text-blue-500"/> {data?.address || "Adresse fehlt"}</span>
                                    <span className="flex items-center gap-1"><Users size={12} className="text-blue-500"/> {employees.length} MA</span>
                                </div>
                            </div>
                            {isEditing && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => {setIsEditing(false); setImageUpload(null);}}>Abbrechen</Button>
                                    <Button size="sm" onClick={handleSaveProfile} disabled={uploading}>Speichern</Button>
                                </div>
                            )}
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="p-6 rounded-[1.5rem] shadow-lg bg-white border-slate-50">
                                <h3 className="font-black text-sm uppercase tracking-widest mb-4 border-b border-slate-50 pb-2">Unternehmensprofil</h3>
                                {isEditing ? <textarea value={data?.description} onChange={e => setData({...data, description: e.target.value})} className="w-full h-32 p-4 bg-slate-50 rounded-xl outline-none text-sm leading-relaxed" /> : <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{data?.description || "Stellen Sie sich vor."}</p>}
                            </Card>
                            <Card className="p-6 rounded-[1.5rem] shadow-lg bg-white border-slate-50">
                                <h3 className="font-black text-sm uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">Newsfeed</h3>
                                {!isEditing && <form onSubmit={(e) => {e.preventDefault(); handleCreatePost();}} className="flex gap-2 mb-6"><input className="flex-1 bg-slate-50 rounded-xl px-4 text-xs outline-none border-none focus:ring-1 focus:ring-blue-500" placeholder="Was gibt's Neues?" value={newPostContent} onChange={e => setNewPostContent(e.target.value)} /><Button size="sm" type="submit">Posten</Button></form>}
                                <div className="space-y-4">{posts.map(post => <PostItem key={post.id} post={post} companyId={user.uid} currentUserId={user.uid} />)}</div>
                            </Card>
                        </div>
                        <Card className="p-6 rounded-[1.5rem] bg-slate-900 text-white h-fit shadow-2xl">
                            <h3 className="text-[9px] font-black uppercase text-slate-500 mb-6 tracking-[0.2em]">Konditionen</h3>
                            <div className="space-y-4 text-white">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10"><span className="text-[8px] block text-slate-400 font-bold uppercase mb-1">Stundensatz</span>{isEditing ? <input type="number" value={data?.price} onChange={e => setData({...data, price: e.target.value})} className="bg-transparent text-xl font-black text-blue-400 outline-none w-full" /> : <span className="text-xl font-black text-blue-400">{data?.price}€ / Std</span>}</div>
                                <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-white/5"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Marktplatz</span><div className={`w-8 h-4 rounded-full relative transition-all ${data?.isVisible ? 'bg-green-500' : 'bg-slate-700'}`}><div className={`w-2 h-2 bg-white rounded-full absolute top-1 transition-all ${data?.isVisible ? 'right-1' : 'left-1'}`}></div></div><input type="checkbox" className="hidden" checked={data?.isVisible} onChange={e => setData({...data, isVisible: e.target.checked})}/></label>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* TAB: STAFF / PERSONAL (KLICK AUF ZEILE ÖFFNET PROFIL) */}
            {tab === 'staff' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center bg-white p-6 rounded-[1.5rem] shadow-lg border border-slate-100 text-slate-900">
                        <h3 className="text-xl font-black uppercase tracking-tight">Personalverwaltung</h3>
                        <Button size="sm" className="rounded-xl px-6" onClick={() => {const email = prompt("E-Mail:"); if(email) alert("Einladung wurde vorgemerkt.")}} icon={Plus}>Einladen</Button>
                    </div>
                    <Card className="rounded-[1.5rem] overflow-hidden border-none shadow-xl bg-white">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100"><tr><th className="p-5">Mitarbeiter</th><th className="p-5 text-right">Status</th></tr></thead>
                            <tbody className="divide-y divide-slate-50">
                                {employees.map(e => (
                                    <tr 
                                      key={e.id} 
                                      onClick={() => { setInternalProfileId(e.id); setDetailTab('profile'); }}
                                      className="group hover:bg-slate-50 transition-all cursor-pointer"
                                    >
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl overflow-hidden border-2 border-white shadow-sm transition-transform group-hover:scale-105">
                                                    <Avatar src={e.imageUrl} alt={e.name} size="full" />
                                                </div>
                                                <div className="text-slate-900">
                                                    <div className="font-black group-hover:text-blue-600 transition-colors text-sm uppercase">{e.name}</div>
                                                    <div className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">{e.bewacherId || 'Keine ID'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-sm">Akte öffnen</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </div>
            )}

            {/* TAB: DIENSTPLANER (MATRIX) */}
            {tab === 'schedule' && (
                <div className="h-[calc(100vh-140px)]">
                    <SchedulePlanner 
                        employees={employees} 
                        companyId={user.uid} 
                        currentUser={user} 
                        onViewProfile={(id) => { setInternalProfileId(id); setDetailTab('profile'); }} 
                    />
                </div>
            )}

            {/* ANDERE TABS */}
            {tab === 'marketplace' && <div className="p-10 text-center text-slate-400 font-bold uppercase text-xs tracking-widest bg-white rounded-[2rem] shadow-sm">Der Marktplatz ist aktuell aktiv für Ihr Unternehmen.</div>}
            {tab === 'messages' && <div className="h-[calc(100vh-140px)]"><ChatSystem user={user} userRole="provider" isEmbedded={true} /></div>}
            
            {tab === 'req_manage' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {requests.filter(r => r.status === 'Offen').map(req => (
                        <Card key={req.id} className="p-6 rounded-[1.5rem] shadow-xl bg-white flex flex-col justify-between border-slate-50 text-slate-900">
                            <div className="mb-4"><div className="flex justify-between items-start mb-4 uppercase"><span className="font-black text-sm">{req.employeeName}</span><span className="text-[8px] font-bold text-slate-400 tracking-widest">{new Date(req.date).toLocaleDateString()}</span></div><div className="bg-slate-50 p-3 rounded-xl font-bold text-xs uppercase tracking-tighter">{req.type}</div></div>
                            <div className="flex gap-2"><button onClick={() => updateDoc(doc(db, "companies", user.uid, "requests", req.id), {status: 'Genehmigt'})} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-black text-[9px] uppercase shadow-lg tracking-widest">Genehmigen</button><button onClick={() => updateDoc(doc(db, "companies", user.uid, "requests", req.id), {status: 'Abgelehnt'})} className="flex-1 bg-slate-100 text-slate-400 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest">Ablehnen</button></div>
                        </Card>
                    ))}
                    {requests.filter(r => r.status === 'Offen').length === 0 && <div className="col-span-full py-20 text-center text-slate-300 font-bold uppercase text-xs">Keine offenen Anträge</div>}
                </div>
            )}
          </div>
      )}
    </DashboardLayout>
  );
};