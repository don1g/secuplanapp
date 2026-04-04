import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, MapPin, Euro, FileText, Loader2, Building2, Users } from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { PostItem } from './PostItem';

export const CompanyProfileView = ({ 
  company, 
  onBack, 
  onContactClick, 
  showContactButton = true,
  currentUser 
}) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) return;
    
    const loadPosts = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "companies", company.id, "posts"));
        const snap = await getDocs(q);
        setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1));
      } catch (e) {
        console.error("Fehler beim Laden der Posts:", e);
      }
      setLoading(false);
    };

    loadPosts();
  }, [company?.id]);

  if (!company) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-blue-600" size={40}/>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-20">
      
      {/* ZURÜCK BUTTON */}
      <Button variant="ghost" onClick={onBack} icon={ArrowLeft} size="sm" className="text-slate-500">
        Zurück zur Übersicht
      </Button>

      {/* FIRMEN-PROFIL CARD */}
      <Card className="overflow-hidden shadow-2xl border-none rounded-[2.5rem] bg-white">
        
        {/* COVER IMAGE */}
        <div className="h-40 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50"></div>
        </div>

        {/* FIRMA INFO */}
        <div className="px-8 lg:px-10 pb-10 -mt-16 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
            {/* LOGO */}
            <div className="h-32 w-32 rounded-[2.5rem] bg-white p-1 shadow-2xl border-4 border-white overflow-hidden shrink-0">
              <Avatar src={company.imageUrl} alt={company.name} size="full" className="rounded-[2rem]"/>
            </div>

            {/* NAME & INFO */}
            <div className="space-y-3">
              <div>
                <h1 className="text-3xl lg:text-4xl font-black tracking-tight uppercase text-slate-900">{company.name}</h1>
                <div className="flex flex-wrap gap-4 mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-blue-600"/> {company.address || "Standort auf Anfrage"}
                  </span>
                  {company.employees && (
                    <span className="flex items-center gap-1.5">
                      <Users size={14} className="text-blue-600"/> {company.employees} Mitarbeiter
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KONTAKT BUTTON */}
          {showContactButton && onContactClick && (
            <Button onClick={onContactClick} icon={Mail} className="rounded-2xl px-8 shadow-xl shadow-blue-200 shrink-0">
              Kontaktieren
            </Button>
          )}
        </div>

        {/* CONTENT GRID */}
        <div className="px-8 lg:px-10 pb-10 grid grid-cols-1 lg:grid-cols-3 gap-8 border-t border-slate-100">
          
          {/* LINKE SPALTE: ÜBER UNS & POSTS */}
          <div className="lg:col-span-2 space-y-8 pt-8">
            
            {/* ÜBER UNS */}
            <div>
              <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 mb-4 flex items-center gap-2">
                <FileText size={18}/> Über uns
              </h3>
              <p className="text-slate-600 font-medium leading-relaxed">
                {company.description || "Noch keine Beschreibung hinterlegt."}
              </p>
            </div>

            {/* POSTS / NEUIGKEITEN */}
            <div>
              <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 mb-4 flex items-center gap-2">
                <Building2 size={18}/> Neuigkeiten
              </h3>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-blue-600" size={24}/>
                </div>
              ) : posts.length > 0 ? (
                <div className="space-y-4">
                  {posts.map(p => (
                    <PostItem key={p.id} post={p} companyId={company.id} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 italic text-sm">
                  Noch keine Beiträge verfügbar
                </div>
              )}
            </div>
          </div>

          {/* RECHTE SPALTE: PREIS & ZUSATZINFO */}
          <div className="space-y-6 pt-8">
            
            {/* PREIS CARD */}
            <Card className="p-8 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl border-none">
              <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-[0.2em]">
                Konditionen
              </h3>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <span className="text-[9px] block text-slate-400 font-black uppercase mb-2">
                  Stundensatz
                </span>
                <span className="text-3xl font-black text-blue-400 flex items-baseline gap-2">
                  {company.price || 'Auf Anfrage'}
                  {company.price && <span className="text-sm text-slate-400">€</span>}
                </span>
              </div>
            </Card>

            {/* KONTAKT INFO */}
            {company.phone && (
              <Card className="p-6 rounded-2xl bg-blue-50 border-blue-100">
                <div className="text-[9px] font-black uppercase text-blue-600 mb-2 tracking-widest">
                  Telefon
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {company.phone}
                </div>
              </Card>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
