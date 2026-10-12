import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './workspace.css';
import {bootstrap} from './persistence';
const root=ReactDOM.createRoot(document.getElementById('root')!);
root.render(<p>TalAI · открываем хранилище…</p>);
bootstrap().then(()=>root.render(<App/>)).catch(e=>root.render(<div role="alert">{String(e)} <button onClick={()=>location.reload()}>Повторить</button></div>));

import './gis.css';
