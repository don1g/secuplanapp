import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, FileText, Plus, Users, User, Trash2, Upload, Loader2, Phone, MapPin, CheckCircle2, X } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { RosterScheduler } from '../components/features/RosterScheduler';
import { SchedulePlanner } from '../components/features/SchedulePlanner';
import { UserProfileView } from '../components/features/UserProfileView';

export const EmployeeDashboard = ({ user, onLogout }) => {
  const [tab, setTab] = useState('schedule');
  const [requests, setRequests] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [viewingProfileId, setViewingProfileId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editData, setEditData] = useState({ phone: user.phone || "", address: user.address || "" });

  const isLead = user.role === 'team_lead' || user.role === 'obj_lead';
  const currentUserAsArray = useMemo(() => [{ id: user.uid, ...user }], [user.uid, user.name, user.role, user.phone, user.address, user.imageUrl]);

  useEffect(() => {
    if (!user.companyId) return;
    const unsubReq = onSnapshot(query(collection(db, "companies", user.companyId, "requests"), where("employeeId", "==", user.uid)), (snap) => {
        setRequests(snap.docs.map(d => ({id: d.id, ...d.data()})));
    });
    if (isLead) {
        getDocs(collection(db, "companies", user.companyId, "employees")).then(s => setTeamMembers(s.docs.map(d => ({id: d.id, ...d.data()}))));
    }
    return () => unsubReq();
  }, [user, isLead]);

  const handleReq = async () => {
    const type = prompt("Art des Antrags (z.B. Urlaub):"); if(!type) return;
    await addDoc(collection(db, "companies", user.companyId, "requests"), { employeeId: user.uid, employeeName: user.name, type, status: 'Offen', date: new Date().toISOString() });
  };

  const menu = [
    { id: 'schedule', name: 'Dienstplan', icon: <CalendarDays size={20}/> },
    { id: 'requests', name: 'Anträge', icon: <FileText size={20}/> },
    { id: 'files', name: 'Meine Akte', icon: <User size={20}/> } 
  ];
  if (isLead) menu.push({ id: 'team_planning', name: 'Team Planung', icon: <Users size={20}/> });

  return (
    <DashboardLayout title="Mitarbeiter Portal" user={user} sidebarItems={menu} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
      
      {tab === 'schedule' && (
          <div className="animate-in fade-in duration-500">
              <RosterScheduler user={user} companyId={user.companyId} employees={currentUserAsArray} />
          </div>
      )}

      {tab === 'files' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
            {/* Veredelte Akte-Ansicht */}
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden text-center p-12">
                <div className="relative inline-block mb-8">
                    <div className="h-44 w-44 rounded-[3rem] overflow-hidden bg-slate-50 p-2 border-4 border-white shadow-2xl mx-auto">
                        <Avatar src={user.imageUrl} alt={user.name} size="full" className="rounded-[2.5rem]" />
                    </div>
                    <Badge color="blue" className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-6 py-1.5 shadow-xl border-4 border-white uppercase tracking-tighter text-[10px]">{user.role}</Badge>
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">{user.name}</h2>
                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-8">{user.email}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-left group hover:bg-blue-600 transition-all duration-300">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white rounded-2xl text-blue-600 group-hover:scale-110 transition-transform shadow-sm"><Phone size={24}/></div>
                            <div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-100 transition-colors">Telefon</div><input value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} className="bg-transparent border-none font-black text-slate-900 group-hover:text-white outline-none w-full" placeholder="Nicht hinterlegt"/></div>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-left group hover:bg-blue-600 transition-all duration-300">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white rounded-2xl text-blue-600 group-hover:scale-110 transition-transform shadow-sm"><MapPin size={24}/></div>
                            <div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-100 transition-colors">Adresse</div><input value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} className="bg-transparent border-none font-black text-slate-900 group-hover:text-white outline-none w-full" placeholder="Nicht hinterlegt"/></div>
                        </div>
                    </div>
                </div>
                <Button className="mt-8 rounded-2xl px-12 shadow-xl shadow-blue-100 bg-blue-600 font-black uppercase tracking-widest text-xs" onClick={async () => { await updateDoc(doc(db, "users", user.uid), editData); alert("Gespeichert!"); }}>Profil aktualisieren</Button>
            </div>
        </div>
      )}

      {tab === 'requests' && (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in">
          <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
            <div><h3 className="text-2xl font-black text-slate-900 tracking-tight">Anträge</h3><p className="text-slate-400 text-sm font-medium">Verwalten Sie Ihre Urlaubs- und Fehlzeiten.</p></div>
            <Button onClick={handleReq} icon={Plus} className="rounded-2xl px-8 shadow-lg shadow-blue-100">Neuer Antrag</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map(r => (
                <Card key={r.id} className="p-6 rounded-3xl border-slate-100 shadow-lg hover:shadow-xl transition-shadow bg-white flex justify-between items-center">
                    <div><div className="font-black text-slate-900 text-lg">{r.type}</div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(r.date).toLocaleDateString()}</div></div>
                    <Badge color={r.status==='Genehmigt'?'green':r.status==='Abgelehnt'?'red':'orange'} className="px-4 py-1 uppercase text-[9px] tracking-tighter">{r.status}</Badge>
                </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'team_planning' && isLead && <div className="h-[calc(100vh-140px)]"><SchedulePlanner employees={teamMembers} companyId={user.companyId} currentUser={user} onViewProfile={setViewingProfileId} /></div>}
    </DashboardLayout>
  );
};