import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase'; // Hier wichtig: ./firebase

import { AuthScreen } from './pages/AuthScreen';
import { ProviderDashboard } from './pages/ProviderDashboard';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { ClientDashboard } from './pages/ClientDashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Prüfe erst, ob es ein normaler User/Mitarbeiter ist
        const userDoc = await getDoc(doc(db, "users", u.uid));
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          
          // Wenn Mitarbeiter, lade zusätzliche Firmeninfos
          if (data.type === 'employee' && data.companyId) {
            const empDoc = await getDoc(doc(db, "companies", data.companyId, "employees", u.uid));
            setUser({ uid: u.uid, email: u.email, ...data, ...(empDoc.exists() ? empDoc.data() : {}) });
          } else {
            // Normaler Client
            setUser({ uid: u.uid, email: u.email, ...data });
          }
        } else {
          // Falls nicht in 'users', prüfe ob es eine Firma ist (Provider)
          const compDoc = await getDoc(doc(db, "companies", u.uid));
          if (compDoc.exists()) {
             setUser({ uid: u.uid, email: u.email, type: 'provider', ...compDoc.data() });
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <Loader2 className="animate-spin text-blue-600 h-10 w-10"/>
        </div>
    );
  }

  // Routing-Logik basierend auf User-Status
  if (!user) return <AuthScreen onLogin={setUser} />;
  
  if (user.type === 'provider') return <ProviderDashboard user={user} onLogout={() => signOut(auth)} />;
  
  if (user.type === 'employee') return <EmployeeDashboard user={user} onLogout={() => signOut(auth)} />;
  
  // Standard: Client (Kunde)
  return <ClientDashboard onLogout={() => signOut(auth)} />;
}