import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, Clock, MapPin, Users, Info, 
  ChevronLeft, ChevronRight, AlertCircle 
} from 'lucide-react';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameDay, addMonths, subMonths, parseISO 
} from 'date-fns';
import { de } from 'date-fns/locale';
import { collection, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

export const RosterScheduler = ({ user, companyId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [allCompanyShifts, setAllCompanyShifts] = useState([]); // Für die Team-Sicht
  const [loading, setLoading] = useState(true);

  const isOwner = user.uid === (user.id || user.uid); // Prüft ob der MA sein eigenes Profil sieht

  useEffect(() => {
    if (!companyId) return;

    // 1. Alle Schichten der Firma laden (für die Team-Abgleichung)
    const unsubAll = onSnapshot(collection(db, "companies", companyId, "shifts"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllCompanyShifts(data);
      // 2. Nur die Schichten für diesen spezifischen Mitarbeiter filtern
      setShifts(data.filter(s => s.employeeId === (user.id || user.uid)));
      setLoading(false);
    });

    return () => unsubAll();
  }, [companyId, user.id, user.uid]);

  const days = useMemo(() => eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  }), [currentDate]);

  const handleConfirm = async (shiftId) => {
    try {
      await updateDoc(doc(db, "companies", companyId, "shifts", shiftId), {
        isConfirmed: true,
        confirmedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Fehler bei Bestätigung:", e);
    }
  };

  // Findet heraus, wer noch an diesem Tag im selben Objekt ist
  const getTeamMembers = (date, projectId, currentShiftId) => {
    return allCompanyShifts.filter(s => 
      s.date === date && 
      s.projectId === projectId && 
      s.id !== currentShiftId &&
      s.isConfirmed === true // Man sieht das Team erst, wenn man selbst & die anderen bestätigt sind (oder nach deiner Vorgabe: sobald man selbst bestätigt ist)
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      
      {/* MONATS-NAV */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-slate-50 rounded-lg"><ChevronLeft size={20}/></button>
          <span className="text-sm font-bold uppercase tracking-widest text-slate-900">{format(currentDate, 'MMMM yyyy', { locale: de })}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-slate-50 rounded-lg"><ChevronRight size={20}/></button>
        </div>
        <div className="text-[10px] font-black uppercase text-slate-400">Mein Dienstplan</div>
      </div>

      {/* KALENDER-MATRIX */}
      <Card className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-200">
                {days.map(day => (
                  <th key={day.toString()} className={`p-4 border-r border-slate-200 min-w-[140px] text-center ${format(day, 'E') === 'So' ? 'bg-red-50/50' : ''}`}>
                    <div className="text-[8px] font-bold text-slate-400 uppercase">{format(day, 'EEEEEE', { locale: de })}</div>
                    <div className="text-sm font-black text-slate-900">{format(day, 'dd')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {days.map(day => {
                  const dStr = format(day, 'yyyy-MM-dd');
                  const dayShifts = shifts.filter(s => s.date === dStr);

                  return (
                    <td key={day.toString()} className={`p-2 border-r border-slate-200 align-top min-h-[150px] ${format(day, 'E') === 'So' ? 'bg-red-50/20' : ''}`}>
                      <div className="space-y-3">
                        {dayShifts.map(s => {
                          const team = getTeamMembers(s.date, s.projectId, s.id);
                          
                          return (
                            <div key={s.id} className={`p-3 rounded-xl border-2 transition-all ${s.isConfirmed ? 'border-green-500 bg-green-50/30' : 'border-blue-200 bg-blue-50/30'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-xs font-black text-slate-900 flex items-center gap-1">
                                  <Clock size={12} className="text-blue-500"/> {s.startTime} - {s.endTime}
                                </div>
                                {s.isConfirmed && <CheckCircle2 size={14} className="text-green-600"/>}
                              </div>
                              
                              <div className="text-[10px] font-bold text-slate-600 mb-3 flex items-center gap-1">
                                <MapPin size={12} className="text-slate-400"/> {s.location}
                              </div>

                              {/* BESTÄTIGUNGS-BUTTON (Nur für den Inhaber sichtbar & wenn noch nicht bestätigt) */}
                              {!s.isConfirmed && isOwner && (
                                <button 
                                  onClick={() => handleConfirm(s.id)}
                                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-md transition-all"
                                >
                                  Dienst bestätigen
                                </button>
                              )}

                              {/* TEAM-SICHT (Nur nach Bestätigung) */}
                              {s.isConfirmed && (
                                <div className="mt-3 pt-3 border-t border-green-200">
                                  <div className="text-[8px] font-black uppercase text-green-700 mb-2 flex items-center gap-1">
                                    <Users size={10}/> Team vor Ort:
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    {team.length > 0 ? team.map(member => (
                                      <div key={member.id} className="flex items-center gap-2 text-[9px] font-bold text-slate-700 bg-white/50 p-1 rounded-md">
                                        <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[7px]">{member.employeeName?.charAt(0)}</div>
                                        {member.employeeName}
                                      </div>
                                    )) : (
                                      <div className="text-[8px] italic text-slate-400">Allein-Dienst</div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {!dayShifts.length && <div className="h-20 flex items-center justify-center text-[8px] text-slate-200 font-bold uppercase tracking-tighter italic">Kein Dienst</div>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-xl border border-blue-100">
        <Info size={16} className="text-blue-500 shrink-0"/>
        <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
          Bestätige deine Dienste rechtzeitig. Sobald ein Dienst bestätigt ist, siehst du deine Kollegen im Objekt.
        </p>
      </div>
    </div>
  );
};