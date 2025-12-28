import React, { useState } from 'react';
import { Shield, ArrowLeft, Loader2, User, Briefcase, Users } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase'; // Gehe einen Ordner hoch zu firebase.js
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
        
        if (docSnap.exists()) {
          const uData = docSnap.data();
          if (uData.type === 'employee' && uData.companyId) {
             const empDoc = await getDoc(doc(db, "companies", uData.companyId, "employees", cred.user.uid));
             onLogin({ uid: cred.user.uid, email: cred.user.email, ...uData, ...(empDoc.exists() ? empDoc.data() : {}) });
          } else {
             onLogin({ uid: cred.user.uid, email: cred.user.email, ...uData });
          }
        } else {
          // Fallback für alte Accounts ohne User-Doc
          const compDoc = await getDoc(doc(db, "companies", cred.user.uid));
          if(compDoc.exists()) {
             onLogin({ uid: cred.user.uid, email: cred.user.email, type: 'provider', ...compDoc.data() });
          } else {
             onLogin({ uid: cred.user.uid, email: cred.user.email, type: 'client', name: "User" });
          }
        }
      } else {
        // Registrierung
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const uData = { name, type: role, companyId: null, createdAt: new Date().toISOString() };
        
        // Einladungs-Check (Invite)
        if (role === 'employee') {
            const inviteQ = query(collection(db, "global_invites"), where("email", "==", email));
            const inviteSnap = await getDocs(inviteQ);
            if (!inviteSnap.empty) {
               const inv = inviteSnap.docs[0].data();
               uData.companyId = inv.companyId;
               // Mitarbeiter-Eintrag erstellen
               await setDoc(doc(db, "companies", inv.companyId, "employees", cred.user.uid), { 
                   name, email, role: inv.role, status: 'Aktiv', joinedAt: new Date().toISOString() 
               });
               // Invite löschen
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
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  if (mode === 'landing') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full flex flex-col md:flex-row overflow-hidden p-8">
        <div className="md:w-1/2 p-4 flex flex-col justify-center space-y-6">
          <div><h1 className="text-4xl font-bold text-slate-900">Secu<span className="text-blue-600">Plan</span></h1><p className="text-slate-500 text-lg">Sicherheitsdienste modern verwalten.</p></div>
          <div className="space-y-3">
            <Button variant="secondary" className="w-full py-4" onClick={() => setMode('login')}>Login</Button>
            <Button variant="primary" className="w-full py-4 shadow-blue-200" onClick={() => setMode('role')}>Neu hier?</Button>
          </div>
        </div>
        <div className="md:w-1/2 flex items-center justify-center bg-slate-50 rounded-2xl"><Shield className="h-32 w-32 text-blue-200" /></div>
      </Card>
    </div>
  );

  if (mode === 'role') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full p-8">
        <Button variant="ghost" onClick={() => setMode('landing')} icon={ArrowLeft} className="mb-4">Zurück</Button>
        <h2 className="text-2xl font-bold text-center mb-8">Wählen Sie Ihre Rolle</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: 'client', icon: User, label: "Kunde", desc: "Ich suche Sicherheit." },
            { id: 'provider', icon: Briefcase, label: "Firma", desc: "Ich biete Dienste an." },
            { id: 'employee', icon: Users, label: "Mitarbeiter", desc: "Ich habe einen Invite." }
          ].map(r => (
            <div key={r.id} onClick={() => { setRole(r.id); setMode('register'); }} className="border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 rounded-xl p-6 cursor-pointer text-center group transition-all">
              <r.icon className="h-10 w-10 mx-auto text-slate-400 group-hover:text-blue-500 mb-3"/>
              <h3 className="font-bold">{r.label}</h3><p className="text-xs text-slate-500">{r.desc}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8">
        <Button variant="ghost" size="sm" onClick={() => setMode('landing')} icon={ArrowLeft}>Zurück</Button>
        <h2 className="text-2xl font-bold mt-4 mb-1">{mode === 'login' ? 'Login' : 'Registrieren'}</h2>
        <p className="text-sm text-slate-500 mb-6">Willkommen bei SecuPlan.</p>
        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'register' && <input className="w-full p-3 bg-slate-50 border rounded-lg outline-none focus:border-blue-500" placeholder={role === 'provider' ? "Firmenname" : "Name"} value={name} onChange={e => setName(e.target.value)} required />}
          <input type="email" className="w-full p-3 bg-slate-50 border rounded-lg outline-none focus:border-blue-500" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" className="w-full p-3 bg-slate-50 border rounded-lg outline-none focus:border-blue-500" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin"/> : (mode === 'login' ? 'Einloggen' : 'Konto erstellen')}</Button>
        </form>
      </Card>
    </div>
  );
};