'use strict';
/* Arena Codex — Phase 1-2: foundation + database (parser, validation, search, filters).
   Mọi dữ liệu đến từ data.txt. Không dùng innerHTML; chỉ textContent/DOM API. */
const $=(s,r=document)=>r.querySelector(s);
const h=(t,a={},...k)=>{const e=document.createElement(t);for(const[n,v]of Object.entries(a)){if(v==null||v===false)continue;if(n==='class')e.className=v;else if(n.startsWith('on'))e.addEventListener(n.slice(2),v);else e.setAttribute(n,v===true?'':v)}for(const c of k.flat())if(c!=null&&c!==false)e.append(c.nodeType?c:document.createTextNode(c));return e};
const norm=s=>Array.from(String(s??'')).map(c=>(c.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d')[0]||'')).join('').toLowerCase();
const flat=o=>o==null?[]:typeof o==='object'?Object.values(o).flatMap(flat):[String(o)];
const GROUPS=[['role','Vai trò'],['lane','Lộ'],['damage','Sát thương'],['difficulty','Độ khó'],['range','Tầm đánh'],['status','Trạng thái']];
const ORDER={role:['Tank','Fighter','Assassin','Mage','Marksman','Support'],lane:['Top','Mid','Jungle','Bot','Support'],damage:['Physical','Magic','Mixed','True Damage'],difficulty:['Easy','Normal','Hard','Expert'],range:['Melee','Ranged'],status:['New','Updated']};
const KNOWN=new Set(['id','name','title','role','lane','damage','difficulty','range','status','shortDesc','quote','releaseDate','version','demo','keywords','images','stats','passive','skills','lore','extra']);
const SEG=new Set(['text','number','physical_damage','magic_damage','true_damage','healing','shield','cc','debuff','cooldown','ad_scale','ap_scale','hp_scale','level_scale']);
const IMG_RE=/^[\w-]+\.(png|jpe?g|webp|gif|svg)$/i;
let PAGE=24;
const S={chars:[],rep:{errors:[],warnings:[],imgFail:new Set()},f:Object.fromEntries(GROUPS.map(([k])=>[k,new Set()])),q:'',sort:'id',shown:PAGE};
const vals=(c,k)=>k==='lane'?c.lane:(c[k]?[c[k]]:[]);

/* ---------- Validation ---------- */
const segOk=s=>s&&typeof s==='object'&&!Array.isArray(s)&&SEG.has(s.type)&&(s.value==null||typeof s.value==='string'||typeof s.value==='number');
const descOk=d=>typeof d==='string'||(Array.isArray(d)&&d.every(segOk));
const fOk=v=>typeof v==='string'||(typeof v==='number'&&isFinite(v))||(Array.isArray(v)&&v.every(x=>typeof x==='string'||segOk(x)||descOk(x)));
function validate(c,i,seen){
  const E=[],W=[];const id=c&&typeof c.id==='string'?c.id:null;const tag=id?'#'+id:'mục thứ '+(i+1);
  const e=(f,m)=>E.push({id:tag,f,m}),w=(f,m)=>W.push({id:tag,f,m});
  if(!c||typeof c!=='object'||Array.isArray(c)){e('-','Không phải object JSON');return{E,W}}
  if(!id||!/^[\w-]+$/.test(id))e('id','Thiếu hoặc sai định dạng (chỉ chữ, số, _ và -)');else if(seen.has(id))e('id','ID bị trùng');
  for(const f of['name','role'])if(typeof c[f]!=='string'||!c[f].trim())e(f,'Thiếu hoặc không phải chuỗi');
  for(const f of['title','damage','difficulty','range','status','shortDesc','quote','releaseDate','version'])if(c[f]!=null&&typeof c[f]!=='string')e(f,'Phải là chuỗi');
  for(const k of Object.keys(c))if(!KNOWN.has(k))w(k,'Trường không được hỗ trợ, sẽ bị bỏ qua');
  if(c.lane!=null&&!(typeof c.lane==='string'||(Array.isArray(c.lane)&&c.lane.every(x=>typeof x==='string'))))e('lane','Phải là chuỗi hoặc mảng chuỗi');
  if(c.keywords!=null&&!(Array.isArray(c.keywords)&&c.keywords.every(x=>typeof x==='string')))e('keywords','Phải là mảng chuỗi');
  if(c.images!=null){if(typeof c.images!=='object'||Array.isArray(c.images))e('images','Phải là object');else for(const[k,v]of Object.entries(c.images)){const ok=typeof v==='string'?IMG_RE.test(v):Array.isArray(v)&&v.every(p=>typeof p==='string'&&IMG_RE.test(p));if(!ok){w('images.'+k,'Tên file ảnh không hợp lệ, đã bỏ qua: '+JSON.stringify(v));delete c.images[k]}}}
  const DET=['mechanics','damage','range','radius','cooldown','cost','duration','effects','scaling','conditions','notes'];
  const chk=(o,p)=>{DET.forEach(k=>{if(o[k]!=null&&!fOk(o[k])){w(p+'.'+k,'Sai kiểu dữ liệu hoặc loại segment, đã bỏ qua');delete o[k]}});if(o.desc!=null&&!descOk(o.desc)){w(p+'.desc','Mô tả sai kiểu hoặc loại segment không hợp lệ, đã bỏ qua');delete o.desc}if(o.video!=null&&!(typeof o.video==='string'&&VID_RE.test(o.video))){w(p+'.video','Tên file video không hợp lệ, đã bỏ qua');delete o.video}};
  if(c.stats!=null){if(typeof c.stats!=='object'||Array.isArray(c.stats))e('stats','Phải là object');else for(const[k,v]of Object.entries(c.stats)){const ok=typeof v==='number'?Number.isFinite(v)&&v>=0:v&&typeof v==='object'&&!Array.isArray(v)&&Number.isFinite(v.base)&&v.base>=0&&(v.growth==null||Number.isFinite(v.growth))&&(v.unit==null||typeof v.unit==='string')&&(v.note==null||typeof v.note==='string');if(!ok){w('stats.'+k,'Giá trị chỉ số không hợp lệ, đã bỏ qua');delete c.stats[k]}}}
  if(c.passive!=null){if(typeof c.passive!=='object'||Array.isArray(c.passive)||typeof c.passive.name!=='string'){w('passive','Nội tại cần là object có name (chuỗi), đã bỏ qua');delete c.passive}else chk(c.passive,'passive')}
  if(c.skills!=null){if(!Array.isArray(c.skills))e('skills','Phải là mảng');else{if(c.skills.length!==3)w('skills','Cần đúng 3 kỹ năng chính, hiện có '+c.skills.length);c.skills=c.skills.filter((s,j)=>{if(!s||typeof s!=='object'||typeof s.name!=='string'){w('skills['+j+']','Thiếu tên kỹ năng, đã bỏ qua');return false}chk(s,'skills['+j+']');return true})}}else w('skills','Chưa có kỹ năng');
  if(c.lore!=null){if(typeof c.lore==='string')c.lore={full:[c.lore]};else if(typeof c.lore!=='object'||Array.isArray(c.lore))e('lore','Phải là chuỗi hoặc object');else for(const k of Object.keys(c.lore))if(!LORE_KEYS.has(k))w('lore.'+k,'Mục cốt truyện không được hỗ trợ, sẽ bị bỏ qua')}
  if(c.extra!=null){if(typeof c.extra!=='object'||Array.isArray(c.extra))e('extra','Phải là object');else{
    const X=c.extra;for(const k of Object.keys(X))if(!EXTRA_KEYS.has(k))w('extra.'+k,'Mục không được hỗ trợ, sẽ bị bỏ qua');
    for(const k of['skins','weapons','relationships','videos','history'])if(X[k]!=null&&!Array.isArray(X[k])){w('extra.'+k,'Phải là mảng, đã bỏ qua');delete X[k]}
    for(const k of['titles','voiceLines','artwork'])if(X[k]!=null&&!(Array.isArray(X[k])&&X[k].every(x=>typeof x==='string'))){w('extra.'+k,'Phải là mảng chuỗi, đã bỏ qua');delete X[k]}
    if(X.artwork)X.artwork=X.artwork.filter(p=>IMG_RE.test(p)||(w('extra.artwork','Tên ảnh không hợp lệ: '+p),false));
    if(X.skins)X.skins=X.skins.filter(s=>(s&&typeof s.name==='string'&&(s.image==null||IMG_RE.test(s.image)))||(w('extra.skins','Skin thiếu tên hoặc sai tên ảnh, đã bỏ qua'),false));
    if(X.videos)X.videos=X.videos.filter(s=>(s&&typeof s.file==='string'&&VID_RE.test(s.file))||(w('extra.videos','Video sai định dạng, đã bỏ qua'),false));
    if(X.relationships)X.relationships=X.relationships.filter(s=>(s&&typeof s.name==='string')||(w('extra.relationships','Thiếu name, đã bỏ qua'),false));
    if(X.history)X.history=X.history.filter(s=>(s&&typeof s.version==='string')||(w('extra.history','Thiếu version, đã bỏ qua'),false));
    if(X.weapons)X.weapons=X.weapons.filter(s=>typeof s==='string'||(s&&typeof s.name==='string')||(w('extra.weapons','Sai định dạng, đã bỏ qua'),false));
  }}
  return{E,W};
}
function ingest(data){
  if(!data||!Array.isArray(data.characters))throw new Error('data.txt cần có dạng {"characters":[ ... ]}');
  const seen=new Set();
  data.characters.forEach((c,i)=>{
    const{E,W}=validate(c,i,seen);S.rep.warnings.push(...W);
    if(E.length){S.rep.errors.push(...E);return}
    seen.add(c.id);c.lane=c.lane?[].concat(c.lane):[];c.skills=Array.isArray(c.skills)?c.skills:[];
    c._s=norm([c.id,c.name,c.title,c.role,c.lane.join(' '),c.damage,c.difficulty,c.range,c.passive?.name,c.skills.map(s=>s?.name).join(' '),(c.keywords||[]).join(' '),flat(c.lore).join(' ')].filter(Boolean).join(' '));
    S.chars.push(c);
  });
}

/* ---------- Components ---------- */
const initials=n=>n.split(/\s+/).slice(-2).map(w=>w[0]).join('').toUpperCase();
function pic(p,alt,cls,zoom,fbText){
  const fb=()=>h('div',{class:'fb',role:'img','aria-label':'Chưa có ảnh: '+alt},fbText);
  if(!p||typeof p!=='string')return fb();
  const el=h('img',{src:p,alt,loading:'lazy',decoding:'async',class:cls,onerror(ev){S.rep.imgFail.add(alt+': '+p);const f=fb();(ev.target.closest('.zoom')||ev.target).replaceWith(f)}});
  return zoom?h('button',{type:'button',class:'zoom','aria-label':'Phóng to: '+alt,onclick(e){e.preventDefault();e.stopPropagation();preview(p,alt)}},el):el;
}
const img=(c,key,cls,zoom)=>pic(c.images?.[key],c.name+(key==='avatar'?'':' - '+key),cls,zoom,initials(c.name));
function hl(text,q){const t=norm(q).trim();if(!t||!text)return text||'';const i=norm(text).indexOf(t);return i<0?text:[text.slice(0,i),h('mark',{},text.slice(i,i+t.length)),text.slice(i+t.length)]}
function card(c,q=''){
  return h('a',{class:'card',href:'#/c/'+encodeURIComponent(c.id)},
    h('div',{class:'ph'},img(c,'avatar'),c.status&&h('span',{class:'tag '+c.status.toLowerCase()},c.status),c.demo&&h('span',{class:'tag demo'},'DEMO')),
    h('div',{class:'cb'},h('span',{class:'cid'},'#'+c.id),h('h3',{},hl(c.name,q)),c.title&&h('p',{class:'ct'},hl(c.title,q)),
      h('div',{class:'meta'},[c.role,...c.lane,c.damage,c.difficulty].filter(Boolean).map(x=>h('span',{},x))),
      c.shortDesc&&h('p',{class:'cd'},c.shortDesc)));
}

/* ---------- Filtering / search ---------- */
function result(){
  const t=norm(S.q).split(/\s+/).filter(Boolean);
  const r=S.chars.filter(c=>GROUPS.every(([k])=>!S.f[k].size||vals(c,k).some(v=>S.f[k].has(v)))&&t.every(x=>c._s.includes(x)));
  const s=S.sort;
  r.sort(s==='name'?(a,b)=>a.name.localeCompare(b.name,'vi'):s==='role'?(a,b)=>a.role.localeCompare(b.role)||a.name.localeCompare(b.name,'vi'):(a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
  return r;
}
const nFilters=()=>GROUPS.reduce((n,[k])=>n+S.f[k].size,0);
function buildFilters(){
  const box=$('#filters-body');box.replaceChildren();
  for(const[k,label]of GROUPS){
    const cnt=new Map();S.chars.forEach(c=>vals(c,k).forEach(v=>cnt.set(v,(cnt.get(v)||0)+1)));if(!cnt.size)continue;
    const o=ORDER[k]||[],rank=v=>{const i=o.indexOf(v);return i<0?99:i};
    const items=[...cnt].sort((a,b)=>rank(a[0])-rank(b[0])||String(a[0]).localeCompare(b[0],'vi'));
    box.append(h('fieldset',{class:'fg'},h('legend',{},label),h('div',{class:'chips'},items.map(([v,n])=>h('button',{type:'button',class:'chip','data-k':k,'data-v':v,'aria-pressed':'false',onclick(){const s=S.f[k];s.has(v)?s.delete(v):s.add(v);S.shown=PAGE;renderList()}},v,h('small',{},n))))));
  }
}
function renderList(){
  const r=result();
  document.querySelectorAll('.chip[data-k]').forEach(b=>b.setAttribute('aria-pressed',String(S.f[b.dataset.k].has(b.dataset.v))));
  const n=nFilters();$('#fcount').hidden=!n;$('#fcount').textContent=n;
  $('#count').textContent=r.length+' / '+S.chars.length+' nhân vật';
  $('#grid').replaceChildren(...r.slice(0,S.shown).map(c=>card(c,S.q)));
  $('#empty').hidden=r.length>0;$('#btn-more').hidden=r.length<=S.shown;
}
function clearAll(){GROUPS.forEach(([k])=>S.f[k].clear());S.q='';$('#q').value='';S.shown=PAGE;renderList()}
function toggleFilters(open){$('#filters').classList.toggle('open',open);$('#backdrop').hidden=!open}

/* ---------- Views ---------- */
function renderHome(){
  const ch=S.chars,roles=new Map();ch.forEach(c=>roles.set(c.role,(roles.get(c.role)||0)+1));
  const lanes=new Set(ch.flatMap(c=>c.lane));
  $('#stats').replaceChildren(...[[ch.length,'Nhân vật'],[roles.size,'Vai trò'],[lanes.size,'Lộ đường']].map(([n,l])=>h('div',{class:'stat'},h('b',{},n),h('span',{},l))));
  const feat=ch.filter(c=>c.status==='New');
  $('#featured').replaceChildren(...(feat.length?feat:ch).slice(0,4).map(c=>card(c)));
  $('#latest').replaceChildren(...ch.slice(-4).reverse().map(c=>card(c)));
  $('#role-groups').replaceChildren(...[...roles].map(([r,n])=>h('button',{type:'button',class:'chip',onclick(){clearAll();S.f.role.add(r);go('characters')}},r,h('small',{},n))));
}
function renderReport(){
  const R=S.rep,box=$('#report');box.replaceChildren();
  const list=(t,a,cls)=>{box.append(h('h3',{},t+' ('+a.length+')'));box.append(a.length?h('ul',{class:'rep'},a.map(x=>h('li',{class:cls},h('b',{},typeof x==='string'?x:x.id+' · '+x.f),typeof x==='string'?'':' — '+x.m))):h('p',{class:'muted'},'Không có.'))};
  box.append(h('p',{},'Đã nạp '+S.chars.length+' nhân vật hợp lệ.'));
  list('Lỗi (nhân vật bị loại)',R.errors,'e');list('Cảnh báo',R.warnings,'');list('Ảnh không tải được (kiểm tra tên file trong repo)',[...R.imgFail],'');selfTestBox(box);
}

/* ---------- Phase 3-4: Smart Color, profile, tabs, lightbox, compare, settings ---------- */
S.cmp=['','',''];
const VID_RE=/^[\w-]+\.(mp4|webm|gif)$/i;
const LBL={physical_damage:'sát thương vật lý',magic_damage:'sát thương phép',true_damage:'sát thương chuẩn',healing:'hồi máu',shield:'lá chắn',ad_scale:'công vật lý',ap_scale:'công phép',hp_scale:'máu tối đa',level_scale:'mỗi cấp'};
const UNIT={percent:'%',second:'s',seconds:'s',meter:'m'};
const PH={'sát thương vật lý':'physical_damage','sát thương phép':'magic_damage','sát thương chuẩn':'true_damage','công vật lý':'ad_scale','công phép':'ap_scale','máu tối đa':'hp_scale','máu đã mất':'hp_scale','máu hiện tại':'hp_scale','hồi máu':'healing','hồi phục':'healing','lá chắn':'shield','làm choáng':'cc','hất tung':'cc','làm chậm':'cc','câm lặng':'cc','khóa chiêu':'cc','trói':'cc','kéo về':'cc','giảm giáp':'debuff','giảm kháng phép':'debuff','làm lộ vị trí':'debuff','đánh dấu':'debuff','chảy máu':'debuff','hồi chiêu':'cooldown','thời gian hồi':'cooldown'};
const ATTACH=new Set(['physical_damage','magic_damage','true_damage','ad_scale','ap_scale','hp_scale','healing','shield']);
const KWRE=Object.keys(PH).sort((a,b)=>b.length-a.length).join('|');
const AUTO=new RegExp('(\\d+(?:[.,]\\d+)?(?:\\s*[-–/]\\s*\\d+(?:[.,]\\d+)?)*)(%)?(?:\\s*('+KWRE+'|giây|s|m)(?!\\p{L}))?|('+KWRE+')','giu');
/* Phân loại theo ngữ nghĩa: số chỉ tô màu "số" khi đứng riêng; đi kèm từ khoá thì lấy màu của loại đó. */
function tokenize(str,numCls='number'){
  str=String(str);const out=[];let last=0,m;AUTO.lastIndex=0;
  const push=(type,value)=>{if(value)out.push({type,value,raw:true})};
  while((m=AUTO.exec(str))){
    if(m.index>last)push('text',str.slice(last,m.index));
    if(m[1]!==undefined){
      const kw=m[3]?m[3].toLowerCase():'',cls=PH[kw],num=m[1]+(m[2]||'');
      if(cls&&ATTACH.has(cls))push(cls,m[0]);
      else if(cls){push(numCls,num);push('text',m[0].slice(num.length,m[0].length-kw.length));push(cls,m[0].slice(m[0].length-kw.length))}
      else push(numCls,m[0]);
    }else push(PH[m[4].toLowerCase()],m[4]);
    last=AUTO.lastIndex;
  }
  if(last<str.length)push('text',str.slice(last));
  return out;
}
function segNodes(segs){return segs.map(s=>{
  if(s.type==='text')return document.createTextNode(String(s.value));
  if(s.raw)return h('span',{class:'c-'+s.type},String(s.value));
  const v=s.value!=null?String(s.value)+(UNIT[s.unit]||''):'',l=s.label!==undefined?s.label:(LBL[s.type]||'');
  return h('span',{class:'c-'+s.type},[v,l].filter(Boolean).join(' '));
})}
const rich=(d,nc)=>{const f=document.createDocumentFragment();f.append(...segNodes(Array.isArray(d)?d:tokenize(d,nc)));return f};
const isSeg=x=>x&&typeof x==='object'&&!Array.isArray(x)&&x.type;
function val(v,nc){
  if(Array.isArray(v))return v.every(isSeg)?rich(v,nc):h('ul',{class:'bl'},v.map(i=>h('li',{},rich(isSeg(i)?[i]:i,nc))));
  return rich(String(v),nc);
}
const ROWS=[['damage','Sát thương'],['scaling','Hệ số'],['range','Tầm'],['radius','Bán kính'],['duration','Thời gian'],['cooldown','Hồi chiêu'],['cost','Tiêu hao'],['effects','Hiệu ứng'],['conditions','Điều kiện'],['mechanics','Cơ chế chi tiết'],['notes','Ghi chú']];
const STATS=[['hp','Máu (HP)'],['mana','Năng lượng / Mana'],['physicalAttack','Công vật lý'],['magicAttack','Công phép'],['armor','Giáp'],['magicResist','Kháng phép'],['moveSpeed','Tốc chạy'],['attackSpeed','Tốc đánh'],['attackRange','Tầm đánh']];
const CMP_STATS=[['hp','HP'],['physicalAttack','Công vật lý'],['magicAttack','Công phép'],['armor','Giáp'],['magicResist','Kháng phép'],['moveSpeed','Tốc chạy']];

/* Lightbox */
function preview(src,alt){$('#lb-img').src=src;$('#lb-img').alt=alt;$('#lb').hidden=false;$('#lb-x').focus()}
function closePreview(){$('#lb').hidden=true;$('#lb-img').removeAttribute('src')}

function tabs(items){
  const tl=h('div',{class:'tabs',role:'tablist'}),box=h('div',{}),btns=[],pans=[];
  const sel=i=>btns.forEach((b,j)=>{b.setAttribute('aria-selected',String(i===j));b.tabIndex=i===j?0:-1;pans[j].hidden=i!==j});
  items.forEach((it,i)=>{
    const b=h('button',{type:'button',role:'tab',class:'tab',onclick:()=>sel(i),onkeydown(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const n=(i+(e.key==='ArrowRight'?1:items.length-1))%items.length;sel(n);btns[n].focus()}}},it.label);
    const p=h('div',{role:'tabpanel',class:'tpanel'},it.node);btns.push(b);pans.push(p);tl.append(b);box.append(p);
  });
  sel(0);return h('div',{},tl,box);
}
function skillCard(s,icon,badge){
  const body=h('div',{class:'sb'}),rows=ROWS.filter(([k])=>s[k]!=null);
  if(s.desc!=null)body.append(h('p',{class:'rt'},rich(s.desc)));
  if(rows.length)body.append(h('dl',{class:'rows'},rows.flatMap(([k,l])=>[h('dt',{},l),h('dd',{class:'rt'},val(s[k],k==='cooldown'?'cooldown':'number'))])));
  if(s.video)body.append(/\.gif$/i.test(s.video)?h('img',{src:s.video,alt:'Minh họa '+s.name,loading:'lazy',class:'vid'}):h('video',{src:s.video,controls:true,preload:'none',playsinline:true,class:'vid'}));
  return h('details',{class:'skill',open:true},h('summary',{},pic(icon,s.name,'sic',true,String(badge).slice(0,3)),h('span',{class:'sh'},h('em',{},badge),h('strong',{},s.name))),body);
}
function statsBox(c){
  const st=c.stats;if(!st||!Object.keys(st).length)return null;
  const lbl=Object.fromEntries(STATS),keys=[...STATS.map(s=>s[0]).filter(k=>k in st),...Object.keys(st).filter(k=>!(k in lbl))];
  return h('div',{},h('h2',{},'Chỉ số cơ bản'),h('dl',{class:'stats-l'},keys.flatMap(k=>{
    const x=st[k],o=typeof x==='object'?x:{base:x},cls=k==='physicalAttack'?'physical_damage':k==='magicAttack'?'magic_damage':'number';
    return[h('dt',{},lbl[k]||k),h('dd',{},h('span',{class:'c-'+cls},String(o.base)+(o.unit||'')),o.growth!=null&&h('small',{},'  +'+o.growth+(o.unit||'')+'/cấp'),o.note&&h('small',{class:'muted'},' · '+o.note))]})));
}
const LORE=[['short','Tóm tắt'],['full','Tiểu sử đầy đủ'],['origin','Nguồn gốc'],['background','Bối cảnh'],['personality','Tính cách'],['family','Gia đình'],['relationships','Quan hệ'],['majorEvents','Sự kiện lớn'],['timeline','Dòng thời gian'],['motivation','Động lực'],['status','Tình trạng hiện tại'],['quotes','Trích dẫn']];
const LORE_KEYS=new Set(LORE.map(x=>x[0]));
const EXTRA_KEYS=new Set(['skins','weapons','titles','relationships','voiceLines','videos','artwork','history']);
function block(x){
  if(typeof x==='string')return h('p',{},x);if(!x||typeof x!=='object')return null;
  if(x.heading)return h('h4',{},String(x.heading));if(Array.isArray(x.list))return h('ul',{class:'bl'},x.list.map(i=>h('li',{},String(i))));
  if(x.quote)return h('blockquote',{},String(x.quote));return null;
}
function loreNode(L){
  const w=h('div',{class:'lore'}),body=h('div',{class:'lbody'});
  if(L.short)w.append(h('p',{class:'lead'},L.short));
  for(const[k,l]of LORE){
    if(k==='short'||L[k]==null)continue;const v=L[k],sec=h('section',{},h('h3',{},l));
    if(k==='timeline'&&Array.isArray(v))sec.append(h('ol',{class:'tl'},v.filter(x=>x&&x.text).map(x=>h('li',{},x.time&&h('b',{},String(x.time)),String(x.text)))));
    else if(k==='quotes'&&Array.isArray(v))sec.append(...v.map(q=>h('blockquote',{},String(q))));
    else if(k==='majorEvents'&&Array.isArray(v))sec.append(h('ul',{class:'bl'},v.map(i=>h('li',{},String(i)))));
    else(Array.isArray(v)?v:[v]).forEach(x=>{const b=block(x);b&&sec.append(b)});
    body.append(sec);
  }
  w.append(body);
  if(body.textContent.length>900){
    body.classList.add('clamp');
    const btn=h('button',{type:'button',class:'btn ghost','aria-expanded':'false',onclick(){const on=body.classList.toggle('clamp');btn.textContent=on?'Mở rộng toàn bộ':'Thu gọn';btn.setAttribute('aria-expanded',String(!on))}},'Mở rộng toàn bộ');
    w.append(btn);
  }
  return w;
}
const gal=items=>h('div',{class:'gal'},items.map(i=>h('figure',{},pic(i.p,i.t,null,true,'?'),i.t&&h('figcaption',{},i.t,i.n&&h('small',{},' — '+i.n)))));
function extraNode(c){
  const X=c.extra;if(!X)return null;const w=h('div',{});let n=0;const sec=(t,node)=>{n++;w.append(h('section',{class:'xs'},h('h3',{},t),node))};
  if(X.skins?.length)sec('Trang phục',gal(X.skins.map(s=>({p:s.image,t:s.name,n:s.note}))));
  if(X.weapons?.length)sec('Vũ khí',h('ul',{class:'bl'},X.weapons.map(x=>typeof x==='string'?h('li',{},x):h('li',{},h('b',{},x.name),x.desc&&' — '+x.desc))));
  if(X.titles?.length)sec('Danh hiệu',h('div',{class:'chips'},X.titles.map(t=>h('span',{class:'chip'},t))));
  if(X.relationships?.length)sec('Quan hệ',h('ul',{class:'bl'},X.relationships.map(r=>{const o=r.id&&S.chars.find(x=>x.id===r.id);return h('li',{},o?h('a',{class:'link2',href:'#/c/'+encodeURIComponent(o.id)},r.name):h('b',{},r.name),r.type&&' ('+r.type+')',r.desc&&' — '+r.desc)})));
  if(X.voiceLines?.length)sec('Lời thoại',h('div',{},X.voiceLines.map(q=>h('blockquote',{},q))));
  if(X.videos?.length)sec('Video',h('div',{class:'gal'},X.videos.map(v=>h('figure',{},/\.gif$/i.test(v.file)?h('img',{src:v.file,alt:v.title||'Video',loading:'lazy'}):h('video',{src:v.file,controls:true,preload:'none',playsinline:true}),v.title&&h('figcaption',{},v.title)))));
  if(X.artwork?.length)sec('Hình nghệ thuật',gal(X.artwork.map((p,i)=>({p,t:c.name+' artwork '+(i+1)}))));
  if(X.history?.length)sec('Lịch sử cập nhật',h('ol',{class:'tl'},X.history.map(x=>h('li',{},h('b',{},x.version+(x.date?' · '+x.date:'')),x.notes&&h('span',{},' '+[].concat(x.notes).join('; '))))));
  return n?w:null;
}
function addCmp(id){if(S.cmp.includes(id))return;const i=S.cmp.findIndex(x=>!x);S.cmp[i>=0?i:2]=id}
function renderProfile(id){
  const v=$('#v-profile'),c=S.chars.find(x=>x.id===id);v.replaceChildren();
  if(!c){v.append(h('div',{class:'wrap'},h('div',{class:'empty'},h('h3',{},'Không có nhân vật #'+id),h('a',{class:'btn',href:'#/characters'},'Về thư viện'))));return}
  document.title=c.name+' — Arena Codex';
  const bg=c.images?.splash||c.images?.bg,hero=h('div',{class:'profile-hero'});
  if(bg)hero.append(h('img',{class:'bgimg',src:bg,alt:'',loading:'lazy',onerror(e){S.rep.imgFail.add(c.name+': '+bg);e.target.remove()}}));
  hero.append(h('div',{class:'wrap pin'},h('div',{class:'pav'},img(c,'avatar',null,true)),h('div',{},
    h('span',{class:'cid'},'#'+c.id+(c.demo?' · DEMO':'')),h('h1',{},c.name),c.title&&h('p',{class:'ct'},c.title),c.quote&&h('p',{class:'quote'},c.quote),
    h('div',{class:'meta'},[c.role,...c.lane,c.damage,c.difficulty,c.range,c.releaseDate&&'Phát hành '+c.releaseDate,c.version&&'Phiên bản '+c.version].filter(Boolean).map(x=>h('span',{},x))),
    h('div',{class:'acts'},h('button',{class:'btn',type:'button',onclick(){addCmp(c.id);go('compare')}},'So sánh'),h('a',{class:'btn ghost',href:'#/characters'},'Thư viện')))));
  v.append(hero);
  const ov=h('div',{class:'ov'}),right=h('div',{}),sb=statsBox(c);
  if(c.shortDesc)right.append(h('p',{class:'note'},c.shortDesc));
  if(c.passive)right.append(h('h2',{},'Nội tại'),skillCard(c.passive,c.images?.passive,'Nội tại'));
  if(c.skills.length)right.append(h('h2',{},'Kỹ năng'),h('div',{class:'skills'},c.skills.map((s,i)=>skillCard(s,c.images?.['skill'+(i+1)],s.hotkey||String(i+1)))));
  if(sb)ov.append(sb);ov.append(right);
  const items=[{label:'Tổng quan',node:ov}];
  if(c.lore&&Object.keys(c.lore).some(k=>LORE_KEYS.has(k)))items.push({label:'Cốt truyện',node:loreNode(c.lore)});
  const ex=extraNode(c);if(ex)items.push({label:'Thông tin thêm',node:ex});
  v.append(h('div',{class:'wrap'},tabs(items)));
}
function renderCompare(){
  const sel=$('#cmp-sel'),out=$('#cmp-out');sel.replaceChildren();out.replaceChildren();
  for(let i=0;i<3;i++)sel.append(h('select',{'aria-label':'Nhân vật '+(i+1),onchange(e){S.cmp[i]=e.target.value;renderCompare()}},h('option',{value:''},i<2?'Chọn nhân vật '+(i+1):'Thêm nhân vật 3 (tùy chọn)'),...S.chars.map(c=>h('option',{value:c.id,selected:S.cmp[i]===c.id},'#'+c.id+' '+c.name))));
  const cs=[...new Set(S.cmp.filter(Boolean))].map(id=>S.chars.find(x=>x.id===id)).filter(Boolean);
  if(cs.length<2){out.append(h('p',{class:'note'},'Chọn ít nhất 2 nhân vật để so sánh.'));return}
  const st=k=>c=>{const x=c.stats?.[k];return x==null?'—':typeof x==='object'?x.base+(x.unit||''):String(x)};
  const sk=i=>c=>c.skills[i]?h('div',{},h('b',{},c.skills[i].name),h('p',{class:'rt'},rich(c.skills[i].desc||''))):'—';
  const R=[['Vai trò',c=>c.role],['Lộ',c=>c.lane.join(', ')||'—'],['Độ khó',c=>c.difficulty||'—'],['Tầm đánh',c=>c.range||'—'],['Loại sát thương',c=>c.damage||'—'],...CMP_STATS.map(([k,l])=>[l,st(k)]),
    ['Nội tại',c=>c.passive?h('div',{},h('b',{},c.passive.name),h('p',{class:'rt'},rich(c.passive.desc||''))):'—'],...[0,1,2].map(i=>['Kỹ năng '+(i+1),sk(i)])];
  out.append(h('div',{class:'cmp-scroll'},h('table',{class:'cmp'},
    h('thead',{},h('tr',{},h('th',{scope:'col'},'Tiêu chí'),cs.map(c=>h('th',{scope:'col'},h('a',{href:'#/c/'+encodeURIComponent(c.id)},c.name))))),
    h('tbody',{},R.map(([l,f])=>h('tr',{},h('th',{scope:'row'},l),cs.map(c=>h('td',{},f(c)))))))),
    h('p',{class:'muted'},'Dữ liệu được đặt cạnh nhau, không xếp hạng mạnh yếu.'));
}
/* Settings */
const DEF={fs:'normal',rm:false,page:24},CFG={...DEF};
function loadCfg(){try{const o=JSON.parse(localStorage.getItem('arena.cfg')||'{}');if(['normal','large'].includes(o.fs))CFG.fs=o.fs;if(typeof o.rm==='boolean')CFG.rm=o.rm;if([12,24,48].includes(o.page))CFG.page=o.page}catch{}}
function applyCfg(){document.documentElement.dataset.fs=CFG.fs;document.documentElement.classList.toggle('rm',CFG.rm);PAGE=CFG.page;S.shown=PAGE}
function saveCfg(){try{localStorage.setItem('arena.cfg',JSON.stringify(CFG))}catch{}applyCfg()}
const LEG=[[{type:'number',value:30},'Số, chỉ số, thời gian'],[{type:'physical_damage',value:10,unit:'percent'},'Sát thương vật lý / hệ số công vật lý'],[{type:'magic_damage',value:10,unit:'percent'},'Sát thương phép / hệ số công phép'],[{type:'true_damage',value:5,unit:'percent'},'Sát thương chuẩn'],[{type:'healing',value:50},'Hồi máu'],[{type:'shield',value:80},'Lá chắn'],[{type:'cc',value:'Làm choáng'},'Khống chế (CC)'],[{type:'debuff',value:'Giảm giáp'},'Hiệu ứng bất lợi'],[{type:'cooldown',value:8,unit:'second'},'Hồi chiêu']];
function renderSettings(){
  const box=$('#settings');box.replaceChildren();
  const grp=(label,key,opts)=>h('fieldset',{class:'fg'},h('legend',{},label),h('div',{class:'chips'},opts.map(([v,t])=>h('button',{type:'button',class:'chip','aria-pressed':String(CFG[key]===v),onclick(){CFG[key]=v;saveCfg();renderSettings()}},t))));
  box.append(grp('Cỡ chữ','fs',[['normal','Vừa'],['large','Lớn']]),grp('Giảm chuyển động','rm',[[false,'Theo hệ thống'],[true,'Luôn giảm']]),grp('Số nhân vật mỗi lần tải','page',[[12,'12'],[24,'24'],[48,'48']]),
    h('button',{class:'btn ghost',type:'button',onclick(){Object.assign(CFG,DEF);saveCfg();renderSettings()}},'Khôi phục mặc định'),
    h('h3',{style:'margin:26px 0 10px'},'Chú giải màu'),h('ul',{class:'legend'},LEG.map(([s,t])=>h('li',{},h('span',{class:'lg'},segNodes([s])),t))));
}
/* Self-test (hiển thị ở trang Database) */
function selfTests(){
  const T=[],t=(n,f)=>{let ok=false;try{ok=!!f()}catch{}T.push({n,ok})},ty=s=>tokenize(s).map(x=>x.type).join(',');
  t('Tìm không dấu: "kiem si" khớp "Kiếm Sĩ"',()=>norm('Kiếm Sĩ')==='kiem si'&&norm('Đạo')==='dao');
  t('30 = số, 10% sát thương vật lý = cam, 10% sát thương phép = tím',()=>ty('Gây 30 + 10% sát thương vật lý + 10% sát thương phép lên kẻ địch.')==='text,number,text,physical_damage,text,magic_damage,text');
  t('Khoảng giá trị 30/60/90 là một số',()=>{const a=tokenize('30/60/90');return a.length===1&&a[0].type==='number'});
  t('Số thập phân + giây là một số',()=>{const a=tokenize('1.5 giây');return a.length===1&&a[0].type==='number'});
  t('Làm choáng = CC, sát thương chuẩn = đỏ',()=>ty('làm choáng và sát thương chuẩn')==='cc,text,true_damage');
  t('Hệ số công vật lý/phép không nhầm với sát thương',()=>ty('60% công vật lý')==='ad_scale'&&ty('20% công phép')==='ap_scale');
  t('Tokenizer giữ nguyên nội dung (render bằng textContent, chống XSS)',()=>{const x='<img src=x onerror=alert(1)>';return tokenize(x).map(s=>s.value).join('')===x});
  t('Validator bắt ID trùng',()=>validate({id:'1',name:'a',role:'r'},0,new Set(['1'])).E.length===1);
  t('Validator bắt thiếu tên',()=>validate({id:'2',role:'r'},0,new Set()).E.some(e=>e.f==='name'));
  t('Validator cảnh báo trường lạ và chỉ số âm',()=>validate({id:'3',name:'a',role:'r',x:1,stats:{hp:-5}},0,new Set()).W.length>=2);
  return T;
}
function selfTestBox(box){const T=selfTests();box.append(h('h3',{},'Tự kiểm tra ('+T.filter(x=>x.ok).length+'/'+T.length+' đạt)'),h('ul',{class:'rep'},T.map(x=>h('li',{class:x.ok?'ok':'e'},(x.ok?'✓ ':'✗ ')+x.n))))}

/* ---------- Router ---------- */
function go(r){location.hash='#/'+r}
function route(){
  if(!S.ready)return;
  const hs=location.hash||'#/home',m=hs.match(/^#\/c\/(.+)$/);
  const view=m?'profile':({'#/characters':'characters','#/database':'database','#/compare':'compare','#/settings':'settings'})[hs]||'home';
  document.querySelectorAll('.view').forEach(s=>s.hidden=s.id!=='v-'+view);
  document.querySelectorAll('[data-r]').forEach(a=>a.classList.toggle('on',a.dataset.r===view));
  document.title='Arena Codex — Bách khoa nhân vật MOBA';toggleFilters(false);
  if(view==='characters')renderList();
  if(view==='profile')renderProfile(decodeURIComponent(m[1]));
  if(view==='database')renderReport();
  if(view==='compare')renderCompare();
  if(view==='settings')renderSettings();
  scrollTo(0,0);
}
function focusSearch(){if(location.hash!=='#/characters')go('characters');setTimeout(()=>$('#q').focus(),60)}

/* ---------- Init ---------- */
async function init(){
  loadCfg();applyCfg();
  $('#grid').replaceChildren(...Array.from({length:8},()=>h('div',{class:'sk'})));
  let t=null;
  $('#q').addEventListener('input',e=>{clearTimeout(t);t=setTimeout(()=>{S.q=e.target.value;S.shown=PAGE;renderList()},200)});
  $('#sort').addEventListener('change',e=>{S.sort=e.target.value;renderList()});
  $('#btn-more').addEventListener('click',()=>{S.shown+=PAGE;renderList()});
  $('#btn-clear').addEventListener('click',clearAll);$('#btn-empty-clear').addEventListener('click',clearAll);
  $('#btn-filter').addEventListener('click',()=>toggleFilters(true));
  for(const id of['btn-fclose','btn-fdone','backdrop'])$('#'+id).addEventListener('click',()=>toggleFilters(false));
  $('#btn-search').addEventListener('click',focusSearch);$('#bn-search').addEventListener('click',focusSearch);
  $('#hero-form').addEventListener('submit',e=>{e.preventDefault();clearAll();S.q=$('#hero-q').value;$('#q').value=S.q;go('characters')});
  window.addEventListener('hashchange',route);
  $('#lb-x').addEventListener('click',closePreview);$('#lb').addEventListener('click',e=>{if(e.target.id==='lb')closePreview()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePreview();toggleFilters(false)}});
  try{
    const r=await fetch('data.txt',{cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status+' khi tải data.txt');
    let d;try{d=JSON.parse(await r.text())}catch(e){throw new Error('JSON không hợp lệ: '+e.message)}
    ingest(d);buildFilters();renderHome();S.ready=true;route();
  }catch(e){
    document.querySelectorAll('.view').forEach(s=>s.hidden=s.id!=='v-error');$('#err-msg').textContent=e.message;
  }
}
if(typeof document!=='undefined')init();
if(typeof module!=='undefined')module.exports={S,norm,validate,ingest,tokenize,result,selfTests};
