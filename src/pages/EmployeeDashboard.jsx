import React, { useState, useEffect } from 'react';
import { CalendarDays, FileText, Plus, Users, User, Trash2 } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { RosterScheduler } from '../components/features/RosterScheduler';
import { SchedulePlanner } from '../components/features/SchedulePlanner'; // Import für Leads
import { UserProfileView } from '../components/features/UserProfileView'; // Für Profil-Klick

export const EmployeeDashboard = ({ user, onLogout }) => {
  const [tab, setTab] = useState('schedule');
  const [requests, setRequests] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]); // Neu: Liste aller MA für Leads
  const [viewingProfileId, setViewingProfileId] = useState(null); // Neu: Für Profil-Modal

  // Prüfen ob Lead
  const isLead = user.role === 'team_lead' || user.role === 'obj_lead';

  // Requests laden (für alle)
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

  // Profil & Bild speichern (für RosterScheduler)
  const handleSaveProfile = async (formData) => {
      try {
          await updateDoc(doc(db, "users", user.uid), formData);
          if(user.companyId) await updateDoc(doc(db, "companies", user.companyId, "employees", user.uid), formData);
          alert("Profil gespeichert!");
      } catch(e) { console.error(e); alert("Fehler beim Speichern."); }
  };

  const handleImageUpload = async (e) => {
      const file = e.target.files[0]; if(!file) return;
      try {
          const sRef = ref(storage, `avatars/${user.uid}`);
          await uploadBytes(sRef, file);
          const url = await getDownloadURL(sRef);
          await updateDoc(doc(db, "users", user.uid), { imageUrl: url });
          if(user.companyId) await updateDoc(doc(db, "companies", user.companyId, "employees", user.uid), { imageUrl: url });
          alert("Bild aktualisiert!");
      } catch(e) { console.error(e); }
  };

const handleDeleteImage = async () => {
        if (!confirm("Profilbild wirklich löschen?")) return;
        setLoading(true);
        try {
            // 1. Aus User-Profil löschen
            await updateDoc(doc(db, "users", user.uid), { imageUrl: deleteField() });
            // 2. Auch aus der Firmen-Liste löschen (falls vorhanden)
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
    { id: 'requests', name: 'Meine Anträge', icon: <FileText size={20}/> }
  ];

  // Wenn Lead, füge Team-Planung hinzu
  if (isLead) {
      menu.push({ id: 'team_planning', name: 'Team Planung', icon: <Users size={20}/> });
  }

  // Profil Ansicht Handler
  if (viewingProfileId) {
      return (
          <DashboardLayout title="Mitarbeiter Portal" user={user} sidebarItems={menu} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
              <UserProfileView targetUserId={viewingProfileId} onBack={() => setViewingProfileId(null)} />
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout title="Mitarbeiter Portal" user={user} sidebarItems={menu} activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
      
      {/* Dienstplan (Mit integriertem Profil) */}
      {tab === 'schedule' && (
        <RosterScheduler 
            user={user} 
            companyId={user.companyId} 
            employees={[{id: user.uid, ...user}]} 
            onSaveProfile={handleSaveProfile}
            onImageUpload={handleImageUpload}
        />
      )}

      {/* TEAM PLANUNG (Nur für Leads) */}
      {tab === 'team_planning' && isLead && (
          <div className="h-[calc(100vh-140px)]">
              <SchedulePlanner 
                employees={teamMembers} 
                companyId={user.companyId} 
                currentUser={user} // Wichtig für Berechtigungen!
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
    </DashboardLayout>
  );
};