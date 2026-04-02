import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Phone, Loader2, MapPin } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { RosterScheduler } from './RosterScheduler';

export const UserProfileView = ({ targetUserId, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // GitHub Logik: Kaskadierende Suche
      let docSnap = await getDoc(doc(db, "users", targetUserId));
      let isCompany = false;
      
      if (!docSnap.exists()) { 
          docSnap = await getDoc(doc(db, "companies", targetUserId)); 
          isCompany = true; 
      }
      
      if (docSnap.exists()) {
        const uData = docSnap.data();
        let companyInfo = null;
        if (uData.companyId) {
          const cSnap = await getDoc(doc(db, "companies", uData.companyId));
          if (cSnap.exists()) companyInfo = { id: cSnap.id, ...cSnap.data() };
        }
        setData({ id: docSnap.id, ...uData, isCompany, companyInfo });
      }
      setLoading(false);
    };
    load();
  }, [targetUserId]);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600 h-10 w-10"/></div>;
  if (!data) return <div className="p-10 text-center text-slate-500">Nutzer nicht gefunden. <Button variant="ghost" onClick={onBack}>Zurück</Button></div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4">
      <Button variant="ghost" size="sm" onClick={onBack} icon={ArrowLeft} className="mb-6">Zurück</Button>
      
      {!data.isCompany && data.companyInfo ? (
        <RosterScheduler 
            user={{ uid: "viewer" }} 
            targetUserId={targetUserId} 
            companyId={data.companyInfo.id} 
            employees={[{ id: targetUserId, ...data }]} 
        />
      ) : (
        <Card className="max-w-3xl mx-auto overflow-hidden text-center shadow-xl border-slate-200">
          <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-400"></div>
          <div className="relative -mt-16 mb-4 flex justify-center">
            <Avatar src={data.imageUrl} alt={data.name} size="xl" className="border-4 border-white shadow-lg bg-white"/>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1">{data.name}</h2>
          <div className="text-blue-600 font-bold text-sm mb-8 uppercase tracking-widest">
            {data.isCompany ? "Verifiziertes Unternehmen" : "Sicherheitsmitarbeiter"}
          </div>
          <div className="border-t border-slate-100 bg-slate-50/50 p-8 space-y-4 text-left">
            <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Mail size={20}/></div>
                <div><div className="text-[10px] text-slate-400 font-black uppercase">E-Mail</div><div className="text-slate-700 font-medium">{data.email || data.publicEmail}</div></div>
            </div>
            {data.phone && (
                <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Phone size={20}/></div>
                    <div><div className="text-[10px] text-slate-400 font-black uppercase">Telefon</div><div className="text-slate-700 font-medium">{data.phone}</div></div>
                </div>
            )}
            {data.address && (
                <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><MapPin size={20}/></div>
                    <div><div className="text-[10px] text-slate-400 font-black uppercase">Standort</div><div className="text-slate-700 font-medium">{data.address}</div></div>
                </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};