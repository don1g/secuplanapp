import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, X, Clock, MapPin, User, 
  CheckCircle2, AlertCircle, Calculator, Info, Download, 
  Users, Building2, Euro, FileText, Edit2, Trash2
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  addMonths, subMonths, parseISO 
} from 'date-fns';
import { de } from 'date-fns/locale';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';

export const SchedulePlanner = ({ employees = [], projects = [], companyId, currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftDetailModal, setShiftDetailModal] = useState(null);
  const [freeProjectEntry, setFreeProjectEntry] = useState(false);

  // Formular-Zustand mit Objekt-Details
  const [formData, setFormData] = useState({
    employeeId: '',
    projectId: '',
    projectName: '',
    clientName: '',
    location: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '08:00',
    endTime: '16:00',
    note: '',
    hourlyRate: 0
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
      
      const rate = s.hourlyRate || projects?.find(p => p.id === s.projectId)?.rate || 0;
      
      acc.hours += hours;
      acc.revenue += hours * rate;
      return acc;
    }, { hours: 0, revenue: 0 });
  }, [shifts, currentDate, projects]);

  // Objekt auswählen - Daten automatisch übernehmen
  const handleProjectSelect = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setFormData(prev => ({
        ...prev,
        projectId,
        projectName: project.name,
        clientName: project.clientName,
        location: project.location || project.name,
        hourlyRate: project.rate || 0
      }));
      setFreeProjectEntry(false);
    }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    
    // Validierung
    if (!formData.employeeId) {
      alert("Bitte Mitarbeiter auswählen.");
      return;
    }

    if (!freeProjectEntry && !formData.projectId) {
      alert("Bitte Objekt auswählen oder freie Eingabe nutzen.");
      return;
    }

    if (freeProjectEntry && !formData.projectName.trim()) {
      alert("Bitte Objektname eingeben.");
      return;
    }

    // Doppelbuchungs-Validierung
    const existingShift = shifts.find(s => 
      s.employeeId === formData.employeeId && 
      s.date === formData.date &&
      s.id !== editingShift?.id
    );
    
    if (existingShift) {
      const employeeName = employees.find(e => e.id === formData.employeeId)?.name;
      const confirm = window.confirm(
        `${employeeName} hat bereits eine Schicht an diesem Tag.\n\nMöchten Sie trotzdem fortfahren?`
      );
      if (!confirm) return;
    }

    const employee = employees.find(e => e.id === formData.employeeId);
    const shiftId = editingShift?.id || `${formData.employeeId}_${formData.date}_${Date.now()}`;
    
    try {
      await setDoc(doc(db, "companies", companyId, "shifts", shiftId), {
        employeeId: formData.employeeId,
        employeeName: employee?.name || 'Unbekannt',
        projectId: freeProjectEntry ? null : formData.projectId,
        projectName: formData.projectName,
        clientName: formData.clientName,
        location: formData.location,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        note: formData.note || '',
        hourlyRate: formData.hourlyRate,
        isConfirmed: editingShift?.isConfirmed || false,
        confirmedBy: editingShift?.confirmedBy || null,
        updatedAt: new Date().toISOString(),
        createdBy: currentUser?.uid
      });
      
      setIsModalOpen(false);
      setEditingShift(null);
      setFreeProjectEntry(false);
      setFormData({
        employeeId: '',
        projectId: '',
        projectName: '',
        clientName: '',
        location: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '08:00',
        endTime: '16:00',
        note: '',
        hourlyRate: 0
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

  const handleEditShift = (shift) => {
    setEditingShift(shift);
    setFormData({
      employeeId: shift.employeeId,
      projectId: shift.projectId || '',
      projectName: shift.projectName || '',
      clientName: shift.clientName || '',
      location: shift.location || '',
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      note: shift.note || '',
      hourlyRate: shift.hourlyRate || 0
    });
    setFreeProjectEntry(!shift.projectId);
    setIsModalOpen(true);
  };

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    const monthName = format(currentDate, 'MMMM yyyy', { locale: de });
    
    doc.setFontSize(18);
    doc.text(`Dienstplan ${monthName}`, 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Gesamtstunden: ${stats.hours.toFixed(2)} h`, 14, 30);
    doc.text(`Umsatz (geschätzt): ${stats.revenue.toFixed(2)} €`, 14, 36);
    
    const monthShifts = shifts.filter(s => {
      const sDate = parseISO(s.date);
      return sDate >= startOfMonth(currentDate) && sDate <= endOfMonth(currentDate);
    });

    const tableData = monthShifts.map(s => {
      const start = new Date(`${s.date}T${s.startTime}`);
      let end = new Date(`${s.date}T${s.endTime}`);
      if (end < start) end.setDate(end.getDate() + 1);
      const hours = ((end - start) / (1000 * 60 * 60)).toFixed(2);
      
      return [
        format(parseISO(s.date), 'dd.MM.yyyy'),
        s.employeeName || 'Unbekannt',
        s.location || 'Unbekannt',
        s.clientName || '-',
        `${s.startTime} - ${s.endTime}`,
        hours + ' h',
        s.isConfirmed ? '✓' : '✗'
      ];
    });

    doc.autoTable({
      startY: 45,
      head: [['Datum', 'Mitarbeiter', 'Objekt', 'Kunde', 'Zeiten', 'Stunden', 'Bestätigt']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [51, 122, 183] }
    });

    doc.save(`dienstplan-${format(currentDate, 'yyyy-MM')}.pdf`);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      
      {/* HEADER: NAVIGATION & STATS & EXPORT */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 lg:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-all">
            <ChevronLeft size={20}/>
          </button>
          <span className="text-sm font-bold uppercase tracking-widest min-w-[140px] text-center">
            {format(currentDate, 'MMMM yyyy', { locale: de })}
          </span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-all">
            <ChevronRight size={20}/>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
          <div className="flex gap-4 text-xs">
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Stunden</div>
              <div className="text-sm font-black text-blue-600">{stats.hours.toFixed(2)} h</div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Umsatz (Netto)</div>
              <div className="text-sm font-black text-blue-600">{stats.revenue.toFixed(2)} €</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} icon={Download} variant="outline" size="sm" className="text-xs">Export PDF</Button>
            <Button onClick={() => { 
              setFormData({ ...formData, employeeId: '', projectId: '', date: format(new Date(), 'yyyy-MM-dd') }); 
              setFreeProjectEntry(false);
              setIsModalOpen(true); 
            }} icon={Plus} size="sm" className="text-xs">Schicht</Button>
          </div>
        </div>
      </div>

      {/* KOMPAKTER KALENDER FÜR CHEF - HORIZONTAL SCROLL */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto h-full">
          <table className="w-full border-collapse table-fixed min-w-max">
            <thead className="sticky top-0 z-20 bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <th className="p-2 lg:p-3 sticky left-0 z-30 bg-slate-50 border-r-2 border-slate-200 w-[120px] lg:w-[180px] text-left text-[9px] lg:text-[10px] font-bold uppercase text-slate-500">
                  Personal
                </th>
                {days.map(day => (
                  <th key={day.toString()} className={`p-1 lg:p-2 border-r border-slate-200 w-[80px] lg:w-[90px] text-center ${format(day, 'E') === 'So' ? 'bg-red-50/50' : ''}`}>
                    <div className="text-[7px] lg:text-[8px] font-bold text-slate-400 uppercase">{format(day, 'EEEEEE', { locale: de })}</div>
                    <div className="text-xs lg:text-sm font-bold">{format(day, 'dd')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees.map(emp => (
                <tr key={emp.id} className="group hover:bg-slate-50/30 transition-all">
                  <td className="p-2 lg:p-3 sticky left-0 z-20 bg-white group-hover:bg-slate-50/30 border-r-2 border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-2">
                      <Avatar src={emp.imageUrl} size="sm" className="rounded-lg h-7 w-7 lg:h-9 lg:w-9 border border-slate-100" />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[10px] lg:text-xs uppercase truncate text-slate-900">{emp.name}</div>
                        <div className="text-[7px] lg:text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-block mt-0.5">
                          ID: {emp.bewacherId || '---'}
                        </div>
                      </div>
                    </div>
                  </td>
                  {days.map(day => {
                    const dStr = format(day, 'yyyy-MM-dd');
                    const dayShifts = shifts.filter(s => s.employeeId === emp.id && s.date === dStr);
                    
                    return (
                      <td key={day.toString()} className={`p-0.5 lg:p-1 border-r border-slate-200 min-h-[60px] lg:min-h-[70px] relative align-top ${format(day, 'E') === 'So' ? 'bg-red-50/20' : ''}`}>
                        <div className="space-y-1">
                          {dayShifts.map(s => (
                            <div 
                              key={s.id} 
                              onClick={() => setShiftDetailModal(s)}
                              className={`p-1 lg:p-1.5 rounded-lg border cursor-pointer transition-all hover:shadow-md relative group/shift ${s.isConfirmed ? 'bg-green-100 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-slate-700'}`}
                            >
                              <div className="text-[8px] lg:text-[9px] font-bold flex items-center justify-between">
                                <span className="truncate">{s.startTime}-{s.endTime}</span>
                                {s.isConfirmed && <CheckCircle2 size={8} className="text-green-600 shrink-0"/>}
                              </div>
                              <div className="text-[7px] lg:text-[8px] font-bold uppercase truncate mt-0.5 opacity-70">
                                {s.location || s.projectName}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditShift(s); }}
                                className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm opacity-0 group-hover/shift:opacity-100 transition-all border border-slate-200"
                              >
                                <Edit2 size={10} className="text-slate-600"/>
                              </button>
                            </div>
                          ))}
                          {!dayShifts.length && (
                            <button 
                              onClick={() => { 
                                setFormData({ ...formData, employeeId: emp.id, date: dStr }); 
                                setFreeProjectEntry(false);
                                setIsModalOpen(true); 
                              }}
                              className="w-full h-8 lg:h-10 rounded-lg border-2 border-dashed border-slate-100 opacity-0 group-hover:opacity-100 hover:bg-white hover:border-blue-200 transition-all flex items-center justify-center text-blue-400"
                            >
                              <Plus size={12}/>
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

      {/* MODAL FÜR PLANUNG/BEARBEITUNG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border-none max-h-[90vh] overflow-y-auto">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-slate-900 sticky top-0 z-10">
                <h3 className="font-bold uppercase text-sm tracking-widest">
                  {editingShift ? 'Schicht bearbeiten' : 'Neue Schicht planen'}
                </h3>
                <button onClick={() => { setIsModalOpen(false); setEditingShift(null); }} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <X/>
                </button>
            </div>
            <form onSubmit={handleSaveShift} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* MITARBEITER */}
                  <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Mitarbeiter *</label>
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

                  {/* DATUM */}
                  <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Datum *</label>
                      <input 
                        type="date" 
                        required 
                        className="w-full mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold text-xs outline-none" 
                        value={formData.date} 
                        onChange={e => setFormData({...formData, date: e.target.value})} 
                      />
                  </div>
              </div>

              {/* OBJEKT AUSWAHL ODER FREIE EINGABE */}
              <div className="space-y-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-blue-700">Objekt</label>
                  <button
                    type="button"
                    onClick={() => setFreeProjectEntry(!freeProjectEntry)}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    {freeProjectEntry ? '→ Vorhandenes wählen' : '→ Freie Eingabe'}
                  </button>
                </div>

                {!freeProjectEntry ? (
                  <select 
                      className="w-full bg-white p-3 rounded-xl border border-blue-200 font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.projectId}
                      onChange={e => handleProjectSelect(e.target.value)}
                  >
                      <option value="">Objekt wählen...</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.clientName}) - {p.rate}€/h
                        </option>
                      ))}
                  </select>
                ) : (
                  <div className="space-y-3">
                    <input 
                      type="text"
                      placeholder="Objektname"
                      className="w-full bg-white p-3 rounded-xl border border-blue-200 font-bold text-xs outline-none"
                      value={formData.projectName}
                      onChange={e => setFormData({...formData, projectName: e.target.value})}
                    />
                    <input 
                      type="text"
                      placeholder="Kundenname"
                      className="w-full bg-white p-3 rounded-xl border border-blue-200 font-bold text-xs outline-none"
                      value={formData.clientName}
                      onChange={e => setFormData({...formData, clientName: e.target.value})}
                    />
                    <input 
                      type="text"
                      placeholder="Standort"
                      className="w-full bg-white p-3 rounded-xl border border-blue-200 font-bold text-xs outline-none"
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                    />
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="Stundensatz (€)"
                      className="w-full bg-white p-3 rounded-xl border border-blue-200 font-bold text-xs outline-none"
                      value={formData.hourlyRate}
                      onChange={e => setFormData({...formData, hourlyRate: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                )}

                {formData.projectId && !freeProjectEntry && projects.find(p => p.id === formData.projectId) && (
                  <div className="text-xs space-y-1 text-blue-700 bg-white p-3 rounded-lg">
                    <div><strong>Kunde:</strong> {formData.clientName}</div>
                    <div><strong>Standort:</strong> {formData.location}</div>
                    <div><strong>Stundensatz:</strong> {formData.hourlyRate}€</div>
                  </div>
                )}
              </div>

              {/* ZEIT */}
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Beginn *</label>
                      <input 
                        type="time" 
                        required 
                        className="w-full mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold text-xs outline-none" 
                        value={formData.startTime} 
                        onChange={e => setFormData({...formData, startTime: e.target.value})} 
                      />
                  </div>
                  <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Ende *</label>
                      <input 
                        type="time" 
                        required 
                        className="w-full mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold text-xs outline-none" 
                        value={formData.endTime} 
                        onChange={e => setFormData({...formData, endTime: e.target.value})} 
                      />
                  </div>
              </div>

              {/* NOTIZ */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Notiz (Optional)</label>
                <textarea 
                  className="w-full mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold text-xs outline-none h-20"
                  value={formData.note}
                  onChange={e => setFormData({...formData, note: e.target.value})}
                  placeholder="Besondere Hinweise..."
                />
              </div>

              {/* BESTÄTIGUNGS-STATUS (nur Info, Chef kann nicht bestätigen) */}
              {editingShift && (
                <div className={`p-3 rounded-xl flex items-center gap-3 border text-xs ${editingShift.isConfirmed ? 'bg-green-50 border-green-100 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  <Info size={16}/>
                  <div className="font-bold uppercase tracking-tight">
                      {editingShift.isConfirmed ? "✓ Vom Mitarbeiter bestätigt" : "⏳ Wartet auf Bestätigung vom Mitarbeiter"}
                  </div>
                </div>
              )}

              {/* ACTIONS */}
              <div className="flex gap-3 pt-2">
                {editingShift && (
                  <Button type="button" variant="ghost" className="flex-1 text-red-500 hover:bg-red-50" onClick={handleDeleteShift}>
                    <Trash2 size={16} className="mr-2"/> Löschen
                  </Button>
                )}
                <Button type="submit" className="flex-[2] py-3 shadow-md">
                  {editingShift ? "Änderung speichern" : "Dienst anlegen"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* DIENST-DETAILS MODAL (READ-ONLY) */}
      {shiftDetailModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShiftDetailModal(null)}>
          <Card className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border-none" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-black text-xl uppercase tracking-tight mb-2">Dienst-Details</h3>
                  <div className="text-sm opacity-90">{format(parseISO(shiftDetailModal.date), 'EEEE, dd. MMMM yyyy', { locale: de })}</div>
                </div>
                <button onClick={() => setShiftDetailModal(null)} className="text-white/80 hover:text-white transition-colors">
                  <X size={24}/>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* MITARBEITER */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="h-12 w-12 rounded-xl overflow-hidden bg-blue-100 flex items-center justify-center text-blue-600 font-black">
                  <User size={24}/>
                </div>
                <div className="flex-1">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mitarbeiter</div>
                  <div className="text-sm font-black text-slate-900">{shiftDetailModal.employeeName || 'Unbekannt'}</div>
                </div>
              </div>

              {/* ZEIT & ORT */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <Clock size={16}/>
                    <div className="text-[9px] font-bold uppercase tracking-widest">Arbeitszeit</div>
                  </div>
                  <div className="text-lg font-black text-slate-900">
                    {shiftDetailModal.startTime} - {shiftDetailModal.endTime}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {(() => {
                      const start = new Date(`${shiftDetailModal.date}T${shiftDetailModal.startTime}`);
                      let end = new Date(`${shiftDetailModal.date}T${shiftDetailModal.endTime}`);
                      if (end < start) end.setDate(end.getDate() + 1);
                      const hours = ((end - start) / (1000 * 60 * 60)).toFixed(2);
                      return `${hours} Stunden`;
                    })()}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <MapPin size={16}/>
                    <div className="text-[9px] font-bold uppercase tracking-widest">Standort</div>
                  </div>
                  <div className="text-sm font-black text-slate-900">{shiftDetailModal.location || 'Unbekannt'}</div>
                  {shiftDetailModal.clientName && (
                    <div className="text-xs text-slate-500 mt-1">{shiftDetailModal.clientName}</div>
                  )}
                </div>
              </div>

              {/* TEAM VOR ORT */}
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center gap-2 text-green-700 mb-3">
                  <Users size={16}/>
                  <div className="text-[9px] font-bold uppercase tracking-widest">Team vor Ort</div>
                </div>
                <div className="flex flex-col gap-2">
                  {shifts
                    .filter(s => 
                      s.date === shiftDetailModal.date && 
                      s.projectId === shiftDetailModal.projectId &&
                      s.id !== shiftDetailModal.id &&
                      s.isConfirmed
                    )
                    .map(member => (
                      <div key={member.id} className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-white p-2 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-600">
                          {member.employeeName?.charAt(0)}
                        </div>
                        {member.employeeName}
                      </div>
                    ))}
                  {shifts.filter(s => 
                    s.date === shiftDetailModal.date && 
                    s.projectId === shiftDetailModal.projectId &&
                    s.id !== shiftDetailModal.id &&
                    s.isConfirmed
                  ).length === 0 && (
                    <div className="text-xs italic text-slate-400">Allein-Dienst</div>
                  )}
                </div>
              </div>

              {/* NOTIZ */}
              {shiftDetailModal.note && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex items-center gap-2 text-amber-700 mb-2">
                    <FileText size={16}/>
                    <div className="text-[9px] font-bold uppercase tracking-widest">Notiz</div>
                  </div>
                  <div className="text-sm text-slate-700">{shiftDetailModal.note}</div>
                </div>
              )}

              {/* STATUS */}
              <div className={`p-4 rounded-xl flex items-center gap-3 ${shiftDetailModal.isConfirmed ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {shiftDetailModal.isConfirmed ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
                <div className="text-sm font-bold uppercase tracking-tight">
                  {shiftDetailModal.isConfirmed ? "✓ Bestätigt vom Mitarbeiter" : "⏳ Wartet auf Bestätigung"}
                </div>
              </div>

              {/* EDIT BUTTON */}
              <div className="flex gap-3">
                <Button onClick={() => { setShiftDetailModal(null); handleEditShift(shiftDetailModal); }} className="flex-1">
                  <Edit2 size={16} className="mr-2"/> Bearbeiten
                </Button>
                <Button onClick={() => setShiftDetailModal(null)} variant="outline" className="flex-1">
                  Schließen
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
