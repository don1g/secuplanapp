import React, { useState, useEffect } from 'react';
import { Search, Mail, Filter, MapPin, ArrowLeft, Loader2, User, Save, Phone, Upload, X, Trash2 } from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { ChatSystem } from '../components/features/ChatSystem';
import { PostItem } from '../components/features/PostItem';

export const ClientDashboard = ({ onLogout }) => {
  const [view, setView] = useState('search');
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [firmPosts, setFirmPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Profil Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [profileData, setProfileData] = useState({
      name: auth.currentUser?.displayName || "",
      phone: "",
      address: ""
  });

  useEffect(() => {
      if (auth.currentUser) {
          setProfileData({
              name: auth.currentUser.displayName || "",
              phone: "", 
              address: "" 
          });
      }
  }, []);

  useEffect(() => {
    const loadFirms = async () => {
      setLoading(true);
      const q = query(collection(db, "companies"), where("isVisible", "==", true));
      const snap = await getDocs(q);
      setFirms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    loadFirms();
  }, []);

  useEffect(() => {
    if (selectedFirm) {
        const loadPosts = async () => {
            const q = query(collection(db, "companies", selectedFirm.id, "posts"));
            const snap = await getDocs(q);
            setFirmPosts(snap.docs.map(d => ({id: d.id, ...d.data()})));
        };
        loadPosts();
    }
  }, [selectedFirm]);

  const handleSaveProfile = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
          await updateDoc(doc(db, "users", auth.currentUser.uid), {
              name: profileData.name,
              phone: profileData.phone,
              address: profileData.address
          });
          setIsEditing(false);
          alert("Profil gespeichert!");
      } catch (e) {
          console.error(e);
          alert("Fehler beim Speichern.");
      }
      setLoading(false);
  };

  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file || !auth.currentUser) return;
      setLoading(true);
      try {
          const sRef = ref(storage, `avatars/${auth.currentUser.uid}`);
          await uploadBytes(sRef, file);
          const url = await getDownloadURL(sRef);
          await updateDoc(doc(db, "users", auth.currentUser.uid), { imageUrl: url });
          window.location.reload(); 
      } catch (e) { console.error(e); }
      setLoading(false);
  };

  // --- BILD LÖSCHEN (Korrigiert) ---
  const handleDeleteImage = async (e) => {
      if(e) e.stopPropagation(); // Verhindert Klicks auf darunterliegende Elemente
      if (!auth.currentUser) return;
      if (!confirm("Profilbild wirklich löschen?")) return;
      
      setLoading(true);
      try {
          // Löscht das Feld 'imageUrl' aus der Datenbank
          await updateDoc(doc(db, "users", auth.currentUser.uid), { imageUrl: deleteField() });
          alert("Bild gelöscht!");
          window.location.reload(); 
      } catch (e) {
          console.error(e);
          alert("Fehler beim Löschen.");
      }
      setLoading(false);
  };

  const filteredFirms = firms.filter(f => 
    !searchTerm || f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const menu = [
    { id: 'search', name: 'Suche', icon: <Search size={20}/> },
    { id: 'chat', name: 'Nachrichten', icon: <Mail size={20}/> },
    { id: 'profile', name: 'Mein Profil', icon: <User size={20}/> }
  ];

  return (
    <DashboardLayout title="Marktplatz" user={auth.currentUser} sidebarItems={menu} activeTab={view} onTabChange={(t) => { setView(t); setSelectedFirm(null); }} onLogout={onLogout}>
      
      {/* VIEW: SUCHE */}
      {view === 'search' && !selectedFirm && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex gap-2">
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                <input 
                    className="w-full pl-10 p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500" 
                    placeholder="Sicherheitsfirma suchen..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Button icon={Filter} variant="outline">Filter</Button>
          </div>
          
          {loading ? <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600"/></div> : (
            <div className="space-y-4">
                {filteredFirms.map(f => (
                <Card key={f.id} onClick={() => { setSelectedFirm(f); setView('details'); }} className="p-4 flex gap-4 cursor-pointer hover:border-blue-400 transition-all">
                    <Avatar src={f.imageUrl} alt={f.name} size="lg" />
                    <div>
                        <h3 className="font-bold text-lg text-slate-900">{f.name}</h3>
                        <div className="text-sm text-slate-500 flex gap-2 mb-2 items-center"><MapPin size={14}/> {f.address || "Keine Adresse"}</div>
                        <div className="text-blue-600 font-bold bg-blue-50 inline-block px-2 py-0.5 rounded text-sm">
                            {f.showPrice !== false ? `ab ${f.price}€ / Std` : 'Preis auf Anfrage'}
                        </div>
                    </div>
                </Card>
                ))}
                {filteredFirms.length === 0 && <div className="text-center text-slate-400 py-10">Keine Firmen gefunden.</div>}
            </div>
          )}
        </div>
      )}

      {/* VIEW: DETAILS */}
      {view === 'details' && selectedFirm && (
        <div className="space-y-6 animate-in fade-in">
          <Button variant="ghost" onClick={() => setSelectedFirm(null)} icon={ArrowLeft} size="sm">Zurück zur Suche</Button>
          <Card className="overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-400"></div>
            <div className="px-8 pb-6 -mt-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div className="flex items-end gap-4">
                  <Avatar src={selectedFirm.imageUrl} alt={selectedFirm.name} size="xl" className="bg-white border-4 border-white shadow-md"/>
                  <div className="mb-2">
                      <h1 className="text-2xl font-bold text-slate-900">{selectedFirm.name}</h1>
                      <p className="text-slate-500 flex items-center gap-1"><MapPin size={14}/> {selectedFirm.address}</p>
                  </div>
              </div>
              <Button onClick={() => setView('chat')} icon={Mail} className="mb-2">Kontaktieren</Button>
            </div>
            
            <div className="p-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    <div>
                        <h3 className="font-bold text-slate-900 mb-2">Über uns</h3>
                        <p className="text-slate-600 leading-relaxed">{selectedFirm.description || "Keine Beschreibung verfügbar."}</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 mb-4">Neuigkeiten</h3>
                        {firmPosts.length > 0 ? (
                            firmPosts.map(p => <PostItem key={p.id} post={p} companyId={selectedFirm.id} />)
                        ) : <div className="text-slate-400 italic">Keine Beiträge.</div>}
                    </div>
                </div>
                <div>
                    <Card className="p-4 bg-slate-50 border-slate-200">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-1">Stundensatz</div>
                        <div className="text-2xl font-bold text-blue-600 mb-4">{selectedFirm.price}€</div>
                        <div className="text-xs text-slate-400">Die Preise können je nach Auftrag variieren.</div>
                    </Card>
                </div>
            </div>
          </Card>
        </div>
      )}

      {/* VIEW: CHAT */}
      {view === 'chat' && (
        <div className="h-[calc(100vh-140px)]">
            <ChatSystem user={auth.currentUser} userRole="client" targetId={selectedFirm?.id} targetName={selectedFirm?.name} isEmbedded={true} />
        </div>
      )}

      {/* VIEW: PROFIL */}
      {view === 'profile' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
              <Card className="p-6 flex flex-col md:flex-row items-center gap-6">
                  
                  <div className="relative group">
                      <div onClick={() => !isEditing && setShowImageModal(true)} className={!isEditing ? "cursor-zoom-in hover:opacity-90 transition-opacity" : ""}>
                          <Avatar src={auth.currentUser?.photoURL} alt={profileData.name} size="xl" className="shadow-lg"/>
                      </div>
                      
                      {/* Upload & Löschen Overlay (Nur wenn isEditing) */}
                      {isEditing && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl gap-4 animate-in fade-in">
                              
                              {/* 1. Upload Knopf */}
                              <label className="cursor-pointer text-white hover:text-blue-200" title="Neues Bild hochladen">
                                  <Upload size={24}/> 
                                  <input type="file" className="hidden" onChange={handleImageUpload}/>
                              </label>

                              {/* 2. Löschen Knopf */}
                              {auth.currentUser?.photoURL && (
                                <button onClick={handleDeleteImage} className="text-white hover:text-red-500 cursor-pointer" title="Bild löschen">
                                    <Trash2 size={24}/>
                                </button>
                              )}
                              
                          </div>
                      )}
                  </div>

                  <div className="text-center md:text-left flex-1">
                      <h2 className="text-2xl font-bold text-slate-900">{profileData.name || "Kunde"}</h2>
                      <div className="text-slate-500">{auth.currentUser?.email}</div>
                  </div>
                  <Button variant={isEditing ? 'ghost' : 'primary'} onClick={() => setIsEditing(!isEditing)}>
                      {isEditing ? 'Abbrechen' : 'Profil bearbeiten'}
                  </Button>
              </Card>

              <Card className="p-6 space-y-6">
                  <h3 className="font-bold text-lg border-b pb-2 mb-4">Meine Daten</h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Name</label>
                          <input 
                              disabled={!isEditing} 
                              className="w-full p-2 border rounded bg-white disabled:bg-slate-50"
                              value={profileData.name}
                              onChange={e => setProfileData({...profileData, name: e.target.value})}
                              placeholder="Ihr Name"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Phone size={12}/> Telefon</label>
                          <input 
                              disabled={!isEditing} 
                              className="w-full p-2 border rounded bg-white disabled:bg-slate-50"
                              value={profileData.phone}
                              onChange={e => setProfileData({...profileData, phone: e.target.value})}
                              placeholder="+49..."
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><MapPin size={12}/> Adresse</label>
                          <input 
                              disabled={!isEditing} 
                              className="w-full p-2 border rounded bg-white disabled:bg-slate-50"
                              value={profileData.address}
                              onChange={e => setProfileData({...profileData, address: e.target.value})}
                              placeholder="Straße, PLZ Stadt"
                          />
                      </div>
                  </div>

                  {isEditing && (
                      <div className="pt-4 flex justify-end">
                          <Button onClick={handleSaveProfile} disabled={loading} icon={Save}>
                              {loading ? 'Speichert...' : 'Änderungen speichern'}
                          </Button>
                      </div>
                  )}
              </Card>
          </div>
      )}

      {/* BILD MODAL */}
      {showImageModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-in fade-in" onClick={() => setShowImageModal(false)}>
            <div className="relative max-w-4xl w-full h-full flex items-center justify-center">
                <button className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full backdrop-blur-sm" onClick={() => setShowImageModal(false)}>
                    <X size={24} />
                </button>
                <img src={auth.currentUser?.photoURL} className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
            </div>
        </div>
      )}

    </DashboardLayout>
  );
};