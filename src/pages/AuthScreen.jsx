import React, { useState } from 'react';
import { Shield, ArrowLeft, Loader2, User, Briefcase, Users } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const AuthScreen = ({ onLogin }) => {
  const [mode, setMode] = useState('landing');
  const [role, setRole] = useState('client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (mode === 'login') {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const docSnap = await getDoc(doc(db, "users", cred.user.uid));
        if (docSnap.exists()) onLogin({ uid: cred.user.uid, ...docSnap.data() });
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uData = { name, type: role, companyId: null, createdAt: new Date().toISOString() };
        
        if (role === 'employee') {
            const inviteQ = query(collection(db, "global_invites"), where("email", "==", email));
            const inviteSnap = await getDocs(inviteQ);
            if (!inviteSnap.empty) {
               const inv = inviteSnap.docs[0].data();
               uData.companyId = inv.companyId;
               await setDoc(doc(db, "companies", inv.companyId, "employees", cred.user.uid), { 
                   name, email, role: inv.role, status: 'Aktiv', joinedAt: new Date().toISOString() 
               });
               await deleteDoc(inviteSnap.docs[0].ref);
            }
        }
        await setDoc(doc(db, "users", cred.user.uid), uData);
        if(role === 'provider') {
            await setDoc(doc(db, "companies", cred.user.uid), { 
                name, description: "Neu bei SecuPlan.", price: "49", employees: 0, isVisible: false 
            });
        }
        onLogin({ uid: cred.user.uid, email: cred.user.email, ...uData });
      }
    } catch (err) { setError("Anmeldung fehlgeschlagen. Bitte Daten prüfen."); }
    setLoading(false);
  };

  if (mode === 'landing') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full flex flex-col md:flex-row overflow-hidden shadow-2xl border-none">
        <div className="md:w-1/2 p-12 flex flex-col justify-center space-y-8 bg-white">
          <div><h1 className="text-4xl font-black text-slate-900 tracking-tight">Secu<span className="text-blue-600">Plan</span></h1><p className="text-slate-500 text-lg mt-2">Sicherheitsdienste modern verwalten.</p></div>
          <div className="space-y-4">
            <Button className="w-full py-6 text-lg" onClick={() => setMode('login')}>Anmelden</Button>
            <Button variant="outline" className="w-full py-6 text-lg" onClick={() => setMode('role')}>Konto erstellen</Button>
          </div>
        </div>
        <div className="md:w-1/2 bg-blue-600 flex items-center justify-center p-12 text-white">
            <div className="text-center"><Shield size={120} className="mx-auto mb-6 opacity-20"/><h2 className="text-2xl font-bold">Professionell & Sicher</h2><p className="opacity-80 mt-2">Die All-in-One Lösung für Dienstplanung und Marktplatz-Präsenz.</p></div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 tracking-tight">
      <Card className="max-w-md w-full p-8 shadow-xl border-none">
        <Button variant="ghost" size="sm" onClick={() => setMode('landing')} icon={ArrowLeft} className="-ml-2 mb-4">Zurück</Button>
        <h2 className="text-2xl font-black text-slate-900">{mode === 'login' ? 'Willkommen zurück' : 'Registrieren'}</h2>
        <p className="text-sm text-slate-500 mb-8">{mode === 'login' ? 'Loggen Sie sich in Ihr Dashboard ein.' : 'Erstellen Sie Ihr kostenloses Konto.'}</p>
        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'register' && <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900" placeholder={role === 'provider' ? "Firmenname" : "Vollständiger Name"} value={name} onChange={e => setName(e.target.value)} required />}
          <input type="email" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <div className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}
          <Button type="submit" className="w-full py-4 shadow-lg shadow-blue-200" disabled={loading}>{loading ? <Loader2 className="animate-spin"/> : (mode === 'login' ? 'Einloggen' : 'Konto erstellen')}</Button>
        </form>
      </Card>
    </div>
  );
};