import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import PrivacyPage from './PrivacyPage.jsx';
import './styles.css';

const Page = window.location.pathname === '/privacy' ? PrivacyPage : App;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);
