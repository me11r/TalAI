import ReactDOM from 'react-dom/client';
import Entry from './Entry';
import './styles.css';
import './workspace.css';
import './gis.css';
import './privacy.css';
const nativeFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);if(url.origin===location.origin&&url.pathname.startsWith('/api/')){const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));headers.set('X-TalAI-Request','1');return nativeFetch(input,{...init,headers});}return nativeFetch(input,init);};
ReactDOM.createRoot(document.getElementById('root')!).render(<Entry/>);
