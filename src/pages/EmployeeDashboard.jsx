import React, { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(false); // Für Lade-Status beim Löschen

  // State für Profil-Bearbeitung (Daten)
  const [editData, setEditData] = useState({ 
    phone: user.phone || "", 
    address: user.address || "" 
  });

  // Prüfen ob Lead
  const isLead = user.role === 'team_lead' || user.role === 'obj_lead';

  // Requests laden
  useEffect(() => {
    if (!user.companyId) return;
    const q = query(collection(db, "companies", user.companyId, "requests"), where("employeeId", "==", user.uid));
    getDocs(q).then(s => setRequests(s.docs.map(d => ({id: d.id, ...d.data()}))));
  }, [user]);

  // Team laden (NUR für Leads)
  useEffect(() => {
      if (isLead && user.companyId) {
          getDocs(collection(db, "companies", user.companyId, "employees")).then(s => {
              setTeamMembers(s.docs.map(d => ({id: d.id, ...d.data()})));
          });
      }
  }, [user, isLead]);

  // Neuen Antrag stellen
  const handleReq = async () => {
    const type = prompt("Art des Antrags (z.B. Urlaub, Krankmeldung):"); 
    if(!type) return;
    const reason = prompt("Grund / Anmerkung (optional):");
    
    const newReq = { 
        employeeId: user.uid, 
        employeeName: user.name, 
        type, 
        reason: reason || "",
        status: 'Offen', 
        date: new Date().toISOString() 
    };
    await addDoc(collection(db, "companies", user.companyId, "requests"), newReq);
    setRequests([...requests, { id: Date.now(), ...newReq }]);
  };

  // Profil Daten speichern
  const handleSaveData = async () => {
      setLoading(true);
      try {
          const updateData = { phone: editData.phone, address: editData.address };
          await updateDoc(doc(db, "users", user.uid), updateData);
          if(user.companyId) await updateDoc(doc(db, "companies", user.companyId, "employees", user.uid), updateData);
          alert("Daten gespeichert!");
      } catch(e) { console.error(e); alert("Fehler beim Speichern."); }
      setLoading(false);
  };

  // BILD HOCHLADEN
  const handleImageUpload = async (e) => {
      const file = e.target.files[0]; if(!file) return;
      setLoading(true);
      try {
          const sRef = ref(storage, `avatars/${user.uid}`);
          await uploadBytes(sRef, file);
          const url = await getDownloadURL(sRef);
          await updateDoc(doc(db, "users", user.uid), { imageUrl: url });
          if(user.companyId) await updateDoc(doc(db, "companies", user.companyId, "employees", user.uid), { imageUrl: url });
          alert("Bild aktualisiert!");
          window.location.reload();
      } catch(e) { console.error(e); }
      setLoading(false);
  };

  // BILD LÖSCHEN (Die Funktion, die du wolltest)
  const handleDeleteImage = async () => {
      if (!confirm("Profilbild wirklich löschen?")) return;
      setLoading(true);
      try {
          // 1. Aus User-Profil löschen
          await updateDoc(doc(db, "users", user.uid), { imageUrl: deleteField() });
          // 2. Auch aus der Firmen-Liste löschen
          if (user.companyId) {
              await updateDoc(doc(db, "companies", user.companyId, "employees", user.uid), { imageUrl: deleteField() });
          }
          alert("Bild gelöscht!");
          window.location.reload();
      } catch (e) { console.error(e); }
      setLoading(false);
  };

  // Menü bauen
  const menu = [
    { id: 'schedule', name: 'Mein Dienstplan', icon: <CalendarDays size={20}/> },
    { id: 'requests', name: 'Meine Anträge', icon: <FileText size={20}/> },
    { id: 'files', name: 'Meine Akte', icon: <User size={20}/> } // WICHTIG: Tab hinzugefügt für Profilbild
  ];

  if (isLead) {
      menu.push({ id: 'team_planning', name: 'Team Planung', icon: <Users size={20}/> });
  }

  // Profil Ansicht Modal
  if (viewingProfileId) {
      return (
          <DashboardLayout title="Mitarbeiter Portal" user={user} sidebarItems={menu} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
              <UserProfileView targetUserId={viewingProfileId} onBack={() => setViewingProfileId(null)} />
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout title="Mitarbeiter Portal" user={user} sidebarItems={menu} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
      
      {/* Dienstplan */}
      {tab === 'schedule' && (
        <RosterScheduler 
            user={user} 
            companyId={user.companyId} 
            employees={[{id: user.uid, ...user}]} 
            // Wir geben die Funktionen auch an den Scheduler weiter, falls dort Buttons sind
            onImageUpload={handleImageUpload}
            onImageDelete={handleDeleteImage}
        />
      )}

      {/* TEAM PLANUNG (Nur für Leads) */}
      {tab === 'team_planning' && isLead && (
          <div className="h-[calc(100vh-140px)]">
              <SchedulePlanner 
                employees={teamMembers} 
                companyId={user.companyId} 
                currentUser={user} 
                onViewProfile={setViewingProfileId}
              />
          </div>
      )}

      {/* Anträge */}
      {tab === 'requests' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800">Antragsübersicht</h3>
            <Button onClick={handleReq} icon={Plus}>Neuen Antrag stellen</Button>
          </div>
          <div className="grid gap-3">
            {requests.length === 0 && <div className="text-center text-slate-400 p-8">Keine Anträge vorhanden.</div>}
            {requests.map(r => (
                <Card key={r.id} className="p-4 flex justify-between items-center">
                    <div>
                        <div className="font-bold text-slate-800">{r.type}</div>
                        <div className="text-xs text-slate-500">{new Date(r.date).toLocaleDateString()} {r.reason && `• ${r.reason}`}</div>
                    </div>
                    <Badge color={r.status==='Genehmigt'?'green':r.status==='Abgelehnt'?'red':'orange'}>{r.status}</Badge>
                </Card>
            ))}
          </div>
        </div>
      )}

      {/* MEINE AKTE (Hier ist der neue Bild-Upload/Löschen Bereich) */}
      {tab === 'files' && (
        <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <Card className="p-8 flex flex-col items-center gap-6">
                <div className="relative group h-32 w-32">
                    {/* Das Bild */}
                    <div className="h-32 w-32 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-lg">
                        {user.imageUrl ? (
                            <img src={user.imageUrl} className="h-full w-full object-cover" alt="Profil" />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-300">
                                <User size={64}/>
                            </div>
                        )}
                    </div>

                    {/* Overlay mit Upload UND Löschen Button */}
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-4">
                        
                        {/* 1. Upload Button */}
                        <label className="cursor-pointer text-white hover:text-blue-300 hover:scale-110 transition-all p-2 bg-white/10 rounded-full backdrop-blur-sm" title="Bild hochladen">
                            <Upload size={20}/>
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload}/>
                        </label>

                        {/* 2. Löschen Button (nur wenn Bild da ist) */}
                        {user.imageUrl && (
                            <button onClick={handleDeleteImage} className="text-white hover:text-red-400 hover:scale-110 transition-all p-2 bg-white/10 rounded-full backdrop-blur-sm" title="Bild löschen">
                                <Trash2 size={20}/>
                            </button>
                        )}
                    </div>
                    
                    {loading && <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-full"><Loader2 className="animate-spin text-blue-600"/></div>}
                </div>

                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-900">{user.name}</h2>
                    <p className="text-slate-500">{user.email}</p>
                </div>
            </Card>

            <Card className="p-6 space-y-4">
                <h3 className="font-bold text-lg border-b pb-2">Kontaktdaten bearbeiten</h3>
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Telefon</label>
                    <input type="text" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="Telefonnummer"/>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Adresse</label>
                    <input type="text" value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="Straße, PLZ Stadt"/>
                </div>
                <Button onClick={handleSaveData} disabled={loading} className="w-full">
                    {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : null} Speichern
                </Button>
            </Card>
        </div>
      )}

    </DashboardLayout>
  );
};