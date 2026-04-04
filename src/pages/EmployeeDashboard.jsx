import React, { useState, useEffect } from 'react';
import { 
  CalendarDays, FileText, User, Upload, Loader2, Phone, 
  MapPin, CheckCircle2, X, Plus, Shield, IdCard, Baby, Award, Car 
} from 'lucide-react';
import { doc, updateDoc, onSnapshot, query, collection, where, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { RosterScheduler } from '../components/features/RosterScheduler';

export const EmployeeDashboard = ({ user, onLogout }) => {
  const [tab, setTab] = useState('schedule');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imageUpload, setImageUpload] = useState(null);
  
  const [editData, setEditData] = useState({ 
    name: user?.name || "",
    bewacherId: user?.bewacherId || "",
    birthDate: user?.birthDate || "",
    phone: user?.phone || "", 
    address: user?.address || "",
    hasLicense: user?.hasLicense || "Nein",
    qualification: user?.qualification || "",
    shirtSize: user?.shirtSize || "L"
  });

  // Update editData when user changes (ohne direktes setState in effect)
  useEffect(() => {
    if (user && (user.name !== editData.name || user.phone !== editData.phone)) {
        setEditData(prev => ({
            ...prev,
            name: user.name || "",
            bewacherId: user.bewacherId || "",
            birthDate: user.birthDate || "",
            phone: user.phone || "",
            address: user.address || "",
            hasLicense: user.hasLicense || "Nein",
            qualification: user.qualification || "",
            shirtSize: user.shirtSize || "L"
        }));
    }
  }, [user?.name, user?.phone, user?.bewacherId, editData.name, editData.phone]);

  useEffect(() => {
    if (!user?.companyId || !user?.uid) return;
    const q = query(collection(db, "companies", user.companyId, "requests"), where("employeeId", "==", user.uid));
    return onSnapshot(q, (snap) => setRequests(snap.docs.map(d => ({id: d.id, ...d.data()}))));
  }, [user]);

  const handleSaveProfile = async () => {
      if (!user?.uid) return;
      setLoading(true);
      try {
          let url = user.imageUrl || null;
          if (imageUpload) {
              const imageRef = ref(storage, `avatars/${user.uid}`);
              const snapshot = await uploadBytes(imageRef, imageUpload);
              url = await getDownloadURL(snapshot.ref);
          }
          
          const updated = { ...editData, imageUrl: url, updatedAt: new Date().toISOString() };
          await updateDoc(doc(db, "users", user.uid), updated);
          if (user.companyId) {
              await updateDoc(doc(db, "companies", user.companyId, "employees", user.uid), updated);
          }
          alert("Profil wurde erfolgreich aktualisiert!");
          setImageUpload(null);
      } catch (e) { 
          console.error(e);
          alert("Fehler beim Speichern.");
      }
      setLoading(false);
  };

  const menu = [
    { id: 'schedule', name: 'Dienstplan', icon: <CalendarDays size={20}/> },
    { id: 'requests', name: 'Anträge', icon: <FileText size={20}/> },
    { id: 'files', name: 'Meine Akte', icon: <User size={20}/> } 
  ];

  return (
    <DashboardLayout title="Mitarbeiter Portal" user={user} sidebarItems={menu} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
      
      <div className="max-w-4xl mx-auto pb-12">
        
        {tab === 'schedule' && <RosterScheduler user={user} companyId={user.companyId} />}

        {tab === 'files' && (
            <div className="space-y-6 animate-in fade-in duration-500">
                
                {/* HEADER: PROFILBILD & NAME */}
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10 flex flex-col items-center text-center text-slate-900">
                    <div className="relative group mb-6">
                        <div className="h-40 w-40 rounded-[3rem] overflow-hidden bg-slate-50 border-4 border-white shadow-2xl">
                            <Avatar src={imageUpload ? URL.createObjectURL(imageUpload) : user.imageUrl} alt={user.name} size="full" className="rounded-[2.6rem]" />
                        </div>
                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[3rem] cursor-pointer text-white opacity-0 group-hover:opacity-100 transition-all">
                            <Upload size={32}/><input type="file" className="hidden" onChange={e => setImageUpload(e.target.files[0])} />
                        </label>
                    </div>

                    <div className="space-y-3 w-full max-w-md">
                        <input 
                            value={editData.name} 
                            onChange={e => setEditData({...editData, name: e.target.value})}
                            className="text-3xl sm:text-4xl font-black tracking-tight bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-100 rounded-xl w-full text-center"
                            placeholder="Vorname Name"
                        />
                        <div className="flex flex-col items-center gap-2">
                            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-6 py-2.5 rounded-2xl border border-blue-100 shadow-sm">
                                <IdCard size={20} className="text-blue-600"/>
                                <span className="text-sm font-black uppercase tracking-widest">
                                    ID: {editData.bewacherId || 'FEHLT'}
                                </span>
                            </div>
                            <Badge color="slate" className="px-4 py-1 text-[10px] font-black uppercase tracking-widest bg-slate-100 border-none">
                                {user.role === 'team_lead' ? 'Einsatzleiter' : 'Mitarbeiter'}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* FORMULAR GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-slate-900">
                    
                    <Card className="p-8 rounded-[2.5rem] shadow-lg bg-white border-slate-50 space-y-6">
                        <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2">
                            <User size={18}/> Stammdaten
                        </h3>
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Bewacher ID</label>
                                <input value={editData.bewacherId} onChange={e => setEditData({...editData, bewacherId: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-bold text-sm mt-1 focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Geburtsdatum</label>
                                <div className="relative mt-1">
                                    <Baby className="absolute left-4 top-4 text-slate-400" size={18}/>
                                    <input type="date" value={editData.birthDate} onChange={e => setEditData({...editData, birthDate: e.target.value})} className="w-full bg-slate-50 pl-12 pr-4 py-4 rounded-2xl border-none font-bold text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Führerschein</label>
                                <div className="relative mt-1">
                                    <Car className="absolute left-4 top-4 text-slate-400" size={18}/>
                                    <select value={editData.hasLicense} onChange={e => setEditData({...editData, hasLicense: e.target.value})} className="w-full bg-slate-50 pl-12 pr-4 py-4 rounded-2xl border-none font-bold text-sm">
                                        <option value="Ja">Ja</option>
                                        <option value="Nein">Nein</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-8 rounded-[2.5rem] shadow-lg bg-white border-slate-50 space-y-6">
                        <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2">
                            <Award size={18}/> Qualifikation & Kontakt
                        </h3>
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Qualifikation</label>
                                <input value={editData.qualification} onChange={e => setEditData({...editData, qualification: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border-none font-bold text-sm mt-1" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mobilnummer</label>
                                <div className="relative mt-1">
                                    <Phone className="absolute left-4 top-4 text-slate-400" size={18}/>
                                    <input value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} className="w-full bg-slate-50 pl-12 pr-4 py-4 rounded-2xl border-none font-bold text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Wohnanschrift</label>
                                <div className="relative mt-1">
                                    <MapPin className="absolute left-4 top-4 text-slate-400" size={18}/>
                                    <input value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} className="w-full bg-slate-50 pl-12 pr-4 py-4 rounded-2xl border-none font-bold text-sm" />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* AUSSTATTUNG - FIX FÜR ÜBERLAUF */}
                    <Card className="p-8 rounded-[2.5rem] shadow-lg bg-white border-slate-50 md:col-span-2">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 shadow-sm"><Shield size={24}/></div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-[0.1em] text-slate-900">Dienstausstattung</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Uniformgrößen verwalten</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 w-full sm:w-auto bg-slate-50 p-2 rounded-2xl border border-slate-100 justify-between sm:justify-start">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Größe:</label>
                                <select 
                                    value={editData.shirtSize} 
                                    onChange={e => setEditData({...editData, shirtSize: e.target.value})} 
                                    className="bg-white border-none rounded-xl font-black px-8 py-3 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 min-w-[120px]"
                                >
                                    {['XS','S','M','L','XL','XXL','3XL','4XL'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* ACTIONS */}
                <div className="flex justify-center pt-4">
                    <button 
                      onClick={handleSaveProfile} 
                      disabled={loading} 
                      className="group relative flex items-center justify-center gap-3 px-16 py-5 bg-slate-900 text-white rounded-[2rem] shadow-2xl hover:bg-blue-600 transition-all duration-300 disabled:opacity-50 overflow-hidden w-full sm:w-auto"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20} className="group-hover:scale-125 transition-transform"/>}
                      <span className="text-xs font-black uppercase tracking-[0.2em]">
                        {loading ? 'Speichern...' : 'Profil aktualisieren'}
                      </span>
                    </button>
                </div>
            </div>
        )}
        
        {/* TAB ANTRÄGE */}
        {tab === 'requests' && (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center text-slate-900 bg-white p-8 rounded-[2.5rem] shadow-lg border border-slate-50">
                    <div>
                        <h3 className="text-2xl font-black tracking-tight uppercase">Fehlzeiten</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Urlaub & Krank</p>
                    </div>
                    <Button onClick={() => {const t = prompt("Grund:"); if(t) addDoc(collection(db, "companies", user.companyId, "requests"), {employeeId: user.uid, employeeName: user.name, type: t, status: 'Offen', date: new Date().toISOString()})}}>Neuer Antrag</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {requests.map(r => (
                        <Card key={r.id} className="p-6 flex justify-between items-center text-slate-900 bg-white shadow-md rounded-[1.5rem] border-slate-50">
                            <div><div className="font-black text-xs uppercase tracking-widest">{r.type}</div><div className="text-[10px] text-slate-400 font-bold mt-1">{new Date(r.date).toLocaleDateString()}</div></div>
                            <Badge color={r.status==='Genehmigt'?'green':r.status==='Abgelehnt'?'red':'orange'} className="text-[9px] uppercase font-black px-4 py-1.5 rounded-xl">{r.status}</Badge>
                        </Card>
                    ))}
                </div>
            </div>
        )}
      </div>
    </DashboardLayout>
  );
};