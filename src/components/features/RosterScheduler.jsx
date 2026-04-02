import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Clock, Info, 
  MapPin, User, Shirt, Calendar, Loader2, CheckCircle, Car, Users, FileText, Download 
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isAfter 
} from 'date-fns';
import { de } from 'date-fns/locale';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export const RosterScheduler = ({ user, companyId }) => {
  const [date, setDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [allShifts, setAllShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!companyId || !user?.uid) return;
    setIsLoading(true);
    
    const unsub = onSnapshot(collection(db, "companies", companyId, "shifts"), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllShifts(data);
        setShifts(data.filter(s => s.employeeId === user.uid));
        setIsLoading(false);
    });

    return () => unsub();
  }, [companyId, user?.uid]);

  // --- BERECHNUNGSLOGIK FÜR PDF & DASHBOARD ---

  const getShiftIntervals = (s) => {
    const start = new Date(s.date + 'T' + s.startTime);
    let end = new Date(s.date + 'T' + s.endTime);
    if (end < start) end.setDate(end.getDate() + 1);
    return { start, end };
  };

  const calculateTotalHours = (start, end) => (end - start) / (1000 * 60 * 60);

  const calculateNightHours = (start, end) => {
    let nightMin = 0;
    let curr = new Date(start);
    while (curr < end) {
      const h = curr.getHours();
      if (h >= 22 || h < 6) nightMin++; 
      curr.setMinutes(curr.getMinutes() + 1);
    }
    return nightMin / 60;
  };

  const calculateSundayHours = (start, end) => {
    let sunMin = 0;
    let curr = new Date(start);
    while (curr < end) {
      if (curr.getDay() === 0) sunMin++;
      curr.setMinutes(curr.getMinutes() + 1);
    }
    return sunMin / 60;
  };

  // --- PDF EXPORT (MATCHING THE SAMPLE PDF) ---

  const exportMonthlyPDF = () => {
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const monthTitle = format(date, 'MMMM yyyy', { locale: de });
    const now = new Date();
    
    // Header Sektion
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(`Offizielle Abrechnungsübersicht: ${monthTitle}`, 14, 15);
    
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Mitarbeiter: ${user.name}`, 14, 22);
    pdf.text(`Status: Nur bestätigte und abgeschlossene Einsätze`, 14, 27);

    // Daten filtern: Nur bestätigte & vergangen
    const monthlyShifts = shifts.filter(s => {
        if (!isSameMonth(parseISO(s.date), date) || !s.isConfirmed) return false;
        const { end } = getShiftIntervals(s);
        return isAfter(now, end);
    }).sort((a, b) => a.date.localeCompare(b.date));

    const tableData = monthlyShifts.map(s => {
      const { start, end } = getShiftIntervals(s);
      const total = calculateTotalHours(start, end);
      const night = calculateNightHours(start, end);
      const sunday = calculateSundayHours(start, end);
      
      // Datumsformatierung wie im Beispiel: 01.04. (Mi.)
      const dayName = format(start, 'EEE', { locale: de });
      const formattedDate = `${format(start, 'dd.MM.')} (${dayName}.)`;

      return [
        formattedDate,
        s.location,
        `${s.startTime}-${s.endTime}`,
        total.toFixed(2) + ' h',
        night > 0 ? night.toFixed(2) + ' h' : '',
        sunday > 0 ? sunday.toFixed(2) + ' h' : '',
        '' // Feiertag (Platzhalter)
      ];
    });

    const totalSum = tableData.reduce((acc, row) => acc + parseFloat(row[3]), 0);

    autoTable(pdf, {
      head: [['Datum', 'Einsatzort', 'Zeitraum', 'Gesamt', 'Nacht (22-06)', 'Sonntag', 'Feiertag']],
      body: tableData,
      startY: 32,
      theme: 'grid', // Sauberer Gitter-Look wie im Beispiel
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [200, 200, 200] },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'left' },
      columnStyles: { 
          0: { cellWidth: 35 },
          3: { halign: 'right', fontStyle: 'bold' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' }
      },
      foot: [['', '', 'ABGERECHNETE SUMME', totalSum.toFixed(2) + ' h', '', '', '']],
      footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'right' }
    });

    pdf.save(`Abrechnung_${user.name}_${monthTitle}.pdf`);
  };

  const totalConfirmedPastHours = useMemo(() => {
    const now = new Date();
    return shifts.filter(s => {
        if (!isSameMonth(parseISO(s.date), date) || !s.isConfirmed) return false;
        const { end } = getShiftIntervals(s);
        return isAfter(now, end);
    }).reduce((sum, s) => {
        const { start, end } = getShiftIntervals(s);
        return sum + calculateTotalHours(start, end);
    }, 0);
  }, [shifts, date]);

  const days = eachDayOfInterval({ 
    start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }), 
    end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }) 
  });
  
  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-10">
      
      {/* HEADER NAVIGATION */}
      <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white shadow-xl rounded-[2rem] border-slate-100">
        <div className="flex items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-100 w-full sm:w-auto">
          <button onClick={() => setDate(subMonths(date, 1))} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-blue-600"><ChevronLeft size={20}/></button>
          
          <div className="flex items-center gap-3 px-4 flex-1 justify-center">
              <span className="text-xs font-black text-slate-900 capitalize whitespace-nowrap">
                {format(date, 'MMMM yyyy', { locale: de })}
              </span>
              <div className="flex items-center gap-1.5 bg-blue-600 text-white px-2.5 py-1 rounded-xl shadow-sm">
                <Clock size={10}/>
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {totalConfirmedPastHours.toFixed(2)}h
                </span>
              </div>
          </div>

          <button onClick={() => setDate(addMonths(date, 1))} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-blue-600"><ChevronRight size={20}/></button>
        </div>

        <button 
          onClick={exportMonthlyPDF}
          className="w-full sm:w-auto bg-slate-900 hover:bg-blue-600 text-white px-6 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-xl"
        >
          <Download size={14}/> Abrechnung PDF
        </button>
      </Card>
      
      {/* KALENDER GRID */}
      <Card className="overflow-hidden bg-white rounded-[2.5rem] shadow-2xl border-slate-100">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
            {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
              <div key={d} className={`py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] ${d === 'So' ? 'text-red-500' : 'text-slate-400'}`}>{d}</div>
            ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr bg-slate-100/30 gap-px">
          {days.map(d => {
            const dStr = format(d, 'yyyy-MM-dd');
            const dayShifts = shifts.filter(s => s.date === dStr);
            const isToday = isSameDay(d, new Date());
            const isSunday = d.getDay() === 0;

            return (
              <div key={dStr} className={`bg-white p-2 min-h-[120px] ${!isSameMonth(d, date) ? 'opacity-30' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className={`text-[11px] font-black w-7 h-7 flex items-center justify-center rounded-xl mb-1 ${isToday ? 'bg-blue-600 text-white shadow-lg' : isSunday ? 'text-red-500 bg-red-50' : 'text-slate-400'}`}>
                        {format(d, 'd')}
                    </div>
                </div>
                <div className="space-y-1.5">
                  {dayShifts.map((s, i) => (
                    <div key={i} onClick={() => setSelectedShift(s)} className={`${s.isConfirmed ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'} text-[8px] font-bold rounded-xl p-2 border cursor-pointer hover:scale-105 transition-all shadow-sm overflow-hidden`}>
                        <div className="flex justify-between items-center mb-0.5">
                            <span className="truncate">{s.startTime}-{s.endTime}</span>
                            {s.isConfirmed && <CheckCircle size={10}/>}
                        </div>
                        <div className="opacity-70 truncate border-t border-current/10 pt-1 leading-tight">{s.location}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* DETAIL MODAL (BLEIBT GLEICH) */}
      {selectedShift && (
        <Modal title="Einsatz-Details" onClose={() => setSelectedShift(null)}>
            <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-1 text-slate-900">
                <div className={`p-6 rounded-[2rem] flex items-center justify-between text-white shadow-2xl ${selectedShift.isConfirmed ? 'bg-green-600' : 'bg-blue-600'}`}>
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-white/20 rounded-2xl shadow-inner"><Clock size={28}/></div>
                        <div>
                            <div className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-1">Einsatzzeit</div>
                            <div className="font-black text-xl">{format(new Date(selectedShift.date), 'EEEE, dd.MM.yyyy', { locale: de })}</div>
                            <div className="text-md font-bold opacity-90">{selectedShift.startTime} - {selectedShift.endTime} Uhr</div>
                        </div>
                    </div>
                </div>

                {!selectedShift.isConfirmed && (
                    <button 
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl" 
                      onClick={async () => {
                          await updateDoc(doc(db, "companies", companyId, "shifts", selectedShift.id), { isConfirmed: true });
                          setSelectedShift(prev => ({...prev, isConfirmed: true}));
                      }}
                    >
                      Dienst jetzt Bestätigen
                    </button>
                )}

                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-8">
                    <div className="flex gap-5">
                      <MapPin size={24} className="text-blue-600 shrink-0 mt-1"/>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Einsatzort</div>
                        <div className="text-lg font-black uppercase leading-tight text-slate-900">{selectedShift.location}</div>
                        <div className="text-xs font-medium text-slate-500 mt-1">{selectedShift.objectAddress || "Keine Adresse hinterlegt"}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-sm">
                            <div className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center justify-center gap-2"><Car size={14}/> Fahrer</div>
                            <div className={`text-xs font-black uppercase ${selectedShift.isDriver ? 'text-blue-600' : 'text-slate-400 italic'}`}>
                                {selectedShift.isDriver ? "Aktiv" : "Nein"}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-sm">
                            <div className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center justify-center gap-2"><Shirt size={14}/> Kleidung</div>
                            <div className="text-xs font-black uppercase text-slate-800">{selectedShift.uniform || "Standard"}</div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-50 rounded-xl text-blue-600 shadow-sm"><User size={20}/></div>
                            <div className="flex-1">
                                <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Ansprechpartner</div>
                                <div className="text-sm font-bold">{selectedShift.contactPerson || "Keine Angabe"}</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-50 rounded-xl text-blue-600 shadow-sm"><Info size={20}/></div>
                            <div className="flex-1">
                                <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Parken / Anfahrt</div>
                                <div className="text-sm font-bold">{selectedShift.parkingInfo || "Keine Angabe"}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <Button className="w-full py-5 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600" variant="ghost" onClick={() => setSelectedShift(null)}>Schließen</Button>
            </div>
        </Modal>
      )}
    </div>
  );
};