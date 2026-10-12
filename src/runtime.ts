/** Static jury demo never connects to the operator database. */
export const PUBLIC_DEMO = import.meta.env?.MODE === 'demo';
export const DEMO_KEY = 'talai.demo.project.v1';
export const DEMO_UPLOAD_NOTICE = 'В публичном демо загрузка файлов отключена. Она доступна в закрытом серверном режиме.';
