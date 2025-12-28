import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Phone, Loader2 } from 'lucide-react';
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
      // 1. Suche in Users
      let docSnap = await getDoc(doc(db, "users", targetUserId));
      let isCompany = false;
      
      // 2. Falls nicht, suche in Companies
      if (!docSnap.exists()) { 
          docSnap = await getDoc(doc(db, "companies", targetUserId)); 
          isCompany = true; 
      }
      
      if (docSnap.exists()) {
        const uData = docSnap.data();
        let companyInfo = null;
        // Wenn Mitarbeiter, lade Firmeninfo dazu
        if (uData.companyId) {
          const cSnap = await getDoc(doc(db, "companies", uData.companyId));
          if (cSnap.exists()) companyInfo = { id: cSnap.id, ...cSnap.data() };
        }
        setData({ ...uData, isCompany, companyInfo });
      }
      setLoading(false);
    };
    load();
  }, [targetUserId]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600"/></div>;
  if (!data) return <div className="p-10 text-center">Nutzer nicht gefunden. <Button variant="ghost" onClick={onBack}>Zurück</Button></div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 pb-10">
      <Button variant="outline" size="sm" onClick={onBack} icon={ArrowLeft} className="mb-6">Zurück</Button>
      
      {/* Wenn Mitarbeiter -> Zeige Dienstplan (der enthält links schon die Profilkarte) */}
      {!data.isCompany && data.companyInfo ? (
        <RosterScheduler 
            user={{ uid: "viewer" }} 
            targetUserId={targetUserId} 
            companyId={data.companyInfo.id} 
            employees={[{ id: targetUserId, ...data }]} 
        />
      ) : (
        /* Wenn Firma oder Privat -> Zeige einfache Profilkarte */
        <Card className="max-w-3xl mx-auto overflow-hidden pb-8 text-center shadow-lg">
          <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-400"></div>
          <div className="relative -mt-16 mb-3 flex justify-center">
            <Avatar src={data.imageUrl} alt={data.name} size="xl" className="border-4 border-white shadow-md bg-white"/>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-1">{data.name}</h2>
          <div className="text-slate-500 font-medium mb-6">
            {data.isCompany ? "Firmenprofil" : `Mitarbeiter bei ${data.companyInfo?.name || 'Unbekannt'}`}
          </div>
          <div className="border-t border-slate-100 pt-6 px-8 max-w-lg mx-auto space-y-3 text-left">
            <div className="flex items-center gap-4 text-slate-700 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="bg-white p-2 rounded-full text-blue-600 shadow-sm"><Mail size={18}/></div>
                <div><div className="text-xs text-slate-400 font-bold uppercase">E-Mail</div><div>{data.email}</div></div>
            </div>
            {data.phone && (
                <div className="flex items-center gap-4 text-slate-700 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="bg-white p-2 rounded-full text-blue-600 shadow-sm"><Phone size={18}/></div>
                    <div><div className="text-xs text-slate-400 font-bold uppercase">Telefon</div><div>{data.phone}</div></div>
                </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};