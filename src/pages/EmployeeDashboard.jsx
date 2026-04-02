import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, FileText, Plus, Users, User, Trash2, Upload, Loader2 } from 'lucide-react';
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

  // Optimierung aus GitHub: Memoized User-Array
  const currentUserAsArray = useMemo(() => [{ id: user.uid, ...user }], [user.uid, user.name, user.role, user.phone, user.address, user.imageUrl]);

  useEffect(() => {
    if (!user.companyId) return;
    const q = query(collection(db, "companies", user.companyId, "requests"), where("employeeId", "==", user.uid));
    getDocs(q).then(s => setRequests(s.docs.map(d => ({id: d.id, ...d.data()}))));
  }, [user]);

  useEffect(() => {
      if (isLead && user.companyId) {
          getDocs(collection(db, "companies", user.companyId, "employees")).then(s => {
              setTeamMembers(s.docs.map(d => ({id: d.id, ...d.data()})));
          });
      }
  }, [user, isLead]);

  const handleReq = async () => {
    const type = prompt("Art des Antrags:"); if(!type) return;
    const reason = prompt("Grund (optional):");
    const newReq = { employeeId: user.uid, employeeName: user.name, type, reason: reason || "", status: 'Offen', date: new Date().toISOString() };
    await addDoc(collection(db, "companies", user.companyId, "requests"), newReq);
    setRequests([...requests, { id: Date.now(), ...newReq }]);
  };

  const handleSaveData = async () => {
      setLoading(true);
      try {
          const updateData = { phone: editData.phone, address: editData.address };
          await updateDoc(doc(db, "users", user.uid), updateData);
          if(user.companyId) await updateDoc(doc(db, "companies", user.companyId, "employees", user.uid), updateData);
          alert("Gespeichert!");
      } catch(e) { console.error(e); }
      setLoading(false);
  };

  const handleImageUpload = async (e) => {
      const file = e.target.files[0]; if(!file) return;
      setLoading(true);
      try {
          const sRef = ref(storage, `avatars/${user.uid}`);
          await uploadBytes(sRef, file);
          const url = await getDownloadURL(sRef);
          await updateDoc(doc(db, "users", user.uid), { imageUrl: url });
          if(user.companyId) await updateDoc(doc(db, "companies", user.companyId, "employees", user.uid), { imageUrl: url });
          window.location.reload();
      } catch(e) { console.error(e); }
      setLoading(false);
  };

  const handleDeleteImage = async () => {
      if (!confirm("Profilbild wirklich löschen?")) return;
      setLoading(true);
      try {
          await updateDoc(doc(db, "users", user.uid), { imageUrl: deleteField() });
          if (user.companyId) await updateDoc(doc(db, "companies", user.companyId, "employees", user.uid), { imageUrl: deleteField() });
          window.location.reload();
      } catch (e) { console.error(e); }
      setLoading(false);
  };

  const menu = [
    { id: 'schedule', name: 'Mein Dienstplan', icon: <CalendarDays size={20}/> },
    { id: 'requests', name: 'Meine Anträge', icon: <FileText size={20}/> },
    { id: 'files', name: 'Meine Akte', icon: <User size={20}/> } 
  ];
  if (isLead) menu.push({ id: 'team_planning', name: 'Team Planung', icon: <Users size={20}/> });

  if (viewingProfileId) {
      return (
          <DashboardLayout title="Profilansicht" user={user} sidebarItems={menu} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
              <UserProfileView targetUserId={viewingProfileId} onBack={() => setViewingProfileId(null)} />
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout title="Mitarbeiter Portal" user={user} sidebarItems={menu} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
      {tab === 'schedule' && <RosterScheduler user={user} companyId={user.companyId} employees={currentUserAsArray} onImageUpload={handleImageUpload} onImageDelete={handleDeleteImage} />}
      {tab === 'team_planning' && isLead && <div className="h-[calc(100vh-140px)]"><SchedulePlanner employees={teamMembers} companyId={user.companyId} currentUser={user} onViewProfile={setViewingProfileId} /></div>}
      {tab === 'requests' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800">Antragsübersicht</h3><Button onClick={handleReq} icon={Plus}>Neu</Button></div>
          <div className="grid gap-3">
            {requests.map(r => (
                <Card key={r.id} className="p-4 flex justify-between items-center">
                    <div><div className="font-bold text-slate-800">{r.type}</div><div className="text-xs text-slate-500">{new Date(r.date).toLocaleDateString()}</div></div>
                    <Badge color={r.status==='Genehmigt'?'green':r.status==='Abgelehnt'?'red':'orange'}>{r.status}</Badge>
                </Card>
            ))}
          </div>
        </div>
      )}
      {tab === 'files' && (
        <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <Card className="p-8 flex flex-col items-center gap-6">
                <div className="relative group h-32 w-32">
                    <Avatar src={user.imageUrl} alt={user.name} size="xl" className="shadow-lg border-4 border-white" />
                    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-4 text-white">
                        <label className="cursor-pointer hover:text-blue-300"><Upload size={20}/><input type="file" className="hidden" accept="image/*" onChange={handleImageUpload}/></label>
                        {user.imageUrl && <button onClick={handleDeleteImage} className="hover:text-red-400"><Trash2 size={20}/></button>}
                    </div>
                </div>
                <div className="text-center"><h2 className="text-2xl font-bold text-slate-900">{user.name}</h2><p className="text-slate-500">{user.email}</p></div>
            </Card>
            <Card className="p-6 space-y-4">
                <h3 className="font-bold text-lg border-b pb-2">Kontaktdaten</h3>
                <div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Telefon</label><input type="text" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} className="w-full p-2 border rounded-lg text-slate-900"/></div>
                <div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Adresse</label><input type="text" value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} className="w-full p-2 border rounded-lg text-slate-900"/></div>
                <Button onClick={handleSaveData} disabled={loading} className="w-full">Speichern</Button>
            </Card>
        </div>
      )}
    </DashboardLayout>
  );
};