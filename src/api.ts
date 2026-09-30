const configured=import.meta.env.VITE_API_BASE_URL?.trim();
const base=configured?configured.replace(/\/$/,''):`${import.meta.env.BASE_URL.replace(/\/$/,'')}/api`;
export function apiUrl(path:string){const suffix=path.replace(/^\/+/, '');return `${base}/${suffix}`;}
export async function apiFetch(path:string,init:RequestInit={}){const response=await fetch(apiUrl(path),{credentials:'include',...init});if(response.status===423&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('speakup:locked'));return response;}
export function apiBase(){return base;}
