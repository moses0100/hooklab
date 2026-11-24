const $ = id => document.getElementById(id);
let info; let rows = []; let selected = null; let record = null; let tab = 'body'; let loading = false; let demoBusy = false; let lastSignature = ''; let messageTimer;
const time = value => new Date(value).toLocaleTimeString('th-TH', { hour12:false });
function notify(text) { $('message').textContent=text; $('message').hidden=false; clearTimeout(messageTimer); messageTimer=setTimeout(()=>$('message').hidden=true,3500); }
function fail(error) { $('error').textContent=error.message ?? 'เชื่อมต่อไม่ได้'; $('error').hidden=false; }
async function json(url,options) {
  const response=await fetch(url,{cache:'no-store',...options});
  const data=await response.json();
  if(!response.ok) throw new Error(data.error ?? 'โหลดข้อมูลไม่สำเร็จ');
  return data;
}
function renderList() {
  const search=$('search').value.trim().replace(/^#/,'').toLowerCase();
  const visible=rows.filter(row=>`${row.method} ${row.id}`.toLowerCase().includes(search));
  $('request-count').textContent=rows.length;
  const fragment=document.createDocumentFragment();
  for(const row of visible) {
    const item=document.createElement('li'); const button=document.createElement('button');
    button.type='button'; button.className='request-row'; button.setAttribute('aria-pressed',String(row.id===selected));
    button.setAttribute('aria-label',`${row.method} request ${row.id} เวลา ${time(row.receivedAt)}`);
    const top=document.createElement('div');top.className='row-top';
    const method=document.createElement('span');method.className=`method method-${row.method.toLowerCase()}`;method.textContent=row.method;
    const timestamp=document.createElement('span');timestamp.className='row-time';timestamp.textContent=time(row.receivedAt);
    top.append(method,timestamp);
    const bottom=document.createElement('div');bottom.className='row-bottom';
    const id=document.createElement('span');id.className='request-id';id.textContent=`#${row.id}`;
    const summary=document.createElement('span');summary.textContent=`${row.kind} · ${row.bytes.toLocaleString()} B`;
    bottom.append(id,summary);button.append(top,bottom);button.addEventListener('click',()=>select(row.id));item.append(button);fragment.append(item);
  }
  $('request-list').replaceChildren(fragment);$('list-empty').hidden=visible.length>0;
  $('list-empty').textContent=search?'ไม่พบรายการที่ตรงกับคำค้น':'ยังไม่มี request เข้ามา';
}
function renderPayload() {
  if(!record)return;
  $('payload').textContent=JSON.stringify(record[tab],null,2);
  $('export-request').href=`/api/requests/${record.id}/export`;
  $('payload-label').textContent=tab==='body'?record.kind.toUpperCase():'JSON';
  $('payload').setAttribute('aria-labelledby',`tab-${tab}`);
  for(const button of document.querySelectorAll('[data-tab]'))button.setAttribute('aria-selected',String(button.dataset.tab===tab));
}
async function select(id) {
  selected=id;renderList();$('error').hidden=true;
  try {
    const data=await json(`/api/requests/${id}`);
    if(selected!==id)return;
    record=data;$('welcome').hidden=true;$('detail').hidden=false;
    $('detail-title').textContent=`Request #${record.id}`;
    $('detail-method').textContent=record.method;$('detail-method').className=`method method-${record.method.toLowerCase()}`;
    $('detail-time').textContent=new Date(record.receivedAt).toLocaleString('th-TH',{hour12:false});
    $('detail-size').textContent=`${record.bytes.toLocaleString()} bytes`;$('detail-kind').textContent=record.kind;
    renderPayload();
  }catch(error){if(selected===id){record=null;$('detail').hidden=true;$('welcome').hidden=false;fail(error);}}
}
async function refresh() {
  if(loading)return;loading=true;
  try {
    if(!info){info=await json('/api/info');$('capture-url').value=info.captureUrl;$('copy-url').disabled=false;
      $('curl-example').textContent=`curl -X POST '${info.captureUrl}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"event":"hello","source":"n8n"}'`;
    }
    const result=await json('/api/requests');rows=result.requests;
    const signature=rows.map(row=>row.id).join(',');
    if(signature!==lastSignature){lastSignature=signature;renderList();}
    if(selected!==null&&!rows.some(row=>row.id===selected)){selected=null;record=null;$('detail').hidden=true;$('welcome').hidden=false;renderList();}
    $('connection').textContent='พร้อมรับข้อมูล';$('connection').classList.remove('offline');$('send-demo').disabled=demoBusy;
    if(!selected&&rows.length)await select(rows[0].id);
  }catch(error){$('connection').textContent='ออฟไลน์';$('connection').classList.add('offline');$('send-demo').disabled=true;fail(error);}
  finally{loading=false;}
}
async function copy(text,notice) {try{await navigator.clipboard.writeText(text);notify(notice);}catch{fail(new Error('คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความแล้วคัดลอกเอง'));}}
$('copy-url').addEventListener('click',()=>copy(info.captureUrl,'คัดลอก URL แล้ว'));
$('copy-payload').addEventListener('click',()=>record&&copy(JSON.stringify(record[tab],null,2),'คัดลอกข้อมูลแล้ว'));
$('search').addEventListener('input',renderList);$('refresh').addEventListener('click',()=>{ $('error').hidden=true;void refresh(); });
for(const button of document.querySelectorAll('[data-tab]'))button.addEventListener('click',()=>{tab=button.dataset.tab;renderPayload();});
$('send-demo').addEventListener('click',async()=>{
  if(!info||demoBusy)return;demoBusy=true;$('send-demo').disabled=true;$('send-demo').textContent='กำลังส่ง…';$('error').hidden=true;
  try{const result=await json(info.captureUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':'demo-key-not-a-real-secret'},body:JSON.stringify({event:'order.created',source:'hooklab-demo',order:{id:'DEMO-001',total:399,currency:'THB'},customer:{name:'Demo User',access_token:'example-token'}})});await refresh();await select(result.id);notify(`รับตัวอย่างแล้ว · request #${result.id}`);}
  catch(error){fail(error);}finally{demoBusy=false;$('send-demo').disabled=false;$('send-demo').textContent='↗ ส่งตัวอย่าง';}
});
void refresh();setInterval(()=>{if(!document.hidden)void refresh();},2000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});

