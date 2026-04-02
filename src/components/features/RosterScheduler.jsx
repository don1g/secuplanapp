import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Download, Mail, Phone, MapPin, 
  Clock, Info, User, Save, Upload, CreditCard, Shirt, 
  FileText, Car, X, Loader2, Calendar 
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths 
} from 'date-fns';
import { de } from 'date-fns/locale';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { EMP_ROLES } from '../../utils/constants';

export const RosterScheduler = ({ user, employees = [], companyId, targetUserId, onSaveProfile, onImageUpload }) => {
  const [date, setDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [objects, setObjects] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const activeUserId = targetUserId || user.uid;
  const activeUser = employees.find(e => e.id === activeUserId) || { name: "Mitarbeiter" };
  const isOwnProfile = user.uid === activeUser.id;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (!companyId) return;
    setIsLoading(true);
    
    // Echtzeit-Sync für Schichten
    const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 }).toISOString().split('T')[0];
    const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 }).toISOString().split('T')[0];
    
    const qShifts = query(collection(db, "companies", companyId, "shifts"), where("date", ">=", start), where("date", "<=", end));
    const unsubShifts = onSnapshot(qShifts, (snap) => {
        setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setIsLoading(false);
    });

    // Objekte laden
    const unsubObjects = onSnapshot(collection(db, "companies", companyId, "objects"), (snap) => {
        setObjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubShifts(); unsubObjects(); };
  }, [date, companyId]);

  useEffect(() => {
      if (activeUser) {
          setFormData({
              phone: activeUser.phone || '',
              address: activeUser.address || '',
              iban: activeUser.iban || '',
              taxId: activeUser.taxId || '',
              shirtSize: activeUser.shirtSize || 'M',
              hasLicense: activeUser.hasLicense || false
          });
      }
  }, [activeUser]);

  const handleSave = () => {
      if (onSaveProfile) {
          onSaveProfile(formData);
          setIsEditing(false);
      }
  };

  const exportPDF = () => {
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    pdf.text(`Dienstplan - ${activeUser.name}`, 14, 15);
    const tableData = shifts
        .filter(s => s.employeeId === activeUserId && isSameMonth(new Date(s.date), date))
        .map(s => [s.date, s.startTime, s.endTime, s.location]);
    autoTable(pdf, { head: [['Datum', 'Von', 'Bis', 'Objekt']], body: tableData, startY: 25 });
    pdf.save(`Plan_${activeUser.name}.pdf`);
  };

  const days = eachDayOfInterval({ 
      start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }), 
      end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }) 
  });
  
  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full animate-in fade-in duration-500">
      
      {/* LINKE SPALTE: PROFIL-ZENTRALE (Screenshot Design) */}
      <Card className="w-full lg:w-[380px] flex-shrink-0 p-8 flex flex-col h-fit bg-white rounded-[2.5rem] shadow-2xl border-slate-100">
        <div className="flex flex-col items-center text-center relative">
            <div className="relative group mb-6">
                <div 
                    onClick={() => !isEditing && setShowImageModal(true)} 
                    className={`h-44 w-44 rounded-[3rem] overflow-hidden bg-white p-2 shadow-2xl border border-slate-50 transition-all duration-500 ${!isEditing ? 'cursor-zoom-in hover:scale-105' : ''}`}
                >
                    <Avatar src={activeUser.imageUrl} alt={activeUser.name} size="full" className="rounded-[2.5rem]" />
                </div>
                {isOwnProfile && isEditing && (
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-[3rem] cursor-pointer text-white animate-in fade-in">
                        <Upload size={28}/>
                        <input type="file" className="hidden" onChange={onImageUpload} />
                    </label>
                )}
            </div>
            
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">{activeUser.name}</h2>
            <div className="flex items-center gap-2 mb-6">
                <Badge color="blue" className="px-4 py-1 uppercase text-[9px] font-black tracking-widest">{EMP_ROLES[activeUser.role]?.label || activeUser.role}</Badge>
                <div className="h-2 w-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
            </div>

            {isOwnProfile && (
                <button 
                    onClick={() => setIsEditing(!isEditing)}
                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all mb-8 ${isEditing ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600 shadow-lg shadow-blue-50 hover:bg-blue-600 hover:text-white'}`}
                >
                    {isEditing ? "Abbrechen" : "Profil anpassen"}
                </button>
            )}
        </div>

        <div className="space-y-4">
            <div className={`p-5 rounded-[1.5rem] border transition-all ${isEditing ? 'bg-white border-blue-200 ring-4 ring-blue-50' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600"><Phone size={16}/></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Erreichbarkeit</span>
                </div>
                {isEditing ? (
                    <input className="w-full bg-transparent border-none font-bold text-slate-900 outline-none p-0" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+49..." />
                ) : (
                    <div className="font-bold text-slate-900">{activeUser.phone || "Nicht hinterlegt"}</div>
                )}
            </div>

            <div className={`p-5 rounded-[1.5rem] border transition-all ${isEditing ? 'bg-white border-blue-200 ring-4 ring-blue-50' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600"><MapPin size={16}/></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wohnort</span>
                </div>
                {isEditing ? (
                    <textarea rows="2" className="w-full bg-transparent border-none font-bold text-slate-900 outline-none p-0 resize-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Straße, PLZ Stadt" />
                ) : (
                    <div className="font-bold text-slate-900 whitespace-pre-wrap">{activeUser.address || "Nicht hinterlegt"}</div>
                )}
            </div>

            {isEditing && (
                <Button className="w-full py-5 rounded-2xl shadow-xl shadow-blue-200 font-black uppercase tracking-widest text-xs mt-4" onClick={handleSave} icon={Save}>
                    Speichern
                </Button>
            )}
        </div>
      </Card>

      {/* RECHTE SPALTE: DIENSTPLAN-KALENDER (Screenshot Design) */}
      <Card className="flex-1 overflow-hidden flex flex-col min-h-[600px] bg-white rounded-[3rem] shadow-2xl border-slate-100">
        <div className="p-8 flex justify-between items-center border-b border-slate-50">
          <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Einsatzplan</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Persönliche Schichtübersicht</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={exportPDF} className="rounded-2xl border-slate-100 shadow-sm" icon={Download}>Export</Button>
            <div className="flex items-center bg-slate-50 p-1 rounded-2xl border border-slate-100">
              <button onClick={() => setDate(subMonths(date, 1))} className="p-3 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-blue-600"><ChevronLeft size={20}/></button>
              <span className="px-6 text-sm font-black text-slate-900 capitalize min-w-[140px] text-center">{format(date, 'MMMM yyyy', { locale: de })}</span>
              <button onClick={() => setDate(addMonths(date, 1))} className="p-3 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-blue-600"><ChevronRight size={20}/></button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-7 border-b border-slate-50 bg-slate-50/30">
            {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d=><div key={d} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{d}</div>)}
        </div>
        
        <div className="grid grid-cols-7 auto-rows-fr bg-slate-100/50 gap-px flex-1">
          {days.map(d => {
            const dStr = format(d, 'yyyy-MM-dd');
            const isToday = isSameDay(d, new Date());
            const dayShifts = shifts.filter(s => s.date === dStr && s.employeeId === activeUserId);
            const isCurrentMonth = isSameMonth(d, date);
            
            return (
              <div key={dStr} className={`bg-white p-3 min-h-[110px] flex flex-col transition-all ${!isCurrentMonth ? 'opacity-30 bg-slate-50/50' : 'hover:bg-slate-50/50'}`}>
                <span className={`text-[11px] font-black w-8 h-8 flex items-center justify-center rounded-xl mb-2 ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400'}`}>
                    {format(d, 'd')}
                </span>
                <div className="flex-1 flex flex-col gap-2">
                  {dayShifts.map((s, i) => {
                    const obj = objects.find(o => o.id === s.objectId);
                    return (
                        <div 
                            key={i} 
                            onClick={() => setSelectedShift({ ...s, objectDetails: obj })} 
                            className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-[10px] font-black rounded-xl p-3 shadow-lg shadow-blue-200 cursor-pointer hover:scale-[1.03] transition-all animate-in zoom-in-95"
                        >
                            <div className="flex items-center gap-1.5 mb-1 opacity-90"><Clock size={10}/> {s.startTime} - {s.endTime}</div>
                            <div className="truncate uppercase tracking-tighter border-t border-white/20 pt-1.5">{obj?.name || s.location}</div>
                        </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* DETAIL MODAL (Screenshot Design mit Zeit-Banner) */}
      {selectedShift && (
        <Modal title="Einsatzdetails" onClose={() => setSelectedShift(null)}>
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-[2rem] shadow-2xl shadow-blue-200 flex items-center gap-5">
                    <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md shadow-inner"><Clock className="text-white h-10 w-10"/></div>
                    <div>
                        <div className="text-[10px] font-black text-blue-100 uppercase tracking-widest mb-1">Dienstzeit</div>
                        <div className="text-xl font-black">{format(new Date(selectedShift.date), 'EEEE, dd.MM.yyyy', { locale: de })}</div>
                        <div className="text-lg font-bold opacity-90">{selectedShift.startTime} Uhr - {selectedShift.endTime} Uhr</div>
                    </div>
                </div>

                <div className="grid gap-4">
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><MapPin size={12} className="text-blue-500"/> Einsatzort</div>
                        <div className="text-xl font-black text-slate-900">{selectedShift.objectDetails?.name || selectedShift.location || "Unbekannt"}</div>
                        {selectedShift.objectDetails?.address && <div className="text-slate-500 font-medium text-sm mt-1">{selectedShift.objectDetails.address}</div>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {selectedShift.objectDetails?.client && (
                            <div className="bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><User size={12} className="text-blue-500"/> Kunde</div>
                                <div className="text-sm font-bold text-slate-800">{selectedShift.objectDetails.client}</div>
                            </div>
                        )}
                        {selectedShift.objectDetails?.uniform && (
                            <div className="bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><Shirt size={12} className="text-blue-500"/> Kleidung</div>
                                <div className="text-sm font-bold text-slate-800">{selectedShift.objectDetails.uniform}</div>
                            </div>
                        )}
                    </div>

                    {selectedShift.objectDetails?.notes && (
                        <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-600"><Info size={40}/></div>
                            <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Instruktionen</div>
                            <div className="text-sm text-amber-900 font-medium leading-relaxed whitespace-pre-wrap">{selectedShift.objectDetails.notes}</div>
                        </div>
                    )}
                </div>
                
                <button onClick={() => setSelectedShift(null)} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-black transition-all shadow-xl">Schließen</button>
            </div>
        </Modal>
      )}

      {/* LIGHTBOX MODAL */}
      {showImageModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-10 animate-in fade-in" onClick={() => setShowImageModal(false)}>
            <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
                <button className="absolute -top-16 right-0 text-white/40 hover:text-white transition-all hover:rotate-90" onClick={() => setShowImageModal(false)}><X size={48} /></button>
                <img src={activeUser.imageUrl} className="max-w-full max-h-full object-contain rounded-[3rem] shadow-[0_0_80px_rgba(0,0,0,0.5)] animate-in zoom-in-95" alt="Profilbild" />
            </div>
        </div>
      )}
    </div>
  );
};