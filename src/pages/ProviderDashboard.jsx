import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, CalendarDays, Users, Mail, Plus, MapPin, 
  CheckCircle2, FileText, Settings, Upload, Loader2, X, 
  Trash2, Search, Filter, ArrowLeft, Phone, Globe, Ban,
  IdCard, Briefcase, Building2, Euro, Receipt, Download
} from 'lucide-react';
import { 
  collection, doc, addDoc, updateDoc, query, onSnapshot, 
  where, writeBatch, deleteDoc, serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { SchedulePlanner } from '../components/features/SchedulePlanner';
import { ChatSystem } from '../components/features/ChatSystem';
import { PostItem } from '../components/features/PostItem';
import { UserProfileView } from '../components/features/UserProfileView';
import { CompanyProfileView } from '../components/features/CompanyProfileView';

export const ProviderDashboard = ({ user, onLogout, initialTab = 'dashboard' }) => {
  const [tab, setTab] = useState(initialTab);
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState(null);
  const [internalProfileId, setInternalProfileId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Neue States für Auftraggeber & Objekte
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [imageUpload, setImageUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [requests, setRequests] = useState([]);
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // --- ECHTZEIT-DATA ---
  useEffect(() => {
    if (!user?.uid) return;

    const unsubComp = onSnapshot(doc(db, "companies", user.uid), (docSnap) => { 
        if (docSnap.exists()) setData({ isVisible: false, price: "Auf Anfrage", ...docSnap.data() }); 
    });
    const unsubEmp = onSnapshot(collection(db, "companies", user.uid, "employees"), (snap) => {
        setEmployees(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });
    const unsubClients = onSnapshot(collection(db, "companies", user.uid, "clients"), (snap) => {
        setClients(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });
    const unsubProjects = onSnapshot(collection(db, "companies", user.uid, "projects"), (snap) => {
        setProjects(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });
    const unsubPosts = onSnapshot(query(collection(db, "companies", user.uid, "posts")), (snap) => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt - a.createdAt));
    });
    const unsubReq = onSnapshot(collection(db, "companies", user.uid, "requests"), (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubMarket = onSnapshot(collection(db, "companies"), (snap) => {
        setFirms(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => f.isVisible));
    });

    return () => { unsubComp(); unsubEmp(); unsubClients(); unsubProjects(); unsubPosts(); unsubReq(); unsubMarket(); };
  }, [user.uid]);

  // --- DASHBOARD SPEICHER FIX ---
  const handleSaveProfile = async () => { 
      if (uploading) return;
      setUploading(true); 
      try {
          let url = data.imageUrl || null; 
          if (imageUpload) { 
              const imageRef = ref(storage, `logos/${user.uid}`); 
              const snapshot = await uploadBytes(imageRef, imageUpload); 
              url = await getDownloadURL(snapshot.ref); 
          } 
          
          const batch = writeBatch(db);
          const compRef = doc(db, "companies", user.uid);
          const userRef = doc(db, "users", user.uid);

          batch.set(compRef, { ...data, imageUrl: url }, { merge: true });
          batch.update(userRef, { 
              name: data.name, 
              imageUrl: url,
              isVisible: data.isVisible || false 
          });

          await batch.commit();
          setIsEditing(false);
          setImageUpload(null);
          alert("Profil erfolgreich gespeichert!");
      } catch (e) { 
          console.error("Spehler beim Speichern:", e);
          alert("Fehler beim Speichern. Bitte Konsole prüfen.");
      }
      setUploading(false);
  };

  const handleCreatePost = async () => { 
      if(!newPostContent.trim()) return; 
      await addDoc(collection(db, "companies", user.uid, "posts"), { 
          content: newPostContent, createdAt: new Date().toISOString(), authorName: data.name 
      }); 
      setNewPostContent(''); 
  };

  if (!data) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10"/></div>;

  const menu = [
    { id: 'dashboard', name: 'Zentrale', icon: <LayoutDashboard size={20}/> },
    { id: 'clients', name: 'Kunden', icon: <Briefcase size={20}/> },
    { id: 'schedule', name: 'Planer', icon: <CalendarDays size={20}/> },
    { id: 'staff', name: 'Team', icon: <Users size={20}/> },
    { id: 'marketplace', name: 'Markt', icon: <Globe size={20}/> },
    { id: 'messages', name: 'Chat', icon: <Mail size={20}/> }
  ];

  return (
    <DashboardLayout title="Führungsebene" user={{...user, ...data}} sidebarItems={menu} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
      
      {internalProfileId ? (
          <UserProfileView 
            employee={employees.find(e => e.id === internalProfileId)} 
            companyId={user.uid} 
            onBack={() => setInternalProfileId(null)} 
          />
      ) : selectedFirm ? (
          <CompanyProfileView 
            company={selectedFirm} 
            onBack={() => setSelectedFirm(null)} 
            onContactClick={() => setTab('messages')}
            showContactButton={true}
            currentUser={user}
          />
      ) : (
          <div className="max-w-7xl mx-auto space-y-6 pb-24 text-slate-900">
            
            {/* TAB: DASHBOARD */}
            {tab === 'dashboard' && (
                <div className="space-y-8 animate-in fade-in">
                    <Card className="bg-white rounded-[2.5rem] shadow-xl border-none overflow-hidden">
                        <div className="h-40 bg-gradient-to-r from-slate-900 to-blue-900 relative">
                            <button onClick={() => setIsEditing(!isEditing)} className="absolute top-6 right-6 bg-white/10 backdrop-blur-md text-white px-5 py-2 rounded-2xl border border-white/20 hover:bg-white hover:text-slate-900 transition-all font-black text-[10px] uppercase tracking-widest">
                                {isEditing ? "Abbrechen" : "Bearbeiten"}
                            </button>
                        </div>
                        <div className="px-10 pb-10 -mt-16 flex flex-col md:flex-row items-end gap-8">
                            <div className="relative group">
                                <Avatar src={imageUpload ? URL.createObjectURL(imageUpload) : data.imageUrl} alt={data.name} size="full" className="h-32 w-32 rounded-[2.5rem] bg-white p-1 shadow-2xl border-4 border-white" />
                                {isEditing && (
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-[2.5rem] cursor-pointer text-white animate-in fade-in">
                                        <Upload size={32}/><input type="file" className="hidden" onChange={(e) => setImageUpload(e.target.files[0])} />
                                    </label>
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                {isEditing ? (
                                    <input value={data.name} onChange={e => setData({...data, name: e.target.value})} className="text-3xl font-black bg-slate-50 rounded-2xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-blue-500" />
                                ) : (
                                    <h1 className="text-4xl font-black tracking-tight uppercase">{data.name}</h1>
                                )}
                                <div className="flex flex-wrap gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <span className="flex items-center gap-1.5"><MapPin size={14} className="text-blue-600"/> {data.address || "Standort fehlt"}</span>
                                    <span className="flex items-center gap-1.5"><Users size={14} className="text-blue-600"/> {employees.length} Mitarbeiter</span>
                                </div>
                            </div>
                            {isEditing && <Button onClick={handleSaveProfile} disabled={uploading} className="rounded-2xl px-8 shadow-xl shadow-blue-200">{uploading ? "Speichert..." : "Sichern"}</Button>}
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            <Card className="p-8 rounded-[2.5rem] bg-white shadow-lg border-none">
                                <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 mb-6 flex items-center gap-2"><FileText size={18}/> Über uns</h3>
                                {isEditing ? <textarea value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full h-40 p-6 bg-slate-50 rounded-[2rem] outline-none text-sm font-medium leading-relaxed" placeholder="Beschreibe deine Firma..." /> : <p className="text-slate-600 font-medium leading-relaxed">{data.description || "Noch keine Beschreibung hinterlegt."}</p>}
                            </Card>
                        </div>
                        <div className="space-y-8">
                            <Card className="p-8 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl">
                                <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-[0.2em]">Marktplatz-Status</h3>
                                <div className="space-y-6">
                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                                        <span className="text-[9px] block text-slate-400 font-black uppercase mb-1">Stundensatz</span>
                                        {isEditing ? <input value={data.price} onChange={e => setData({...data, price: e.target.value})} className="bg-transparent text-2xl font-black text-blue-400 outline-none w-full" /> : <span className="text-2xl font-black text-blue-400">{data.price}€</span>}
                                    </div>
                                    <label className="flex items-center justify-between p-2 cursor-pointer">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Öffentlich sichtbar</span>
                                        <div onClick={() => setData({...data, isVisible: !data.isVisible})} className={`w-12 h-6 rounded-full relative transition-all shadow-inner ${data.isVisible ? 'bg-blue-500' : 'bg-slate-700'}`}>
                                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${data.isVisible ? 'right-1' : 'left-1'}`}></div>
                                        </div>
                                    </label>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: KUNDEN & AUFTRAGGEBER */}
            {tab === 'clients' && (
                <div className="space-y-8 animate-in fade-in">
                    <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-lg">
                        <div>
                            <h2 className="text-2xl font-black uppercase">Kundenstamm</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auftraggeber & Finanzübersicht</p>
                        </div>
                        <Button onClick={() => {
                            const n = prompt("Name des Auftraggebers:");
                            const r = prompt("Stundensatz (Netto):", "25");
                            if(n) addDoc(collection(db, "companies", user.uid, "clients"), { name: n, rate: parseFloat(r), createdAt: serverTimestamp() });
                        }} icon={Plus} className="rounded-2xl">Neu anlegen</Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {clients.map(c => (
                            <Card key={c.id} className="p-8 bg-white rounded-[2.5rem] shadow-xl border-none space-y-6">
                                <div className="flex justify-between items-start">
                                    <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl"><Building2 size={24}/></div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-slate-400 uppercase">Satz</div>
                                        <div className="text-xl font-black text-blue-600">{c.rate}€</div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase text-slate-900">{c.name}</h3>
                                    <button onClick={() => {
                                        const p = prompt("Objektname:");
                                        if(p) addDoc(collection(db, "companies", user.uid, "projects"), { name: p, clientId: c.id, clientName: c.name, rate: c.rate });
                                    }} className="mt-2 text-[9px] font-black text-blue-500 uppercase tracking-widest hover:underline">+ Objekt hinzufügen</button>
                                </div>
                                <div className="pt-4 border-t border-slate-50">
                                    <div className="text-[9px] font-black text-slate-400 uppercase mb-3">Zugeordnete Objekte:</div>
                                    <div className="flex flex-wrap gap-2">
                                        {projects.filter(p => p.clientId === c.id).map(p => (
                                            <Badge key={p.id} color="slate" className="px-3 py-1 rounded-lg text-[8px] font-black uppercase">{p.name}</Badge>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB: TEAM (PERSONALSTAMM - UI UPDATE) */}
            {tab === 'staff' && (
                <div className="space-y-8 animate-in fade-in">
                    <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] shadow-lg">
                        <h2 className="text-2xl font-black uppercase">Einsatzkräfte</h2>
                        <Button icon={Plus} variant="outline" className="rounded-2xl">Mitarbeiter einladen</Button>
                    </div>
                    <Card className="rounded-[2.5rem] overflow-hidden bg-white shadow-2xl border-none">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                <tr>
                                    <th className="p-8">Mitarbeiter</th>
                                    <th className="p-8 text-right">Aktion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {employees.map(e => (
                                    <tr key={e.id} onClick={() => setInternalProfileId(e.id)} className="group hover:bg-slate-50/80 transition-all cursor-pointer">
                                        <td className="p-8">
                                            <div className="flex items-center gap-6">
                                                <div className="h-14 w-14 rounded-2xl overflow-hidden shadow-lg border-2 border-white shrink-0">
                                                    <Avatar src={e.imageUrl} alt={e.name} size="full" />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="font-black text-lg uppercase text-slate-900 group-hover:text-blue-600 transition-colors">{e.name}</div>
                                                    <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-xl border border-blue-100 font-black text-[10px] uppercase">
                                                        <IdCard size={12}/> ID: {e.bewacherId || 'FEHLT'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-8 text-right">
                                            <Button size="sm" variant="ghost" className="rounded-xl text-[10px] font-black uppercase tracking-widest">Akte öffnen</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </div>
            )}

            {/* TAB: DIENSTPLANER */}
            {tab === 'schedule' && (
                <div className="h-[calc(100vh-140px)]">
                    <SchedulePlanner 
                        employees={employees} 
                        projects={projects}
                        companyId={user.uid} 
                        currentUser={user} 
                        onViewProfile={setInternalProfileId} 
                    />
                </div>
            )}

            {/* TAB: MARKTPLATZ (FIX) */}
            {tab === 'marketplace' && (
                <div className="space-y-8">
                    <div className="relative group max-w-2xl mx-auto">
                        <Search className="absolute left-6 top-5 text-slate-400" size={20}/>
                        <input className="w-full pl-16 pr-6 py-5 bg-white border-none rounded-[2rem] shadow-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold" placeholder="Firma, Standort oder Spezialisierung suchen..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {firms.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).map(f => (
                            <Card key={f.id} onClick={() => setSelectedFirm(f)} className="group p-6 rounded-[2rem] shadow-lg hover:shadow-2xl transition-all cursor-pointer bg-white border-none">
                                <div className="flex gap-6 items-center">
                                    <Avatar src={f.imageUrl} size="lg" className="rounded-2xl h-20 w-20 shadow-md" />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-lg uppercase truncate text-slate-900">{f.name}</h3>
                                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest space-y-1">
                                            <div className="flex items-center gap-1"><MapPin size={12}/> {f.address || "Auf Anfrage"}</div>
                                            <div className="flex items-center gap-1 text-blue-600 font-black italic"><Euro size={12}/> {f.price || "Auf Anfrage"}</div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'messages' && <div className="h-[calc(100vh-140px)]"><ChatSystem user={user} userRole="provider" isEmbedded={true} /></div>}

          </div>
      )}
    </DashboardLayout>
  );
};