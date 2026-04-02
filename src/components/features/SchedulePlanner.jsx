import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, Trash2, Save, Edit2,
  Briefcase, Settings, Download, User, MapPin, Shield, Calendar, Clock, Loader2, X, Info, Shirt, Car, CheckCircle, Phone, FileText 
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

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal'; 
import { Badge } from '../ui/Badge';

export const SchedulePlanner = ({ employees = [], companyId, onViewProfile, currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [showObjectsModal, setShowObjectsModal] = useState(false);
  
  // State für die Objekt-Bearbeitung
  const [editingObjectId, setEditingObjectId] = useState(null);
  const [newObject, setNewObject] = useState({ 
    name: '', 
    address: '', 
    client: '', 
    uniform: 'Standard', 
    parkingInfo: '', 
    contactPerson: '',
    notes: ''
  });

  const isBoss = currentUser?.type === 'provider';
  const isTeamLead = currentUser?.role === 'team_lead';
  const hasFullAccess = isBoss || isTeamLead;

  // Daten laden
  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }).toISOString().split('T')[0];
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }).toISOString().split('T')[0];

    const unsubShifts = onSnapshot(query(collection(db, "companies", companyId, "shifts"), where("date", ">=", start), where("date", "<=", end)), (snap) => {
        setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
    });

    const unsubObjects = onSnapshot(collection(db, "companies", companyId, "objects"), (snap) => {
        setObjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubShifts(); unsubObjects(); };
  }, [companyId, currentDate]);

  const handleCellClick = (employeeId, dateStr) => {
    const existing = shifts.find(s => s.employeeId === employeeId && s.date === dateStr);
    const emp = employees.find(e => e.id === employeeId);
    
    if (existing) {
        setEditingShift({ ...existing });
    } else {
        setEditingShift({ 
            employeeId, 
            employeeName: emp?.name || 'Mitarbeiter',
            date: dateStr, 
            startTime: '06:00', 
            endTime: '18:00', 
            objectId: '',
            location: '',
            isDriver: false,
            parkingInfo: '',
            contactPerson: '',
            uniform: 'Standard',
            additionalInfo: '',
            isConfirmed: false
        });
    }
  };

  const handleSaveShift = async () => {
    try {
        const shiftData = {
            ...editingShift,
            updatedAt: new Date().toISOString()
        };

        if (editingShift.id) {
            await updateDoc(doc(db, "companies", companyId, "shifts", editingShift.id), shiftData);
        } else {
            await addDoc(collection(db, "companies", companyId, "shifts"), shiftData);
        }
        setEditingShift(null);
    } catch (e) { console.error(e); }
  };

  const handleSaveObject = async () => {
      if(!newObject.name) return;
      try {
          if (editingObjectId) {
              // Bestehendes Objekt aktualisieren
              await updateDoc(doc(db, "companies", companyId, "objects", editingObjectId), newObject);
          } else {
              // Neues Objekt anlegen
              await addDoc(collection(db, "companies", companyId, "objects"), newObject);
          }
          // Formular zurücksetzen
          setNewObject({ name: '', address: '', client: '', uniform: 'Standard', parkingInfo: '', contactPerson: '', notes: '' });
          setEditingObjectId(null);
      } catch (e) { console.error(e); }
  };

  const startEditObject = (obj) => {
      setNewObject({
          name: obj.name || '',
          address: obj.address || '',
          client: obj.client || '',
          uniform: obj.uniform || 'Standard',
          parkingInfo: obj.parkingInfo || '',
          contactPerson: obj.contactPerson || '',
          notes: obj.notes || ''
      });
      setEditingObjectId(obj.id);
  };

  const monthStart = startOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }) });

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in">
      {/* TOOLBAR */}
      <Card className="p-3 flex items-center justify-between bg-white shadow-lg rounded-2xl border-slate-100">
        <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-50 p-1 rounded-xl">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronLeft size={18}/></button>
                <span className="text-sm font-bold text-slate-900 w-32 text-center capitalize">{format(currentDate, 'MMMM yyyy', { locale: de })}</span>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-white rounded-lg transition-all"><ChevronRight size={18}/></button>
            </div>
            {loading && <Loader2 className="animate-spin text-blue-600 h-4 w-4"/>}
        </div>
        {hasFullAccess && <Button variant="outline" size="sm" onClick={() => { 
            setEditingObjectId(null); 
            setNewObject({ name: '', address: '', client: '', uniform: 'Standard', parkingInfo: '', contactPerson: '', notes: '' });
            setShowObjectsModal(true); 
        }} icon={Briefcase}>Objekte verwalten</Button>}
      </Card>

      {/* DIENSTPLAN MATRIX */}
      <Card className="flex-1 overflow-hidden rounded-2xl shadow-xl bg-white border-slate-100">
        <div className="overflow-auto h-full scrollbar-thin">
            <table className="w-full border-separate border-spacing-0 text-slate-900 text-xs">
                <thead className="sticky top-0 z-30 bg-white/95 backdrop-blur shadow-sm">
                    <tr>
                        <th className="p-4 text-left sticky left-0 bg-white z-40 border-b border-r border-slate-100 min-w-[160px] font-black uppercase text-slate-400">Mitarbeiter</th>
                        {calendarDays.map(day => (
                            <th key={day.toString()} className={`p-2 text-center border-b border-r border-slate-50 min-w-[60px] ${!isSameMonth(day, monthStart) ? 'opacity-20' : ''}`}>
                                <div className={`font-bold ${format(day, 'EEE', { locale: de }) === 'So' ? 'text-red-500' : 'text-slate-400'}`}>{format(day, 'EEE', { locale: de })}</div>
                                <div className={`font-black ${format(day, 'EEE', { locale: de }) === 'So' ? 'text-red-600' : ''}`}>{format(day, 'dd')}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {employees.map(emp => (
                        <tr key={emp.id} className="group hover:bg-slate-50/50">
                            <td onClick={() => onViewProfile(emp.id)} className="p-3 sticky left-0 bg-white z-20 border-r border-slate-100 font-bold text-slate-700 cursor-pointer hover:text-blue-600 transition-all">{emp.name}</td>
                            {calendarDays.map(day => {
                                const dStr = format(day, 'yyyy-MM-dd');
                                const shift = shifts.find(s => s.employeeId === emp.id && s.date === dStr);
                                return (
                                    <td key={dStr} onClick={() => isSameMonth(day, monthStart) && handleCellClick(emp.id, dStr)} className={`border-r border-slate-50 p-1 h-14 transition-all ${!isSameMonth(day, monthStart) ? 'bg-slate-50/30' : 'hover:bg-blue-50/20'} cursor-pointer`}>
                                        {shift && (
                                            <div className={`h-full ${shift.isConfirmed ? 'bg-green-600 shadow-green-100' : 'bg-blue-600 shadow-blue-100'} text-white rounded-lg p-1 shadow-md flex flex-col justify-center text-[7px] font-black uppercase overflow-hidden`}>
                                                <div className="flex items-center justify-between">
                                                    <span>{shift.startTime}-{shift.endTime}</span>
                                                    {shift.isDriver && <Car size={8} className="text-yellow-300"/>}
                                                </div>
                                                <div className="border-t border-white/20 pt-0.5 truncate opacity-90">{shift.location}</div>
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

      {/* MODAL: SCHICHT ANLEGEN/BEARBEITEN */}
      {editingShift && (
        <Modal title="Dienst planen" onClose={() => setEditingShift(null)}>
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2 scrollbar-thin">
                <div className={`p-4 rounded-xl flex items-center justify-between text-white shadow-lg ${editingShift.isConfirmed ? 'bg-green-600' : 'bg-blue-600'}`}>
                    <div className="flex items-center gap-3">
                        <Calendar size={18}/>
                        <div>
                            <div className="text-[9px] font-bold opacity-70 uppercase">Einsatzdatum</div>
                            <div className="text-sm font-black">{format(new Date(editingShift.date), 'EEEE, dd.MM.yyyy', { locale: de })}</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-1">Beginn</label><input type="time" className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" value={editingShift.startTime} onChange={e => setEditingShift({...editingShift, startTime: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-1">Ende</label><input type="time" className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" value={editingShift.endTime} onChange={e => setEditingShift({...editingShift, endTime: e.target.value})} /></div>
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Objekt auswählen (Daten übernehmen)</label>
                        <select className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold outline-none" value={editingShift.objectId || ''} onChange={e => {
                            const obj = objects.find(o => o.id === e.target.value);
                            setEditingShift({
                                ...editingShift, 
                                objectId: e.target.value, 
                                location: obj?.name || 'Privat', 
                                parkingInfo: obj?.parkingInfo || '', 
                                contactPerson: obj?.contactPerson || '', 
                                uniform: obj?.uniform || 'Standard',
                                objectAddress: obj?.address || ''
                            });
                        }}>
                            <option value="">-- Objekt wählen --</option>
                            {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Bezeichnung im Plan (Editierbar)</label>
                        <input className="w-full p-2.5 bg-blue-50/20 border border-blue-100 rounded-xl text-xs font-black uppercase" value={editingShift.location} onChange={e => setEditingShift({...editingShift, location: e.target.value})} placeholder="z.B. Haupteingang" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2"><Car size={14} className="text-blue-600"/><span className="text-[9px] font-black uppercase text-slate-500">Fahrer</span></div>
                            <input type="checkbox" checked={editingShift.isDriver} onChange={e => setEditingShift({...editingShift, isDriver: e.target.checked})} className="w-4 h-4 accent-blue-600" />
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                             <label className="text-[8px] font-black uppercase text-slate-400 block">Kleidung</label>
                             <input value={editingShift.uniform} onChange={e => setEditingShift({...editingShift, uniform: e.target.value})} className="bg-transparent border-none w-full text-[10px] font-bold outline-none" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Parken / Anreise</label>
                        <input className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold" value={editingShift.parkingInfo} onChange={e => setEditingShift({...editingShift, parkingInfo: e.target.value})} />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Kontakt & Infos</label>
                        <textarea className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-medium" rows="2" value={editingShift.additionalInfo} onChange={e => setEditingShift({...editingShift, additionalInfo: e.target.value})} placeholder="Interne Hinweise..." />
                    </div>
                </div>

                <div className="flex gap-2 pt-2">
                    {editingShift.id && <button onClick={async () => { if(confirm("Löschen?")) { await deleteDoc(doc(db, "companies", companyId, "shifts", editingShift.id)); setEditingShift(null); } }} className="flex-1 p-3 bg-red-50 text-red-600 font-bold rounded-xl uppercase text-[9px]">Löschen</button>}
                    <button onClick={handleSaveShift} className="flex-[2] p-3 bg-slate-900 text-white font-bold rounded-xl uppercase text-[9px] shadow-lg">Speichern</button>
                </div>
            </div>
        </Modal>
      )}

      {/* MODAL: OBJEKTSTAMM VERWALTEN */}
      {showObjectsModal && (
          <Modal title={editingObjectId ? "Objekt bearbeiten" : "Objektstamm verwalten"} onClose={() => setShowObjectsModal(false)}>
              <div className="space-y-4">
                  <div className="grid gap-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <div className="text-[10px] font-black uppercase text-blue-600">{editingObjectId ? "Änderungen vornehmen" : "Neues Objekt anlegen"}</div>
                        {editingObjectId && (
                            <button 
                                onClick={() => { 
                                    setEditingObjectId(null); 
                                    setNewObject({ name: '', address: '', client: '', uniform: 'Standard', parkingInfo: '', contactPerson: '', notes: '' });
                                }}
                                className="text-[9px] font-bold text-slate-400 hover:text-red-500 uppercase transition-colors"
                            >
                                Abbrechen
                            </button>
                        )}
                      </div>
                      <input className="w-full p-2.5 border rounded-lg font-bold text-xs" placeholder="Objektname (z.B. Werksgelände)" value={newObject.name} onChange={e => setNewObject({...newObject, name: e.target.value})} />
                      <input className="w-full p-2.5 border rounded-lg font-bold text-xs" placeholder="Adresse" value={newObject.address} onChange={e => setNewObject({...newObject, address: e.target.value})} />
                      <div className="grid grid-cols-2 gap-2">
                          <input className="p-2.5 border rounded-lg font-bold text-xs" placeholder="Kunde" value={newObject.client} onChange={e => setNewObject({...newObject, client: e.target.value})} />
                          <input className="p-2.5 border rounded-lg font-bold text-xs" placeholder="Uniform" value={newObject.uniform} onChange={e => setNewObject({...newObject, uniform: e.target.value})} />
                      </div>
                      <input className="w-full p-2.5 border rounded-lg font-bold text-xs" placeholder="Parksituation" value={newObject.parkingInfo} onChange={e => setNewObject({...newObject, parkingInfo: e.target.value})} />
                      <textarea className="w-full p-2.5 border rounded-lg font-medium text-xs" placeholder="Notizen / Instruktionen" rows="2" value={newObject.notes} onChange={e => setNewObject({...newObject, notes: e.target.value})} />
                      <Button size="sm" onClick={handleSaveObject} className="mt-1">
                          {editingObjectId ? "Änderungen speichern" : "Objekt speichern"}
                      </Button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {objects.map(o => (
                          <div key={o.id} className={`flex justify-between items-center p-3 bg-white border rounded-xl shadow-sm transition-all ${editingObjectId === o.id ? 'ring-2 ring-blue-500' : ''}`}>
                              <div className="min-w-0">
                                  <div className="font-black text-xs truncate uppercase">{o.name}</div>
                                  <div className="text-[9px] text-slate-400 truncate">{o.address}</div>
                              </div>
                              <div className="flex gap-1">
                                  <button onClick={() => startEditObject(o)} className="text-blue-400 p-2 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14}/></button>
                                  <button onClick={async () => { if(confirm("Objekt löschen?")) await deleteDoc(doc(db, "companies", companyId, "objects", o.id)); }} className="text-red-400 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </Modal>
      )}
    </div>
  );
};