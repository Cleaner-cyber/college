import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from '@/engine/App';
// 场景 UI 标题字：霞鹜文楷 Lite（OFL 开源，按 unicode-range 切片按需加载，不出外网）
import 'lxgw-wenkai-lite-webfont/lxgwwenkailite-regular.css';
import 'lxgw-wenkai-lite-webfont/lxgwwenkailite-bold.css';
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
