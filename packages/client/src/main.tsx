import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'

// The #root element is declared in index.html and is structurally guaranteed to exist
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
