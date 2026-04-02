import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, Trash2, Save, 
  Briefcase, Settings, Download, User, MapPin, Shield, Calendar, Clock, Loader2, X 
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths 
} from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

// UI Components
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal'; 
import { Badge } from '../ui/Badge';

export const SchedulePlanner = ({ employees = [], companyId, onViewProfile, currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [objects, setObjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals & State
  const [editingShift, setEditingShift] = useState(null);
  const [showObjectsModal, setShowObjectsModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  
  // States für neue Objekte & Vorlagen (Logik aus GitHub)
  const [editingObject, setEditingObject] = useState(null);
  const [newObject, setNewObject] = useState({ 
      name: '', address: '', client: '', uniform: '', notes: '', assignedLeadId: '' 
  });
  const [newTemplate, setNewTemplate] = useState({ name: '', startTime: '06:00', endTime: '18:00' });

  // Berechtigungen sicher prüfen (Boss, Einsatzleiter, Objektleiter)
  const isBoss = currentUser?.type === 'provider';
  const isTeamLead = currentUser?.role === 'team_lead';
  const isObjLead = currentUser?.role === 'obj_lead';
  const hasFullAccess = isBoss || isTeamLead;

  // --- DATEN LADEN (Echtzeit-Synchronisation aus GitHub) ---
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }).toISOString().split('T')[0];
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }).toISOString().split('T')[0];

    // 1. Schichten (Echtzeit)
    const qS = query(collection(db, "companies", companyId, "shifts"), where("date", ">=", start), where("date", "<=", end));
    const unsubShifts = onSnapshot(qS, (snap) => {
        setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
    });

    // 2. Objekte (Filter-Logik für Objektleiter integriert)
    const unsubObjects = onSnapshot(collection(db, "companies", companyId, "objects"), (snap) => {
        const allO = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setObjects(isObjLead ? allO.filter(o => o.assignedLeadId === currentUser.uid) : allO);
    });

    // 3. Vorlagen
    const unsubTemplates = onSnapshot(collection(db, "companies", companyId, "shiftTemplates"), (snap) => {
        setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubShifts(); unsubObjects(); unsubTemplates(); };
  }, [companyId, currentDate, currentUser?.uid]);

  // --- HANDLERS: SCHICHTEN ---
  const handleCellClick = (employeeId, dateStr) => {
    const existing = shifts.find(s => s.employeeId === employeeId && s.date === dateStr);
    
    // Berechtigungs-Check für Objektleiter
    if (isObjLead && existing?.objectId && !objects.find(o => o.id === existing.objectId)) {
        alert("Sie verwalten dieses Objekt nicht."); return;
    }

    if (existing) {
        setEditingShift({ ...existing });
    } else {
        setEditingShift({ 
            employeeId, date: dateStr, startTime: '06:00', endTime: '18:00', 
            objectId: objects[0]?.id || '' 
        });
    }
  };

  const handleSaveShift = async () => {
    try {
        const selectedObj = objects.find(o => o.id === editingShift.objectId);
        const shiftData = {
            employeeId: editingShift.employeeId,
            date: editingShift.date,
            startTime: editingShift.startTime,
            endTime: editingShift.endTime,
            objectId: editingShift.objectId || null,
            location: selectedObj?.name || 'Kein Objekt',
            objectAddress: selectedObj?.address || ''
        };

        if (editingShift.id) {
            await updateDoc(doc(db, "companies", companyId, "shifts", editingShift.id), shiftData);
        } else {
            await addDoc(collection(db, "companies", companyId, "shifts"), shiftData);
        }
        setEditingShift(null);
    } catch (e) { console.error(e); }
  };

  // --- HANDLERS: OBJEKTE ---
  const handleSaveObject = async () => {
      if(!newObject.name) return;
      if (editingObject) await updateDoc(doc(db, "companies", companyId, "objects", editingObject.id), newObject);
      else await addDoc(collection(db, "companies", companyId, "objects"), newObject);
      setNewObject({ name: '', address: '', client: '', uniform: '', notes: '', assignedLeadId: '' });
      setEditingObject(null);
  };

  // --- PDF EXPORT (Logik aus GitHub) ---
  const exportPDF = () => {
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      pdf.text(`Dienstplan - ${format(currentDate, 'MMMM yyyy', {locale: de})}`, 14, 15);
      const days = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }) });
      const head = ['MA', ...days.filter(d => isSameMonth(d, monthStart)).map(d => format(d, 'dd'))];
      const body = employees.map(emp => [
          emp.name, 
          ...days.filter(d => isSameMonth(d, monthStart)).map(d => {
              const s = shifts.find(x => x.employeeId === emp.id && x.date === format(d, 'yyyy-MM-dd'));
              return s ? `${s.startTime}-${s.endTime}` : '';
          })
      ]);
      autoTable(pdf, { head: [head], body, startY: 25, styles: { fontSize: 7 } });
      pdf.save("Dienstplan.pdf");
  };

  const monthStart = startOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ 
      start: startOfWeek(monthStart, { weekStartsOn: 1 }), 
      end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }) 
  });

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      {/* TOOLBAR (Screenshot Design) */}
      <Card className="p-4 flex flex-wrap items-center justify-between gap-4 bg-white/90 backdrop-blur shadow-xl border-slate-100 rounded-[2rem]">
        <div className="flex items-center gap-6">
            <div className="flex items-center bg-slate-100/50 p-1.5 rounded-2xl border border-slate-100">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronLeft size={20}/></button>
                <div className="px-6 flex flex-col items-center min-w-[160px]">
                    <span className="text-sm font-black text-slate-900 capitalize mb-1">{format(currentDate, 'MMMM yyyy', { locale: de })}</span>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Planung</span>
                </div>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"><ChevronRight size={20}/></button>
            </div>
            {loading && <Loader2 className="animate-spin text-blue-600 h-5 w-5"/>}
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTemplatesModal(true)} className="rounded-2xl border-slate-200"><Settings size={18} className="mr-2"/> Vorlagen</Button>
            {hasFullAccess && <Button variant="outline" onClick={() => setShowObjectsModal(true)} className="rounded-2xl border-slate-200"><Briefcase size={18} className="mr-2"/> Objekte</Button>}
            <Button variant="primary" onClick={exportPDF} className="rounded-2xl bg-blue-600 shadow-lg shadow-blue-100"><Download size={18} className="mr-2"/> PDF Export</Button>
        </div>
      </Card>

      {/* MATRIX GRID (Screenshot Design) */}
      <Card className="flex-1 overflow-hidden border-slate-200 rounded-[2.5rem] shadow-2xl bg-white relative">
        <div className="overflow-auto h-full scrollbar-thin scrollbar-thumb-slate-200">
            <table className="w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-30 bg-white shadow-sm">
                    <tr>
                        <th className="p-6 text-left sticky left-0 bg-white z-40 border-b border-r border-slate-100 min-w-[220px]">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mitarbeiter</div>
                        </th>
                        {calendarDays.map(day => (
                            <th key={day.toString()} className={`p-4 text-center border-b border-r border-slate-50 min-w-[65px] ${!isSameMonth(day, monthStart) ? 'opacity-20' : ''} ${isSameDay(day, new Date()) ? 'bg-blue-50/50' : ''}`}>
                                <div className="text-[11px] font-bold text-slate-400 mb-1">{format(day, 'EEE', { locale: de })}</div>
                                <div className={`text-lg font-black ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-slate-900'}`}>{format(day, 'dd')}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {employees.map(emp => (
                        <tr key={emp.id} className="group hover:bg-slate-50/30 transition-all">
                            <td onClick={() => onViewProfile && onViewProfile(emp.id)} className="p-4 sticky left-0 bg-white z-20 border-r border-slate-100 font-black text-sm text-slate-700 cursor-pointer hover:text-blue-600">
                                {emp.name}
                                <div className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{emp.role}</div>
                            </td>
                            {calendarDays.map(day => {
                                const dStr = format(day, 'yyyy-MM-dd');
                                const shift = shifts.find(s => s.employeeId === emp.id && s.date === dStr);
                                const isCurrent = isSameMonth(day, monthStart);
                                return (
                                    <td key={dStr} onClick={() => isCurrent && handleCellClick(emp.id, dStr)} className={`border-r border-slate-50 p-1 h-20 transition-all ${!isCurrent ? 'bg-slate-50/30' : 'hover:bg-blue-50/20'} cursor-pointer`}>
                                        {shift && (
                                            <div className="h-full bg-blue-600 text-white rounded-2xl p-2 shadow-lg shadow-blue-200/40 flex flex-col justify-center overflow-hidden animate-in zoom-in-95">
                                                <div className="text-[10px] font-black leading-tight flex items-center gap-1"><Clock size={10}/> {shift.startTime}</div>
                                                <div className="text-[10px] font-black leading-tight flex items-center gap-1 mb-1"><Clock size={10}/> {shift.endTime}</div>
                                                <div className="text-[8px] font-bold truncate border-t border-white/20 pt-1 uppercase tracking-tighter">{shift.location}</div>
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </Card>

      {/* MODAL: SCHICHT BEARBEITEN */}
      {editingShift && (
        <Modal title="Dienst bearbeiten" onClose={() => setEditingShift(null)}>
            <div className="space-y-6">
                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><Calendar size={24}/></div>
                    <div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Datum</div><div className="text-lg font-black text-slate-900">{format(new Date(editingShift.date), 'EEEE, dd.MM.yyyy', { locale: de })}</div></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase ml-1">Beginn</label><input type="time" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all" value={editingShift.startTime} onChange={e => setEditingShift({...editingShift, startTime: e.target.value})} /></div>
                    <div className="space-y-2"><label className="text-xs font-black text-slate-400 uppercase ml-1">Ende</label><input type="time" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all" value={editingShift.endTime} onChange={e => setEditingShift({...editingShift, endTime: e.target.value})} /></div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase ml-1">Einsatzobjekt</label>
                    <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all" value={editingShift.objectId || ''} onChange={e => setEditingShift({...editingShift, objectId: e.target.value})}>
                        <option value="">Objekt wählen...</option>
                        {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                </div>
                <div className="flex gap-3 pt-4">
                    {editingShift.id && <button onClick={async () => { if(confirm("Schicht löschen?")) { await deleteDoc(doc(db, "companies", companyId, "shifts", editingShift.id)); setEditingShift(null); } }} className="flex-1 p-4 bg-red-50 text-red-600 font-black rounded-2xl hover:bg-red-100 transition-all uppercase tracking-widest text-[10px]">Löschen</button>}
                    <button onClick={handleSaveShift} className="flex-[2] p-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest text-[10px]">Speichern</button>
                </div>
            </div>
        </Modal>
      )}

      {/* MODAL: OBJEKTE VERWALTEN (GitHub Logik) */}
      {showObjectsModal && (
        <Modal title="Objekte" onClose={() => setShowObjectsModal(false)}>
            <div className="space-y-4">
                <input className="w-full p-4 border rounded-2xl font-bold bg-slate-50 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50" placeholder="Objektname" value={newObject.name} onChange={e => setNewObject({...newObject, name: e.target.value})} />
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <label className="text-[10px] font-black text-blue-600 uppercase mb-2 block">Leitung zuweisen</label>
                    <select className="w-full bg-transparent font-bold outline-none" value={newObject.assignedLeadId} onChange={e => setNewObject({...newObject, assignedLeadId: e.target.value})}>
                        <option value="">-- Keine Leitung --</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                </div>
                <Button className="w-full rounded-2xl" onClick={handleSaveObject}>Objekt speichern</Button>
                <div className="max-h-60 overflow-y-auto space-y-2 pt-4 border-t">
                    {objects.map(o => (
                        <div key={o.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="font-black text-slate-700">{o.name}</span>
                            <button onClick={async () => { if(confirm("Löschen?")) await deleteDoc(doc(db, "companies", companyId, "objects", o.id)); }} className="text-red-500 hover:bg-red-50 p-2 rounded-xl"><Trash2 size={18}/></button>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
};