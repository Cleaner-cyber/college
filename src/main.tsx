import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from '@/engine/App';
import './index.css';

// HashRouter：纯静态托管零配置（无需服务端 rewrite）。
// 部署到支持 rewrite 的平台（如 Vercel）时可换 BrowserRouter，见 docs/07。
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
