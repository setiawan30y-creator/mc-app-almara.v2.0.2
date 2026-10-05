(function(){
'use strict';
const API='/api/letter-numbers';
const token=()=>document.querySelector('meta[name="csrf-token"]')?.content||'';
async function api(url,opt={}){opt.credentials='same-origin';opt.headers=Object.assign({'Accept':'application/json','Content-Type':'application/json','X-CSRF-TOKEN':token(),'X-Requested-With':'XMLHttpRequest'},opt.headers||{});const r=await fetch(url,opt),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||('HTTP '+r.status));return d}
function esc(v){return String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
async function render(view){
 if(!view)return;
 const box=document.createElement('div');box.id='letter-archive-panel';box.className='panel';box.style.marginTop='18px';
 box.innerHTML='<div class="panel-header"><h3><i class="fa-solid fa-folder-open"></i> Riwayat Nomor Surat</h3><small>Nomor dibuat terlebih dahulu, dokumen dapat diupload kemudian.</small></div><div id="letterRows" style="padding:12px;overflow:auto"></div>';
 view.querySelector('#letter-archive-panel')?.remove();view.appendChild(box);
 const r=await api(API+'/records');const rows=r.data||[];
 document.getElementById('letterRows').innerHTML='<table class="table"><thead><tr><th>Nomor</th><th>Jenis</th><th>Tanggal</th><th>Perihal</th><th>Status</th><th>File</th><th>Aksi</th></tr></thead><tbody>'+rows.map(x=>'<tr><td><b>'+esc(x.letter_number)+'</b></td><td>'+esc(x.letter_type)+'</td><td>'+esc(x.letter_date)+'</td><td>'+esc(x.subject||'-')+'</td><td>'+esc(x.status)+'</td><td>'+((x.documents||[]).length)+' file</td><td><button class="btn btn-sm btn-outline" data-letter-upload="'+x.id+'"><i class="fa-solid fa-paperclip"></i> Upload</button></td></tr>').join('')+'</tbody></table>';
 box.querySelectorAll('[data-letter-upload]').forEach(b=>b.onclick=()=>upload(b.dataset.letterUpload,render.bind(null,view)));
}
async function upload(id,refresh){
 const input=document.createElement('input');input.type='file';input.accept='.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp';input.onchange=()=>{
  const file=input.files[0];if(!file)return;if(file.size>10*1024*1024)return alert('Maksimal 10 MB.');
  const reader=new FileReader();reader.onload=async()=>{try{await api(API+'/records/'+id+'/documents',{method:'POST',body:JSON.stringify({data_url:reader.result,filename:file.name})});alert('Dokumen berhasil diupload.');refresh()}catch(e){alert(e.message)}};reader.readAsDataURL(file)
 };input.click()
}
window.AlmaraLetterArchive={render};
document.addEventListener('DOMContentLoaded',()=>{const v=document.getElementById('letter-number-view');if(v)render(v).catch(console.error)});
})();