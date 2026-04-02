import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, CalendarDays, Users, Mail, Plus, MapPin, 
  CheckCircle2, FileText, Settings, Upload, Loader2, X, 
  Trash2, Search, Filter, ArrowLeft, Phone, Globe, Ban,
  IdCard, Baby, Award, Car, Shirt, Clock, Shield 
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
import { ChatSystem } from '../components/features/ChatSystem';
import { PostItem } from '../components/features/PostItem';
import { UserProfileView } from '../components/features/UserProfileView';

export const ProviderDashboard = ({ user, onLogout, initialTab = 'dashboard' }) => {
  const [tab, setTab] = useState(initialTab);
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState(null);
  const [internalProfileId, setInternalProfileId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [imageUpload, setImageUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [requests, setRequests] = useState([]);
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // --- DATEN-LADEN (Stabilisiert) ---
  useEffect(() => {
    if (!user?.uid) return;

    // 1. Deine Firmendaten (Logo, Name etc.)
    const unsubComp = onSnapshot(doc(db, "companies", user.uid), (docSnap) => { 
        if (docSnap.exists()) {
            setData({ name: "Firma", isVisible: false, price: "45", ...docSnap.data() }); 
        } else {
            setData({ name: user.name || "Meine Firma", uid: user.uid });
        }
    });

    // 2. Deine Mitarbeiter
    const unsubEmp = onSnapshot(collection(db, "companies", user.uid, "employees"), (snap) => {
        setEmployees(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });

    // 3. Newsfeed & Marktplatz & Anträge
    const unsubPosts = onSnapshot(query(collection(db, "companies", user.uid, "posts")), (snap) => {
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt - a.createdAt));
    });
    const unsubReq = onSnapshot(collection(db, "companies", user.uid, "requests"), (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
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
          batch.update(doc(db, "users", user.uid), { name: data.name, imageUrl: url });
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

  if (!data) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600 w-10 h-10"/></div>;

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
      
      {/* ANSICHT: MITARBEITER-AKTE */}
      {internalProfileId ? (
          <UserProfileView 
            // WICHTIG: Hier wird das gesamte Objekt aus der Liste gesucht
            employee={employees.find(e => e.id === internalProfileId)} 
            companyId={user.uid} 
            onBack={() => setInternalProfileId(null)} 
          />
      ) : (
          /* ... Rest des Dashboards ... */
          /* ... Rest vom Dashboard ... */
          <div className="max-w-6xl mx-auto space-y-6 pb-12 text-slate-900">
            
            {/* TAB: DASHBOARD (Deine Firmendaten) */}
            {tab === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in">
                    <Card className="bg-white rounded-[1.5rem] shadow-xl border border-slate-100 overflow-hidden">
                        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
                            {!isEditing && (
                                <button onClick={() => setIsEditing(true)} className="absolute top-4 right-6 bg-white/20 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-white/30 hover:bg-white hover:text-blue-600 transition-all font-bold text-xs shadow-xl tracking-widest uppercase">Bearbeiten</button>
                            )}
                        </div>
                        <div className="px-6 pb-6 -mt-10 flex flex-col md:flex-row items-end gap-6">
                            <div className="relative group">
                                <div className="h-28 w-28 rounded-[1.5rem] overflow-hidden bg-white p-1 shadow-xl border border-slate-100">
                                    <Avatar src={imageUpload ? URL.createObjectURL(imageUpload) : data.imageUrl} alt={data.name} size="full" className="rounded-[1.3rem]" />
                                </div>
                                {isEditing && (
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[1.5rem] cursor-pointer text-white">
                                        <Upload size={24}/>
                                        <input type="file" className="hidden" onChange={(e) => setImageUpload(e.target.files[0])} />
                                    </label>
                                )}
                            </div>
                            <div className="flex-1 pb-1">
                                {isEditing ? (
                                    <input value={data.name} onChange={e => setData({...data, name: e.target.value})} className="text-2xl font-black bg-slate-50 rounded-xl px-3 py-1 w-full outline-none focus:ring-2 focus:ring-blue-500" />
                                ) : (
                                    <h1 className="text-2xl font-black tracking-tight uppercase text-slate-900">{data.name}</h1>
                                )}
                                <div className="flex gap-4 mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                    <span className="flex items-center gap-1"><MapPin size={12} className="text-blue-500"/> {data.address || "Adresse fehlt"}</span>
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
                                {isEditing ? <textarea value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full h-32 p-4 bg-slate-50 rounded-xl outline-none text-sm leading-relaxed" /> : <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{data.description || "Stellen Sie sich vor."}</p>}
                            </Card>
                            <Card className="p-6 rounded-[1.5rem] shadow-lg bg-white border-slate-50">
                                <h3 className="font-black text-sm uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">Newsfeed</h3>
                                {!isEditing && <form onSubmit={(e) => {e.preventDefault(); handleCreatePost();}} className="flex gap-2 mb-6"><input className="flex-1 bg-slate-50 rounded-xl px-4 text-xs outline-none border-none focus:ring-1 focus:ring-blue-500" placeholder="Was gibt's Neues?" value={newPostContent} onChange={e => setNewPostContent(e.target.value)} /><Button size="sm" type="submit">Posten</Button></form>}
                                <div className="space-y-4">{posts.map(post => <PostItem key={post.id} post={post} companyId={user.uid} currentUserId={user.uid} />)}</div>
                            </Card>
                        </div>
                        <Card className="p-6 rounded-[1.5rem] bg-slate-900 text-white h-fit shadow-2xl">
                            <h3 className="text-[9px] font-black uppercase text-slate-500 mb-6 tracking-[0.2em]">Konditionen</h3>
                            <div className="space-y-4">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/10"><span className="text-[8px] block text-slate-400 font-bold uppercase mb-1">Stundensatz</span>{isEditing ? <input type="number" value={data.price} onChange={e => setData({...data, price: e.target.value})} className="bg-transparent text-xl font-black text-blue-400 outline-none w-full" /> : <span className="text-xl font-black text-blue-400">{data.price}€ / Std</span>}</div>
                                <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-white/5"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Marktplatz</span><div className={`w-8 h-4 rounded-full relative transition-all ${data.isVisible ? 'bg-green-500' : 'bg-slate-700'}`}><div className={`w-2 h-2 bg-white rounded-full absolute top-1 transition-all ${data.isVisible ? 'right-1' : 'left-1'}`}></div></div><input type="checkbox" className="hidden" checked={data.isVisible} onChange={e => setData({...data, isVisible: e.target.checked})}/></label>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* TAB: PERSONAL (Hier habe ich die Avatar-Größe gefixt) */}
            {tab === 'staff' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center bg-white p-6 rounded-[1.5rem] shadow-lg border border-slate-50 text-slate-900">
                        <h3 className="text-xl font-black uppercase tracking-tight">Personalverwaltung</h3>
                        <Button size="sm" className="rounded-xl px-6" onClick={() => {const email = prompt("E-Mail:"); if(email) alert("Einladung versendet.")}} icon={Plus}>Einladen</Button>
                    </div>
                    <Card className="rounded-[1.5rem] overflow-hidden border-none shadow-xl bg-white">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100"><tr><th className="p-5">Mitarbeiter</th><th className="p-5 text-right">Aktion</th></tr></thead>
                            <tbody className="divide-y divide-slate-50">
                                {employees.map(e => (
                                    <tr 
                                      key={e.id} 
                                      onClick={() => setInternalProfileId(e.id)}
                                      className="group hover:bg-slate-50 transition-all cursor-pointer text-slate-900"
                                    >
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-4">
                                                {/* FIX: Feste Breite h-10 w-10 */}
                                                <div className="h-10 w-10 rounded-xl overflow-hidden shadow-sm border border-slate-100 shrink-0">
                                                    <Avatar src={e.imageUrl} alt={e.name} size="full" />
                                                </div>
                                                <div>
                                                    <div className="font-black group-hover:text-blue-600 transition-colors text-sm uppercase">{e.name}</div>
                                                    <div className="text-[9px] font-medium text-slate-400 tracking-widest">{e.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all">Details</span>
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
                        companyId={user.uid} 
                        currentUser={user} 
                        onViewProfile={setInternalProfileId} 
                    />
                </div>
            )}

            {/* ANDERE TABS */}
            {tab === 'marketplace' && <div className="p-10 text-center text-slate-400">Marktplatz ist bereit.</div>}
            {tab === 'messages' && <div className="h-[calc(100vh-140px)]"><ChatSystem user={user} userRole="provider" isEmbedded={true} /></div>}
            
            {tab === 'req_manage' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {requests.filter(r => r.status === 'Offen').map(req => (
                        <Card key={req.id} className="p-6 rounded-[1.5rem] shadow-xl bg-white flex flex-col justify-between border-slate-50 text-slate-900">
                            <div className="mb-4 text-slate-900"><div className="flex justify-between items-start mb-4 uppercase text-slate-900"><span className="font-black text-sm">{req.employeeName}</span><span className="text-[8px] font-bold text-slate-400 tracking-widest">{new Date(req.date).toLocaleDateString()}</span></div><div className="bg-slate-50 p-3 rounded-xl font-bold text-xs uppercase tracking-tighter">{req.type}</div></div>
                            <div className="flex gap-2"><button onClick={() => updateDoc(doc(db, "companies", user.uid, "requests", req.id), {status: 'Genehmigt'})} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-black text-[9px] uppercase shadow-lg tracking-widest hover:bg-green-700">OK</button><button onClick={() => updateDoc(doc(db, "companies", user.uid, "requests", req.id), {status: 'Abgelehnt'})} className="flex-1 bg-slate-100 text-slate-400 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest">Nein</button></div>
                        </Card>
                    ))}
                </div>
            )}
          </div>
      )}
    </DashboardLayout>
  );
};