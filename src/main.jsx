import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // <--- WICHTIG: Prüfen, ob der Pfad stimmt!
import './index.css' // Falls du globales CSS hast (Tailwind imports)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)