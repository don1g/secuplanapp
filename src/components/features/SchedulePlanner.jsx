import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, Trash2, Save, 
  Briefcase, Settings, Download, User, MapPin, Shield 
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths 
} from 'date-fns';
import { de } from 'date-fns/locale';
import { 
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc 
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

  // Berechtigungen prüfen
  const isObjLead = currentUser?.role === 'obj_lead';
  const isTeamLead = currentUser?.role === 'team_lead';
  const isBoss = currentUser?.type === 'provider';
  // Einsatzleiter und Chef dürfen ALLES
  const hasFullAccess = isBoss || isTeamLead;

  // Modals & State
  const [editingShift, setEditingShift] = useState(null);
  const [showObjectsModal, setShowObjectsModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  
  const [editingObject, setEditingObject] = useState(null);
  const [newObject, setNewObject] = useState({ 
      name: '', address: '', client: '', uniform: '', notes: '', assignedLeadId: '' 
  });
  
  const [newTemplate, setNewTemplate] = useState({ name: '', startTime: '06:00', endTime: '14:00' });

  // --- DATEN LADEN ---
  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }).toISOString().split('T')[0];
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }).toISOString().split('T')[0];

    try {
        // 1. Shifts laden
        // Wenn Objektleiter: Eigentlich müssten wir hier filtern, aber es ist besser, alle Shifts zu laden 
        // und nur die Bearbeitung zu sperren, damit er sieht, ob MA woanders verplant sind.
        const qShifts = query(collection(db, "companies", companyId, "shifts"), where("date", ">=", start), where("date", "<=", end));
        const snapShifts = await getDocs(qShifts);
        setShifts(snapShifts.docs.map(d => ({ id: d.id, ...d.data() })));

        // 2. Objekte laden
        const snapObj = await getDocs(collection(db, "companies", companyId, "objects"));
        const allObjects = snapObj.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // FILTER: Objektleiter sieht nur SEINE Objekte
        if (isObjLead) {
            setObjects(allObjects.filter(o => o.assignedLeadId === currentUser.uid));
        } else {
            setObjects(allObjects);
        }

        // 3. Vorlagen laden
        const snapTemp = await getDocs(collection(db, "companies", companyId, "shiftTemplates"));
        setTemplates(snapTemp.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [companyId, currentDate, currentUser]); // currentUser als dependency

  // --- ACTIONS: SHIFTS ---
  const handleCellClick = (employeeId, dateStr) => {
    const existing = shifts.find(s => s.employeeId === employeeId && s.date === dateStr);
    
    // BERECHTIGUNGSPRÜFUNG BEIM KLICK
    if (isObjLead) {
        // Wenn Schicht existiert, aber zu einem fremden Objekt gehört -> Zugriff verweigern
        if (existing && existing.objectId && !objects.find(o => o.id === existing.objectId)) {
            alert("Diese Schicht gehört zu einem Objekt, das Sie nicht verwalten.");
            return;
        }
    }

    if (existing) {
        setEditingShift({ ...existing });
    } else {
        // Neue Schicht
        setEditingShift({ 
            employeeId, 
            date: dateStr, 
            startTime: '06:00', 
            endTime: '14:00', 
            objectId: objects.length > 0 ? objects[0].id : '' // Erstes verfügbares Objekt wählen
        });
    }
  };

  const saveShift = async () => {
    try {
        const selectedObj = objects.find(o => o.id === editingShift.objectId);
        
        // Sicherheitscheck für Objektleiter
        if (isObjLead && !selectedObj && editingShift.objectId) {
            alert("Sie können nur Schichten für Ihre zugewiesenen Objekte erstellen.");
            return;
        }

        const shiftData = {
            employeeId: editingShift.employeeId,
            date: editingShift.date,
            startTime: editingShift.startTime,
            endTime: editingShift.endTime,
            objectId: editingShift.objectId || null,
            location: selectedObj?.name || '',
            objectAddress: selectedObj?.address || '' 
        };

        if (editingShift.id) {
            await updateDoc(doc(db, "companies", companyId, "shifts", editingShift.id), shiftData);
        } else {
            await addDoc(collection(db, "companies", companyId, "shifts"), shiftData);
        }
        setEditingShift(null);
        loadData();
    } catch (e) { alert("Fehler beim Speichern"); }
  };

  const deleteShift = async () => {
      if (!editingShift.id || !confirm("Löschen?")) return;
      await deleteDoc(doc(db, "companies", companyId, "shifts", editingShift.id));
      setEditingShift(null);
      loadData();
  };

  // --- ACTIONS: OBJECTS ---
  const handleSaveObject = async () => {
      if(!newObject.name) return;
      try {
          if (editingObject) {
              await updateDoc(doc(db, "companies", companyId, "objects", editingObject.id), newObject);
          } else {
              await addDoc(collection(db, "companies", companyId, "objects"), newObject);
          }
          setNewObject({ name: '', address: '', client: '', uniform: '', notes: '', assignedLeadId: '' });
          setEditingObject(null);
          loadData();
      } catch(e) { console.error(e); }
  };
  
  const handleEditObject = (obj) => {
      setEditingObject(obj);
      setNewObject({ ...obj });
  };

  const deleteObject = async (id) => {
      if(!confirm("Objekt löschen?")) return;
      await deleteDoc(doc(db, "companies", companyId, "objects", id));
      loadData();
  };

  // --- ACTIONS: TEMPLATES ---
  const saveTemplate = async () => {
      if(!newTemplate.name) return;
      await addDoc(collection(db, "companies", companyId, "shiftTemplates"), newTemplate);
      setNewTemplate({ name: '', startTime: '06:00', endTime: '14:00' });
      loadData();
  };

  const deleteTemplate = async (id) => {
      if(!confirm("Vorlage löschen?")) return;
      await deleteDoc(doc(db, "companies", companyId, "shiftTemplates", id));
      loadData();
  };

  const applyTemplate = (t) => {
      setEditingShift({ ...editingShift, startTime: t.startTime, endTime: t.endTime });
  };

  // --- HELPER ---
  const monthStart = startOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ 
      start: startOfWeek(monthStart, { weekStartsOn: 1 }), 
      end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }) 
  });

  const exportPDF = () => {
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      pdf.setFontSize(16);
      pdf.text(`Dienstplan Gesamt - ${format(currentDate, 'MMMM yyyy', {locale: de})}`, 14, 15);
      const daysInMonth = calendarDays.filter(d => isSameMonth(d, monthStart));
      const headRow = ['MA', ...daysInMonth.map(d => format(d, 'dd'))];
      const bodyRows = employees.map(emp => {
          const row = [emp.name];
          daysInMonth.forEach(d => {
              const dStr = format(d, 'yyyy-MM-dd');
              const s = shifts.find(x => x.employeeId === emp.id && x.date === dStr);
              row.push(s ? `${s.startTime}-${s.endTime}` : '');
          });
          return row;
      });
      autoTable(pdf, { head: [headRow], body: bodyRows, startY: 25, styles: { fontSize: 6, cellPadding: 1 } });
      pdf.save("Dienstplan_Gesamt.pdf");
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* HEADER */}
      <Card className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-white shrink-0">
        <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-white rounded shadow-sm"><ChevronLeft size={18}/></button>
                <span className="w-32 text-center font-bold text-slate-800 capitalize">{format(currentDate, 'MMMM yyyy', { locale: de })}</span>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-white rounded shadow-sm"><ChevronRight size={18}/></button>
            </div>
            {loading && <span className="text-xs text-blue-600 animate-pulse">Laden...</span>}
        </div>
        <div className="flex gap-2">
            {/* Nur Full Access (Chef/Einsatzleiter) darf Objekte verwalten */}
            {hasFullAccess && <Button variant="outline" size="sm" onClick={() => { setEditingObject(null); setNewObject({name:'', address:'', client:'', uniform:'', notes:'', assignedLeadId:''}); setShowObjectsModal(true); }} icon={Briefcase}>Objekte</Button>}
            <Button variant="outline" size="sm" onClick={() => setShowTemplatesModal(true)} icon={Settings}>Vorlagen</Button>
            <Button variant="primary" size="sm" onClick={exportPDF} icon={Download}>Export</Button>
        </div>
      </Card>

      {/* PLANNER MATRIX */}
      <Card className="flex-1 overflow-hidden flex flex-col border-slate-200">
        <div className="overflow-auto flex-1">
            <table className="w-full border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th className="p-2 text-left text-xs font-bold text-slate-500 uppercase min-w-[150px] sticky left-0 bg-slate-50 z-30 border-r border-slate-200">Mitarbeiter</th>
                        {calendarDays.map(day => {
                            const isCurrent = isSameMonth(day, monthStart);
                            const isToday = isSameDay(day, new Date());
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            return (
                                <th key={day.toString()} className={`p-1 text-center min-w-[45px] border-r border-slate-100 ${!isCurrent ? 'opacity-30 bg-slate-100' : ''} ${isWeekend ? 'bg-slate-50' : ''} ${isToday ? 'bg-blue-50 text-blue-600' : ''}`}>
                                    <div className="text-[10px] font-bold">{format(day, 'EEE', { locale: de })}</div>
                                    <div className="text-sm font-bold">{format(day, 'dd')}</div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {employees.map(emp => (
                        <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td 
                                onClick={() => onViewProfile && onViewProfile(emp.id)}
                                className="p-3 sticky left-0 bg-white z-10 border-r border-slate-200 font-bold text-sm text-slate-700 truncate max-w-[150px] cursor-pointer hover:text-blue-600 hover:bg-slate-50 transition-colors group"
                            >
                                <div className="flex items-center gap-2">
                                    <User size={14} className="text-slate-400 group-hover:text-blue-500"/>
                                    {emp.name}
                                </div>
                            </td>
                            {calendarDays.map(day => {
                                const dStr = format(day, 'yyyy-MM-dd');
                                const isCurrent = isSameMonth(day, monthStart);
                                const shift = shifts.find(s => s.employeeId === emp.id && s.date === dStr);
                                const obj = objects.find(o => o.id === shift?.objectId);
                                
                                return (
                                    <td 
                                        key={dStr} 
                                        onClick={() => isCurrent && handleCellClick(emp.id, dStr)}
                                        className={`border-r border-slate-100 p-0.5 cursor-pointer relative h-12 transition-colors ${!isCurrent ? 'bg-slate-50' : 'hover:bg-blue-50'}`}
                                    >
                                        {shift && (
                                            <div className="bg-blue-100 border border-blue-200 text-blue-800 rounded px-1 py-0.5 text-[9px] leading-tight h-full flex flex-col justify-center overflow-hidden">
                                                <span className="font-bold">{shift.startTime}-{shift.endTime}</span>
                                                <span className="truncate opacity-75">{obj?.name || shift.location || ''}</span>
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
        <Modal title="Schicht bearbeiten" onClose={() => setEditingShift(null)}>
            <div className="space-y-4">
                <div className="flex gap-4">
                    <div className="flex-1"><label className="text-xs font-bold text-slate-500">Start</label><input type="time" className="w-full p-2 border rounded" value={editingShift.startTime} onChange={e => setEditingShift({...editingShift, startTime: e.target.value})} /></div>
                    <div className="flex-1"><label className="text-xs font-bold text-slate-500">Ende</label><input type="time" className="w-full p-2 border rounded" value={editingShift.endTime} onChange={e => setEditingShift({...editingShift, endTime: e.target.value})} /></div>
                </div>
                
                <div>
                    <label className="text-xs font-bold text-slate-500">Objekt / Ort</label>
                    <select className="w-full p-2 border rounded bg-white" value={editingShift.objectId || ''} onChange={e => setEditingShift({...editingShift, objectId: e.target.value})}>
                        <option value="">-- Kein Objekt (oder freier Text) --</option>
                        {/* Hier sieht der Objektleiter NUR seine Objekte (wird oben gefiltert) */}
                        {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    
                    {editingShift.objectId && (() => {
                        const obj = objects.find(o => o.id === editingShift.objectId);
                        if(obj) return (
                            <div className="mt-2 p-2 bg-slate-50 border rounded text-xs text-slate-600 space-y-1">
                                <div><MapPin size={10} className="inline mr-1"/> {obj.address}</div>
                                {obj.notes && <div className="italic text-slate-500">"{obj.notes}"</div>}
                            </div>
                        )
                    })()}
                </div>

                {templates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {templates.map(t => <button key={t.id} onClick={() => applyTemplate(t)} className="text-xs bg-slate-100 px-2 py-1 rounded border">{t.name}</button>)}
                    </div>
                )}
                <div className="flex gap-2 pt-4">
                    {editingShift.id && <Button variant="danger" onClick={deleteShift} className="flex-1" icon={Trash2}>Löschen</Button>}
                    <Button variant="primary" onClick={saveShift} className="flex-[2]" icon={Save}>Speichern</Button>
                </div>
            </div>
        </Modal>
      )}

      {/* MODAL: OBJEKTE VERWALTEN (Nur für Full Access) */}
      {showObjectsModal && hasFullAccess && (
          <Modal title={editingObject ? "Objekt bearbeiten" : "Neues Objekt"} onClose={() => setShowObjectsModal(false)}>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                  <input className="w-full p-2 border rounded text-sm font-bold" placeholder="Objekt Name (z.B. Baustelle A)" value={newObject.name} onChange={e => setNewObject({...newObject, name: e.target.value})} />
                  
                  {/* NEU: OBJEKTLEITER ZUWEISEN */}
                  <div className="bg-purple-50 p-2 rounded border border-purple-100">
                      <label className="text-[10px] font-bold text-purple-700 uppercase mb-1 block flex items-center gap-1"><Shield size={10}/> Objektleitung zuweisen</label>
                      <select 
                        className="w-full p-2 border rounded text-sm bg-white" 
                        value={newObject.assignedLeadId || ''} 
                        onChange={e => setNewObject({...newObject, assignedLeadId: e.target.value})}
                      >
                          <option value="">-- Keine Zuweisung --</option>
                          {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                          ))}
                      </select>
                  </div>

                  <input className="w-full p-2 border rounded text-sm" placeholder="Adresse" value={newObject.address} onChange={e => setNewObject({...newObject, address: e.target.value})} />
                  <input className="w-full p-2 border rounded text-sm" placeholder="Auftraggeber / Firma" value={newObject.client} onChange={e => setNewObject({...newObject, client: e.target.value})} />
                  <input className="w-full p-2 border rounded text-sm" placeholder="Dienstkleidung" value={newObject.uniform} onChange={e => setNewObject({...newObject, uniform: e.target.value})} />
                  <textarea className="w-full p-2 border rounded text-sm h-20" placeholder="Zusätzliche Infos / Notizen" value={newObject.notes} onChange={e => setNewObject({...newObject, notes: e.target.value})} />
                  
                  <div className="flex gap-2 pt-2">
                      {editingObject && <Button variant="ghost" onClick={() => { setEditingObject(null); setNewObject({name:'', address:'', client:'', uniform:'', notes:'', assignedLeadId:''}); }}>Abbrechen</Button>}
                      <Button className="flex-1" onClick={handleSaveObject}>{editingObject ? 'Aktualisieren' : 'Erstellen'}</Button>
                  </div>

                  <div className="border-t pt-4 mt-4">
                      <h4 className="font-bold text-xs text-slate-500 uppercase mb-2">Vorhandene Objekte</h4>
                      <div className="space-y-2">
                          {objects.map(o => (
                              <div key={o.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border">
                                  <div onClick={() => handleEditObject(o)} className="cursor-pointer flex-1">
                                      <div className="font-bold text-sm">{o.name}</div>
                                      <div className="text-xs text-slate-500">
                                          {o.assignedLeadId ? (
                                              <span className="text-purple-600 flex items-center gap-1"><Shield size={10}/> {employees.find(e=>e.id===o.assignedLeadId)?.name || 'Unbekannt'}</span>
                                          ) : 'Keine Leitung'}
                                      </div>
                                  </div>
                                  <button onClick={() => deleteObject(o.id)} className="text-red-500 p-1"><Trash2 size={14}/></button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </Modal>
      )}

      {/* MODAL: VORLAGEN */}
      {showTemplatesModal && (
          <Modal title="Schicht-Vorlagen" onClose={() => setShowTemplatesModal(false)}>
              <div className="space-y-4">
                  <div className="flex gap-2 items-end">
                      <div className="flex-1"><label className="text-[10px]">Name</label><input className="w-full p-2 border rounded text-sm" placeholder="z.B. Früh" value={newTemplate.name} onChange={e => setNewTemplate({...newTemplate, name: e.target.value})} /></div>
                      <div className="w-20"><label className="text-[10px]">Start</label><input type="time" className="w-full p-2 border rounded text-sm" value={newTemplate.startTime} onChange={e => setNewTemplate({...newTemplate, startTime: e.target.value})} /></div>
                      <div className="w-20"><label className="text-[10px]">Ende</label><input type="time" className="w-full p-2 border rounded text-sm" value={newTemplate.endTime} onChange={e => setNewTemplate({...newTemplate, endTime: e.target.value})} /></div>
                      <Button size="sm" onClick={saveTemplate} icon={Plus} className="mb-0.5">Add</Button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 border-t pt-2">
                      {templates.map(t => (
                          <div key={t.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border">
                              <div className="text-sm"><span className="font-bold">{t.name}</span> <span className="text-slate-500 text-xs ml-2">{t.startTime}-{t.endTime}</span></div>
                              <button onClick={() => deleteTemplate(t.id)} className="text-red-500 p-1"><Trash2 size={16}/></button>
                          </div>
                      ))}
                  </div>
              </div>
          </Modal>
      )}
    </div>
  );
};