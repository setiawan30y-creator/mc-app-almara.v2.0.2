(function(){
'use strict';
var API='/api/letter-numbers';
function csrf(){return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')||'';}
async function req(url,opt){
 opt=opt||{}; opt.credentials='same-origin';
 opt.headers=Object.assign({'Accept':'application/json','Content-Type':'application/json','X-CSRF-TOKEN':csrf(),'X-Requested-With':'XMLHttpRequest'},opt.headers||{});
 var r=await fetch(url,opt), d=await r.json().catch(function(){return {};});
 if(!r.ok) throw new Error(d.message||('HTTP '+r.status)); return d;
}
function esc(v){return String(v??'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function boot(){
 var nav=document.querySelector('.sidebar-nav');
 var main=document.querySelector('.view-container');
 if(!nav||!main){setTimeout(boot,300);return;}
 var existingSection=document.getElementById('letter-number-view');
 var link=nav.querySelector('.nav-item[data-target="letter-number-view"]');
 if(!link){link=document.createElement('a'); link.href='#'; link.className='nav-item'; link.dataset.target='letter-number-view'; nav.appendChild(link);}
 link.innerHTML='<i class="fa-solid fa-file-signature"></i><span>Nomor Surat</span>'; link.title='Nomor Surat';
 var section=existingSection || document.createElement('section');
 if(!existingSection){section.id='letter-number-view'; section.className='view-section hidden';}
 section.querySelector('#letter-number-module-root')?.replaceChildren();
var mount=section.querySelector('#letter-number-module-root') || section;
mount.innerHTML='<div class="panel"><div class="panel-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><div><h2 style="margin:0"><i class="fa-solid fa-file-signature"></i> Nomor Surat</h2><small class="text-muted">Nomor otomatis, per jenis surat, dan aman dari nomor ganda.</small></div><button class="btn btn-primary" id="lnGenerate"><i class="fa-solid fa-plus"></i> Buat Nomor</button></div><div style="padding:18px"><div style="display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:12px"><label>Kode Perusahaan<input id="lnCompany" class="form-control"></label><label>Jenis Surat<select id="lnType" class="form-control"></select></label><label>Format Nomor<input id="lnFormat" class="form-control"></label><label>Digit Nomor<input id="lnDigits" type="number" min="1" max="10" class="form-control"></label></div><div style="margin-top:18px;padding:16px;border:1px solid rgba(148,163,184,.2);border-radius:10px"><div style="font-size:.75rem;color:#94a3b8;text-transform:uppercase">Preview</div><div id="lnPreview" style="font-size:1.5rem;font-weight:800;margin-top:6px">0001/APV/SK/okt/2026</div></div><div id="lnLastGenerated" style="display:none;margin-top:12px;padding:14px 16px;border:1px solid rgba(16,185,129,.35);background:rgba(16,185,129,.08);border-radius:10px"><div style="font-size:.75rem;color:#6ee7b7;text-transform:uppercase;font-weight:700">Nomor Surat Terakhir Dibuat</div><div id="lnLastNumber" style="font-size:1.35rem;font-weight:800;margin-top:5px"></div><div id="lnLastMeta" style="font-size:.82rem;color:#94a3b8;margin-top:4px"></div></div><div style="margin-top:18px;display:flex;gap:8px"><button class="btn btn-primary" id="lnSave"><i class="fa-solid fa-floppy-disk"></i> Simpan Pengaturan</button><button class="btn btn-outline" id="lnAddType"><i class="fa-solid fa-plus"></i> Tambah Jenis Surat</button></div><div id="lnTypes" style="margin-top:18px"></div><div style="margin-top:20px;font-size:.82rem;color:#94a3b8">Token: <code>{NO}</code> <code>{COMPANY}</code> <code>{TYPE}</code> <code>{MONTH}</code> <code>{YEAR}</code></div></div></div>';
 if(!existingSection) main.appendChild(section);
 var company=mount.querySelector('#lnCompany'), type=mount.querySelector('#lnType'), format=mount.querySelector('#lnFormat'), digits=mount.querySelector('#lnDigits'), preview=mount.querySelector('#lnPreview'), types=[];
 function refreshSelect(){type.innerHTML=types.map(function(x){return '<option value="'+esc(x.code)+'">'+esc(x.code)+' — '+esc(x.name)+'</option>';}).join('');}
 function renderTypes(){mount.querySelector('#lnTypes').innerHTML='<b>Jenis Surat</b><table class="table" style="margin-top:8px"><thead><tr><th>Kode</th><th>Nama</th><th></th></tr></thead><tbody>'+types.map(function(x,i){return '<tr><td><input class="form-control" data-code="'+i+'" value="'+esc(x.code)+'"></td><td><input class="form-control" data-name="'+i+'" value="'+esc(x.name)+'"></td><td><button class="btn btn-sm btn-outline" data-del="'+i+'"><i class="fa-solid fa-trash"></i></button></td></tr>';}).join('')+'</tbody></table>';
 mount.querySelectorAll('[data-del]').forEach(function(b){b.onclick=function(){types.splice(+b.dataset.del,1);renderTypes();refreshSelect();};});
 mount.querySelectorAll('[data-code]').forEach(function(i){i.oninput=function(){types[+i.dataset.code].code=i.value.toUpperCase();refreshSelect();};});
 mount.querySelectorAll('[data-name]').forEach(function(i){i.oninput=function(){types[+i.dataset.name].name=i.value;};});
 }
 function refreshPreview(){var n=String(1).padStart(+digits.value||4,'0'),now=new Date(),m=now.toLocaleDateString('id-ID',{month:'short'}).replace('.','').toLowerCase();preview.textContent=(format.value||'{NO}/{COMPANY}/{TYPE}/{MONTH}/{YEAR}').replaceAll('{NO}',n).replaceAll('{COMPANY}',company.value||'APV').replaceAll('{TYPE}',type.value||'SK').replaceAll('{MONTH}',m).replaceAll('{YEAR}',String(now.getFullYear()));}
 async function load(){var r=await req(API+'/settings'),s=r.data;company.value=s.company_code;format.value=s.format;digits.value=s.digits;types=s.letter_types||[];refreshSelect();renderTypes();refreshPreview();}
 ['input','change'].forEach(function(ev){[company,type,format,digits].forEach(function(x){x.addEventListener(ev,refreshPreview);});});
 mount.querySelector('#lnAddType').onclick=function(){types.push({code:'BARU',name:'Jenis Surat Baru'});renderTypes();refreshSelect();};
 mount.querySelector('#lnSave').onclick=async function(){try{await req(API+'/settings',{method:'POST',body:JSON.stringify({company_code:company.value,format:format.value,digits:+digits.value,month_format:'short',reset_mode:'yearly',letter_types:types})});alert('Pengaturan nomor surat tersimpan.');}catch(e){alert(e.message);}};
 mount.querySelector('#lnGenerate').onclick=async function(){try{var r=await req(API+'/next',{method:'POST',body:JSON.stringify({letter_type:type.value})});preview.textContent=r.data.number;var last=mount.querySelector('#lnLastGenerated'),lastNo=mount.querySelector('#lnLastNumber'),lastMeta=mount.querySelector('#lnLastMeta');if(last){last.style.display='block';if(lastNo)lastNo.textContent=r.data.number;if(lastMeta)lastMeta.textContent='Jenis: '+(r.data.letter_type||type.value||'-')+' • Urutan: '+(r.data.sequence||'-')+' • Tahun: '+(r.data.year||'-');}if(window.AlmaraLetterArchive&&typeof window.AlmaraLetterArchive.render==='function'){await window.AlmaraLetterArchive.render(section);}alert('Nomor surat berhasil dibuat: '+r.data.number);}catch(e){alert(e.message);}};
 link.onclick=function(e){e.preventDefault();document.querySelectorAll('.view-section').forEach(function(v){v.classList.add('hidden');});section.classList.remove('hidden');document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});link.classList.add('active');var t=document.getElementById('pageTitle');if(t)t.textContent='Nomor Surat';};
 load().catch(console.error);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();