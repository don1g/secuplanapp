import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, X, Clock, MapPin, 
  User, CheckCircle2, AlertCircle, Calculator, Info
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameDay, addMonths, subMonths, parseISO 
} from 'date-fns';
import { de } from 'date-fns/locale';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

export const SchedulePlanner = ({ employees = [], projects = [], companyId, currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);

  // Formular-Zustand
  const [formData, setFormData] = useState({
    employeeId: '',
    projectId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '08:00',
    endTime: '16:00',
    note: ''
  });

  // Schichten in Echtzeit laden
  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(collection(db, "companies", companyId, "shifts"), (snap) => {
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [companyId]);

  // Kalender-Tage für den aktuellen Monat berechnen
  const days = useMemo(() => eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  }), [currentDate]);

  // Umsatz-Kalkulation für den Header
  const stats = useMemo(() => {
    const monthShifts = shifts.filter(s => {
      const sDate = parseISO(s.date);
      return sDate >= startOfMonth(currentDate) && sDate <= endOfMonth(currentDate);
    });

    return monthShifts.reduce((acc, s) => {
      const start = new Date(`${s.date}T${s.startTime}`);
      let end = new Date(`${s.date}T${s.endTime}`);
      if (end < start) end.setDate(end.getDate() + 1);
      const hours = (end - start) / (1000 * 60 * 60);
      
      const project = projects?.find(p => p.id === s.projectId);
      const rate = project?.rate || 0;
      
      acc.hours += hours;
      acc.revenue += hours * rate;
      return acc;
    }, { hours: 0, revenue: 0 });
  }, [shifts, currentDate, projects]);

  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.projectId) {
        alert("Bitte Mitarbeiter und Objekt auswählen.");
        return;
    }

    // Doppelbuchungs-Validierung
    const existingShift = shifts.find(s => 
      s.employeeId === formData.employeeId && 
      s.date === formData.date &&
      s.id !== editingShift?.id
    );
    
    if (existingShift) {
      const confirm = window.confirm(
        `${employees.find(e => e.id === formData.employeeId)?.name} hat bereits eine Schicht an diesem Tag.\n\nMöchten Sie trotzdem fortfahren?`
      );
      if (!confirm) return;
    }

    const project = projects.find(p => p.id === formData.projectId);
    const employee = employees.find(e => e.id === formData.employeeId);
    const shiftId = editingShift?.id || `${formData.employeeId}_${formData.date}_${Date.now()}`;
    
    try {
      await setDoc(doc(db, "companies", companyId, "shifts", shiftId), {
        ...formData,
        employeeName: employee?.name || 'Unbekannt',
        location: project?.name || 'Unbekannt',
        clientName: project?.clientName || 'Privat',
        isConfirmed: editingShift?.isConfirmed || false, 
        updatedAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setEditingShift(null);
      setFormData({
        employeeId: '',
        projectId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '08:00',
        endTime: '16:00',
        note: ''
      });
    } catch (error) {
      console.error("Fehler beim Speichern der Schicht:", error);
      alert("Fehler beim Speichern der Schicht. Bitte versuchen Sie es erneut.");
    }
  };

  const handleDeleteShift = async () => {
    if (!editingShift) return;
    if (window.confirm("Möchten Sie diese Schicht wirklich löschen?")) {
      await deleteDoc(doc(db, "companies", companyId, "shifts", editingShift.id));
      setIsModalOpen(false);
      setEditingShift(null);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      
      {/* HEADER: NAVIGATION & STATS */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-all"><ChevronLeft size={20}/></button>
          <span className="text-sm font-bold uppercase tracking-widest min-w-[140px] text-center">{format(currentDate, 'MMMM yyyy', { locale: de })}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-all"><ChevronRight size={20}/></button>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Monats-Umsatz (geschätzt)</div>
            <div className="text-sm font-black text-blue-600">{stats.revenue.toFixed(2)} € <span className="text-[9px] text-slate-300">Netto</span></div>
          </div>
          <Button onClick={() => { 
            setFormData({ ...formData, employeeId: '', projectId: '', date: format(new Date(), 'yyyy-MM-dd') }); 
            setIsModalOpen(true); 
          }} icon={Plus}>Schicht planen</Button>
        </div>
      </div>

      {/* MATRIX: HORIZONTAL SCROLLBAR & DEUTLICHE LINIEN */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-200">
                <th className="p-4 sticky left-0 z-30 bg-slate-50 border-r-2 border-slate-200 w-[200px] text-left text-[10px] font-bold uppercase text-slate-500">Personal</th>
                {days.map(day => (
                  <th key={day.toString()} className={`p-2 border-r border-slate-200 w-[100px] text-center ${format(day, 'E') === 'So' ? 'bg-red-50/50' : ''}`}>
                    <div className="text-[8px] font-bold text-slate-400 uppercase">{format(day, 'EEEEEE', { locale: de })}</div>
                    <div className="text-sm font-bold">{format(day, 'dd')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees.map(emp => (
                <tr key={emp.id} className="group hover:bg-slate-50/30 transition-all">
                  <td className="p-3 sticky left-0 z-20 bg-white group-hover:bg-slate-50/30 border-r-2 border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-3">
                      <Avatar src={emp.imageUrl} size="sm" className="rounded-lg h-9 w-9 border border-slate-100" />
                      <div className="min-w-0">
                        <div className="font-bold text-xs uppercase truncate text-slate-900">{emp.name}</div>
                        <div className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block mt-0.5">ID: {emp.bewacherId || '---'}</div>
                      </div>
                    </div>
                  </td>
                  {days.map(day => {
                    const dStr = format(day, 'yyyy-MM-dd');
                    const dayShifts = shifts.filter(s => s.employeeId === emp.id && s.date === dStr);
                    
                    return (
                      <td key={day.toString()} className={`p-1 border-r border-slate-200 min-h-[70px] relative ${format(day, 'E') === 'So' ? 'bg-red-50/20' : ''}`}>
                        <div className="space-y-1">
                          {dayShifts.map(s => (
                            <div 
                              key={s.id} 
                              onClick={() => { setEditingShift(s); setFormData(s); setIsModalOpen(true); }}
                              className={`p-1.5 rounded-lg border cursor-pointer transition-all hover:shadow-md relative ${s.isConfirmed ? 'bg-green-100 border-green-200 text-green-800' : 'bg-white border-slate-200 text-slate-700'}`}
                            >
                              <div className="text-[9px] font-bold flex items-center justify-between">
                                {s.startTime}-{s.endTime}
                                {s.isConfirmed && <CheckCircle2 size={10} className="text-green-600"/>}
                              </div>
                              <div className="text-[8px] font-bold uppercase truncate mt-0.5 opacity-70">
                                {s.location}
                              </div>
                            </div>
                          ))}
                          {!dayShifts.length && (
                            <button 
                              onClick={() => { setFormData({ ...formData, employeeId: emp.id, date: dStr }); setIsModalOpen(true); }}
                              className="w-full h-10 rounded-lg border-2 border-dashed border-slate-100 opacity-0 group-hover:opacity-100 hover:bg-white hover:border-blue-200 transition-all flex items-center justify-center text-blue-400"
                            >
                              <Plus size={14}/>
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FÜR PLANUNG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border-none">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-slate-900">
                <h3 className="font-bold uppercase text-sm tracking-widest">Dienstplanung</h3>
                <button onClick={() => { setIsModalOpen(false); setEditingShift(null); }} className="text-slate-400 hover:text-slate-900 transition-colors"><X/></button>
            </div>
            <form onSubmit={handleSaveShift} className="p-6 space-y-5">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Mitarbeiter</label>
                        <select 
                            required
                            className="w-full mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.employeeId}
                            onChange={e => setFormData({...formData, employeeId: e.target.value})}
                        >
                            <option value="">Wählen...</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Objekt / Kunde</label>
                        <select 
                            required
                            className="w-full mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.projectId}
                            onChange={e => setFormData({...formData, projectId: e.target.value})}
                        >
                            <option value="">Wählen...</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.clientName})</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Datum</label>
                    <input type="date" required className="w-full mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold text-xs outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Beginn</label>
                        <input type="time" required className="w-full mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold text-xs outline-none" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Ende</label>
                        <input type="time" required className="w-full mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold text-xs outline-none" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
                    </div>
                </div>

                {editingShift && (
                  <div className={`p-3 rounded-xl flex items-center gap-3 border ${editingShift.isConfirmed ? 'bg-green-50 border-green-100 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <Info size={16}/>
                    <div className="text-[10px] font-bold uppercase tracking-tight">
                        Status: {editingShift.isConfirmed ? "Vom Mitarbeiter bestätigt" : "Wartet auf Bestätigung"}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                {editingShift && (
                  <Button type="button" variant="ghost" className="flex-1 text-red-500 hover:bg-red-50" onClick={handleDeleteShift}>Löschen</Button>
                )}
                <Button type="submit" className="flex-[2] py-3 shadow-md">{editingShift ? "Änderung speichern" : "Dienst anlegen"}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};