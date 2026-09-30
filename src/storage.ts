import JSZip from 'jszip';
import { initialData } from './data';
import { apiFetch } from './api';
export type AppData=typeof initialData;

async function api(url:string,init?:RequestInit){
 const response=await apiFetch(url,init);
 if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||`Request gagal (${response.status})`);}
 return response;
}
function collectAudioIds(data:any):string[]{const ids=new Set<string>();for(const session of data.sessions||[])for(const turn of session.turns||[])if(turn.audioId)ids.add(String(turn.audioId));return [...ids];}
export async function exportBackup(data:AppData,includeAudio:boolean){
 const zip=new JSZip();zip.file('manifest.json',JSON.stringify({app:'SpeakUp',schema_version:2,exported_at:new Date().toISOString(),includes_audio:includeAudio}));zip.file('data.json',JSON.stringify(data,null,2));
 if(includeAudio){const folder=zip.folder('audio')!;for(const id of collectAudioIds(data)){try{const response=await api(`audio/${encodeURIComponent(id)}`);folder.file(`${id}.webm`,await response.blob());}catch{/* Rekaman yang sudah dihapus dilewati. */}}}
 const blob=await zip.generateAsync({type:'blob'});const anchor=document.createElement('a');anchor.href=URL.createObjectURL(blob);anchor.download=`speakup-backup-${new Date().toISOString().slice(0,10)}.zip`;anchor.click();setTimeout(()=>URL.revokeObjectURL(anchor.href),1200);
}
export async function importBackup(file:File):Promise<AppData>{
 if(file.size>100*1024*1024)throw new Error('Backup melebihi batas 100 MB.');
 const zip=await JSZip.loadAsync(file,{checkCRC32:true});const mf=zip.file('manifest.json'),df=zip.file('data.json');if(!mf||!df)throw new Error('ZIP bukan backup SpeakUp.');
 const manifestSize=(mf as any)._data?.uncompressedSize??0;const dataSize=(df as any)._data?.uncompressedSize??0;if(manifestSize>65536||dataSize>5_000_000)throw new Error('Isi backup melebihi batas aman.');
 const manifest=JSON.parse(await mf.async('text'));if(manifest.app!=='SpeakUp'||![1,2].includes(manifest.schema_version))throw new Error('Versi backup tidak didukung.');
 const raw=JSON.parse(await df.async('text'));if(!Array.isArray(raw.completed)||!Array.isArray(raw.sessions))throw new Error('Struktur backup tidak valid.');
 const data={...initialData,...raw,settings:{...initialData.settings,...raw.settings}} as AppData;const idMap:Record<string,string>={};const folder=zip.folder('audio');
 if(folder){const entries:{old:string;entry:JSZip.JSZipObject;expectedSize:number}[]=[];folder.forEach((path,entry)=>{const size=Number((entry as any)._data?.uncompressedSize??0);if(!entry.dir&&/^[a-zA-Z0-9_-]+\.webm$/.test(path)&&size>0&&size<=25*1024*1024)entries.push({old:path.replace(/\.webm$/,''),entry,expectedSize:size});});if(entries.length>300)throw new Error('Backup berisi terlalu banyak rekaman (maksimal 300).');let total=0;for(const item of entries){total+=item.expectedSize;if(total>100*1024*1024)throw new Error('Total ukuran audio melebihi batas 100 MB.');const blob=await item.entry.async('blob');if(blob.size!==item.expectedSize||blob.size>25*1024*1024)continue;const form=new FormData();form.append('audio',blob,`${item.old}.webm`);form.append('client_ref',item.old);try{const response=await api('audio',{method:'POST',body:form});const result=await response.json();idMap[item.old]=result.audio.id;}catch{/* Audio yang gagal diunggah dilewati. */}}}
 const replace=(value:any):any=>{if(Array.isArray(value))return value.map(replace);if(value&&typeof value==='object'){const out:any={};for(const [key,child]of Object.entries(value))out[key]=key==='audioId'&&typeof child==='string'?(idMap[child]||null):replace(child);if('audioSaved'in out&&!out.audioId)out.audioSaved=false;return out;}return value;};const restored=replace(data) as AppData;
 await api('progress',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({progress:restored})});return restored;
}
export async function deleteAllRecordings(){await api('progress',{method:'DELETE'});}
