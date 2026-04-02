import React, { useState } from 'react';
import { Shield, ArrowLeft, Loader2, User, Briefcase, Users, Mail, Lock, CheckCircle2 } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const AuthScreen = ({ onLogin }) => {
  // States für die Navigation innerhalb der Landingpage
  const [mode, setMode] = useState('landing'); // landing, role, login, register
  const [role, setRole] = useState('client'); // client, employee, provider
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Authentifizierungs-Logik (GitHub Stand)
  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (mode === 'login') {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const docSnap = await getDoc(doc(db, "users", cred.user.uid));
        if (docSnap.exists()) {
          onLogin({ uid: cred.user.uid, ...docSnap.data() });
        } else {
          // Fallback für Firmen/Provider, falls diese nur in 'companies' liegen
          const compSnap = await getDoc(doc(db, "companies", cred.user.uid));
          if (compSnap.exists()) {
              onLogin({ uid: cred.user.uid, type: 'provider', ...compSnap.data() });
          } else {
              setError("Nutzerdaten konnten nicht gefunden werden.");
          }
        }
      } else {
        // Registrierung
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uData = {
          name,
          email,
          type: role,
          companyId: null,
          createdAt: new Date().toISOString()
        };

        // Spezial-Logik für Mitarbeiter (GitHub: Automatisches Verknüpfen bei Einladung)
        if (role === 'employee') {
          const inviteQ = query(collection(db, "global_invites"), where("email", "==", email));
          const inviteSnap = await getDocs(inviteQ);
          if (!inviteSnap.empty) {
            const inv = inviteSnap.docs[0].data();
            uData.companyId = inv.companyId;
            // In Firmen-Mitarbeiterliste eintragen
            await setDoc(doc(db, "companies", inv.companyId, "employees", cred.user.uid), {
              name,
              email,
              role: inv.role || 'worker',
              status: 'Aktiv',
              joinedAt: new Date().toISOString()
            });
            // Einladung löschen
            await deleteDoc(inviteSnap.docs[0].ref);
          }
        }

        // Basis-Profil in 'users' anlegen
        await setDoc(doc(db, "users", cred.user.uid), uData);

        // Wenn Provider: Firma in 'companies' initialisieren
        if (role === 'provider') {
          await setDoc(doc(db, "companies", cred.user.uid), {
            name,
            description: "Neu bei SecuPlan.",
            price: "45",
            employees: 0,
            isVisible: false,
            createdAt: new Date().toISOString()
          });
        }

        onLogin({ uid: cred.user.uid, ...uData });
      }
    } catch (err) {
      console.error(err);
      setError(mode === 'login' ? "E-Mail oder Passwort falsch." : "Registrierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  // 1. LANDING VIEW (Zweigeteiltes Layout)
  if (mode === 'landing') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 sm:p-6">
        <Card className="max-w-5xl w-full flex flex-col md:flex-row overflow-hidden shadow-2xl border-none rounded-[2.5rem]">
          {/* Linke Seite: Aktionen */}
          <div className="md:w-1/2 p-12 lg:p-16 flex flex-col justify-center space-y-10 bg-white">
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h1 className="text-5xl font-black text-slate-900 tracking-tighter">
                Secu<span className="text-blue-600">Plan</span>
              </h1>
              <p className="text-slate-400 text-xl font-bold mt-4 leading-relaxed">
                Sicherheitsdienste modern verwalten.
              </p>
            </div>

            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <button 
                onClick={() => setMode('login')}
                className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all uppercase tracking-widest text-xs"
              >
                Anmelden
              </button>
              <button 
                onClick={() => setMode('role')}
                className="w-full py-5 bg-white text-slate-900 border-2 border-slate-100 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
              >
                Konto erstellen
              </button>
            </div>
          </div>

          {/* Rechte Seite: Info-Box (Blau) */}
          <div className="md:w-1/2 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 flex items-center justify-center p-12 lg:p-16 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-400/20 rounded-full -ml-32 -mb-32 blur-3xl"></div>
            
            <div className="text-center relative z-10 animate-in zoom-in-95 duration-700">
              <div className="bg-white/10 backdrop-blur-md p-8 rounded-[3rem] border border-white/20 inline-block mb-8 shadow-2xl">
                <Shield size={100} className="text-white drop-shadow-lg"/>
              </div>
              <h2 className="text-3xl font-black tracking-tight mb-4">Professionell & Sicher</h2>
              <p className="text-blue-100 font-medium text-lg leading-relaxed max-w-sm mx-auto">
                Die All-in-One Lösung für Dienstplanung, Team-Management und Marktplatz-Präsenz.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // 2. ROLE SELECTION (Karten-Design)
  if (mode === 'role') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="max-w-4xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center space-y-2">
            <button 
              onClick={() => setMode('landing')}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-600 font-black uppercase text-[10px] tracking-widest transition-colors mb-4"
            >
              <ArrowLeft size={16}/> Zurück
            </button>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Registrieren</h2>
            <p className="text-slate-400 font-bold text-sm">Als was möchten Sie sich registrieren?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { id: 'client', label: 'Kunde', icon: User, desc: 'Ich suche Sicherheit' },
              { id: 'provider', label: 'Sicherheitsfirma', icon: Briefcase, desc: 'Ich biete Dienste an' },
              { id: 'employee', label: 'Mitarbeiter', icon: Users, desc: 'Ich bin angestellt' }
            ].map((r) => (
              <button 
                key={r.id}
                onClick={() => { setRole(r.id); setMode('register'); }}
                className="group p-8 bg-white rounded-[2.5rem] shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all border border-slate-50 text-center"
              >
                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                  <r.icon size={32}/>
                </div>
                <h3 className="font-black text-slate-900 text-lg mb-2">{r.label}</h3>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{r.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3. LOGIN & REGISTER FORMS
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-10 shadow-2xl border-none rounded-[3rem] bg-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16"></div>
        
        <div className="relative z-10 space-y-8">
          <div className="space-y-2">
            <button 
              onClick={() => setMode(mode === 'login' ? 'landing' : 'role')}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-600 font-black uppercase text-[10px] tracking-widest transition-colors mb-2"
            >
              <ArrowLeft size={16}/> Zurück
            </button>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}
            </h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
              {mode === 'login' ? 'Melden Sie sich an' : `Registrierung als ${role === 'provider' ? 'Firma' : role === 'employee' ? 'MA' : 'Kunde'}`}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {mode === 'register' && (
              <div className="relative group">
                <User className="absolute left-4 top-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20}/>
                <input 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all" 
                  placeholder={role === 'provider' ? "Firmenname" : "Vollständiger Name"}
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                />
              </div>
            )}

            <div className="relative group">
              <Mail className="absolute left-4 top-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20}/>
              <input 
                type="email"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all" 
                placeholder="E-Mail Adresse"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20}/>
              <input 
                type="password"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all" 
                placeholder="Passwort"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-black uppercase tracking-widest border border-red-100 animate-in shake duration-300">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-all uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20}/> : (mode === 'login' ? 'Einloggen' : 'Konto erstellen')}
            </button>
          </form>
          
          {mode === 'login' && (
            <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              Noch kein Konto? <button onClick={() => setMode('role')} className="text-blue-600 hover:underline">Hier registrieren</button>
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};