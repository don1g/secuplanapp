import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Mail, Phone, MapPin, Clock, Info, User, Save, Upload, CreditCard, Shirt, FileText, Car, X } from 'lucide-react'; // X hinzugefügt
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
  
  // NEU: State für Bild-Vergrößerung
  const [showImageModal, setShowImageModal] = useState(false);

  const activeUserId = targetUserId || user.uid;
  const activeUser = employees.find(e => e.id === activeUserId) || { name: "Mitarbeiter" };
  const isOwnProfile = user.uid === activeUser.id;

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

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

  useEffect(() => {
    if (!companyId) return;
    const loadData = async () => {
        const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 }).toISOString().split('T')[0];
        const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 }).toISOString().split('T')[0];
        
        const qShifts = query(collection(db, "companies", companyId, "shifts"), where("date", ">=", start), where("date", "<=", end));
        const snapShifts = await getDocs(qShifts);
        setShifts(snapShifts.docs.map(d => ({ id: d.id, ...d.data() })));

        const snapObjs = await getDocs(collection(db, "companies", companyId, "objects"));
        setObjects(snapObjs.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadData();
  }, [date, companyId]);

  const handleSave = () => {
      if (onSaveProfile) {
          onSaveProfile(formData);
          setIsEditing(false);
      }
  };

  const exportPDF = () => {
    try {
        const pdf = new jsPDF('landscape', 'mm', 'a4');
        pdf.text(`Dienstplan - ${activeUser.name} - ${format(date, 'MMMM yyyy', { locale: de })}`, 14, 15);
        const tableData = [['Datum', 'Tag', 'Von', 'Bis', 'Objekt', 'Adresse']];
        const monthStart = startOfMonth(date);
        const myShifts = shifts.filter(s => s.employeeId === activeUserId).sort((a,b) => a.date.localeCompare(b.date));

        myShifts.forEach(s => {
            const d = new Date(s.date);
            if (isSameMonth(d, monthStart)) {
                const obj = objects.find(o => o.id === s.objectId);
                tableData.push([
                    format(d, 'dd.MM.yyyy'),
                    format(d, 'EEEE', { locale: de }),
                    s.startTime || '-', s.endTime || '-',
                    obj?.name || s.location || '-',
                    obj?.address || '-'
                ]);
            }
        });
        autoTable(pdf, { head: [tableData[0]], body: tableData.slice(1), startY: 25 });
        pdf.save(`Dienstplan_${activeUser.name}.pdf`);
    } catch(e) { alert("PDF Fehler"); }
  };

  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }) });
  
  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full animate-in fade-in">
      
      {/* LINKE SPALTE: PROFIL */}
      <Card className="w-full lg:w-80 flex-shrink-0 p-6 flex flex-col h-fit bg-white border-slate-200 shadow-md">
        <div className="flex flex-col items-center text-center relative">
            
            {/* PROFILBILD LOGIK GEÄNDERT */}
            <div className="relative group mb-4">
                <div 
                    onClick={() => !isEditing && setShowImageModal(true)} 
                    className={!isEditing ? "cursor-zoom-in transition-transform hover:scale-105" : ""}
                >
                    <Avatar src={activeUser.imageUrl} alt={activeUser.name} size="xl" className="shadow-lg border-4 border-slate-50"/>
                </div>

                {/* Upload nur anzeigen wenn EDITING aktiv ist */}
                {isOwnProfile && isEditing && (
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl cursor-pointer text-white animate-in fade-in">
                        <Upload size={24}/>
                        <input type="file" className="hidden" onChange={onImageUpload} />
                    </label>
                )}
            </div>
            
            <h2 className="text-xl font-bold text-slate-900">{activeUser.name}</h2>
            <div className="flex items-center gap-2 mt-1">
                <Badge color="blue">{EMP_ROLES[activeUser.role]?.label || activeUser.role || "Mitarbeiter"}</Badge>
                {activeUser.status && <Badge color="green">{activeUser.status}</Badge>}
            </div>
            <div className="text-xs text-slate-500 mt-1 mb-4">{activeUser.email}</div>

            {isOwnProfile && onSaveProfile && (
                <Button 
                    size="sm" 
                    variant={isEditing ? "ghost" : "outline"} 
                    className="w-full mb-4"
                    onClick={() => setIsEditing(!isEditing)}
                >
                    {isEditing ? "Abbrechen" : "Profil bearbeiten"}
                </Button>
            )}
        </div>

        {/* DATEN FELDER */}
        <div className="border-t border-slate-100 pt-4 space-y-4 text-sm text-slate-700">
            <div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-1"><Phone size={12}/> Telefon</div>
                {isEditing ? <input className="w-full p-1.5 border rounded text-sm bg-white" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /> : <div className="font-medium text-slate-900">{activeUser.phone || "-"}</div>}
            </div>
            <div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-1"><MapPin size={12}/> Adresse</div>
                {isEditing ? <textarea rows="2" className="w-full p-1.5 border rounded text-sm resize-none bg-white" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /> : <div className="font-medium text-slate-900 whitespace-pre-wrap">{activeUser.address || "-"}</div>}
            </div>
            <div className="border-t border-slate-100 pt-4"></div>
            <div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-1"><CreditCard size={12}/> IBAN</div>
                {isEditing ? <input className="w-full p-1.5 border rounded text-sm bg-white" value={formData.iban} onChange={e => setFormData({...formData, iban: e.target.value})} /> : <div className="font-medium text-slate-900 font-mono text-xs">{activeUser.iban || "-"}</div>}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-1"><Shirt size={12}/> Größe</div>
                    {isEditing ? <select className="w-full p-1.5 border rounded text-sm bg-white" value={formData.shirtSize} onChange={e => setFormData({...formData, shirtSize: e.target.value})}><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></select> : <div className="font-medium text-slate-900">{activeUser.shirtSize || "-"}</div>}
                </div>
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-1"><FileText size={12}/> Steuer-ID</div>
                    {isEditing ? <input className="w-full p-1.5 border rounded text-sm bg-white" value={formData.taxId} onChange={e => setFormData({...formData, taxId: e.target.value})} /> : <div className="font-medium text-slate-900">{activeUser.taxId || "-"}</div>}
                </div>
            </div>
            <div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-1"><Car size={12}/> Führerschein</div>
                {isEditing ? <label className="flex items-center gap-2 cursor-pointer mt-1"><input type="checkbox" checked={formData.hasLicense} onChange={e => setFormData({...formData, hasLicense: e.target.checked})} className="rounded text-blue-600"/><span className="text-sm">Vorhanden</span></label> : <div className="font-medium text-slate-900">{activeUser.hasLicense ? <span className="text-green-600 flex items-center gap-1">Ja</span> : <span className="text-slate-400">Nein</span>}</div>}
            </div>
            {isEditing && <Button className="w-full mt-4" onClick={handleSave} icon={Save}>Speichern</Button>}
        </div>
      </Card>

      {/* KALENDER */}
      <Card className="flex-1 overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">Dienstplan</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportPDF} icon={Download}>PDF</Button>
            <div className="flex items-center bg-white border border-slate-300 rounded-lg shadow-sm">
              <button onClick={() => setDate(subMonths(date, 1))} className="p-1.5 hover:bg-slate-100 rounded-l-lg text-slate-600"><ChevronLeft size={18}/></button>
              <span className="px-3 text-sm font-bold w-28 text-center text-slate-900 capitalize">{format(date, 'MMM yyyy', { locale: de })}</span>
              <button onClick={() => setDate(addMonths(date, 1))} className="p-1.5 hover:bg-slate-100 rounded-r-lg text-slate-600"><ChevronRight size={18}/></button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{['Mo','Di','Mi','Do','Fr','Sa','So'].map(d=><div key={d} className="py-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">{d}</div>)}</div>
        <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-px flex-1">
          {days.map(d => {
            const dStr = format(d, 'yyyy-MM-dd');
            const isToday = isSameDay(d, new Date());
            const dayShifts = shifts.filter(s => s.date === dStr && s.employeeId === activeUserId);
            return (
              <div key={dStr} className={`bg-white p-1 min-h-[80px] flex flex-col ${!isSameMonth(d, date) ? 'bg-slate-50/50 text-slate-300' : ''} ${isToday ? 'bg-blue-50/30' : ''}`}>
                <span className={`text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-sm' : ''}`}>{format(d, 'd')}</span>
                <div className="flex-1 flex flex-col justify-end gap-1 mt-1">
                  {dayShifts.map((s, i) => {
                    const obj = objects.find(o => o.id === s.objectId);
                    return <div key={i} onClick={() => setSelectedShift({ ...s, objectDetails: obj })} className="bg-blue-600 text-white text-[9px] rounded px-1.5 py-1 truncate shadow-sm cursor-pointer hover:bg-blue-700 transition-colors">{s.startTime}-{s.endTime} {obj?.name || s.location}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* DETAIL MODAL SCHICHT */}
      {selectedShift && (
        <Modal title="Einsatz-Details" onClose={() => setSelectedShift(null)}>
            <div className="space-y-4">
                <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <Clock className="text-blue-600 h-5 w-5"/>
                    <div>
                        <div className="text-xs font-bold text-slate-500 uppercase">Zeit</div>
                        <div className="font-bold text-slate-900">{format(new Date(selectedShift.date), 'dd.MM.yyyy')} | {selectedShift.startTime} - {selectedShift.endTime} Uhr</div>
                    </div>
                </div>
                <div className="border-t border-slate-100 pt-4 space-y-3">
                    <div><div className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><MapPin size={12}/> Objekt</div><div className="font-bold text-lg text-slate-900">{selectedShift.objectDetails?.name || selectedShift.location || "Unbekannt"}</div>{selectedShift.objectDetails?.address && <div className="text-slate-600 text-sm">{selectedShift.objectDetails.address}</div>}</div>
                    {selectedShift.objectDetails?.client && <div><div className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><User size={12}/> Auftraggeber</div><div className="text-slate-800 text-sm">{selectedShift.objectDetails.client}</div></div>}
                    {selectedShift.objectDetails?.uniform && <div><div className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Info size={12}/> Dienstkleidung</div><div className="bg-slate-100 px-2 py-1 rounded text-sm text-slate-700 inline-block">{selectedShift.objectDetails.uniform}</div></div>}
                    {selectedShift.objectDetails?.notes && <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg"><div className="text-xs font-bold text-yellow-700 uppercase mb-1">Wichtige Infos</div><div className="text-sm text-yellow-900 whitespace-pre-wrap">{selectedShift.objectDetails.notes}</div></div>}
                </div>
                <Button className="w-full mt-2" onClick={() => setSelectedShift(null)}>Schließen</Button>
            </div>
        </Modal>
      )}

      {/* NEU: BILD VERGRÖßERUNGS MODAL (LIGHTBOX) */}
      {showImageModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-in fade-in" onClick={() => setShowImageModal(false)}>
            <div className="relative max-w-4xl w-full h-full flex items-center justify-center">
                <button className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full backdrop-blur-sm" onClick={() => setShowImageModal(false)}>
                    <X size={24} />
                </button>
                <img src={activeUser.imageUrl} alt={activeUser.name} className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
            </div>
        </div>
      )}
    </div>
  );
};