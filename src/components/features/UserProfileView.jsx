import React, { useState } from 'react';
import { 
  ArrowLeft, Mail, Phone, MapPin, Loader2,
  IdCard, Baby, Award, Car, Shirt, Shield, User, CalendarDays 
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { RosterScheduler } from './RosterScheduler';

export const UserProfileView = ({ employee, companyId, onBack }) => {
  const [activeTab, setActiveTab] = useState('profile');

  // 1. SCHUTZ: Wenn kein Mitarbeiter-Objekt ankommt, zeige Ladebildschirm statt Absturz
  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[2.5rem] shadow-xl">
        <Loader2 className="animate-spin text-blue-600 mb-4" />
        <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Daten werden synchronisiert...</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">Zurück</Button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} icon={ArrowLeft} className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Zurück</Button>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button onClick={() => setActiveTab('profile')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'profile' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>
            <User size={14} className="inline mr-2"/> Profil
          </button>
          <button onClick={() => setActiveTab('roster')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'roster' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>
            <CalendarDays size={14} className="inline mr-2"/> Dienstplan
          </button>
        </div>
      </div>

      {activeTab === 'profile' ? (
        <Card className="max-w-5xl mx-auto overflow-hidden shadow-2xl border-none rounded-[2.5rem] bg-white text-slate-900">
          <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
          <div className="relative -mt-16 mb-6 flex flex-col items-center">
            <div className="h-32 w-32 border-4 border-white shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
                <Avatar src={employee?.imageUrl} alt={employee?.name} size="full" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mt-4 uppercase tracking-tight">{employee?.name || 'Mitarbeiter'}</h2>
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-6 py-2 rounded-2xl border border-blue-100 font-black text-xs uppercase">
                <IdCard size={18}/> ID: {employee?.bewacherId || '---'}
              </div>
            </div>
          </div>

          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-50 bg-slate-50/30">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Stammdaten</h4>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 text-slate-900">
                <Baby size={20} className="text-blue-500"/>
                <div><div className="text-[9px] font-black text-slate-400 uppercase">Geburtsdatum</div><div className="text-sm font-bold">{employee?.birthDate || '---'}</div></div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 text-slate-900">
                <Phone size={20} className="text-blue-500"/>
                <div><div className="text-[9px] font-black text-slate-400 uppercase">Telefon</div><div className="text-sm font-bold">{employee?.phone || '---'}</div></div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Qualifikation</h4>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 text-slate-900">
                <Shirt size={20} className="text-blue-500"/>
                <div><div className="text-[9px] font-black text-slate-400 uppercase">Größe</div><div className="text-sm font-bold">{employee?.shirtSize || 'L'}</div></div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 text-slate-900">
                <Award size={20} className="text-blue-500"/>
                <div><div className="text-[9px] font-black text-slate-400 uppercase">Status</div><div className="text-sm font-bold">{employee?.qualification || 'Sachkunde'}</div></div>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="animate-in zoom-in-95">
          {/* Wir mappen die ID zu UID, damit der Scheduler sie findet */}
          <RosterScheduler 
            user={{ ...employee, uid: employee.id }} 
            companyId={companyId} 
          />
        </div>
      )}
    </div>
  );
};